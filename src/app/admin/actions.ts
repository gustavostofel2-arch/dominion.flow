"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { dailyEmailLimit, emailConfigured, renderEmailHtml, sendEmail } from "@/lib/email";
import { DEFAULT_REPLY_TO, DEFAULT_TEMPLATES, EMAIL_CHECKOUT_URL, SUPPORT_WHATSAPP, fill, templateVars } from "./email-templates";

// Ações do painel admin. TODAS conferem no servidor se quem chama é admin.
// Nenhuma mexe em acesso, plano ou assinatura: só e-mails, modelos e leitura.

const TZ = "America/Sao_Paulo";
const MAX_PER_SEND = 40;
const RESEND_WINDOW_DAYS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) throw new Error("Não autorizado");
  return user.email!.toLowerCase();
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.slice(0, max) : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SendResult = {
  ok: boolean;
  error?: string;
  sent: string[];
  failed: { email: string; error: string }[];
  skipped: string[];
  remaining: number;
};

export async function sendEmailsAction(input: {
  recipients: string[];
  templateId: string;
  subject: string;
  body: string;
  buttonLabel: string | null;
  buttonUrl: string | null;
  force?: boolean;
}): Promise<SendResult> {
  const admin_email = await requireAdmin();
  const empty = { sent: [], failed: [], skipped: [], remaining: 0 };
  if (!emailConfigured()) return { ok: false, error: "Falta a RESEND_API_KEY na Vercel.", ...empty };

  const recipients = [...new Set((input.recipients ?? []).map((e) => String(e).trim().toLowerCase()))].filter((e) => EMAIL_RE.test(e));
  if (recipients.length === 0) return { ok: false, error: "Nenhum destinatário.", ...empty };
  if (recipients.length > MAX_PER_SEND) return { ok: false, error: `Máximo de ${MAX_PER_SEND} por envio.`, ...empty };

  const subject = clean(input.subject, 200).trim();
  const body = clean(input.body, 8000);
  const buttonLabel = clean(input.buttonLabel, 60).trim() || null;
  const buttonUrl = clean(input.buttonUrl, 500).trim() || null;
  const templateId = clean(input.templateId, 40) || "livre";
  if (!subject || !body.trim()) return { ok: false, error: "Assunto e mensagem são obrigatórios.", ...empty };

  const db = createAdminClient();

  // Limite diário do Resend (plano grátis: 100 por dia). Conta as últimas 24h.
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: countErr } = await db
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("created_at", since24);
  if (countErr) return { ok: false, error: "Tabelas de e-mail não encontradas. Rode o SQL do painel no Supabase.", ...empty };
  // Os e-mails de "esqueci minha senha" saem pela mesma conta do Resend e gastam a mesma cota.
  const { data: rec } = await db.rpc("admin_recovery_requests", { p_since: since24 });
  let remaining = dailyEmailLimit() - (count ?? 0) - (Array.isArray(rec) ? rec.length : 0);

  // Só envia para e-mails conhecidos (clientes ou quem passou pelo checkout).
  const { data: subs } = await db
    .from("subscriptions")
    .select("email, name, plan, billing_period, next_billing_at, cancel_at_period_end")
    .in("email", recipients);
  const { data: evs } = await db
    .from("webhook_events")
    .select("email, buyer_name:payload->Data->Buyer->>Name")
    .in("email", recipients)
    .order("received_at", { ascending: false })
    .limit(500);
  const known = new Map<string, { name: string | null; plan: string | null; renewal: string | null }>();
  for (const e of evs ?? []) {
    const r = e as { email: string; buyer_name: string | null };
    if (!known.has(r.email)) known.set(r.email, { name: r.buyer_name, plan: null, renewal: null });
  }
  for (const s of subs ?? []) {
    known.set(s.email, {
      name: s.name ?? known.get(s.email)?.name ?? null,
      plan: s.billing_period || s.plan || null,
      renewal: s.cancel_at_period_end || !s.next_billing_at ? null : new Date(s.next_billing_at).toLocaleDateString("pt-BR", { timeZone: TZ }),
    });
  }

  // Quem já recebeu este modelo nos últimos dias é pulado (a não ser que force).
  let recent = new Set<string>();
  if (!input.force) {
    const { data: logs } = await db
      .from("email_log")
      .select("to_email")
      .eq("status", "sent")
      .eq("template_id", templateId)
      .in("to_email", recipients)
      .gte("created_at", new Date(Date.now() - RESEND_WINDOW_DAYS * 86_400_000).toISOString());
    recent = new Set((logs ?? []).map((l) => l.to_email));
  }

  const { data: setting } = await db.from("admin_settings").select("value").eq("key", "reply_to").maybeSingle();
  const replyTo = setting?.value && EMAIL_RE.test(setting.value) ? setting.value : DEFAULT_REPLY_TO;
  const checkoutUrl = EMAIL_CHECKOUT_URL;
  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP}`;

  const result: SendResult = { ok: true, sent: [], failed: [], skipped: [], remaining };
  for (const email of recipients) {
    const info = known.get(email);
    if (!info) {
      result.failed.push({ email, error: "E-mail não está na base" });
      continue;
    }
    if (recent.has(email)) {
      result.skipped.push(email);
      continue;
    }
    if (remaining <= 0) {
      result.failed.push({ email, error: "Limite diário de e-mails atingido" });
      continue;
    }
    const vars = templateVars({ email, name: info.name, plan: info.plan, renewal: info.renewal }, checkoutUrl);
    const subj = fill(subject, vars);
    const text = fill(body, vars);
    const url = buttonUrl ? fill(buttonUrl, vars) : null;
    const html = renderEmailHtml({ body: text, buttonLabel, buttonUrl: url, whatsappUrl });
    const r = await sendEmail({ to: email, subject: subj, html, text: url ? `${text}\n\n${buttonLabel ?? ""}: ${url}` : text, replyTo });
    await db.from("email_log").insert({
      to_email: email,
      template_id: templateId,
      subject: subj,
      status: r.ok ? "sent" : "error",
      provider_id: r.ok ? r.id : null,
      error: r.ok ? null : r.error,
      sent_by: admin_email,
    });
    if (r.ok) {
      result.sent.push(email);
      remaining--;
    } else result.failed.push({ email, error: r.error });
    await sleep(550); // Resend aceita ~2 envios por segundo
  }
  result.remaining = remaining;
  return result;
}

export async function saveTemplateAction(input: {
  id: string;
  subject: string;
  body: string;
  button_label: string | null;
  button_url: string | null;
}) {
  const by = await requireAdmin();
  if (!DEFAULT_TEMPLATES.some((t) => t.id === input.id)) return { ok: false, error: "Modelo desconhecido" };
  const { error } = await createAdminClient()
    .from("email_templates")
    .upsert({
      id: input.id,
      subject: clean(input.subject, 200),
      body: clean(input.body, 8000),
      button_label: clean(input.button_label, 60) || null,
      button_url: clean(input.button_url, 500) || null,
      updated_at: new Date().toISOString(),
      updated_by: by,
    });
  return error ? { ok: false, error: "Não salvou. Rode o SQL do painel no Supabase." } : { ok: true };
}

export async function resetTemplateAction(id: string) {
  await requireAdmin();
  const { error } = await createAdminClient().from("email_templates").delete().eq("id", clean(id, 40));
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function saveReplyToAction(value: string) {
  await requireAdmin();
  const v = clean(value, 200).trim().toLowerCase();
  if (v && !EMAIL_RE.test(v)) return { ok: false, error: "E-mail inválido" };
  const { error } = await createAdminClient()
    .from("admin_settings")
    .upsert({ key: "reply_to", value: v || null, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: "Não salvou. Rode o SQL do painel no Supabase." } : { ok: true };
}

// ---------- Ficha do cliente ----------

export type ClientDetail = {
  timeline: { at: string; when: string; event: string; result: string; value: number | null; paid: number | null; method: string | null; installments: number | null; offer: string | null; isTest: boolean }[];
  usage: { label: string; value: number }[];
  totalTokens: number;
  emails: { when: string; template: string | null; subject: string; status: string; error: string | null; by: string }[];
};

export async function getClientDetailAction(emailRaw: string, userId: string | null): Promise<ClientDetail> {
  await requireAdmin();
  const email = clean(emailRaw, 200).trim().toLowerCase();
  const db = createAdminClient();
  const fmt = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const num = (v: unknown) => {
    const n = Number(v);
    return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
  };

  const [evs, logs, mails, total] = await Promise.all([
    db
      .from("webhook_events")
      .select(
        "event, result, is_test, received_at, paid:payload->Data->Purchase->Price->>Value, original:payload->Data->Purchase->OriginalPrice->>Value, method:payload->Data->Purchase->Payment->>PaymentMethod, installments:payload->Data->Purchase->Payment->>NumberOfInstallments, offer:payload->Data->Offer->>Name",
      )
      .eq("email", email)
      .order("received_at", { ascending: false })
      .limit(200),
    userId
      ? db
          .from("activation_logs")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
          .limit(5000)
      : Promise.resolve({ data: [] as { created_at: string }[] }),
    db.from("email_log").select("created_at, template_id, subject, status, error, sent_by").eq("to_email", email).order("created_at", { ascending: false }).limit(100),
    userId
      ? db.from("activation_logs").select("id", { count: "exact", head: true }).eq("user_id", userId)
      : Promise.resolve({ count: 0 }),
  ]);

  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const usage: { key: string; label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const k = day(new Date(Date.now() - i * 86_400_000));
    usage.push({ key: k, label: `${k.slice(8)}/${k.slice(5, 7)}`, value: 0 });
  }
  const idx = new Map(usage.map((u, i) => [u.key, i]));
  for (const l of logs.data ?? []) {
    const i = idx.get(day(new Date(l.created_at)));
    if (i !== undefined) usage[i].value++;
  }

  type Ev = { event: string; result: string; is_test: boolean; received_at: string; paid: string | null; original: string | null; method: string | null; installments: string | null; offer: string | null };
  return {
    timeline: ((evs.data ?? []) as Ev[]).map((e) => ({
      at: e.received_at,
      when: fmt(e.received_at),
      event: e.event,
      result: e.result,
      value: num(e.original) ?? num(e.paid),
      paid: num(e.paid),
      method: e.method,
      installments: num(e.installments),
      offer: e.offer,
      isTest: e.is_test,
    })),
    usage: usage.map(({ label, value }) => ({ label, value })),
    totalTokens: total.count ?? 0,
    emails: (mails.data ?? []).map((m) => ({
      when: fmt(m.created_at),
      template: m.template_id,
      subject: m.subject,
      status: m.status,
      error: m.error,
      by: m.sent_by,
    })),
  };
}
