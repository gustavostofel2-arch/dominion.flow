import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionActive } from "@/lib/subscription";

// Só LEITURA: monta os números do painel administrativo. Nada aqui altera o banco.

const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;
const PAGE = 1000; // o Supabase devolve no máximo 1000 linhas por consulta

type SubRow = {
  email: string;
  name: string | null;
  phone: string | null;
  status: "active" | "inactive";
  plan: string | null;
  billing_period: string | null;
  source: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  cancel_at_period_end: boolean | null;
  renewal_pending: boolean | null;
  last_payment_at: string | null;
  last_payment_amount: number | string | null;
  refunded_at: string | null;
  chargeback_at: string | null;
  created_at: string;
  user_id: string | null;
};

type LogRow = { user_id: string; created_at: string; ip: string | null };

type EventRow = {
  id: string;
  event: string;
  email: string | null;
  result: string;
  is_test: boolean;
  received_at: string;
  amount: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  offer: string | null;
};

type AuthUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null };

// ---------- Formatação (feita no servidor para a tela não "piscar") ----------

/** Chave do dia no horário de Brasília (AAAA-MM-DD). */
export function dayKey(d: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(d),
  );
}
export function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ }) : null;
}
export function fmtDateTime(d: string | null | undefined) {
  return d
    ? new Date(d).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
}
export function relative(d: string | null | undefined, now = Date.now()) {
  if (!d) return null;
  const diff = now - new Date(d).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  let txt: string;
  if (min < 1) txt = "agora";
  else if (min < 60) txt = `${min} min`;
  else if (min < 60 * 24) txt = `${Math.round(min / 60)} h`;
  else {
    const days = Math.round(abs / DAY);
    txt = days === 1 ? "1 dia" : `${days} dias`;
  }
  if (txt === "agora") return txt;
  return future ? `em ${txt}` : `há ${txt}`;
}

function toNumber(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Telefone só com dígitos, com DDI 55 quando vier sem (para o link do WhatsApp). */
export function whatsappNumber(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

// ---------- Categorias de plano ----------

export type PlanCategory = "Mensal" | "Anual" | "Vitalício" | "Outros períodos" | "Liberado à mão";

function planCategory(s: SubRow): PlanCategory {
  const p = (s.billing_period ?? "").trim();
  if (p === "Vitalício") return "Vitalício";
  if (p === "Mensal") return "Mensal";
  if (p === "Anual") return "Anual";
  if (p) return "Outros períodos";
  if (s.source === "manual") return "Liberado à mão";
  return "Outros períodos";
}

function planLabel(s: SubRow) {
  return s.billing_period?.trim() || s.plan?.trim() || (s.source === "manual" ? "Manual" : "—");
}

// ---------- Leitura paginada ----------

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(typeof error === "object" && error && "message" in error ? String(error.message) : "erro");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function listAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const out: AuthUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) out.push({ id: u.id, email: u.email.toLowerCase(), created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null });
    }
    if (data.users.length < PAGE) break;
  }
  return out;
}

// ---------- Tipos entregues à tela ----------

export type ClientRow = {
  email: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  active: boolean;
  plan: string;
  category: PlanCategory;
  source: string;
  hasAccount: boolean;
  accountCreated: string | null;
  lastLogin: string | null;
  lastLoginRel: string | null;
  lastUse: string | null;
  lastUseRel: string | null;
  lastUseTs: number;
  uses30: number;
  renewal: string | null;
  accessUntil: string | null;
  boughtAt: string | null;
  boughtAtTs: number;
  amount: number | null;
  flags: string[];
  idle: boolean;
};

export type PendingRow = {
  email: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  plan: string;
  since: string | null;
  sinceDays: number | null;
};

export type AttentionItem = { email: string; name: string | null; detail: string; when: string | null };

export type DayPoint = { key: string; label: string; a: number; b: number; amount: number };

export type AdminData = {
  generatedAt: string;
  kpis: {
    active: number;
    activeLastlink: number;
    activeManual: number;
    newSales30: number;
    newSales7: number;
    newSalesToday: number;
    renewals30: number;
    revenue30: number;
    revenueToday: number;
    refunds30: number;
    refundsAmount30: number;
    chargebacks30: number;
    pending: number;
    cancelScheduled: number;
    activations7: number;
    activationsToday: number;
    activeUsers7: number;
    abandoned30: number;
  };
  byPlan: { label: PlanCategory; value: number }[];
  funnel: { label: string; value: number }[];
  salesDaily: DayPoint[];
  usageDaily: DayPoint[];
  pending: PendingRow[];
  renewSoon: AttentionItem[];
  losingAccess: AttentionItem[];
  paymentPending: AttentionItem[];
  idle: AttentionItem[];
  topUsers: { email: string; name: string | null; uses7: number; ips7: number; last: string | null; suspicious: boolean }[];
  abandoned: { email: string; name: string | null; whatsapp: string | null; offer: string | null; when: string | null }[];
  events: { id: string; event: string; email: string | null; result: string; isTest: boolean; when: string | null; amount: number | null }[];
  clients: ClientRow[];
};

