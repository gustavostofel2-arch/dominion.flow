import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionActive } from "@/lib/subscription";
import { dailyEmailLimit, emailConfigured } from "@/lib/email";
import { DEFAULT_REPLY_TO, EMAIL_CHECKOUT_URL, mergeTemplates, type EmailTemplate } from "./email-templates";

// Monta os números do painel administrativo. Só LÊ o banco.

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
  canceled_at: string | null;
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
  /** Purchase.Price: o que o cliente pagou, COM juros do parcelamento. */
  amount: string | null;
  /** Purchase.OriginalPrice: preço da oferta (sem juros). É o valor da venda. */
  original: string | null;
  payment_id: string | null;
  method: string | null;
  installments: string | null;
  utm: unknown;
  buyer_name: string | null;
  buyer_phone: string | null;
  offer: string | null;
};

type AuthUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null };
type RecoveryRow = { created_at: string; email: string | null; ip: string | null };
type EmailLogRow = { to_email: string; template_id: string | null; subject: string; status: string; error: string | null; sent_by: string; created_at: string };

// ---------- Formatação (feita no servidor para a tela não "piscar") ----------

/** Chave do dia no horário de Brasília (AAAA-MM-DD). */
export function dayKey(d: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}
function brtParts(d: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(d));
  const hour = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.find((x) => x.type === "weekday")?.value ?? "Sun");
  return { hour, weekday: wd < 0 ? 0 : wd };
}
export function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ }) : null;
}
export function fmtDateTime(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
}
export function relative(d: string | null | undefined, now = Date.now()) {
  if (!d) return null;
  const diff = now - new Date(d).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  let txt: string;
  if (min < 1) return "agora";
  if (min < 60) txt = `${min} min`;
  else if (min < 60 * 24) txt = `${Math.round(min / 60)} h`;
  else {
    const days = Math.round(abs / DAY);
    txt = days === 1 ? "1 dia" : `${days} dias`;
  }
  return future ? `em ${txt}` : `há ${txt}`;
}

