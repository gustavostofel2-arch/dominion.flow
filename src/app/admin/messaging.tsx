"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon } from "@/components/ui";
import { sendEmailsAction, type SendResult } from "./actions";
import { fill, templateVars, whatsappText, type EmailTemplate, type Recipient } from "./email-templates";
import type { AdminData, ContactRow } from "./data";
import { Badge, Checkbox, Empty, Pager, Scroll, usePager } from "./ui-kit";

// Mensagens do painel: janela de e-mail (modelo + prévia), botões de WhatsApp/copiar
// e as listas de contato com caixa de seleção.

type Ctx = {
  data: AdminData;
  openCompose: (targets: Recipient[], templateId: string) => void;
  openClient: (email: string) => void;
};
export const AdminCtx = createContext<Ctx | null>(null);
export function useAdmin() {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("AdminCtx ausente");
  return c;
}

export function CopyButton({ text, label = "Copiar", done = "Copiado" }: { text: string; label?: string; done?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {
          /* sem permissão de área de transferência */
        }
      }}
      className="dk-copy-btn inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium"
    >
      {ok ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {ok ? done : label}
    </button>
  );
}

export function WhatsAppButton({ number, text }: { number: string | null; text: string }) {
  if (!number) return null;
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#2ee6b8]/35 bg-[#2ee6b8]/10 px-2.5 text-xs font-medium text-[#2ee6b8] transition hover:bg-[#2ee6b8]/20"
    >
      WhatsApp
    </a>
  );
}

export function EmailButton({ onClick, label = "E-mail" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#3fd0ff]/35 bg-[#3fd0ff]/10 px-2.5 text-xs font-medium text-[#7be3ff] transition hover:bg-[#3fd0ff]/20"
    >
      ✉ {label}
    </button>
  );
}

export function useTemplate(id: string) {
  const { data } = useAdmin();
  return data.email.templates.find((t) => t.id === id) ?? data.email.templates[data.email.templates.length - 1];
}

/** Texto de WhatsApp de um modelo, já com os dados da pessoa. */
export function useWhatsappText(templateId: string, r: Recipient) {
  const { data } = useAdmin();
  const t = useTemplate(templateId);
  return whatsappText(t, templateVars(r, data.checkoutUrl));
}

// ---------- Lista de contatos (pendências, nunca usou, carrinhos) ----------

