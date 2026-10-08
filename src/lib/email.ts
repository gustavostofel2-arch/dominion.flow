import "server-only";

// Envio de e-mail pelo Resend (API HTTP, sem biblioteca). Usado só pelo painel admin.
// Precisa de RESEND_API_KEY na Vercel. Remetente: EMAIL_FROM ou o padrão abaixo.

const DEFAULT_FROM = "Dominion <dominion@mail.dominion-flow.app>";

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export function dailyEmailLimit() {
  const n = Number(process.env.EMAIL_DAILY_LIMIT ?? 100);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto com quebras de linha → HTML simples (links clicáveis). */
function textToHtml(text: string) {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2f6bff;text-decoration:underline">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function renderEmailHtml({
  body,
  buttonLabel,
  buttonUrl,
  whatsappUrl,
}: {
  body: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  whatsappUrl: string;
}) {
  const button =
    buttonLabel && buttonUrl
      ? `<p style="margin:24px 0 8px"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#ff2d55;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:12px">${esc(buttonLabel)}</a></p>`
      : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f5f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#070b16;padding:20px 28px;color:#eaf2ff;font-size:18px;font-weight:700;letter-spacing:-0.2px">Dominion</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${textToHtml(body)}${button}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eceef2;font-size:13px;color:#6b7280">
Precisa de ajuda? <a href="${esc(whatsappUrl)}" style="color:#16a34a;font-weight:600;text-decoration:none">Fale com a gente no WhatsApp</a><br>
Você recebeu este e-mail porque é cliente ou demonstrou interesse no Dominion.
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY não configurada na Vercel" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message || `Resend respondeu ${res.status}` };
    return { ok: true, id: json.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "falha de rede" };
  }
}
