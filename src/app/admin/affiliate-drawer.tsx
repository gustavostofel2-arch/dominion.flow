"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getClientDetailAction, type ClientDetail } from "./actions";
import type { AffiliateSale } from "./affiliates";
import { Info, eventLabel, resultOf } from "./client-drawer";
import { CopyButton, useAdmin } from "./messaging";
import { Badge, Columns, Empty, brl } from "./ui-kit";

// Ficha do afiliado em janela central (90% da tela): vendas dele por período, assinaturas
// ativas, se tem acesso ao Dominion Flow, se é mentorado (pela oferta que comprou) e o
// histórico completo dele como comprador.

// Ofertas de mentoria: "[mentorados]", "[MENTORADOS]", "[Ment. Individuais]".
const MENTOR_RE = /mentorad|\bment\./i;
const PAYMENT_EVENTS = new Set(["purchase_order_confirmed", "recurrent_payment"]);
const PERIOD_ORDER = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual", "Vitalício"];

function initials(name: string | null, email: string | null) {
  const src = (name || email || "?").replace(/@.*/, "").trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const out = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : src.slice(0, 2)) || "?";
  return out.toUpperCase();
}

function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">{value}</p>
      {sub && <p className="mt-1.5 truncate text-[12px] text-ink-mute">{sub}</p>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="font-semibold">{title}</h4>
        {right && <span className="text-[12px] text-ink-mute">{right}</span>}
      </div>
      {children}
    </section>
  );
}

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
  const clientByEmail = useMemo(() => new Map(data.clients.map((c) => [c.email, c])), [data.clients]);

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
    // Trava a rolagem da página de trás enquanto a janela está aberta.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
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
    const periods = new Map<string, number>();
    const buyers = new Set<string>();
    for (const s of mine) {
      if (s.refunded) {
        refunds++;
        continue;
      }
      if (s.renewal) renewals++;
      else news++;
      revenue += s.value;
      commission += s.commission;
      periods.set(s.period, (periods.get(s.period) ?? 0) + 1);
      if (s.buyer) buyers.add(s.buyer);
    }
    const activeBuyers = [...buyers].filter((e) => clientByEmail.get(e)?.active).length;
    const periodList = [...periods.entries()].sort((a, b) => {
      const ia = PERIOD_ORDER.indexOf(a[0]);
      const ib = PERIOD_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b[1] - a[1];
    });
    const first = mine.length ? mine[mine.length - 1].when : null;
    return { news, renewals, refunds, revenue, commission, periods, periodList, buyers: buyers.size, activeBuyers, first, last: head?.when ?? null };
  }, [mine, head, clientByEmail]);

  if (!head) return null;

  const access = client
    ? client.active
      ? { tone: "ok" as const, label: "Tem acesso ao Dominion Flow" }
      : { tone: "bad" as const, label: "Sem acesso (inativo)" }
    : { tone: "mute" as const, label: "Não é cliente do Dominion Flow" };
  const mentor = !email
    ? { tone: "mute" as const, label: "Mentorado: sem e-mail para checar" }
    : !detail
      ? { tone: "mute" as const, label: "Mentorado: verificando…" }
      : mentorOffers.length > 0
        ? { tone: "info" as const, label: "É mentorado" }
        : { tone: "mute" as const, label: "Não é mentorado" };
  const mensal = stats.periods.get("Mensal") ?? 0;
  const anual = stats.periods.get("Anual") ?? 0;

  return (
    <div className="dk-modal-bg fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-0 backdrop-blur-md sm:p-6" onClick={onClose}>
      <div
        className="dk-modal card card-strong flex h-full w-full flex-col overflow-hidden !rounded-none sm:h-[90vh] sm:w-[90vw] sm:!rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha do afiliado ${head.affName ?? email ?? ""}`}
      >
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-4 border-b border-white/10 px-5 py-5 sm:px-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3fd0ff] to-[#ff2d55] text-lg font-bold text-white shadow-[0_0_30px_rgba(63,208,255,0.25)]">
            {initials(head.affName, email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{head.affName || email || "Afiliado"}</p>
            <p className="truncate text-[13px] text-ink-mute">{email ?? "sem e-mail"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="warn">Afiliado{head.pct !== null ? ` · ${head.pct}%` : ""}</Badge>
              <Badge tone={access.tone}>{access.label}</Badge>
              <Badge tone={mentor.tone}>{mentor.label}</Badge>
              {client && <Badge tone="mute">{client.plan}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {email && <CopyButton text={email} label="E-mail" />}
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
            <button type="button" onClick={onClose} className="btn-ghost !h-9">
              Fechar ✕
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {/* Números do afiliado */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Stat label="Vendas" value={stats.news + stats.renewals} sub={`${stats.news} novas · ${stats.renewals} renov.`} color="#3fd0ff" />
            <Stat label="Assinaturas ativas" value={stats.activeBuyers} sub={`de ${stats.buyers} cliente${stats.buyers === 1 ? "" : "s"} indicado${stats.buyers === 1 ? "" : "s"}`} color="#2ee6b8" />
            <Stat label="Mensais" value={mensal} sub="vendas no mensal" color="#7c8cff" />
            <Stat label="Anuais" value={anual} sub="vendas no anual" color="#ffb547" />
            <Stat label="Faturamento" value={brl(stats.revenue)} sub={`${stats.refunds} reembolsada${stats.refunds === 1 ? "" : "s"}`} color="#3fd0ff" />
            <Stat label="Comissão gerada" value={brl(stats.commission, true)} sub={head.pct !== null ? `${head.pct}% por venda` : undefined} color="#ff2d55" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* Coluna da esquerda: ele como cliente */}
            <div className="space-y-5">
              <Section title="Como cliente do Dominion Flow">
                {!email ? (
                  <Empty>O aviso da Lastlink não trouxe o e-mail deste afiliado.</Empty>
                ) : client ? (
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
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
                  <Empty>Nenhuma compra nem acesso com este e-mail. Se ele estuda com outro e-mail, a busca só acha se for o mesmo que a Lastlink registrou como afiliado.</Empty>
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
              </Section>

              {email && error && <p className="dk-alert-error rounded-xl px-4 py-3 text-sm">Não consegui carregar o histórico dele.</p>}
              {email && !detail && !error && <p className="text-sm text-ink-mute">Carregando o histórico dele como cliente…</p>}

              {detail && (
                <>
                  {client?.hasAccount && (
                    <Section title="Uso nos últimos 30 dias" right={`${detail.totalTokens} tokens no total`}>
                      <Columns items={detail.usage} every={5} />
                    </Section>
                  )}

                  <Section title="Histórico como comprador (Lastlink)" right={`${detail.timeline.length} aviso${detail.timeline.length === 1 ? "" : "s"}`}>
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
                  </Section>
                </>
              )}
            </div>

            {/* Coluna da direita: ele como afiliado */}
            <div className="space-y-5">
              <Section title="Por período" right={`${stats.news + stats.renewals} venda${stats.news + stats.renewals === 1 ? "" : "s"} sem reembolso`}>
                {stats.periodList.length === 0 ? (
                  <Empty>Nenhuma venda válida.</Empty>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.periodList.map(([name, n]) => (
                      <span key={name} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm">
                        <span className="text-ink-soft">{name}</span>
                        <span className="font-mono font-semibold text-ink">{n}</span>
                      </span>
                    ))}
                  </div>
                )}
                <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
                  <Info label="Primeira venda" value={stats.first} />
                  <Info label="Última venda" value={stats.last} />
                  <Info label="Reembolsos" value={String(stats.refunds)} />
                </dl>
              </Section>

              <Section title="Vendas como afiliado" right={`${mine.length} no total`}>
                <ul className="divide-y divide-white/5">
                  {mine.map((s) => {
                    const buyer = s.buyer ? clientByEmail.get(s.buyer) : undefined;
                    return (
                      <li key={s.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[12px] text-ink-mute">{s.when}</span>
                          <Badge tone={s.period === "Vitalício" ? "warn" : "ok"}>{s.period}</Badge>
                          {s.renewal && <Badge tone="info">Renovação</Badge>}
                          {s.refunded && <Badge tone="bad">Reembolsada</Badge>}
                          {buyer && <Badge tone={buyer.active ? "ok" : "mute"}>{buyer.active ? "Cliente ativo" : "Cliente inativo"}</Badge>}
                          <span className="ml-auto text-sm text-ink-soft">{brl(s.value, true)}</span>
                          <span className="text-sm font-medium text-[#ffb547]">{brl(s.commission, true)}</span>
                        </div>
                        <p className="mt-1 truncate text-[12px] text-ink-mute">
                          cliente {s.buyer ?? "—"} · {s.offer ?? "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Section>

              {detail && (
                <Section title="E-mails enviados" right={`${detail.emails.length}`}>
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
                </Section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