// ---------- Montagem ----------

const PAYMENT_EVENTS = new Set(["purchase_order_confirmed", "recurrent_payment"]);
// Resultados de aviso que NÃO representam uma venda processada.
const NOT_COUNTED = new Set(["test_ignored", "ignored_other_product", "no_email", "processing", "stale_ignored", "duplicate"]);

export async function loadAdminData(): Promise<AdminData> {
  const admin = createAdminClient();
  const now = Date.now();
  // Janela de 90 dias para uso e avisos (o painel mostra no máximo 30).
  const since90 = new Date(now - 90 * DAY).toISOString();

  const [subs, users, logs, events] = await Promise.all([
    fetchAll<SubRow>((from, to) =>
      admin
        .from("subscriptions")
        .select(
          "email, name, phone, status, plan, billing_period, source, current_period_end, next_billing_at, cancel_at_period_end, renewal_pending, last_payment_at, last_payment_amount, refunded_at, chargeback_at, created_at, user_id",
        )
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    listAuthUsers(admin),
    fetchAll<LogRow>((from, to) =>
      admin
        .from("activation_logs")
        .select("user_id, created_at, ip")
        .gte("created_at", since90)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAll<EventRow>((from, to) =>
      admin
        .from("webhook_events")
        .select(
          "id, event, email, result, is_test, received_at, amount:payload->Data->Purchase->Price->>Value, buyer_name:payload->Data->Buyer->>Name, buyer_phone:payload->Data->Buyer->>PhoneNumber, offer:payload->Data->Offer->>Name",
        )
        .gte("received_at", since90)
        .order("received_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  return buildAdminData({ subs, users, logs, events }, now);
}

export type RawAdminData = { subs: SubRow[]; users: AuthUser[]; logs: LogRow[]; events: EventRow[] };

/** Cálculo puro dos números do painel (sem banco), a partir das linhas lidas. */
export function buildAdminData({ subs, users, logs, events }: RawAdminData, now = Date.now()): AdminData {
  const today = dayKey(new Date(now));
  const usersByEmail = new Map(users.map((u) => [u.email, u]));
  const usersById = new Map(users.map((u) => [u.id, u]));

  // Uso por usuário (ativações de token).
  const usage = new Map<string, { last: string; uses7: number; uses30: number; ips7: Set<string> }>();
  for (const l of logs) {
    const t = new Date(l.created_at).getTime();
    let u = usage.get(l.user_id);
    if (!u) {
      u = { last: l.created_at, uses7: 0, uses30: 0, ips7: new Set() };
      usage.set(l.user_id, u);
    }
    if (l.created_at > u.last) u.last = l.created_at;
    if (now - t <= 30 * DAY) u.uses30++;
    if (now - t <= 7 * DAY) {
      u.uses7++;
      if (l.ip) u.ips7.add(l.ip);
    }
  }

  // Clientes
  const clients: ClientRow[] = subs.map((s) => {
    const email = s.email.toLowerCase();
    const account = usersByEmail.get(email) ?? (s.user_id ? usersById.get(s.user_id) : undefined);
    const use = account ? usage.get(account.id) : undefined;
    const active = isSubscriptionActive(s);
    const flags: string[] = [];
    if (s.cancel_at_period_end) flags.push("Cancelamento agendado");
    if (s.renewal_pending) flags.push("Pagamento pendente");
    if (s.refunded_at) flags.push("Reembolsado");
    if (s.chargeback_at) flags.push("Chargeback");
    const lastUseTs = use ? new Date(use.last).getTime() : 0;
    const idle = active && !!account && (!use || now - lastUseTs > 14 * DAY);
    const bought = s.last_payment_at ?? s.created_at;
    return {
      email,
      name: s.name,
      phone: s.phone,
      whatsapp: whatsappNumber(s.phone),
      active,
      plan: planLabel(s),
      category: planCategory(s),
      source: s.source === "lastlink" ? "Lastlink" : "Manual",
      hasAccount: !!account,
      accountCreated: fmtDate(account?.created_at),
      lastLogin: fmtDateTime(account?.last_sign_in_at),
      lastLoginRel: relative(account?.last_sign_in_at, now),
      lastUse: fmtDateTime(use?.last),
      lastUseRel: relative(use?.last, now),
      lastUseTs,
      uses30: use?.uses30 ?? 0,
      renewal: s.cancel_at_period_end ? "Cancelada" : fmtDate(s.next_billing_at),
      accessUntil: s.billing_period === "Vitalício" ? "Vitalício" : fmtDate(s.current_period_end) ?? (active ? "Sem data" : null),
      boughtAt: fmtDate(bought),
      boughtAtTs: new Date(bought).getTime(),
      amount: toNumber(s.last_payment_amount),
      flags,
      idle,
    };
  });

  const activeClients = clients.filter((c) => c.active);
  const activeSubs = subs.filter((s) => isSubscriptionActive(s));

  // Pendências de primeiro acesso: acesso ativo e conta ainda não criada.
  const pending: PendingRow[] = subs
    .filter((s) => isSubscriptionActive(s) && !usersByEmail.has(s.email.toLowerCase()) && !(s.user_id && usersById.has(s.user_id)))
    .map((s) => {
      const since = s.last_payment_at ?? s.created_at;
      return {
        email: s.email.toLowerCase(),
        name: s.name,
        phone: s.phone,
        whatsapp: whatsappNumber(s.phone),
        plan: planLabel(s),
        since: fmtDate(since),
        sinceDays: since ? Math.floor((now - new Date(since).getTime()) / DAY) : null,
      };
    })
    .sort((a, b) => (b.sinceDays ?? 0) - (a.sinceDays ?? 0));

  // Avisos da Lastlink: vendas, renovações, reembolsos, carrinhos.
  const realEvents = events.filter((e) => !e.is_test);
  const ev = (e: EventRow) => e.event.toLowerCase();
  const counted = realEvents.filter((e) => !NOT_COUNTED.has(e.result));
  const within = (e: EventRow, days: number) => now - new Date(e.received_at).getTime() <= days * DAY;

  const sales = counted.filter((e) => ev(e) === "purchase_order_confirmed");
  const renewals = counted.filter((e) => ev(e) === "recurrent_payment");
  const refunds = counted.filter((e) => ev(e) === "payment_refund");
  const chargebacks = counted.filter((e) => ev(e) === "payment_chargeback");
  const payments = counted.filter((e) => PAYMENT_EVENTS.has(ev(e)));

  const sum = (list: EventRow[]) => list.reduce((acc, e) => acc + (toNumber(e.amount) ?? 0), 0);

  // Série diária dos últimos 30 dias (Brasília).
  const days: DayPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const key = dayKey(d);
    const [, m, dd] = key.split("-");
    days.push({ key, label: `${dd}/${m}`, a: 0, b: 0, amount: 0 });
  }
  const salesDaily = days.map((d) => ({ ...d }));
  const usageDaily = days.map((d) => ({ ...d }));
  const salesIdx = new Map(salesDaily.map((d, i) => [d.key, i]));
  for (const e of payments) {
    const i = salesIdx.get(dayKey(e.received_at));
    if (i === undefined) continue;
    if (ev(e) === "purchase_order_confirmed") salesDaily[i].a++;
    else salesDaily[i].b++;
    salesDaily[i].amount += toNumber(e.amount) ?? 0;
  }
  const usageIdx = new Map(usageDaily.map((d, i) => [d.key, i]));
  const usersPerDay = new Map<string, Set<string>>();
  for (const l of logs) {
    const k = dayKey(l.created_at);
    const i = usageIdx.get(k);
    if (i === undefined) continue;
    usageDaily[i].a++;
    if (!usersPerDay.has(k)) usersPerDay.set(k, new Set());
    usersPerDay.get(k)!.add(l.user_id);
  }
  for (const d of usageDaily) d.b = usersPerDay.get(d.key)?.size ?? 0;

  // Planos ativos
  const order: PlanCategory[] = ["Mensal", "Anual", "Vitalício", "Outros períodos", "Liberado à mão"];
  const byPlan = order
    .map((label) => ({ label, value: activeClients.filter((c) => c.category === label).length }))
    .filter((p) => p.value > 0);

  // Funil
  const withAccount = activeClients.filter((c) => c.hasAccount);
  const used30 = withAccount.filter((c) => c.uses30 > 0);
  const funnel = [
    { label: "Com acesso ativo", value: activeClients.length },
    { label: "Criaram a conta", value: withAccount.length },
    { label: "Usaram nos últimos 30 dias", value: used30.length },
  ];

  // Atenção
  const renewSoon: AttentionItem[] = activeSubs
    .filter((s) => !s.cancel_at_period_end && s.next_billing_at)
    .filter((s) => {
      const t = new Date(s.next_billing_at!).getTime();
      return t >= now - DAY && t <= now + 7 * DAY;
    })
    .sort((a, b) => a.next_billing_at!.localeCompare(b.next_billing_at!))
    .map((s) => ({ email: s.email, name: s.name, detail: `${planLabel(s)} · renova ${fmtDate(s.next_billing_at)}`, when: relative(s.next_billing_at, now) }));

  const losingAccess: AttentionItem[] = activeSubs
    .filter((s) => s.current_period_end && s.billing_period !== "Vitalício")
    .filter((s) => s.cancel_at_period_end || s.source !== "lastlink")
    .filter((s) => new Date(s.current_period_end!).getTime() <= now + 14 * DAY)
    .sort((a, b) => a.current_period_end!.localeCompare(b.current_period_end!))
    .map((s) => ({
      email: s.email,
      name: s.name,
      detail: `${s.cancel_at_period_end ? "Cancelou" : planLabel(s)} · acesso até ${fmtDate(s.current_period_end)}`,
      when: relative(s.current_period_end, now),
    }));

  const paymentPending: AttentionItem[] = activeSubs
    .filter((s) => s.renewal_pending)
    .map((s) => ({ email: s.email, name: s.name, detail: `${planLabel(s)} · acesso até ${fmtDate(s.current_period_end) ?? "—"}`, when: relative(s.current_period_end, now) }));

  const idle: AttentionItem[] = clients
    .filter((c) => c.idle)
    .sort((a, b) => a.lastUseTs - b.lastUseTs)
    .map((c) => ({ email: c.email, name: c.name, detail: `${c.plan} · ${c.lastUse ? `último uso ${c.lastUse}` : "nunca gerou token"}`, when: c.lastUseRel }));

  // Uso e segurança: quem mais gerou tokens em 7 dias.
  const topUsers = [...usage.entries()]
    .filter(([, u]) => u.uses7 > 0)
    .map(([id, u]) => {
      const acc = usersById.get(id);
      const sub = acc ? subs.find((s) => s.email.toLowerCase() === acc.email) : undefined;
      return {
        email: acc?.email ?? "(conta apagada)",
        name: sub?.name ?? null,
        uses7: u.uses7,
        ips7: u.ips7.size,
        last: relative(u.last, now),
        suspicious: u.ips7.size >= 4 || u.uses7 >= 40,
      };
    })
    .sort((a, b) => b.uses7 - a.uses7)
    .slice(0, 10);

  // Carrinhos abandonados (30 dias) de quem não está ativo.
  const activeEmails = new Set(activeClients.map((c) => c.email));
  const seen = new Set<string>();
  const abandoned = realEvents
    .filter((e) => ev(e) === "abandoned_cart" && within(e, 30) && e.email && !activeEmails.has(e.email))
    .filter((e) => (seen.has(e.email!) ? false : (seen.add(e.email!), true)))
    .slice(0, 30)
    .map((e) => ({ email: e.email!, name: e.buyer_name, whatsapp: whatsappNumber(e.buyer_phone), offer: e.offer, when: relative(e.received_at, now) }));

  const kpis = {
    active: activeClients.length,
    activeLastlink: activeClients.filter((c) => c.source === "Lastlink").length,
    activeManual: activeClients.filter((c) => c.source !== "Lastlink").length,
    newSales30: sales.filter((e) => within(e, 30)).length,
    newSales7: sales.filter((e) => within(e, 7)).length,
    newSalesToday: sales.filter((e) => dayKey(e.received_at) === today).length,
    renewals30: renewals.filter((e) => within(e, 30)).length,
    revenue30: sum(payments.filter((e) => within(e, 30))),
    revenueToday: sum(payments.filter((e) => dayKey(e.received_at) === today)),
    refunds30: refunds.filter((e) => within(e, 30)).length,
    refundsAmount30: sum(refunds.filter((e) => within(e, 30))),
    chargebacks30: chargebacks.filter((e) => within(e, 30)).length,
    pending: pending.length,
    cancelScheduled: activeSubs.filter((s) => s.cancel_at_period_end).length,
    activations7: logs.filter((l) => now - new Date(l.created_at).getTime() <= 7 * DAY).length,
    activationsToday: logs.filter((l) => dayKey(l.created_at) === today).length,
    activeUsers7: [...usage.values()].filter((u) => u.uses7 > 0).length,
    abandoned30: abandoned.length,
  };

  return {
    generatedAt: fmtDateTime(new Date(now).toISOString())!,
    kpis,
    byPlan,
    funnel,
    salesDaily,
    usageDaily,
    pending,
    renewSoon,
    losingAccess,
    paymentPending,
    idle,
    topUsers,
    abandoned,
    events: events.slice(0, 40).map((e) => ({
      id: e.id,
      event: e.event,
      email: e.email,
      result: e.result,
      isTest: e.is_test,
      when: fmtDateTime(e.received_at),
      amount: toNumber(e.amount),
    })),
    clients,
  };
}
