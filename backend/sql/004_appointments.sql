-- 004_appointments.sql
-- Tabela de agendamentos (consultas marcadas pelos usuarios).
-- User-facing: create/list/cancel dos PROPRIOS appointments.
-- Professionals = qualquer profile com role IN ('admin','funcionario').
-- Idempotente. Rode no SQL Editor do Supabase.
--
-- Dependencias:
--   * public.profiles      (criada em 001_profiles.sql)
--   * public.set_updated_at() (criada em 001_profiles.sql)

create table if not exists public.appointments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  professional_id      uuid not null references public.profiles(id) on delete restrict,
  -- Snapshot do plano no momento do agendamento. Sem FK porque o admin
  -- pode editar/desativar/deletar planos custom; queremos preservar o
  -- historico de consultas marcadas mesmo se o plano original deixar
  -- de existir.
  plan_slug            text not null,
  plan_title           text not null,
  plan_price_snapshot  numeric(10,2) not null check (plan_price_snapshot >= 0),
  -- 'YYYY-MM-DD' no fuso do cliente. Guardado como text para evitar
  -- pegadinhas de timezone do timestamptz. Validacao fica no backend.
  date_key             text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  -- 'HH:MM' (24h, zero-padded). Slot de 1h; validado no backend.
  time_slot            text not null check (time_slot ~ '^\d{2}:\d{2}$'),
  modality             text not null check (modality in ('online','presencial')),
  status               text not null default 'scheduled'
                        check (status in ('scheduled','completed','cancelled')),
  payment_method       text not null check (payment_method in ('pix','card')),
  cancel_reason        text,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Indices: a query principal eh "todos os appointments do user, agrupados
-- por status, ordenados por data". O indice composto cobre o filtro
-- + o order by.
create index if not exists idx_appointments_user_status
  on public.appointments (user_id, status, date_key desc);

-- Para o futuro endpoint de "consultas marcadas com o profissional X".
create index if not exists idx_appointments_professional
  on public.appointments (professional_id, date_key);

-- Reusa a funcao public.set_updated_at() criada em 001_profiles.sql.
drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- RLS
-- O backend usa o service role key e bypassa RLS. As checagens de
-- propriedade (user so ve os proprios appointments) ficam no Express.
-- Mesmo assim habilitamos RLS com policies restritivas como defesa em
-- profundidade: se algum dia o frontend usar a anon key direto, o
-- RLS barra. As policies "FOR SELECT/INSERT" ficam disponiveis para
-- uma futura migracao ao client-side SDK; por enquanto as writes
-- vem so do service role.
alter table public.appointments enable row level security;

drop policy if exists "appointments_user_read_own" on public.appointments;
create policy "appointments_user_read_own" on public.appointments
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "appointments_user_insert_own" on public.appointments;
create policy "appointments_user_insert_own" on public.appointments
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Sem policies de UPDATE/DELETE para 'authenticated': o cancelamento
-- (UPDATE status='cancelled') e feito pelo backend via service role.
-- Nao queremos que o client consiga flipar status arbitrariamente.