function toNumber(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Valor da venda: preço da oferta (OriginalPrice). Os juros do parcelamento no cartão
 *  ficam fora (vão para a operadora, não são faturamento). Sem ele, usa o valor pago. */
function valueOf(e: { original: string | null; amount: string | null }) {
  return toNumber(e.original) ?? toNumber(e.amount);
}

/** Telefone só com dígitos, com DDI 55 quando vier sem (para o link do WhatsApp). */
export function whatsappNumber(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

// DDD → estado (para saber de onde vêm os clientes).
const DDD_UF: Record<string, string> = {};
const UF_DDDS: Record<string, number[]> = {
  SP: [11, 12, 13, 14, 15, 16, 17, 18, 19], RJ: [21, 22, 24], ES: [27, 28], MG: [31, 32, 33, 34, 35, 37, 38],
  PR: [41, 42, 43, 44, 45, 46], SC: [47, 48, 49], RS: [51, 53, 54, 55], DF: [61], GO: [62, 64], TO: [63],
  MT: [65, 66], MS: [67], AC: [68], RO: [69], BA: [71, 73, 74, 75, 77], SE: [79], PE: [81, 87], AL: [82],
  PB: [83], RN: [84], CE: [85, 88], PI: [86, 89], PA: [91, 93, 94], AM: [92, 97], RR: [95], AP: [96], MA: [98, 99],
};
for (const [uf, ddds] of Object.entries(UF_DDDS)) for (const d of ddds) DDD_UF[String(d)] = uf;

function stateFromPhone(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  const ddd = d.startsWith("55") && d.length >= 12 ? d.slice(2, 4) : d.length === 10 || d.length === 11 ? d.slice(0, 2) : null;
  return ddd ? (DDD_UF[ddd] ?? null) : null;
}

/** Origem da venda a partir do objeto Utm da Lastlink (qualquer campo "source"). */
function utmSource(u: unknown): string | null {
  if (!u || typeof u !== "object") return null;
  for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
    if (/source/i.test(k) && typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  return null;
}

const METHOD_LABEL: Record<string, string> = { credit_card: "Cartão", pix: "Pix", bankslip: "Boleto" };

// ---------- Categorias de plano ----------

export type PlanCategory = "Mensal" | "Anual" | "Vitalício" | "Outros períodos" | "Liberado à mão";

function planCategory(s: SubRow): PlanCategory {
  // Acesso liberado à mão (dono, sócios, cortesias) nunca conta como plano vendido,
  // mesmo que tenha período (ex.: cortesia anual).
  if (s.source !== "lastlink") return "Liberado à mão";
  const p = (s.billing_period ?? "").trim();
  if (p === "Vitalício") return "Vitalício";
  if (p === "Mensal") return "Mensal";
  if (p === "Anual") return "Anual";
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

export type LastEmail = { template: string | null; when: string | null };

export type ClientRow = {
  email: string;
  userId: string | null;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  state: string | null;
  active: boolean;
  plan: string;
  category: PlanCategory;
  source: string;
  hasAccount: boolean;
  accountCreated: string | null;
  accountAgeDays: number;
  lastLogin: string | null;
  lastLoginRel: string | null;
  lastUse: string | null;
  lastUseRel: string | null;
  lastUseTs: number;
  uses30: number;
  everUsed: boolean;
  renewal: string | null;
  accessUntil: string | null;
  since: string | null;
  sinceDays: number;
  boughtAt: string | null;
  boughtAtTs: number;
  amount: number | null;
  paid: number | null;
  method: string | null;
  installments: number | null;
  utm: string | null;
  flags: string[];
  idle: boolean;
  lastEmail: LastEmail | null;
};

/** Pessoa para quem dá para mandar mensagem (pendências, carrinhos). */
export type ContactRow = {
  email: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  plan: string;
  renewal: string | null;
  detail: string;
  days: number | null;
  lastEmail: LastEmail | null;
};

export type AttentionItem = { email: string; name: string | null; detail: string; when: string | null };

export type DayPoint = { key: string; label: string; a: number; b: number; amount: number };

export type Bar = { label: string; value: number };

export type AdminData = {
  generatedAt: string;
  checkoutUrl: string | null;
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
    neverUsed: number;
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
  pending: ContactRow[];
  neverUsed: ContactRow[];
  renewSoon: AttentionItem[];
  losingAccess: AttentionItem[];
  paymentPending: AttentionItem[];
  idle: AttentionItem[];
  topUsers: { email: string; name: string | null; uses7: number; uses30: number; ips7: number; last: string | null; suspicious: boolean }[];
  abandoned: (ContactRow & { offer: string | null; when: string | null })[];
  events: { id: string; event: string; email: string | null; result: string; isTest: boolean; when: string | null; amount: number | null; paid: number | null }[];
  clients: ClientRow[];
  clientStats: {
    total: number;
    active: number;
    inactive: number;
    refunded: number;
    chargebacks: number;
    canceled: number;
    lastlinkBuyers: number;
    ticket: number | null;
    totalRevenue: number;
    pix: number;
    card: number;
    cardInstallments: number;
    avgTenureDays: number | null;
    states: Bar[];
    utm: Bar[];
    hours: Bar[];
    weekdays: Bar[];
    methods: Bar[];
    oldest: { email: string; name: string | null; plan: string; since: string | null; days: number; active: boolean }[];
  };
  email: {
    ready: boolean;
    configured: boolean;
    limit: number;
    /** Total na cota das últimas 24h: painel + recuperação de senha. */
    sent24: number;
    panel24: number;
    replyTo: string | null;
    templates: EmailTemplate[];
    recovery: {
      ready: boolean;
      last24: number;
      last7: number;
      last30: number;
      daily: Bar[];
      list: { email: string; name: string | null; when: string | null; rel: string | null; ip: string | null }[];
      top: { email: string; count: number }[];
    };
    log: { to: string; template: string | null; subject: string; status: string; error: string | null; by: string; when: string | null }[];
  };
};

// ---------- Montagem ----------

const PAYMENT_EVENTS = new Set(["purchase_order_confirmed", "recurrent_payment"]);
// Resultados de aviso que NÃO representam uma venda processada.
const NOT_COUNTED = new Set(["test_ignored", "ignored_other_product", "no_email", "processing", "stale_ignored", "duplicate"]);

export async function loadAdminData(): Promise<AdminData> {
  const admin = createAdminClient();
  const now = Date.now();
  // Uso: 90 dias. Avisos da Lastlink: 1 ano (para origem, forma de pagamento etc.).
  const since90 = new Date(now - 90 * DAY).toISOString();
  const since365 = new Date(now - 365 * DAY).toISOString();

  const [subs, users, logs, events, emailPart] = await Promise.all([
    fetchAll<SubRow>((from, to) =>
      admin
        .from("subscriptions")
        .select(
          "email, name, phone, status, plan, billing_period, source, current_period_end, next_billing_at, cancel_at_period_end, canceled_at, renewal_pending, last_payment_at, last_payment_amount, refunded_at, chargeback_at, created_at, user_id",
        )
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    listAuthUsers(admin),
    fetchAll<LogRow>((from, to) =>
      admin.from("activation_logs").select("user_id, created_at, ip").gte("created_at", since90).order("created_at", { ascending: false }).range(from, to),
    ),
    fetchAll<EventRow>((from, to) =>
      admin
        .from("webhook_events")
        .select(
          "id, event, email, result, is_test, received_at, amount:payload->Data->Purchase->Price->>Value, original:payload->Data->Purchase->OriginalPrice->>Value, payment_id:payload->Data->Purchase->>PaymentId, method:payload->Data->Purchase->Payment->>PaymentMethod, installments:payload->Data->Purchase->Payment->>NumberOfInstallments, utm:payload->Data->Utm, buyer_name:payload->Data->Buyer->>Name, buyer_phone:payload->Data->Buyer->>PhoneNumber, offer:payload->Data->Offer->>Name",
        )
        .gte("received_at", since365)
        .order("received_at", { ascending: false })
        .range(from, to),
    ),
    loadEmailPart(admin, now),
  ]);

  // Quem não aparece no uso dos últimos 90 dias: confere se já usou alguma vez.
  const recentUsers = new Set(logs.map((l) => l.user_id));
  const candidates = users.filter((u) => !recentUsers.has(u.id)).map((u) => u.id);
  const everUsed = new Set<string>(recentUsers);
  for (let i = 0; i < candidates.length; i += 200) {
    const { data } = await admin.from("activation_logs").select("user_id").in("user_id", candidates.slice(i, i + 200)).limit(1000);
    for (const r of data ?? []) everUsed.add(r.user_id);
  }

  return buildAdminData({ subs, users, logs, events, everUsed, ...emailPart, checkoutUrl: EMAIL_CHECKOUT_URL }, now);
}

async function loadEmailPart(admin: ReturnType<typeof createAdminClient>, now: number) {
  const [tpl, log, setting, rec] = await Promise.all([
    admin.from("email_templates").select("id, subject, body, button_label, button_url"),
    admin
      .from("email_log")
      .select("to_email, template_id, subject, status, error, sent_by, created_at")
      .gte("created_at", new Date(now - 90 * DAY).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("admin_settings").select("value").eq("key", "reply_to").maybeSingle(),
    admin.rpc("admin_recovery_requests", { p_since: new Date(now - 30 * DAY).toISOString() }),
  ]);
  return {
    emailReady: !tpl.error && !log.error,
    savedTemplates: (tpl.data ?? []) as Partial<EmailTemplate>[],
    emailLog: (log.data ?? []) as EmailLogRow[],
    replyTo: setting.data?.value || DEFAULT_REPLY_TO,
    recoveryReady: !rec.error,
    recovery: (rec.data ?? []) as RecoveryRow[],
  };
}

export type RawAdminData = {
  subs: SubRow[];
  users: AuthUser[];
  logs: LogRow[];
  events: EventRow[];
  everUsed: Set<string>;
  emailReady: boolean;
  savedTemplates: Partial<EmailTemplate>[];
  emailLog: EmailLogRow[];
  replyTo: string | null;
  recoveryReady: boolean;
  recovery: RecoveryRow[];
  checkoutUrl: string | null;
};

/** Cálculo puro dos números do painel (sem banco), a partir das linhas lidas. */
export function buildAdminData(raw: RawAdminData, now = Date.now()): AdminData {
  const { subs, users, logs, events, everUsed } = raw;
  const today = dayKey(new Date(now));
  const usersByEmail = new Map(users.map((u) => [u.email, u]));
  const usersById = new Map(users.map((u) => [u.id, u]));
  const ev = (e: EventRow) => e.event.toLowerCase();
  const templates = mergeTemplates(raw.savedTemplates);
  const templateName = new Map(templates.map((t) => [t.id, t.name]));

  // Último e-mail enviado para cada pessoa.
  const lastEmailBy = new Map<string, LastEmail>();
  for (const l of raw.emailLog) {
    if (l.status !== "sent" || lastEmailBy.has(l.to_email)) continue;
    lastEmailBy.set(l.to_email, { template: (l.template_id && templateName.get(l.template_id)) || l.template_id, when: relative(l.created_at, now) });
  }

  // Compras e reembolsos de contas liberadas à mão (dono, sócios, cortesias) são testes
  // internos: aparecem na lista de avisos, mas não entram em vendas, faturamento e reembolsos.
  const internal = new Set(subs.filter((s) => s.source !== "lastlink").map((s) => s.email.toLowerCase()));
  const realEvents = events.filter((e) => !e.is_test);
  // O mesmo pagamento (PaymentId) nunca conta duas vezes no mesmo tipo de aviso.
  const seenPayment = new Set<string>();
  const counted = realEvents.filter((e) => {
    if (NOT_COUNTED.has(e.result) || (e.email && internal.has(e.email.toLowerCase()))) return false;
    if (e.payment_id) {
      const k = `${ev(e)}:${e.payment_id}`;
      if (seenPayment.has(k)) return false;
      seenPayment.add(k);
    }
    return true;
  });
  const refunds = counted.filter((e) => ev(e) === "payment_refund");
  const chargebacks = counted.filter((e) => ev(e) === "payment_chargeback");

  // Cada reembolso/chargeback anula o pagamento mais recente daquele e-mail feito antes dele.
  // Vendas, faturamento e gráficos contam só pagamentos que NÃO foram devolvidos.
  const allPayments = counted.filter((e) => PAYMENT_EVENTS.has(ev(e)));
  const undone = new Set<string>();
  for (const r of [...refunds, ...chargebacks]) {
    const target = allPayments.find(
      (p) => p.email && r.email && p.email.toLowerCase() === r.email.toLowerCase() && p.received_at <= r.received_at && !undone.has(p.id),
    );
    if (target) undone.add(target.id);
  }
  const payments = allPayments.filter((p) => !undone.has(p.id));
  const sales = payments.filter((e) => ev(e) === "purchase_order_confirmed");
  const renewals = payments.filter((e) => ev(e) === "recurrent_payment");

  // Última compra de cada e-mail (avisos vêm do mais novo para o mais antigo).
  const lastPurchase = new Map<string, EventRow>();
  for (const e of realEvents) {
    if (!e.email || !PAYMENT_EVENTS.has(ev(e)) || NOT_COUNTED.has(e.result)) continue;
    const k = e.email.toLowerCase();
    if (!lastPurchase.has(k)) lastPurchase.set(k, e);
  }
  // Origem (utm) da primeira compra conhecida de cada e-mail.
  const firstUtm = new Map<string, string>();
  for (const e of [...realEvents].reverse()) {
    if (!e.email) continue;
    const u = utmSource(e.utm);
    if (u && !firstUtm.has(e.email.toLowerCase())) firstUtm.set(e.email.toLowerCase(), u);
  }

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
    else if (s.canceled_at) flags.push("Cancelou");
    if (s.renewal_pending) flags.push("Pagamento pendente");
    if (s.refunded_at) flags.push("Reembolsado");
    if (s.chargeback_at) flags.push("Chargeback");
    const lastUseTs = use ? new Date(use.last).getTime() : 0;
    // Parado = sem gerar token há mais de 14 dias. Quem nunca usou conta a partir da
    // criação da conta (quem acabou de comprar não é "parado").
    const idleSince = use ? lastUseTs : account ? new Date(account.created_at).getTime() : now;
    const idle = active && !!account && now - idleSince > 14 * DAY;
    const bought = s.last_payment_at;
    const lp = lastPurchase.get(email);
    return {
      email,
      userId: account?.id ?? null,
      name: s.name,
      phone: s.phone,
      whatsapp: whatsappNumber(s.phone),
      state: stateFromPhone(s.phone),
      active,
      plan: planLabel(s),
      category: planCategory(s),
      source: s.source === "lastlink" ? "Lastlink" : "Manual",
      hasAccount: !!account,
      accountCreated: fmtDate(account?.created_at),
      accountAgeDays: account ? Math.floor((now - new Date(account.created_at).getTime()) / DAY) : 0,
      lastLogin: fmtDateTime(account?.last_sign_in_at),
      lastLoginRel: relative(account?.last_sign_in_at, now),
      lastUse: fmtDateTime(use?.last),
      lastUseRel: relative(use?.last, now),
      lastUseTs,
      uses30: use?.uses30 ?? 0,
      everUsed: !!account && everUsed.has(account.id),
      renewal: s.cancel_at_period_end ? "Cancelada" : s.source === "lastlink" ? fmtDate(s.next_billing_at) : null,
      accessUntil: s.billing_period === "Vitalício" ? "Vitalício" : (fmtDate(s.current_period_end) ?? (active ? "Sem data" : null)),
      since: fmtDate(s.created_at),
      sinceDays: Math.floor((now - new Date(s.created_at).getTime()) / DAY),
      boughtAt: fmtDate(bought),
      boughtAtTs: new Date(bought ?? s.created_at).getTime(),
      amount: bought ? ((lp ? valueOf(lp) : null) ?? toNumber(s.last_payment_amount)) : null,
      paid: bought ? ((lp ? toNumber(lp.amount) : null) ?? toNumber(s.last_payment_amount)) : null,
      method: lp?.method ? (METHOD_LABEL[lp.method] ?? lp.method) : null,
      installments: lp ? toNumber(lp.installments) : null,
      utm: firstUtm.get(email) ?? null,
      flags,
      idle,
      lastEmail: lastEmailBy.get(email) ?? null,
    };
  });

  const activeClients = clients.filter((c) => c.active);
  const activeSubs = subs.filter((s) => isSubscriptionActive(s));
  const subByEmail = new Map(subs.map((s) => [s.email.toLowerCase(), s]));

  const contact = (c: ClientRow, detail: string, days: number | null): ContactRow => ({
    email: c.email,
    name: c.name,
    phone: c.phone,
    whatsapp: c.whatsapp,
    plan: c.plan,
    renewal: c.renewal,
    detail,
    days,
    lastEmail: c.lastEmail,
  });

  // Pendências de primeiro acesso: acesso ativo e conta ainda não criada.
  const pending: ContactRow[] = activeClients
    .filter((c) => !c.hasAccount)
    .map((c) => {
      const s = subByEmail.get(c.email)!;
      const since = s.last_payment_at ?? s.created_at;
      const days = Math.floor((now - new Date(since).getTime()) / DAY);
      return contact(c, days === 0 ? "comprou hoje" : `comprou há ${days} dia${days === 1 ? "" : "s"}`, days);
    })
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  // Criaram a conta e nunca geraram token.
  const neverUsed: ContactRow[] = activeClients
    .filter((c) => c.hasAccount && !c.everUsed)
    .map((c) => contact(c, c.accountAgeDays === 0 ? "conta criada hoje" : `conta criada há ${c.accountAgeDays} dia${c.accountAgeDays === 1 ? "" : "s"}`, c.accountAgeDays))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  // Janelas por dia do calendário (Brasília), iguais às do gráfico: "30 dias" = hoje + 29 anteriores.
  const startKey = (days: number) => dayKey(new Date(now - (days - 1) * DAY));
  const inDays = (iso: string, days: number) => dayKey(iso) >= startKey(days);
  const within = (e: EventRow, days: number) => inDays(e.received_at, days);
  const sum = (list: EventRow[]) => list.reduce((acc, e) => acc + (valueOf(e) ?? 0), 0);

  // Série diária dos últimos 30 dias (Brasília).
  const days: DayPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(new Date(now - i * DAY));
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
    salesDaily[i].amount += valueOf(e) ?? 0;
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
  const byPlan = order.map((label) => ({ label, value: activeClients.filter((c) => c.category === label).length })).filter((p) => p.value > 0);

  // Funil
  const withAccount = activeClients.filter((c) => c.hasAccount);
  const funnel = [
    { label: "Com acesso ativo", value: activeClients.length },
    { label: "Criaram a conta", value: withAccount.length },
    { label: "Já geraram token", value: withAccount.filter((c) => c.everUsed).length },
    { label: "Usaram nos últimos 30 dias", value: withAccount.filter((c) => c.uses30 > 0).length },
  ];

  // Atenção
  const renewSoon: AttentionItem[] = activeSubs
    .filter((s) => s.source === "lastlink" && !s.cancel_at_period_end && s.next_billing_at)
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
    .map((c) => ({
      email: c.email,
      name: c.name,
      detail: `${c.plan} · ${c.lastUse ? `último uso ${c.lastUse}` : c.everUsed ? "sem gerar token há mais de 90 dias" : `nunca gerou token · conta criada ${c.accountCreated}`}`,
      when: c.lastUseRel ?? `há ${c.accountAgeDays} dias`,
    }));

  // Uso e segurança: quem gerou tokens nos últimos 30 dias.
  const topUsers = [...usage.entries()]
    .filter(([, u]) => u.uses30 > 0)
    .map(([id, u]) => {
      const acc = usersById.get(id);
      return {
        email: acc?.email ?? "(conta apagada)",
        name: (acc && subByEmail.get(acc.email)?.name) ?? null,
        uses7: u.uses7,
        uses30: u.uses30,
        ips7: u.ips7.size,
        last: relative(u.last, now),
        suspicious: u.ips7.size >= 4 || u.uses7 >= 40,
      };
    })
    .sort((a, b) => b.uses7 - a.uses7 || b.uses30 - a.uses30);

  // Carrinhos abandonados (30 dias) de quem não está ativo nem é conta interna.
  const activeEmails = new Set(activeClients.map((c) => c.email));
  const seen = new Set<string>();
  const abandoned = realEvents
    .filter((e) => ev(e) === "abandoned_cart" && within(e, 30) && e.email && !activeEmails.has(e.email) && !internal.has(e.email))
    .filter((e) => (seen.has(e.email!) ? false : (seen.add(e.email!), true)))
    .map((e) => {
      const d = Math.floor((now - new Date(e.received_at).getTime()) / DAY);
      return {
        email: e.email!,
        name: e.buyer_name,
        phone: e.buyer_phone,
        whatsapp: whatsappNumber(e.buyer_phone),
        plan: "",
        renewal: null,
        detail: e.offer ?? "Checkout",
        days: d,
        lastEmail: lastEmailBy.get(e.email!) ?? null,
        offer: e.offer,
        when: relative(e.received_at, now),
      };
    });

  // ----- Estatísticas da aba Clientes -----
  const buyers = clients.filter((c) => c.source === "Lastlink");
  const salesAll = sales; // vendas novas mantidas (1 ano)
  const tally = (items: (string | null)[], fallback: string) => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i ?? fallback, (m.get(i ?? fallback) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const hours: Bar[] = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}h`, value: 0 }));
  const weekdays: Bar[] = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => ({ label, value: 0 }));
  for (const e of salesAll) {
    const p = brtParts(e.received_at);
    hours[p.hour].value++;
    weekdays[p.weekday].value++;
  }
  const withMethod = buyers.filter((c) => c.method);
  const activeBuyers = buyers.filter((c) => c.active);
  const clientStats = {
    total: clients.length,
    active: activeClients.length,
    inactive: clients.length - activeClients.length,
    refunded: subs.filter((s) => s.refunded_at).length,
    chargebacks: subs.filter((s) => s.chargeback_at).length,
    canceled: subs.filter((s) => s.canceled_at || s.cancel_at_period_end).length,
    lastlinkBuyers: buyers.length,
    ticket: salesAll.length ? sum(salesAll) / salesAll.length : null,
    totalRevenue: sum(payments),
    pix: withMethod.filter((c) => c.method === "Pix").length,
    card: withMethod.filter((c) => c.method === "Cartão").length,
    cardInstallments: withMethod.filter((c) => c.method === "Cartão" && (c.installments ?? 1) > 1).length,
    avgTenureDays: activeBuyers.length ? Math.round(activeBuyers.reduce((a, c) => a + c.sinceDays, 0) / activeBuyers.length) : null,
    states: tally(buyers.map((c) => c.state), "Sem DDD").slice(0, 10),
    utm: tally(salesAll.map((e) => (e.email && firstUtm.get(e.email.toLowerCase())) ?? null), "Direto / sem UTM").slice(0, 8),
    hours,
    weekdays,
    methods: tally(withMethod.map((c) => (c.method === "Cartão" ? ((c.installments ?? 1) > 1 ? "Cartão parcelado" : "Cartão à vista") : c.method)), "—"),
    oldest: [...buyers]
      .sort((a, b) => b.sinceDays - a.sinceDays)
      .slice(0, 10)
      .map((c) => ({ email: c.email, name: c.name, plan: c.plan, since: c.since, days: c.sinceDays, active: c.active })),
  };

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
    neverUsed: neverUsed.length,
    cancelScheduled: activeSubs.filter((s) => s.cancel_at_period_end).length,
    activations7: logs.filter((l) => inDays(l.created_at, 7)).length,
    activationsToday: logs.filter((l) => dayKey(l.created_at) === today).length,
    activeUsers7: new Set(logs.filter((l) => inDays(l.created_at, 7)).map((l) => l.user_id)).size,
    abandoned30: abandoned.length,
  };

  const since24 = now - DAY;
  const panel24 = raw.emailLog.filter((l) => l.status === "sent" && new Date(l.created_at).getTime() >= since24).length;

  // E-mails de "esqueci minha senha" (Supabase → Resend): também gastam a cota diária.
  const recDaily: Bar[] = days.map((d) => ({ label: d.label, value: 0 }));
  const recIdx = new Map(days.map((d, i) => [d.key, i]));
  const recCount = new Map<string, number>();
  for (const r of raw.recovery) {
    const i = recIdx.get(dayKey(r.created_at));
    if (i !== undefined) recDaily[i].value++;
    if (r.email) recCount.set(r.email, (recCount.get(r.email) ?? 0) + 1);
  }
  const recovery = {
    ready: raw.recoveryReady,
    last24: raw.recovery.filter((r) => new Date(r.created_at).getTime() >= since24).length,
    last7: raw.recovery.filter((r) => inDays(r.created_at, 7)).length,
    last30: raw.recovery.length,
    daily: recDaily,
    list: raw.recovery.map((r) => ({
      email: r.email ?? "—",
      name: (r.email && subByEmail.get(r.email)?.name) ?? null,
      when: fmtDateTime(r.created_at),
      rel: relative(r.created_at, now),
      ip: r.ip,
    })),
    top: [...recCount.entries()]
      .filter(([, n]) => n > 1)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };

  return {
    generatedAt: fmtDateTime(new Date(now).toISOString())!,
    checkoutUrl: raw.checkoutUrl,
    kpis,
    byPlan,
    funnel,
    salesDaily,
    usageDaily,
    pending,
    neverUsed,
    renewSoon,
    losingAccess,
    paymentPending,
    idle,
    topUsers,
    abandoned,
    events: events.slice(0, 1000).map((e) => ({
      id: e.id,
      event: e.event,
      email: e.email,
      result: e.result,
      isTest: e.is_test,
      when: fmtDateTime(e.received_at),
      amount: valueOf(e),
      paid: toNumber(e.amount),
    })),
    clients,
    clientStats,
    email: {
      ready: raw.emailReady,
      configured: emailConfigured(),
      limit: dailyEmailLimit(),
      sent24: panel24 + recovery.last24,
      panel24,
      replyTo: raw.replyTo,
      templates,
      recovery,
      log: raw.emailLog.map((l) => ({
        to: l.to_email,
        template: (l.template_id && templateName.get(l.template_id)) || l.template_id,
        subject: l.subject,
        status: l.status,
        error: l.error,
        by: l.sent_by,
        when: fmtDateTime(l.created_at),
      })),
    },
  };
}
