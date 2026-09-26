-- =====================================================================
-- dominion.flow — schema do licenciamento FlowSpace
-- Rode este arquivo inteiro no Supabase: Dashboard → SQL Editor → New query
-- É idempotente: pode rodar de novo sem quebrar nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Assinaturas (uma linha por usuário)
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  status             text not null default 'inactive'
                       check (status in ('active', 'inactive')),
  plan               text,
  -- Opcional: se preenchido, a assinatura deixa de valer depois dessa data,
  -- mesmo com status = 'active'. Útil para venda manual mensal (sem Stripe).
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Usuário logado só LÊ a própria linha.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Nenhuma policy de insert/update/delete: só o service_role (que ignora RLS)
-- escreve. O revoke abaixo é uma segunda camada de proteção.
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- Mantém updated_at sempre atualizado.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Cria automaticamente uma linha 'inactive' quando alguém se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existiam antes deste script também ganham uma linha.
insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Log de ativações (auditoria + limite de uso)
--    Cada token gerado vira uma linha. Serve para você ver quem está
--    gerando tokens demais (sinal de conta compartilhada).
-- ---------------------------------------------------------------------
create table if not exists public.activation_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  challenge  text not null,
  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists activation_logs_user_created_idx
  on public.activation_logs (user_id, created_at desc);

-- RLS ligado e SEM policies: ninguém além do service_role acessa.
alter table public.activation_logs enable row level security;
revoke all on public.activation_logs from anon, authenticated;


-- =====================================================================
-- COMANDOS ÚTEIS DO DIA A DIA (não rode junto — copie quando precisar)
-- =====================================================================

-- Ativar um cliente por 30 dias (troque o email):
-- update public.subscriptions s
--    set status = 'active', plan = 'mensal', current_period_end = now() + interval '30 days'
--   from auth.users u
--  where u.id = s.user_id and u.email = 'cliente@email.com';

-- Desativar um cliente:
-- update public.subscriptions s
--    set status = 'inactive'
--   from auth.users u
--  where u.id = s.user_id and u.email = 'cliente@email.com';

-- Ver todos os clientes e status:
-- select u.email, s.status, s.plan, s.current_period_end, s.updated_at
--   from public.subscriptions s join auth.users u on u.id = s.user_id
--  order by s.updated_at desc;

-- Quem mais gerou tokens nos últimos 7 dias:
-- select u.email, count(*) as tokens
--   from public.activation_logs l join auth.users u on u.id = l.user_id
--  where l.created_at > now() - interval '7 days'
--  group by u.email order by tokens desc;
