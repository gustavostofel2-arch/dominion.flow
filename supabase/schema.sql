-- =====================================================================
-- dominion.flow — schema completo (licenciamento + Lastlink)
-- Rode este arquivo inteiro no Supabase: Dashboard → SQL Editor → New query
-- É idempotente: pode rodar de novo sem apagar nada. Serve tanto para um
-- banco novo quanto para atualizar o banco da versão anterior.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Assinaturas — UMA LINHA POR EMAIL DE COMPRA
--    A linha nasce quando a Lastlink avisa a compra (antes de existir conta).
--    Quando a pessoa cria o acesso no site, a conta é ligada pelo email.
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  email                    text not null,
  user_id                  uuid references auth.users (id) on delete set null,
  status                   text not null default 'inactive'
                             check (status in ('active', 'inactive')),
  plan                     text,
  -- Acesso vale até esta data (mesmo com status 'active'). Vazio = sem prazo.
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Migração da versão anterior (onde user_id era a chave primária).
do $$
declare
  v_pk_cols text;
  v_con     text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'id') then
    alter table public.subscriptions add column id uuid default gen_random_uuid();
    update public.subscriptions set id = gen_random_uuid() where id is null;
    alter table public.subscriptions alter column id set not null;
  end if;

  select string_agg(a.attname, ',') into v_pk_cols
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.subscriptions'::regclass and c.contype = 'p';

  if v_pk_cols is distinct from 'id' then
    if v_pk_cols is not null then
      select conname into v_con from pg_constraint
       where conrelid = 'public.subscriptions'::regclass and contype = 'p';
      execute format('alter table public.subscriptions drop constraint %I', v_con);
    end if;
    alter table public.subscriptions add primary key (id);
  end if;

  alter table public.subscriptions alter column user_id drop not null;

  -- FK do user_id: apagar o usuário não apaga a assinatura (só desliga a conta).
  for v_con in
    select conname from pg_constraint
     where conrelid = 'public.subscriptions'::regclass and contype = 'f'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = 'public.subscriptions'::regclass and attname = 'user_id')]
       and confdeltype <> 'n'
  loop
    execute format('alter table public.subscriptions drop constraint %I', v_con);
  end loop;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.subscriptions'::regclass and contype = 'f'
                    and conkey = array[(select attnum from pg_attribute
                                         where attrelid = 'public.subscriptions'::regclass and attname = 'user_id')]) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_fkey foreign key (user_id)
      references auth.users (id) on delete set null;
  end if;
end;
$$;

alter table public.subscriptions add column if not exists email text;

-- Dados do comprador e da assinatura vindos da Lastlink.
alter table public.subscriptions add column if not exists name                     text;
alter table public.subscriptions add column if not exists phone                    text;
alter table public.subscriptions add column if not exists document                 text;
alter table public.subscriptions add column if not exists address                  jsonb;
alter table public.subscriptions add column if not exists source                   text not null default 'manual';
alter table public.subscriptions add column if not exists lastlink_buyer_id        text;
alter table public.subscriptions add column if not exists lastlink_subscription_id text;
alter table public.subscriptions add column if not exists lastlink_product_id      text;
alter table public.subscriptions add column if not exists lastlink_offer_id        text;
alter table public.subscriptions add column if not exists payment_method           text;
alter table public.subscriptions add column if not exists last_payment_at          timestamptz;
alter table public.subscriptions add column if not exists last_payment_amount      numeric(12, 2);
alter table public.subscriptions add column if not exists recurrency               integer;
alter table public.subscriptions add column if not exists cancel_at_period_end     boolean not null default false;
alter table public.subscriptions add column if not exists canceled_at              timestamptz;
alter table public.subscriptions add column if not exists cancellation_reason      text;
alter table public.subscriptions add column if not exists refunded_at              timestamptz;
alter table public.subscriptions add column if not exists chargeback_at            timestamptz;
alter table public.subscriptions add column if not exists renewal_pending          boolean not null default false;
-- Próxima cobrança (igual ao "Renova em" da Lastlink). O acesso vai até ela + tolerância.
alter table public.subscriptions add column if not exists next_billing_at          timestamptz;
alter table public.subscriptions add column if not exists last_event               text;
alter table public.subscriptions add column if not exists last_event_at            timestamptz;
-- Data do último evento que mudou o status (para ignorar avisos fora de ordem).
alter table public.subscriptions add column if not exists status_event_at          timestamptz;

-- Email sempre minúsculo e preenchido (completa a partir do login, se faltar).
update public.subscriptions s
   set email = lower(trim(u.email))
  from auth.users u
 where u.id = s.user_id and (s.email is null or s.email = '');
update public.subscriptions set email = lower(trim(email)) where email <> lower(trim(email));
delete from public.subscriptions where email is null or email = '';
alter table public.subscriptions alter column email set not null;

