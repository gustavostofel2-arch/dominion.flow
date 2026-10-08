"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getClientDetailAction, type ClientDetail } from "./actions";
import { templateVars, whatsappText } from "./email-templates";
import type { ClientRow } from "./data";
import { CopyButton, EmailButton, useAdmin } from "./messaging";
import { Badge, Columns, Empty, brl, type Tone } from "./ui-kit";

// Ficha do cliente: dados, plano, uso, linha do tempo da Lastlink e e-mails enviados.

const EVENT_LABEL: Record<string, string> = {
  purchase_order_confirmed: "Compra confirmada",
  recurrent_payment: "Renovação paga",
  subscription_canceled: "Cancelou a assinatura",
  subscription_cancelled: "Cancelou a assinatura",
  subscription_expired: "Assinatura expirou",
  subscription_renewal_pending: "Renovação pendente",
  payment_refund: "Reembolso",
  payment_chargeback: "Chargeback",
  abandoned_cart: "Carrinho abandonado",
  product_access_started: "Acesso iniciado",
  product_access_ended: "Acesso encerrado",
  subscription_product_access: "Acesso ao produto",
  subscription_product_acess: "Acesso ao produto",
  purchase_request_confirmed: "Pedido gerado",
  purchase_request_canceled: "Pedido cancelado",
  purchase_request_expired: "Pedido expirou",
  refund_requested: "Pediu reembolso",
  refund_period_over: "Fim da garantia",
  active_member_notification: "Aviso de membro",
};
export const eventLabel = (e: string) => EVENT_LABEL[e.toLowerCase()] ?? e;

export const RESULT: Record<string, { label: string; tone: Tone }> = {
  activated: { label: "Liberou acesso", tone: "ok" },
  activated_lifetime: { label: "Liberou vitalício", tone: "ok" },
  lifetime_kept: { label: "Vitalício mantido", tone: "mute" },
  deactivated: { label: "Cortou acesso", tone: "bad" },
  cancel_scheduled: { label: "Corte agendado", tone: "warn" },
  renewal_pending: { label: "Pagamento pendente", tone: "warn" },
  contact_updated: { label: "Dados atualizados", tone: "mute" },
  logged: { label: "Só registrado", tone: "mute" },
  test_ignored: { label: "Teste (ignorado)", tone: "mute" },
  stale_ignored: { label: "Já aplicado (ok)", tone: "mute" },
  other_subscription_ignored: { label: "Outra assinatura (ignorado)", tone: "mute" },
  ignored_other_product: { label: "Outro produto (ignorado)", tone: "mute" },
  no_email: { label: "Sem e-mail", tone: "warn" },
  processing: { label: "Em processamento", tone: "warn" },
};
export const resultOf = (r: string) => RESULT[r] ?? { label: r, tone: "mute" as Tone };

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-mute">{label}</dt>
      <dd className="truncate text-[14px] text-ink-soft">{value || "—"}</dd>
    </div>
  );
}

