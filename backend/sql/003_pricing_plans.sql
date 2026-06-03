-- 003_pricing_plans.sql
-- Tabela de planos (precos) editaveis pelo admin, lidos pelo user.
-- 2 planos fixos seed (avulsa, mensal) nao podem ser deletados, so editados.
-- Planos custom (criados via modal "Novo Plano" no admin) podem ser desativados/deletados.
-- Rode no SQL Editor do Supabase. Idempotente.

create table if not exists public.pricing_plans (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  title                    text not null,
  icon                     text not null default 'stethoscope',
  base_price               numeric(10,2) not null check (base_price >= 0),
  consultations_per_month  int not null default 1 check (consultations_per_month >= 1),
  discount_active          boolean not null default false,
  discount_percent         numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_start           date,
  discount_end             date,
  is_fixed                 boolean not null default false,
  active                   boolean not null default true,
  display_order            int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

insert into public.pricing_plans
  (slug, title, icon, base_price, consultations_per_month, is_fixed, display_order)
values
  ('avulsa', 'Consulta Avulsa', 'stethoscope', 55.00, 1, true, 0),
  ('mensal', 'Plano Mensal',    'calendar-days', 450.00, 4, true, 1)
on conflict (slug) do nothing;

create index if not exists idx_pricing_plans_order
  on public.pricing_plans (display_order)
  where active;

drop trigger if exists trg_pricing_plans_updated_at on public.pricing_plans;
create trigger trg_pricing_plans_updated_at
  before update on public.pricing_plans
  for each row execute function public.set_updated_at();

-- RLS
alter table public.pricing_plans enable row level security;

drop policy if exists "pricing_plans_read_all" on public.pricing_plans;
create policy "pricing_plans_read_all" on public.pricing_plans
  for select to authenticated, anon
  using (true);

-- Service role (backend com SUPABASE_SERVICE_ROLE_KEY) bypassa RLS,
-- mas a checagem de role continua sendo feita no Express via requireRole('admin').
-- Esta policy e uma camada extra de defesa em profundidade: se o backend
-- algum dia esquecer a checagem, o RLS ainda barra.
drop policy if exists "pricing_plans_admin_write" on public.pricing_plans;
create policy "pricing_plans_admin_write" on public.pricing_plans
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