-- Assinaturas da Lastlink criadas antes da coluna next_billing_at: recalcula
-- (renovação = último pagamento + 1 mês; acesso = renovação + 3 dias, ou só a renovação se cancelou).
update public.subscriptions
   set current_period_end = last_payment_at + interval '1 month'
                            + case when cancel_at_period_end then interval '0' else interval '3 days' end
 where next_billing_at is null and source = 'lastlink' and last_payment_at is not null;
update public.subscriptions
   set next_billing_at = last_payment_at + interval '1 month'
 where next_billing_at is null and source = 'lastlink' and last_payment_at is not null;

create unique index if not exists subscriptions_email_key   on public.subscriptions (email);
create unique index if not exists subscriptions_user_id_key on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- Usuário logado só LÊ a própria linha. Ninguém de fora lê nada.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Só o service_role (servidor) e o painel escrevem.
revoke insert, update, delete on public.subscriptions from anon, authenticated;

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

-- Conta criada → liga à assinatura do mesmo email (ou cria uma linha inativa).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (email, user_id)
  values (lower(trim(new.email)), new.id)
  on conflict (email) do update
    set user_id = excluded.user_id
    where public.subscriptions.user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Email do login trocado → acompanha (se o novo email já tiver outra linha, não mexe).
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.subscriptions set email = lower(trim(new.email)) where user_id = new.id;
  exception when unique_violation then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Contas que já existiam também ganham (ou ligam) sua linha.
insert into public.subscriptions (email, user_id)
select lower(trim(email)), id from auth.users where email is not null
on conflict (email) do update
  set user_id = excluded.user_id
  where public.subscriptions.user_id is null;

-- ---------------------------------------------------------------------
-- 2. Log de ativações (cada token gerado)
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

alter table public.activation_logs enable row level security;
revoke all on public.activation_logs from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Eventos recebidos da Lastlink (auditoria + anti-duplicado)
--    Guarda o aviso COMPLETO (payload) de cada evento, com o resultado.
-- ---------------------------------------------------------------------
create table if not exists public.webhook_events (
  id               text primary key,               -- "Id" do evento na Lastlink
  provider         text not null default 'lastlink',
  event            text not null,
  is_test          boolean not null default false,
  email            text,
  event_created_at timestamptz,
  received_at      timestamptz not null default now(),
  result           text not null,
  meta             jsonb,
  payload          jsonb not null
);

create index if not exists webhook_events_email_idx    on public.webhook_events (email, received_at desc);
create index if not exists webhook_events_received_idx on public.webhook_events (received_at desc);

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Processamento dos eventos da Lastlink
--    Tudo numa transação: grava o evento, ignora duplicado, atualiza a
--    assinatura. Se der erro, nada fica gravado e a Lastlink pode reenviar.
-- ---------------------------------------------------------------------