export default function ClientDrawer({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const { data, openCompose } = useAdmin();
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [error, setError] = useState(false);
  const [waTpl, setWaTpl] = useState(!client.hasAccount ? "primeiro-acesso" : !client.everUsed ? "nunca-ativou" : "livre");

  useEffect(() => {
    let alive = true;
    getClientDetailAction(client.email, client.userId)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [client.email, client.userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tpl = data.email.templates.find((t) => t.id === waTpl) ?? data.email.templates[0];
  const recipient = { email: client.email, name: client.name, plan: client.plan, renewal: client.renewal };
  const wa = whatsappText(tpl, templateVars(recipient, data.checkoutUrl));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="card card-strong flex h-full w-full max-w-xl flex-col overflow-hidden !rounded-none sm:!rounded-l-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${client.email}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-xl font-semibold">{client.name || client.email}</p>
              <Badge tone={client.active ? "ok" : "mute"}>{client.active ? "Ativo" : "Inativo"}</Badge>
            </div>
            <p className="truncate text-[13px] text-ink-mute">{client.email}</p>
            {client.phone && <p className="font-mono text-[12px] text-ink-mute">{client.phone}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !h-9 shrink-0">
            Fechar
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
          {/* Contato */}
          <div className="flex flex-wrap items-center gap-2">
            <EmailButton onClick={() => openCompose([recipient], waTpl)} label="Enviar e-mail" />
            {client.whatsapp && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#2ee6b8]/35 bg-[#2ee6b8]/10 pl-1">
                <select
                  value={waTpl}
                  onChange={(e) => setWaTpl(e.target.value)}
                  className="h-7 rounded-md bg-transparent px-1 text-xs text-[#2ee6b8] outline-none"
                  aria-label="Modelo do WhatsApp"
                >
                  {data.email.templates.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0b1222] text-white">
                      {t.name}
                    </option>
                  ))}
                </select>
                <a
                  href={`https://wa.me/${client.whatsapp}?text=${encodeURIComponent(wa)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center px-2.5 text-xs font-medium text-[#2ee6b8]"
                >
                  WhatsApp
                </a>
              </span>
            )}
            <CopyButton text={client.email} label="E-mail" />
            {client.phone && <CopyButton text={client.phone} label="Telefone" />}
          </div>

          {client.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {client.flags.map((f) => (
                <Badge key={f} tone="bad">
                  {f}
                </Badge>
              ))}
            </div>
          )}

          {/* Dados */}
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
            <Info label="Plano" value={`${client.plan} · ${client.source}`} />
            <Info label="Cliente desde" value={`${client.since} (${client.sinceDays}d)`} />
            <Info label="Estado (DDD)" value={client.state} />
            <Info label="Valor da venda" value={client.amount !== null ? brl(client.amount, true) : null} />
            <Info
              label="Pagamento"
              value={client.method ? `${client.method}${client.installments && client.installments > 1 ? ` ${client.installments}x` : ""}` : null}
            />
            <Info label="Cliente pagou" value={client.paid !== null ? brl(client.paid, true) : null} />
            <Info label="Renovação" value={client.renewal} />
            <Info label="Acesso até" value={client.accessUntil} />
            <Info label="Origem (utm)" value={client.utm} />
            <Info label="Conta" value={client.hasAccount ? `Criada ${client.accountCreated}` : "Não criou"} />
            <Info label="Último login" value={client.lastLoginRel} />
            <Info label="Último token" value={client.lastUseRel ?? (client.everUsed ? "há mais de 90 dias" : client.hasAccount ? "Nunca" : null)} />
          </dl>

          {error && <p className="dk-alert-error rounded-xl px-4 py-3 text-sm">Não consegui carregar o histórico.</p>}
          {!detail && !error && <p className="text-sm text-ink-mute">Carregando histórico…</p>}

          {detail && (
            <>
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h4 className="font-semibold">Uso nos últimos 30 dias</h4>
                  <span className="text-[12px] text-ink-mute">{detail.totalTokens} tokens no total</span>
                </div>
                <Columns items={detail.usage} every={5} />
              </section>

              <section>
                <h4 className="mb-3 font-semibold">Linha do tempo (Lastlink)</h4>
                {detail.timeline.length === 0 ? (
                  <Empty>Nenhum aviso da Lastlink para este e-mail.</Empty>
                ) : (
                  <ol className="relative space-y-4 border-l border-white/10 pl-5">
                    {detail.timeline.map((t, i) => {
                      const r = resultOf(t.result);
                      return (
                        <li key={i} className="relative">
                          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#070b16] bg-[#3fd0ff]" />
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-ink">{eventLabel(t.event)}</span>
                            {t.value !== null && <span className="font-mono text-[12px] text-ink-mute">{brl(t.value, true)}</span>}
                            <Badge tone={r.tone}>{r.label}</Badge>
                            {t.isTest && <span className="text-[11px] text-ink-mute">(teste)</span>}
                          </div>
                          <p className="text-[12px] text-ink-mute">
                            {t.when}
                            {t.method ? ` · ${t.method === "credit_card" ? "cartão" : t.method}${t.installments && t.installments > 1 ? ` ${t.installments}x` : ""}` : ""}
                            {t.paid !== null && t.value !== null && t.paid - t.value > 0.01 ? ` · pagou ${brl(t.paid, true)} com juros` : ""}
                            {t.offer ? ` · ${t.offer}` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <section>
                <h4 className="mb-3 font-semibold">E-mails enviados</h4>
                {detail.emails.length === 0 ? (
                  <Empty>Nenhum e-mail enviado pelo painel.</Empty>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {detail.emails.map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{m.subject}</p>
                          <p className="truncate text-[12px] text-ink-mute">
                            {m.when} · por {m.by}
                            {m.error ? ` · ${m.error}` : ""}
                          </p>
                        </div>
                        <Badge tone={m.status === "sent" ? "ok" : "bad"}>{m.status === "sent" ? "Enviado" : "Erro"}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
