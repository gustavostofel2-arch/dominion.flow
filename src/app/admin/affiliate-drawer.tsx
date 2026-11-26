"use client";

import { useEffect, useMemo, useState } from "react";
import { getClientDetailAction, type ClientDetail } from "./actions";
import type { AffiliateSale } from "./affiliates";
import { Info, eventLabel, resultOf } from "./client-drawer";
import { CopyButton, useAdmin } from "./messaging";
import { Badge, Columns, Empty, brl } from "./ui-kit";

// Ficha do afiliado: vendas dele, se tem acesso ao Dominion Flow, se é mentorado
// (pela oferta que comprou) e o histórico completo dele como comprador.

// Ofertas de mentoria: "[mentorados]", "[MENTORADOS]", "[Ment. Individuais]".
const MENTOR_RE = /mentorad|\bment\./i;
const PAYMENT_EVENTS = new Set(["purchase_order_confirmed", "recurrent_payment"]);

export default function AffiliateDrawer({
  affKey,
  sales,
  onClose,
}: {
  affKey: string;
  /** Todas as vendas de afiliados (sem filtro de período). */
  sales: AffiliateSale[];
  onClose: () => void;
}) {
  const { data } = useAdmin();
  const mine = useMemo(() => sales.filter((s) => s.affKey === affKey), [sales, affKey]);
  const head = mine[0];
  const email = head?.affEmail ?? null;
  const client = email ? data.clients.find((c) => c.email === email) : undefined;

  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!email) return;
    let alive = true;
    getClientDetailAction(email, client?.userId ?? null)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [email, client?.userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ofertas de mentoria que ele comprou (só compras confirmadas, sem teste).
  const mentorOffers = useMemo(() => {
    const set = new Set<string>();
    for (const t of detail?.timeline ?? []) {
      if (t.isTest || !t.offer || !PAYMENT_EVENTS.has(t.event.toLowerCase())) continue;
      if (MENTOR_RE.test(t.offer)) set.add(t.offer);
    }
    return [...set];
  }, [detail]);

  const stats = useMemo(() => {
    let news = 0;
    let renewals = 0;
    let refunds = 0;
    let revenue = 0;
    let commission = 0;
    for (const s of mine) {
      if (s.refunded) {
        refunds++;
        continue;
      }
      if (s.renewal) renewals++;
      else news++;
      revenue += s.value;
      commission += s.commission;
    }
    const first = mine.length ? mine[mine.length - 1].when : null;
    return { news, renewals, refunds, revenue, commission, first, last: head?.when ?? null };
  }, [mine, head]);

  if (!head) return null;

  const access = client ? (client.active ? { tone: "ok" as const, label: "Tem acesso ao Dominion Flow" } : { tone: "bad" as const, label: "Sem acesso (inativo)" }) : { tone: "mute" as const, label: "Não é cliente do Dominion Flow" };
  const mentor = !email
    ? { tone: "mute" as const, label: "Mentorado: sem e-mail para checar" }
    : !detail
      ? { tone: "mute" as const, label: "Mentorado: verificando…" }
      : mentorOffers.length > 0
        ? { tone: "info" as const, label: "É mentorado" }
        : { tone: "mute" as const, label: "Não é mentorado" };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="card card-strong flex h-full w-full max-w-xl flex-col overflow-hidden !rounded-none sm:!rounded-l-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha do afiliado ${head.affName ?? email ?? ""}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">{head.affName || email || "Afiliado"}</p>
            <p className="truncate text-[13px] text-ink-mute">{email ?? "sem e-mail"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="warn">Afiliado{head.pct !== null ? ` · ${head.pct}%` : ""}</Badge>
              <Badge tone={access.tone}>{access.label}</Badge>
              <Badge tone={mentor.tone}>{mentor.label}</Badge>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !h-9 shrink-0">
            Fechar
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
          {email && (
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={email} label="E-mail" />
              {client?.phone && <CopyButton text={client.phone} label="Telefone" />}
              {client?.whatsapp && (
                <a
                  href={`https://wa.me/${client.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-lg border border-[#2ee6b8]/35 bg-[#2ee6b8]/10 px-2.5 text-xs font-medium text-[#2ee6b8]"
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}

          <section>
            <h4 className="mb-3 font-semibold">Como afiliado</h4>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
              <Info label="Vendas novas" value={String(stats.news)} />
              <Info label="Renovações" value={String(stats.renewals)} />
              <Info label="Reembolsos" value={String(stats.refunds)} />
              <Info label="Faturamento gerado" value={brl(stats.revenue, true)} />
              <Info label="Comissão gerada" value={brl(stats.commission, true)} />
              <Info label="Comissão (%)" value={head.pct !== null ? `${head.pct}%` : null} />
              <Info label="Primeira venda" value={stats.first} />
              <Info label="Última venda" value={stats.last} />
            </dl>
          </section>

          <section>
            <h4 className="mb-3 font-semibold">Como cliente do Dominion Flow</h4>
            {!email ? (
              <Empty>O aviso da Lastlink não trouxe o e-mail deste afiliado.</Empty>
            ) : client ? (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
                <Info label="Status" value={client.active ? "Ativo" : "Inativo"} />
                <Info label="Plano" value={`${client.plan} · ${client.source}`} />
                <Info label="Acesso até" value={client.accessUntil} />
                <Info label="Cliente desde" value={`${client.since} (${client.sinceDays}d)`} />
                <Info label="Conta" value={client.hasAccount ? `Criada ${client.accountCreated}` : "Não criou"} />
                <Info label="Último login" value={client.lastLoginRel} />
                <Info label="Último token" value={client.lastUseRel ?? (client.everUsed ? "há mais de 90 dias" : client.hasAccount ? "Nunca" : null)} />
                <Info label="Ativações (30d)" value={String(client.uses30)} />
                <Info label="Telefone" value={client.phone} />
                <Info label="Valor da compra" value={client.amount !== null ? brl(client.amount, true) : null} />
                <Info label="Pagamento" value={client.method ? `${client.method}${client.installments && client.installments > 1 ? ` ${client.installments}x` : ""}` : null} />
                <Info label="Origem (utm)" value={client.utm} />
              </dl>
            ) : (
              <Empty>Nenhuma compra nem acesso com este e-mail. Se ele usa outro e-mail para estudar, a busca só acha se for o mesmo cadastrado na Lastlink como afiliado.</Empty>
            )}
            {client && client.flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.flags.map((f) => (
                  <Badge key={f} tone="bad">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
            {mentorOffers.length > 0 && (
              <p className="mt-3 text-[13px] text-ink-soft">
                Mentorado pela(s) oferta(s): <span className="text-ink">{mentorOffers.join(" · ")}</span>
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h4 className="font-semibold">Vendas como afiliado</h4>
              <span className="text-[12px] text-ink-mute">{mine.length} no total</span>
            </div>
            <ul className="divide-y divide-white/5">
              {mine.map((s) => (
                <li key={s.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-ink-mute">{s.when}</span>
                    {s.renewal && <Badge tone="info">Renovação</Badge>}
                    {s.refunded && <Badge tone="bad">Reembolsada</Badge>}
                    <span className="ml-auto text-sm text-ink-soft">{brl(s.value, true)}</span>
                    <span className="text-sm font-medium text-[#ffb547]">{brl(s.commission, true)}</span>
                  </div>
                  <p className="truncate text-[12px] text-ink-mute">
                    cliente {s.buyer ?? "—"} · {s.offer ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {email && error && <p className="dk-alert-error rounded-xl px-4 py-3 text-sm">Não consegui carregar o histórico dele.</p>}
          {email && !detail && !error && <p className="text-sm text-ink-mute">Carregando o histórico dele como cliente…</p>}

          {detail && (
            <>
              {client?.hasAccount && (
                <section>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h4 className="font-semibold">Uso nos últimos 30 dias</h4>
                    <span className="text-[12px] text-ink-mute">{detail.totalTokens} tokens no total</span>
                  </div>
                  <Columns items={detail.usage} every={5} />
                </section>
              )}

              <section>
                <h4 className="mb-3 font-semibold">Histórico como comprador (Lastlink)</h4>
                {detail.timeline.length === 0 ? (
                  <Empty>Nenhum aviso da Lastlink com este e-mail como comprador.</Empty>
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
