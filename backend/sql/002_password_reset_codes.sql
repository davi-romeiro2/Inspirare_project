-- 002_password_reset_codes.sql
-- Tabela para armazenar codigos de reset de senha (6 digitos) com hash + salt.
-- Rode no SQL Editor do Supabase. Idempotente.

create table if not exists public.password_reset_codes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  code_hash     text not null,         -- hex(sha256(code + salt))
  salt          text not null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  attempt_count int not null default 0, -- rate limit por codigo
  created_at    timestamptz not null default now()
);

-- Indice parcial: usado pela query "ache o codigo ativo mais recente deste user".
create index if not exists idx_prc_user_active
  on public.password_reset_codes (user_id, expires_at desc)
  where used_at is null;

-- Limpeza: remove codigos com mais de 24h.
-- Tolerante a tabela vazia. Roda tambem no re-run (idempotente).
delete from public.password_reset_codes
where created_at < now() - interval '24 hours';