-- Datas da Lastlink vêm em UTC, às vezes sem "Z".
create or replace function public.lastlink_ts(p text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  if p ~ '(Z|z|[+-]\d{2}(:?\d{2})?)$' then
    return p::timestamptz;
  end if;
  return (p || 'Z')::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.process_lastlink_event(p_payload jsonb, p_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id          text := p_payload->>'Id';
  v_event       text := p_payload->>'Event';
  -- A Lastlink escreve alguns nomes com grafias diferentes (ex.: Product_access_started,
  -- Subscription_Product_Acess): a classificação usa o nome em minúsculas.
  v_ev          text := lower(btrim(coalesce(p_payload->>'Event', '')));
  v_test        boolean := coalesce((p_payload->>'IsTest')::boolean, false);
  v_data        jsonb := coalesce(p_payload->'Data', '{}'::jsonb);
  v_created     timestamptz := coalesce(public.lastlink_ts(p_payload->>'CreatedAt'), now());
  -- Período pago (mensal = 1 mês de calendário, igual à Lastlink) e tolerância para a renovação cair.
  v_period      interval := make_interval(months => coalesce((p_options->>'access_months')::int, 1));
  v_grace       interval := make_interval(days => coalesce((p_options->>'grace_days')::int, 3));
  v_next        timestamptz;
  v_apply_test  boolean := coalesce((p_options->>'apply_test')::boolean, false);
  v_products    text[] := coalesce(array(select jsonb_array_elements_text(p_options->'product_ids')), '{}');
  v_email       text;
  v_sub_id      text;
  v_event_prods text[];
  v_action      text;
  v_kind        text;
  v_paid_at     timestamptz;
  v_end         timestamptz;
  v_row         public.subscriptions%rowtype;
  v_result      text;
begin
  if v_id is null or v_event is null then
    raise exception 'payload sem Id ou Event';
  end if;

  v_email := nullif(lower(btrim(coalesce(v_data#>>'{Buyer,Email}', v_data#>>'{Member,Email}'))), '');
  v_sub_id := coalesce(v_data#>>'{Subscriptions,0,Id}', v_data#>>'{Subscription,Id}', v_data->>'SubscriptionId');
  v_action := lower(coalesce(v_data->>'Action', ''));

  -- Anti-duplicado: a mesma notificação só é processada uma vez.
  insert into public.webhook_events (id, event, is_test, email, event_created_at, result, meta, payload)
  values (v_id, v_event, v_test, v_email, v_created, 'processing', p_options->'meta', p_payload)
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('result', 'duplicate');
  end if;

  -- Classificação do evento.
  v_kind := case
    when v_ev in ('purchase_order_confirmed', 'recurrent_payment') then 'payment'
    when v_ev = 'product_access_started'
      or (v_ev in ('subscription_product_access', 'subscription_product_acess') and v_action = 'add') then 'access_add'
    when v_ev in ('subscription_expired', 'payment_refund', 'payment_chargeback', 'product_access_ended')
      or (v_ev in ('subscription_product_access', 'subscription_product_acess') and v_action = 'remove') then 'revoke'
    when v_ev in ('subscription_canceled', 'subscription_cancelled') then 'cancel'
    when v_ev = 'subscription_renewal_pending' then 'renewal_pending'
    when v_ev in ('purchase_request_confirmed', 'purchase_request_canceled', 'purchase_request_expired',
                  'refund_requested', 'refund_period_over', 'active_member_notification') then 'info'
    else 'log_only'  -- Abandoned_Cart e eventos desconhecidos
  end;

  -- Filtro de produto (se configurado): ignora vendas de outros produtos.
  if array_length(v_products, 1) > 0 then
    v_event_prods := array(
      select x from (
        select jsonb_array_elements(coalesce(v_data->'Products', '[]'::jsonb))->>'Id' as x
        union all select v_data#>>'{Product,Id}'
        union all select jsonb_array_elements(coalesce(v_data->'Subscriptions', '[]'::jsonb))->>'ProductId'
        union all select v_data#>>'{Subscription,ProductId}'
      ) t where x is not null);
    if not (v_event_prods && v_products) then
      v_result := 'ignored_other_product';
    end if;
  end if;

  if v_result is null and v_test and not v_apply_test then
    v_result := 'test_ignored';
  end if;
  if v_result is null and v_kind = 'log_only' then
    v_result := 'logged';
  end if;
  if v_result is null and v_email is null then
    v_result := 'no_email';
  end if;

  if v_result is null then
    insert into public.subscriptions (email, source) values (v_email, 'lastlink')
    on conflict (email) do nothing;
    select * into v_row from public.subscriptions where email = v_email for update;

    -- Dados de contato e oferta (sempre que vierem).
    update public.subscriptions set
      name                = coalesce(nullif(v_data#>>'{Buyer,Name}', ''), name),
      phone               = coalesce(nullif(v_data#>>'{Buyer,PhoneNumber}', ''), phone),
      document            = coalesce(nullif(v_data#>>'{Buyer,Document}', ''), document),
      address             = coalesce(v_data#>'{Buyer,Address}', address),
      lastlink_buyer_id   = coalesce(v_data#>>'{Buyer,Id}', v_data#>>'{Member,Id}', lastlink_buyer_id),
      lastlink_offer_id   = coalesce(v_data#>>'{Offer,Id}', lastlink_offer_id),
      lastlink_product_id = coalesce(v_data#>>'{Products,0,Id}', v_data#>>'{Product,Id}', lastlink_product_id),
      plan                = coalesce(nullif(v_data#>>'{Offer,Name}', ''), plan),
      source              = 'lastlink',
      last_event          = v_event,
      last_event_at       = v_created
    where id = v_row.id;

    if v_kind in ('info') then
      v_result := 'contact_updated';

    elsif v_kind = 'renewal_pending' then
      update public.subscriptions set renewal_pending = true where id = v_row.id;
      v_result := 'renewal_pending';

    -- A partir daqui o evento muda o status: avisos mais antigos que o último aplicado são ignorados.
    elsif v_row.status_event_at is not null and v_created < v_row.status_event_at then
      v_result := 'stale_ignored';

    elsif v_kind = 'payment' then
      v_paid_at := coalesce(public.lastlink_ts(v_data#>>'{Purchase,PaymentDate}'), v_created);
      -- Usa a próxima cobrança informada pela Lastlink, se vier; senão, pagamento + 1 mês.
      v_next := coalesce(public.lastlink_ts(v_data#>>'{Subscriptions,0,NextBilling}'), v_paid_at + v_period);
      v_end := v_next + v_grace;
      update public.subscriptions set
        status                   = 'active',
        next_billing_at          = v_next,
        current_period_end       = v_end,
        lastlink_subscription_id = coalesce(v_sub_id, lastlink_subscription_id),
        last_payment_at          = v_paid_at,
        last_payment_amount      = coalesce((v_data#>>'{Purchase,Price,Value}')::numeric, last_payment_amount),
        payment_method           = coalesce(v_data#>>'{Purchase,Payment,PaymentMethod}', payment_method),
        recurrency               = coalesce((v_data#>>'{Purchase,Recurrency}')::int, recurrency),
        cancel_at_period_end     = false,
        canceled_at              = null,
        cancellation_reason      = null,
        renewal_pending          = false,
        status_event_at          = v_created
      where id = v_row.id;
      v_result := 'activated';

    elsif v_kind = 'access_add' then
      update public.subscriptions set
        status                   = 'active',
        next_billing_at          = case when current_period_end is not null and current_period_end < now()
                                        then now() + v_period else next_billing_at end,
        current_period_end       = case when current_period_end is not null and current_period_end < now()
                                        then now() + v_period + v_grace else current_period_end end,
        lastlink_subscription_id = coalesce(v_sub_id, lastlink_subscription_id),
        status_event_at          = v_created
      where id = v_row.id;
      v_result := 'activated';

    -- Evento de outra assinatura (ex.: a pessoa comprou de novo): não derruba a atual.
    elsif v_sub_id is not null and v_row.lastlink_subscription_id is not null
          and v_sub_id <> v_row.lastlink_subscription_id then
      v_result := 'other_subscription_ignored';

    elsif v_kind = 'cancel' then
      -- Cancelou a renovação: mantém o acesso até o fim do período já pago.
      update public.subscriptions set
        cancel_at_period_end = true,
        canceled_at          = coalesce(public.lastlink_ts(v_data#>>'{Subscriptions,0,CanceledDate}'), v_created),
        cancellation_reason  = v_data#>>'{Subscriptions,0,CancellationReason}',
        -- Sem renovação, não há tolerância: o acesso vai até o fim do período pago.
        current_period_end   = coalesce(next_billing_at, last_payment_at + v_period, current_period_end, now()),
        status_event_at      = v_created
      where id = v_row.id;
      v_result := 'cancel_scheduled';

    elsif v_kind = 'revoke' then
      update public.subscriptions set
        status          = 'inactive',
        refunded_at     = case when v_ev = 'payment_refund' then v_created else refunded_at end,
        chargeback_at   = case when v_ev = 'payment_chargeback'
                               then coalesce(public.lastlink_ts(v_data#>>'{Purchase,ChargebackDate}'), v_created)
                               else chargeback_at end,
        renewal_pending = false,
        status_event_at = v_created
      where id = v_row.id;
      v_result := 'deactivated';
    end if;
  end if;

  update public.webhook_events set result = v_result where id = v_id;

  select * into v_row from public.subscriptions where email = v_email;
  return jsonb_build_object(
    'result', v_result,
    'email', v_email,
    'status', v_row.status,
    'current_period_end', v_row.current_period_end,
    'next_billing_at', v_row.next_billing_at
  );
end;
$$;

revoke all on function public.process_lastlink_event(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.process_lastlink_event(jsonb, jsonb) to service_role;


-- =====================================================================
-- COMANDOS ÚTEIS DO DIA A DIA (não rode junto — copie quando precisar)
-- =====================================================================

-- Ver clientes:
-- select email, name, phone, status, current_period_end, cancel_at_period_end,
--        last_event, last_event_at, user_id is not null as tem_conta
--   from public.subscriptions order by updated_at desc;

-- Últimos avisos da Lastlink (e o que o sistema fez com cada um):
-- select received_at, event, email, result, is_test from public.webhook_events
--  order by received_at desc limit 50;

-- Ativar manualmente por 30 dias (cortesia, suporte):
-- update public.subscriptions
--    set status = 'active', current_period_end = now() + interval '30 days'
--  where email = 'cliente@email.com';

-- Liberar acesso para alguém que ainda não comprou (cria a linha):
-- insert into public.subscriptions (email, status, current_period_end, plan)
-- values ('cliente@email.com', 'active', now() + interval '30 days', 'cortesia')
-- on conflict (email) do update set status = 'active', current_period_end = excluded.current_period_end;

-- Desativar:
-- update public.subscriptions set status = 'inactive' where email = 'cliente@email.com';

-- Redefinir a senha de um cliente (até configurar o Resend):
-- update auth.users
--    set encrypted_password = extensions.crypt('SenhaNova123', extensions.gen_salt('bf'))
--  where email = 'cliente@email.com';

-- Suspeita de compartilhamento (últimos 7 dias):
-- select s.email, count(*) as tokens, count(distinct l.ip) as ips
--   from public.activation_logs l join public.subscriptions s on s.user_id = l.user_id
--  where l.created_at > now() - interval '7 days'
--  group by s.email order by tokens desc;