function ContactItem({
  row,
  templateId,
  selected,
  onSelect,
}: {
  row: ContactRow;
  templateId: string;
  selected: boolean;
  onSelect: (v: boolean) => void;
}) {
  const { openCompose, openClient, data } = useAdmin();
  const wa = useWhatsappText(templateId, row);
  const isClient = data.clients.some((c) => c.email === row.email);
  return (
    <li
      onClick={() => isClient && openClient(row.email)}
      className={`flex flex-col gap-3 px-4 py-3.5 transition sm:px-5 md:flex-row md:items-center ${isClient ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${selected ? "bg-[#3fd0ff]/[0.05]" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="pt-1">
          <Checkbox checked={selected} onChange={onSelect} label={`Selecionar ${row.email}`} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name || row.email}</p>
          <p className="truncate text-[13px] text-ink-mute">
            {row.name ? `${row.email} · ` : ""}
            {row.phone ?? "sem telefone"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {row.plan && <Badge>{row.plan}</Badge>}
            <span className={`text-[12px] ${row.days !== null && row.days >= 2 ? "text-[#ffb547]" : "text-ink-mute"}`}>{row.detail}</span>
            {row.lastEmail && (
              <span className="text-[12px] text-[#7be3ff]">
                ✉ {row.lastEmail.template} {row.lastEmail.when}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <EmailButton onClick={() => openCompose([row], templateId)} />
        <WhatsAppButton number={row.whatsapp} text={wa} />
        <CopyButton text={row.email} label="Copiar" />
      </div>
    </li>
  );
}

/** Lista paginada com seleção: marca as pessoas e envia o e-mail só para elas. */
export function ContactList({ rows, templateId, empty }: { rows: ContactRow[]; templateId: string; empty: string }) {
  const { openCompose } = useAdmin();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const p = usePager(rows);
  const valid = useMemo(() => new Set(rows.map((r) => r.email)), [rows]);
  const chosen = [...sel].filter((e) => valid.has(e));
  const pageAll = p.slice.length > 0 && p.slice.every((r) => sel.has(r.email));

  if (rows.length === 0) return <Empty>{empty}</Empty>;

  const toggle = (email: string, v: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (v) n.add(email);
      else n.delete(email);
      return n;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
          <Checkbox
            checked={pageAll}
            onChange={(v) =>
              setSel((s) => {
                const n = new Set(s);
                for (const r of p.slice) {
                  if (v) n.add(r.email);
                  else n.delete(r.email);
                }
                return n;
              })
            }
            label="Selecionar a página"
          />
          Selecionar página
        </label>
        <span className="text-[13px] text-ink-mute">
          {chosen.length} selecionado{chosen.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex gap-2">
          {chosen.length > 0 && (
            <button type="button" onClick={() => setSel(new Set())} className="text-[13px] text-ink-mute hover:text-ink">
              Limpar
            </button>
          )}
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => openCompose(rows.filter((r) => sel.has(r.email)), templateId)}
            className="inline-flex h-8 items-center rounded-lg bg-[#ff2d55] px-3 text-xs font-semibold text-white transition hover:bg-[#e91e48] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✉ Enviar e-mail para {chosen.length || "…"}
          </button>
        </div>
      </div>
      <Scroll max={560}>
        <ul className="divide-y divide-white/5 rounded-xl border border-white/5">
          {p.slice.map((r) => (
            <ContactItem key={r.email} row={r} templateId={templateId} selected={sel.has(r.email)} onSelect={(v) => toggle(r.email, v)} />
          ))}
        </ul>
      </Scroll>
      <Pager p={p} />
    </div>
  );
}

// ---------- Janela de envio de e-mail ----------

export function ComposeModal({ targets, initialTemplate, onClose }: { targets: Recipient[]; initialTemplate: string; onClose: () => void }) {
  const { data } = useAdmin();
  const router = useRouter();
  const templates = data.email.templates;
  const start = templates.find((t) => t.id === initialTemplate) ?? templates[0];
  const [tplId, setTplId] = useState(start.id);
  const [draft, setDraft] = useState<Pick<EmailTemplate, "subject" | "body" | "button_label" | "button_url">>(start);
  const [force, setForce] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const remaining = data.email.limit - data.email.sent24;
  const first = targets[0];
  const vars = templateVars(first, data.checkoutUrl);
  const blocked = !data.email.ready ? "Rode o SQL do painel no Supabase para liberar os e-mails." : !data.email.configured ? "Falta cadastrar a RESEND_API_KEY na Vercel." : targets.length > remaining ? `Você só pode enviar mais ${Math.max(0, remaining)} e-mail(s) nas próximas 24h.` : targets.length > 40 ? "Máximo de 40 por envio." : null;

  function pick(id: string) {
    const t = templates.find((x) => x.id === id)!;
    setTplId(id);
    setDraft({ subject: t.subject, body: t.body, button_label: t.button_label, button_url: t.button_url });
  }

  async function send() {
    if (!window.confirm(`Enviar este e-mail para ${targets.length} pessoa${targets.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    try {
      const r = await sendEmailsAction({
        recipients: targets.map((t) => t.email),
        templateId: tplId,
        subject: draft.subject,
        body: draft.body,
        buttonLabel: draft.button_label,
        buttonUrl: draft.button_url,
        force,
      });
      setResult(r);
      router.refresh();
    } catch {
      setResult({ ok: false, error: "Falha ao enviar. Tente de novo.", sent: [], failed: [], skipped: [], remaining });
    } finally {
      setSending(false);
    }
  }

  const field = "field !h-11 !text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="card card-strong flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden !rounded-b-none sm:!rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Enviar e-mail"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-lg font-semibold">Enviar e-mail</p>
            <p className="truncate text-[13px] text-ink-mute">
              Para {targets.length === 1 ? first.email : `${targets.length} pessoas`} · de dominion@mail.dominion-flow.app
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !h-9">
            Fechar
          </button>
        </div>

        {result ? (
          <div className="overflow-y-auto p-5 sm:p-7">
            {result.error && <p className="dk-alert-error rounded-xl px-4 py-3 text-sm">{result.error}</p>}
            {result.sent.length > 0 && (
              <p className="dk-alert-ok rounded-xl px-4 py-3 text-sm">
                ✓ Enviado para {result.sent.length} pessoa{result.sent.length === 1 ? "" : "s"}. Restam {result.remaining} envios nas próximas 24h.
              </p>
            )}
            {result.skipped.length > 0 && (
              <p className="mt-3 rounded-xl border border-[#ffb547]/35 bg-[#ffb547]/10 px-4 py-3 text-sm text-[#ffb547]">
                Pulados (já receberam este modelo nos últimos 3 dias): {result.skipped.join(", ")}
              </p>
            )}
            {result.failed.length > 0 && (
              <ul className="dk-alert-error mt-3 space-y-1 rounded-xl px-4 py-3 text-sm">
                {result.failed.map((f) => (
                  <li key={f.email}>
                    {f.email}: {f.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="btn-ghost">
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-2">
            <div className="space-y-4 p-5 sm:p-7">
              <div>
                <p className="mb-2 text-[12px] uppercase tracking-[0.12em] text-ink-mute">Modelo</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pick(t.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${tplId === t.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 text-ink-mute hover:text-ink-soft"}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-ink-mute">Assunto</span>
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-ink-mute">Mensagem (use {"{{nome}}"}, {"{{email}}"}…)</span>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={10}
                  className="field !h-auto !py-3 !text-sm leading-relaxed"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-ink-mute">Texto do botão (opcional)</span>
                  <input value={draft.button_label ?? ""} onChange={(e) => setDraft({ ...draft, button_label: e.target.value || null })} className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-ink-mute">Link do botão</span>
                  <input value={draft.button_url ?? ""} onChange={(e) => setDraft({ ...draft, button_url: e.target.value || null })} className={field} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Checkbox checked={force} onChange={setForce} label="Enviar mesmo para quem recebeu há pouco" />
                Enviar mesmo para quem já recebeu este modelo nos últimos 3 dias
              </label>
            </div>

            <div className="border-t border-white/10 bg-black/20 p-5 sm:p-7 lg:border-l lg:border-t-0">
              <p className="mb-2 text-[12px] uppercase tracking-[0.12em] text-ink-mute">Prévia {targets.length > 1 ? `(como ${first.email} vai receber)` : ""}</p>
              <div className="overflow-hidden rounded-2xl bg-[#ffffff] text-[#18181b]">
                <div className="bg-[#070b16] px-5 py-3 text-sm font-bold text-[#eaf2ff]">Dominion</div>
                <div className="px-5 py-4">
                  <p className="mb-3 text-[13px] font-semibold text-[#6b7280]">Assunto: {fill(draft.subject, vars)}</p>
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{fill(draft.body, vars)}</div>
                  {draft.button_label && draft.button_url && (
                    <span className="mt-4 inline-block rounded-xl bg-[#ff2d55] px-5 py-2.5 text-sm font-semibold text-white">{draft.button_label}</span>
                  )}
                </div>
                <div className="border-t border-[#eceef2] px-5 py-3 text-[12px] text-[#6b7280]">Precisa de ajuda? Fale com a gente no WhatsApp</div>
              </div>
              {targets.length > 1 && (
                <details className="mt-4 text-[13px] text-ink-mute">
                  <summary className="cursor-pointer">Ver os {targets.length} destinatários</summary>
                  <p className="mt-2 break-words">{targets.map((t) => t.email).join(", ")}</p>
                </details>
              )}
            </div>
          </div>
        )}

        {!result && (
          <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className={`text-[13px] ${blocked ? "text-[#ff8fa3]" : "text-ink-mute"}`}>
              {blocked ?? `${data.email.sent24} de ${data.email.limit} e-mails usados nas últimas 24h${data.email.replyTo ? ` · respostas vão para ${data.email.replyTo}` : " · defina o e-mail de resposta na aba E-mails"}`}
            </p>
            <button
              type="button"
              disabled={!!blocked || sending || !draft.subject.trim() || !draft.body.trim()}
              onClick={send}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ff2d55] px-6 text-sm font-semibold text-white transition hover:bg-[#e91e48] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Enviando…" : `Enviar para ${targets.length}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
