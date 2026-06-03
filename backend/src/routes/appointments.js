// Appointments routes: list/create/cancel for the logged-in user,
// and a public-to-authenticated list of professionals to pick from.
//
// All routes require auth (applied at the router level). Ownership checks
// are enforced in Express — the service role bypasses RLS, so we can't
// rely on Postgres policies alone for "user X only sees their own rows".

import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  validateCreateAppointment,
  validateCancelAppointment,
} from '../lib/validators.js';

const router = Router();
router.use(requireAuth);

const APPT_SELECT =
  'id, user_id, professional_id, plan_slug, plan_title, plan_price_snapshot, ' +
  'date_key, time_slot, modality, status, payment_method, ' +
  'cancel_reason, canceled_at, created_at, updated_at';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Espelha a regra de desconto do frontend (InspirarePlans.applyDiscount).
// v1: backend é a fonte da verdade do preço — se mudar a regra aqui,
// atualize também o helper no cliente.
function computePlanPrice(plan) {
  const base = Number(plan.base_price);
  if (plan.discount_active && Number(plan.discount_percent) > 0) {
    return Number((base * (1 - Number(plan.discount_percent) / 100)).toFixed(2));
  }
  return Number(base);
}

// GET /api/appointments/professionals
// Retorna todos os profiles com role admin/funcionario. Usado pelo
// step 2 do fluxo de agendamento.
router.get('/professionals', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, fullname, role')
      .in('role', ['admin', 'funcionario'])
      .order('fullname', { ascending: true });
    if (error) throw new HttpError(500, 'fetch_failed', error.message);

    const list = (data || []).map((p) => ({
      id: p.id,
      fullname: p.fullname,
      // specialty ainda não é coluna em profiles; default. Quando
      // 005_profiles_specialty.sql introduzir a coluna, trocar por
      // `p.specialty ?? 'Psicólogo(a)'`.
      specialty: 'Psicólogo(a)',
    }));
    res.json({ professionals: list });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments
// Body: { professional_id, plan_slug, date, time, modality, payment_method }
// 201 -> { appointment }
router.post('/', async (req, res, next) => {
  try {
    if (!req.profile) {
      throw new HttpError(403, 'profile_missing', 'Perfil não encontrado para este usuário.');
    }

    const v = validateCreateAppointment(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid appointment payload', v.errors);
    const { professionalId, planSlug, date, time, modality, paymentMethod } = v.data;

    // 1) Verifica que o profissional existe e tem role admin/funcionario.
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', professionalId)
      .maybeSingle();
    if (profErr) throw new HttpError(500, 'fetch_failed', profErr.message);
    if (!prof) throw new HttpError(404, 'professional_not_found', 'Profissional não encontrado.');
    if (prof.role !== 'admin' && prof.role !== 'funcionario') {
      throw new HttpError(400, 'not_a_professional', 'O usuário selecionado não é um profissional.');
    }

    // 2) Busca o plano e dá snapshot de title + price.
    const { data: plan, error: planErr } = await supabase
      .from('pricing_plans')
      .select('slug, title, base_price, discount_active, discount_percent')
      .eq('slug', planSlug)
      .eq('active', true)
      .maybeSingle();
    if (planErr) throw new HttpError(500, 'fetch_failed', planErr.message);
    if (!plan) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado ou inativo.');

    const price = computePlanPrice(plan);

    // 3) INSERT.
    const { data: appointment, error: insErr } = await supabase
      .from('appointments')
      .insert({
        user_id: req.profile.id,
        professional_id: professionalId,
        plan_slug: plan.slug,
        plan_title: plan.title,
        plan_price_snapshot: price,
        date_key: date,
        time_slot: time,
        modality,
        payment_method: paymentMethod,
        status: 'scheduled',
      })
      .select(APPT_SELECT)
      .single();
    if (insErr) throw new HttpError(500, 'create_failed', insErr.message);
    res.status(201).json({ appointment });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments?status=scheduled|completed|cancelled
//         &as=professional              -> visao do profissional (filtra por professional_id)
//         &with=patient                -> anexa {patient, patient_id} a cada appointment (2 round-trips)
// Retorna:
//   - default: appointments do usuario logado (user_id = req.profile.id)
//   - as=professional: appointments em que o usuario logado e o profissional
router.get('/', async (req, res, next) => {
  try {
    const status = (req.query.status ?? '').toString();
    if (status && !['scheduled', 'completed', 'cancelled'].includes(status)) {
      throw new HttpError(400, 'validation_error', 'status must be scheduled|completed|cancelled');
    }

    // Sem profile = sem appointments (evita vazar dados em caso de
    // trigger que falhou e não criou a row).
    if (!req.profile) {
      return res.json({ appointments: [] });
    }

    const isProfessionalView = req.query.as === 'professional';
    let q = supabase
      .from('appointments')
      .select(APPT_SELECT)
      .order('date_key', { ascending: false })
      .order('time_slot', { ascending: false });
    q = isProfessionalView
      ? q.eq('professional_id', req.profile.id)
      : q.eq('user_id', req.profile.id);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw new HttpError(500, 'fetch_failed', error.message);

    let rows = data || [];

    // with=patient: usado pela tela do admin/funcionario pra mostrar
    // o nome de quem marcou. 2 round-trips no pior caso (1 se vazio).
    if (req.query.with === 'patient' && rows.length > 0) {
      const ids = [...new Set(rows.map((a) => a.user_id).filter(Boolean))];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, fullname')
        .in('id', ids);
      if (pErr) throw new HttpError(500, 'fetch_failed', pErr.message);
      const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      for (const a of rows) {
        a.patient = byId[a.user_id]?.fullname || '—';
        a.patient_id = a.user_id;
      }
    }

    res.json({ appointments: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/cancel
// Body: { reason }   (opcional, texto livre, <= 500 chars)
// Auth: o caller precisa ser dono da consulta — pode ser o user que
// marcou OU o profissional. 200 -> { appointment }.
// 404 se não encontrado OU não pertence a nenhum dos dois
// (escolhido em vez de 403 pra não vazar a existência do recurso).
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const v = validateCancelAppointment(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid cancel payload', v.errors);

    if (!req.profile) {
      throw new HttpError(403, 'profile_missing', 'Perfil não encontrado para este usuário.');
    }

    const id = req.params.id;
    if (!UUID_RE.test(id)) {
      throw new HttpError(404, 'appointment_not_found', 'Consulta não encontrada.');
    }

    // 404-by-design: a query é escopada ao user OU ao profissional.
    // Se não retornar nada, o caller não distingue "não existe" de
    // "não é seu nem como user nem como profissional".
    const { data: existing, error: fetchErr } = await supabase
      .from('appointments')
      .select(APPT_SELECT)
      .eq('id', id)
      .or(`user_id.eq.${req.profile.id},professional_id.eq.${req.profile.id}`)
      .maybeSingle();
    if (fetchErr) throw new HttpError(500, 'fetch_failed', fetchErr.message);
    if (!existing) {
      throw new HttpError(404, 'appointment_not_found', 'Consulta não encontrada.');
    }
    if (existing.status === 'cancelled') {
      // Idempotente: recancelar devolve a mesma row.
      return res.json({ appointment: existing });
    }
    if (existing.status === 'completed') {
      throw new HttpError(
        409,
        'cannot_cancel_completed',
        'Não é possível cancelar uma consulta concluída.'
      );
    }

    // auth ja foi decidida acima pelo .or(). Aqui atualiza por id.
    const { data: updated, error: updErr } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancel_reason: v.data.reason || null,
        canceled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(APPT_SELECT)
      .single();
    if (updErr) throw new HttpError(500, 'update_failed', updErr.message);
    res.json({ appointment: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/debug
// Diagnostico: retorna o profile do caller, todas as consultas do banco
// e quais delas deveriam aparecer na visao do profissional. Use quando
// a UI mostrar "vazio" pra descobrir se eh token errado, codigo antigo
// do backend, ou consultas em outro professional_id.
// REMOVER apos debug.
router.get('/debug', async (req, res, next) => {
  try {
    if (!req.profile) {
      return res.json({
        caller: null,
        hint: 'Sem profile. Token invalido ou trigger falhou.',
      });
    }

    const debugLog = { errors: {} };
    const [byCaller, allAppts, allPros] = await Promise.all([
      supabase
        .from('appointments')
        .select(APPT_SELECT)
        .eq('professional_id', req.profile.id)
        .order('date_key', { ascending: false }),
      supabase
        .from('appointments')
        .select('id, user_id, professional_id, plan_slug, status, date_key, time_slot')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('profiles')
        .select('id, fullname, role')
        .in('role', ['admin', 'funcionario']),
    ]);
    if (byCaller.error) debugLog.errors.byCaller = byCaller.error.message;
    if (allAppts.error) debugLog.errors.allAppts = allAppts.error.message;
    if (allPros.error) debugLog.errors.allPros = allPros.error.message;

    res.json({
      caller: {
        id: req.profile.id,
        fullname: req.profile.fullname,
        role: req.profile.role,
      },
      env: {
        supabase_url: (process.env.SUPABASE_URL || '').slice(0, 40) + '...',
        key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 30) + '...',
      },
      as_professional: byCaller.data || [],
      as_professional_count: (byCaller.data || []).length,
      all_appointments: allAppts.data || [],
      all_appointments_count: (allAppts.data || []).length,
      all_professionals: allPros.data || [],
      debug_log: debugLog,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
