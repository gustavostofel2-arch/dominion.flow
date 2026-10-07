import type { ReactNode } from "react";
import Link from "next/link";
import { Brand, Footer } from "@/components/ui";
import SignOutButton from "../dashboard/sign-out-button";
import { AreaLine, C, Donut, Funnel, StackedBars } from "./charts";
import { ClientsTable, CopyButton, PendingActions, WhatsAppLink } from "./admin-client";
import type { AdminData, AttentionItem } from "./data";

// Painel administrativo (só apresentação). Os dados vêm de data.ts, já filtrados no servidor.

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const NAV = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "pendencias", label: "Primeiro acesso" },
  { id: "atencao", label: "Atenção" },
  { id: "clientes", label: "Clientes" },
  { id: "uso", label: "Uso" },
  { id: "lastlink", label: "Lastlink" },
];

const EVENT_LABEL: Record<string, string> = {
  purchase_order_confirmed: "Compra",
  recurrent_payment: "Renovação",
  subscription_canceled: "Cancelamento",
  subscription_cancelled: "Cancelamento",
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

const RESULT: Record<string, { label: string; tone: "ok" | "bad" | "warn" | "mute" }> = {
  activated: { label: "Liberou acesso", tone: "ok" },
  activated_lifetime: { label: "Liberou vitalício", tone: "ok" },
  lifetime_kept: { label: "Vitalício mantido", tone: "mute" },
  deactivated: { label: "Cortou acesso", tone: "bad" },
  cancel_scheduled: { label: "Corte agendado", tone: "warn" },
  renewal_pending: { label: "Pagamento pendente", tone: "warn" },
  contact_updated: { label: "Dados atualizados", tone: "mute" },
  logged: { label: "Só registrado", tone: "mute" },
  test_ignored: { label: "Teste (ignorado)", tone: "mute" },
  stale_ignored: { label: "Fora de ordem (ignorado)", tone: "mute" },
  other_subscription_ignored: { label: "Outra assinatura (ignorado)", tone: "mute" },
  ignored_other_product: { label: "Outro produto (ignorado)", tone: "mute" },
  no_email: { label: "Sem e-mail", tone: "warn" },
  processing: { label: "Em processamento", tone: "warn" },
};

const TONE = {
  ok: "border-[#2ee6b8]/35 bg-[#2ee6b8]/10 text-[#2ee6b8]",
  bad: "border-[#ff2d55]/35 bg-[#ff2d55]/10 text-[#ff8fa3]",
  warn: "border-[#ffb547]/35 bg-[#ffb547]/10 text-[#ffb547]",
  mute: "border-white/10 bg-white/5 text-ink-mute",
};

function Section({ id, eyebrow, title, hint, children }: { id: string; eyebrow: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 pt-14">
      <p className="eyebrow">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[34px]">{title}</h2>
        {hint && <p className="max-w-md text-sm text-ink-mute sm:text-right">{hint}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Kpi({ label, value, sub, color, highlight }: { label: string; value: ReactNode; sub?: ReactNode; color: string; highlight?: boolean }) {
  return (
    <div className={`card p-5 sm:p-6 ${highlight ? "card-strong" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      </div>
      <p className="mt-3 break-words text-[26px] font-semibold leading-none tracking-[-0.03em] sm:text-[40px]">{value}</p>
      {sub && <p className="mt-2 text-[13px] text-ink-mute">{sub}</p>}
    </div>
  );
}

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card p-5 sm:p-7 ${className}`}>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {sub && <p className="mt-1 text-[13px] text-ink-mute">{sub}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-ink-mute">{children}</p>;
}

function AttentionList({ items, empty, tone }: { items: AttentionItem[]; empty: string; tone: keyof typeof TONE }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-white/5">
      {items.slice(0, 12).map((it) => (
        <li key={it.email} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{it.name || it.email}</p>
            {it.name && <p className="truncate text-[12px] text-ink-mute">{it.email}</p>}
            <p className="truncate text-[12px] text-ink-mute">{it.detail}</p>
          </div>
          {it.when && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{it.when}</span>}
        </li>
      ))}
      {items.length > 12 && <li className="pt-3 text-xs text-ink-mute">+ {items.length - 12} na tabela de clientes</li>}
    </ul>
  );
}

export default function AdminView({ email, data }: { email: string; data: AdminData }) {
  const k = data.kpis;
  return (
    <div className="theme-dark flex min-h-full flex-1 flex-col">
      <div className="dk-bg" aria-hidden="true">
        <div className="dk-grid" />
        <div className="dk-orb dk-orb-blue" />
        <div className="dk-orb dk-orb-cyan" />
        <div className="dk-noise" />
      </div>

      <header className="dk-header sticky top-0 z-20">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Brand subtitle="Painel admin" />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm text-ink-mute md:block">{email}</span>
            <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
              Área de membros
            </Link>
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-5 pb-3" aria-label="Seções">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="shrink-0 rounded-full px-3 py-1.5 text-[13px] text-ink-mute transition hover:bg-white/5 hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20">
        {/* Visão geral */}
        <section id="visao-geral" className="scroll-mt-32 pt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Painel admin · só leitura</p>
              <h1 className="mt-3 text-[40px] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[56px]">
                Visão <span className="glitch">geral</span>.
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-mute">
              <span className="dk-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <span className="dk-pulse" />
                Atualizado {data.generatedAt}
              </span>
              <a href="/admin" className="btn-ghost">
                Atualizar
              </a>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi
              highlight
              label="Clientes ativos"
              value={k.active}
              color={C.green}
              sub={`${k.activeLastlink} Lastlink · ${k.activeManual} manuais`}
            />
            <Kpi
              highlight
              label="Faturamento 30 dias"
              value={brl(k.revenue30)}
              color={C.cyan}
              sub={`Hoje: ${brl(k.revenueToday)}`}
            />
            <Kpi
              label="Vendas novas 30 dias"
              value={k.newSales30}
              color={C.blue}
              sub={`Hoje ${k.newSalesToday} · 7 dias ${k.newSales7} · ${k.renewals30} renovações`}
            />
            <Kpi
              label="Primeiro acesso pendente"
              value={<span className={k.pending ? "text-[#ffb547]" : ""}>{k.pending}</span>}
              color={C.amber}
              sub={k.pending ? "Pagaram e ainda não criaram a conta" : "Todos criaram a conta"}
            />
            <Kpi
              label="Ativações 7 dias"
              value={k.activations7}
              color={C.pink}
              sub={`Hoje ${k.activationsToday} · ${k.activeUsers7} pessoas usando`}
            />
            <Kpi
              label="Reembolsos 30 dias"
              value={k.refunds30 + k.chargebacks30}
              color={C.pink}
              sub={`${brl(k.refundsAmount30)} · ${k.chargebacks30} chargeback${k.chargebacks30 === 1 ? "" : "s"}`}
            />
            <Kpi label="Cancelamentos agendados" value={k.cancelScheduled} color={C.violet} sub="Cancelaram, mas ainda têm acesso" />
            <Kpi label="Carrinhos abandonados" value={k.abandoned30} color={C.amber} sub="Últimos 30 dias, ainda sem compra" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Vendas por dia"
              sub="Últimos 30 dias · passe o mouse nas barras para ver o valor do dia"
            >
              <StackedBars data={data.salesDaily} aLabel="Vendas novas" bLabel="Renovações" money />
            </Panel>
            <Panel className="lg:col-span-2" title="Clientes ativos por plano">
              <Donut items={data.byPlan} total={k.active} caption="ativos" />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title="Uso da ferramenta" sub="Tokens gerados por dia e quantas pessoas usaram (30 dias)">
              <AreaLine data={data.usageDaily} aLabel="Ativações" bLabel="Pessoas" />
            </Panel>
            <Panel className="lg:col-span-2" title="Funil de ativação" sub="Quem paga, cria a conta e usa de fato">
              <Funnel steps={data.funnel} />
            </Panel>
          </div>
        </section>

        {/* Primeiro acesso */}
        <Section
          id="pendencias"
          eyebrow="Pendências"
          title="Primeiro acesso"
          hint="Pagaram (ou foram liberados) e ainda não criaram a conta. Mande a mensagem pronta."
        >
          <div className="card overflow-hidden">
            {data.pending.length === 0 ? (
              <div className="p-6">
                <Empty>Ninguém pendente. Todos os clientes ativos já criaram a conta.</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {data.pending.map((p) => (
                  <li key={p.email} className="flex flex-col gap-3 px-5 py-4 sm:px-7 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{p.name || p.email}</p>
                      <p className="truncate text-[13px] text-ink-mute">
                        {p.name ? `${p.email} · ` : ""}
                        {p.phone ?? "sem telefone"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 md:w-56">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                        {p.plan}
                      </span>
                      <span className={`text-[13px] ${p.sinceDays !== null && p.sinceDays >= 2 ? "text-[#ffb547]" : "text-ink-mute"}`}>
                        {p.sinceDays === null ? "" : p.sinceDays === 0 ? "comprou hoje" : `há ${p.sinceDays} dia${p.sinceDays === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <div className="md:flex md:w-[290px] md:justify-end">
                      <PendingActions name={p.name} email={p.email} whatsapp={p.whatsapp} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* Atenção */}
        <Section id="atencao" eyebrow="Acompanhamento" title="Precisa de atenção" hint="Para agir antes de perder o cliente.">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Renovam nos próximos 7 dias" sub="Cobrança automática da Lastlink">
              <AttentionList items={data.renewSoon} empty="Nenhuma renovação nos próximos 7 dias." tone="ok" />
            </Panel>
            <Panel title="Perdem o acesso em até 14 dias" sub="Cancelaram ou o acesso liberado à mão está acabando">
              <AttentionList items={data.losingAccess} empty="Ninguém perde o acesso nos próximos 14 dias." tone="bad" />
            </Panel>
            <Panel title="Pagamento pendente" sub="A renovação não foi paga ainda">
              <AttentionList items={data.paymentPending} empty="Nenhum pagamento pendente." tone="warn" />
            </Panel>
            <Panel title="Parados há mais de 14 dias" sub="Têm acesso e conta, mas não geram token. Risco de cancelar.">
              <AttentionList items={data.idle} empty="Todos os clientes com conta usaram nos últimos 14 dias." tone="warn" />
            </Panel>
          </div>
        </Section>

        {/* Clientes */}
        <Section id="clientes" eyebrow="Base" title="Clientes" hint="Todos os e-mails do sistema, com busca e filtros.">
          <div className="card p-5 sm:p-7">
            <ClientsTable rows={data.clients} />
          </div>
        </Section>

        {/* Uso e segurança */}
        <Section id="uso" eyebrow="Uso e segurança" title="Quem mais usa" hint="Muitos IPs diferentes numa conta podem indicar login compartilhado.">
          <div className="card overflow-hidden">
            {data.topUsers.length === 0 ? (
              <div className="p-6">
                <Empty>Nenhuma ativação nos últimos 7 dias.</Empty>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                      <th className="px-5 py-3 font-medium sm:px-7">#</th>
                      <th className="py-3 pr-4 font-medium">Cliente</th>
                      <th className="py-3 pr-4 text-right font-medium">Ativações 7d</th>
                      <th className="py-3 pr-4 text-right font-medium">IPs diferentes</th>
                      <th className="py-3 pr-4 font-medium">Última</th>
                      <th className="py-3 pr-7 font-medium">Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((u, i) => (
                      <tr key={u.email} className="border-b border-white/5">
                        <td className="px-5 py-3 font-mono text-ink-mute sm:px-7">{String(i + 1).padStart(2, "0")}</td>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-ink">{u.name || u.email}</p>
                          {u.name && <p className="text-[12px] text-ink-mute">{u.email}</p>}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-ink-soft">{u.uses7}</td>
                        <td className="py-3 pr-4 text-right font-mono text-ink-soft">{u.ips7}</td>
                        <td className="py-3 pr-4 text-ink-mute">{u.last}</td>
                        <td className="py-3 pr-7">
                          {u.suspicious ? (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE.bad}`}>Verificar</span>
                          ) : (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE.ok}`}>Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* Lastlink */}
        <Section id="lastlink" eyebrow="Lastlink" title="Avisos e carrinhos" hint="O que a Lastlink mandou e o que o sistema fez com cada aviso.">
          <div className="grid gap-4 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title="Últimos avisos recebidos" sub="Para conferir na hora se alguém disser que pagou e não liberou">
              {data.events.length === 0 ? (
                <Empty>Nenhum aviso nos últimos 90 dias.</Empty>
              ) : (
                <ul className="divide-y divide-white/5">
                  {data.events.map((e) => {
                    const r = RESULT[e.result] ?? { label: e.result, tone: "mute" as const };
                    return (
                      <li key={e.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {EVENT_LABEL[e.event.toLowerCase()] ?? e.event}
                            {e.amount ? <span className="ml-2 font-mono text-[12px] text-ink-mute">{brl(e.amount)}</span> : null}
                            {e.isTest && <span className="ml-2 text-[11px] text-ink-mute">(teste)</span>}
                          </p>
                          <p className="truncate text-[12px] text-ink-mute">
                            {e.email ?? "sem e-mail"} · {e.when}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[r.tone]}`}>{r.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel className="lg:col-span-2" title="Carrinhos abandonados" sub="Entraram no checkout e não compraram (30 dias)">
              {data.abandoned.length === 0 ? (
                <Empty>Nenhum carrinho abandonado.</Empty>
              ) : (
                <ul className="divide-y divide-white/5">
                  {data.abandoned.map((a) => (
                    <li key={a.email} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{a.name || a.email}</p>
                          <p className="truncate text-[12px] text-ink-mute">{a.name ? a.email : a.offer}</p>
                        </div>
                        <span className="shrink-0 text-[12px] text-ink-mute">{a.when}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CopyButton text={a.email} label="E-mail" />
                        <WhatsAppLink
                          number={a.whatsapp}
                          text={`Olá${a.name ? `, ${a.name.split(/\s+/)[0]}` : ""}! Vi que você começou a assinatura do Dominion e não finalizou. Posso te ajudar?`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
