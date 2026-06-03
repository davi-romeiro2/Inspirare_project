-- 001_profiles.sql
-- Migration da tabela `profiles` (auth helpers, RLS, triggers).
-- Rode no SQL Editor do Supabase.
--
-- Comportamento:
--   * Se a tabela `public.profiles` ainda nao existe: cria do zero com o
--     CHECK de 3 valores (user, admin, funcionario).
--   * Se ja existe: preserva os dados e so atualiza o CHECK constraint de
--     `role` para aceitar os 3 valores (drop + add). Demais objetos
--     (funcoes, triggers, policies, indice) sao reescritos de forma
--     idempotente.
--
-- O script e idempotente: os `drop ... if exists` e `create or replace`
-- garantem que re-rodar nao quebra. Funcoes e triggers sao recriados;
-- policies de RLS tambem.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  fullname    text not null check (char_length(fullname) between 2 and 120),
  phone       text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 11),
  role        text not null default 'user' check (role in ('user', 'admin', 'funcionario')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Garante que, se a tabela ja existia com o CHECK antigo de 2 valores,
-- o CHECK agora aceite os 3. drop constraint pelo nome que o Postgres gera
-- para CHECK inline (profiles_role_check). Se a tabela nao existia, o drop
-- e um no-op.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'funcionario'));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, fullname, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'fullname', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create index if not exists idx_profiles_role on public.profiles (role);
