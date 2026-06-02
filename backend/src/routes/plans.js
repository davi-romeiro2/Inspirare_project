// Pricing plans routes: list (public), read-by-slug (public),
// create / patch / delete (admin only).
//
// The 2 fixed plans (avulsa, mensal) cannot be deleted and have their
// `slug` and `is_fixed` fields locked.

import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { HttpError } from '../lib/errors.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const EDITABLE_FIELDS = [
  'title', 'icon', 'base_price', 'consultations_per_month',
  'discount_active', 'discount_percent', 'discount_start', 'discount_end',
  'active', 'display_order',
];

function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function validatePrice(price) {
  if (typeof price !== 'number' || isNaN(price) || price < 0) {
    throw new HttpError(400, 'validation_error', 'base_price must be a non-negative number');
  }
}

function validateConsultations(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, 'validation_error', 'consultations_per_month must be an integer >= 1');
  }
}

function validateDiscount(percent, start, end) {
  if (typeof percent !== 'number' || isNaN(percent) || percent < 0 || percent > 100) {
    throw new HttpError(400, 'validation_error', 'discount_percent must be between 0 and 100');
  }
  if (start && end && start > end) {
    throw new HttpError(400, 'validation_error', 'discount_end must be on or after discount_start');
  }
}

/**
 * GET /api/plans
 * Public. Returns active plans ordered by display_order.
 * (For now we return ALL plans including inactive; the user UI filters.)
 */
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('id, slug, title, icon, base_price, consultations_per_month, discount_active, discount_percent, discount_start, discount_end, is_fixed, active, display_order, created_at, updated_at')
      .order('display_order', { ascending: true });
    if (error) throw new HttpError(500, 'fetch_failed', error.message);
    res.json({ plans: data || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/plans/:slug
 * Public. Returns a single plan by slug.
 */
router.get('/:slug', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('id, slug, title, icon, base_price, consultations_per_month, discount_active, discount_percent, discount_start, discount_end, is_fixed, active, display_order, created_at, updated_at')
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) throw new HttpError(500, 'fetch_failed', error.message);
    if (!data) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado.');
    res.json({ plan: data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/plans
 * Admin only. Creates a new plan. Slug is auto-generated from title if absent.
 */
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = (body.title ?? '').toString().trim();
    if (!title) throw new HttpError(400, 'validation_error', 'title is required');

    const icon = (body.icon ?? 'stethoscope').toString();
    const basePrice = Number(body.base_price);
    const consultationsPerMonth = Number(body.consultations_per_month);
    validatePrice(basePrice);
    validateConsultations(consultationsPerMonth);

    const discountActive = Boolean(body.discount_active);
    const discountPercent = Number(body.discount_percent || 0);
    const discountStart = body.discount_start || null;
    const discountEnd = body.discount_end || null;
    validateDiscount(discountPercent, discountStart, discountEnd);

    const slug = (body.slug ? String(body.slug) : slugify(title)) || `plan-${Date.now()}`;

    const { data, error } = await supabase
      .from('pricing_plans')
      .insert({
        slug,
        title,
        icon,
        base_price: basePrice,
        consultations_per_month: consultationsPerMonth,
        discount_active: discountActive,
        discount_percent: discountPercent,
        discount_start: discountStart,
        discount_end: discountEnd,
        is_fixed: false,
        active: body.active !== false,
        display_order: Number.isFinite(Number(body.display_order)) ? Number(body.display_order) : 999,
      })
      .select()
      .single();
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        throw new HttpError(409, 'slug_taken', `Já existe um plano com slug "${slug}".`);
      }
      throw new HttpError(500, 'create_failed', error.message);
    }
    res.status(201).json({ plan: data });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/plans/:id
 * Admin only. Updates an existing plan. Locked fields for is_fixed plans:
 *   - slug (cannot change)
 *   - is_fixed (cannot change)
 */
router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = req.body || {};

    // Fetch current to know if it's fixed.
    const { data: current, error: curErr } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (curErr) throw new HttpError(500, 'fetch_failed', curErr.message);
    if (!current) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado.');

    if (current.is_fixed) {
      if (body.slug && body.slug !== current.slug) {
        throw new HttpError(400, 'fixed_plan_immutable', 'Não é possível alterar o slug de um plano fixo.');
      }
      if ('is_fixed' in body && body.is_fixed !== current.is_fixed) {
        throw new HttpError(400, 'fixed_plan_immutable', 'Não é possível alterar o flag is_fixed de um plano fixo.');
      }
    }

    const update = {};
    for (const f of EDITABLE_FIELDS) {
      if (f in body) update[f] = body[f];
    }
    // Coerce numeric fields.
    if ('base_price' in update) {
      update.base_price = Number(update.base_price);
      validatePrice(update.base_price);
    }
    if ('consultations_per_month' in update) {
      update.consultations_per_month = Number(update.consultations_per_month);
      validateConsultations(update.consultations_per_month);
    }
    if ('discount_percent' in update || 'discount_start' in update || 'discount_end' in update) {
      validateDiscount(
        Number(update.discount_percent ?? current.discount_percent),
        update.discount_start ?? current.discount_start,
        update.discount_end ?? current.discount_end
      );
    }
    if ('display_order' in update) {
      update.display_order = Number(update.display_order);
    }
    if (current.is_fixed && 'active' in update && !update.active) {
      // Allow deactivating a fixed plan? You said "can edit, can disable".
      // We'll allow it. If the user complains, change to 400.
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new HttpError(500, 'update_failed', error.message);
    res.json({ plan: data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/plans/:id
 * Admin only. Refuses to delete fixed plans.
 */
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { data: current, error: curErr } = await supabase
      .from('pricing_plans')
      .select('is_fixed, slug')
      .eq('id', id)
      .maybeSingle();
    if (curErr) throw new HttpError(500, 'fetch_failed', curErr.message);
    if (!current) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado.');
    if (current.is_fixed) {
      throw new HttpError(409, 'cannot_delete_fixed_plan',
        `O plano "${current.slug}" é fixo e não pode ser deletado. Desative-o em vez disso.`);
    }
    const { error } = await supabase
      .from('pricing_plans')
      .delete()
      .eq('id', id);
    if (error) throw new HttpError(500, 'delete_failed', error.message);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
