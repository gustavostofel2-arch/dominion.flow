"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AreaLine, C, Donut, Funnel, StackedBars } from "./charts";
import { eventLabel, resultOf } from "./client-drawer";
import { resetTemplateAction, saveReplyToAction, saveTemplateAction } from "./actions";
import { DEFAULT_TEMPLATES, VARIABLES, fill, templateVars, type EmailTemplate } from "./email-templates";
import type { AttentionItem } from "./data";
import { ContactList, useAdmin } from "./messaging";
import { Badge, Columns, Empty, Kpi, Pager, Panel, Scroll, brl, useConfirm, usePager, type Tone } from "./ui-kit";

// ---------- Dashboard ----------

function AttentionList({ items, empty, tone }: { items: AttentionItem[]; empty: string; tone: Tone }) {
  const { openClient } = useAdmin();
  const p = usePager(items);
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <>
      <Scroll max={340}>
        <ul className="divide-y divide-white/5">
          {p.slice.map((it) => (
            <li key={it.email} onClick={() => openClient(it.email)} className="flex cursor-pointer items-center justify-between gap-3 py-3 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{it.name || it.email}</p>
                {it.name && <p className="truncate text-[12px] text-ink-mute">{it.email}</p>}
                <p className="truncate text-[12px] text-ink-mute">{it.detail}</p>
              </div>
              {it.when && <Badge tone={tone}>{it.when}</Badge>}
            </li>
          ))}
        </ul>
      </Scroll>
      <Pager p={p} />
    </>
  );
}

export function TabDashboard({ go }: { go: (tab: string) => void }) {
  const { data } = useAdmin();
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi highlight label="Clientes ativos" value={k.active} color={C.green} sub={`${k.activeLastlink} Lastlink · ${k.activeManual} manuais`} />
        <Kpi highlight label="Faturamento 30 dias" value={brl(k.revenue30)} color={C.cyan} sub={`Hoje: ${brl(k.revenueToday)} · preço da oferta, sem juros e sem reembolsos`} />
        <Kpi label="Vendas novas 30 dias" value={k.newSales30} color={C.blue} sub={`Hoje ${k.newSalesToday} · 7 dias ${k.newSales7} · ${k.renewals30} renovações · sem reembolsadas`} />
        <Kpi label="Reembolsos 30 dias" value={k.refunds30 + k.chargebacks30} color={C.pink} sub={`${brl(k.refundsAmount30)} · ${k.chargebacks30} chargeback${k.chargebacks30 === 1 ? "" : "s"}`} />
        <button type="button" onClick={() => go("ativacao")} className="text-left">
          <Kpi label="Primeiro acesso pendente" value={<span className={k.pending ? "text-[#ffb547]" : ""}>{k.pending}</span>} color={C.amber} sub="Pagaram e não criaram a conta →" />
        </button>
        <button type="button" onClick={() => go("ativacao")} className="text-left">
          <Kpi label="Nunca geraram token" value={<span className={k.neverUsed ? "text-[#ffb547]" : ""}>{k.neverUsed}</span>} color={C.pink} sub="Criaram a conta e não ativaram →" />
        </button>
        <Kpi label="Ativações 7 dias" value={k.activations7} color={C.violet} sub={`Hoje ${k.activationsToday} · ${k.activeUsers7} pessoas usando`} />
        <Kpi label="Cancelamentos agendados" value={k.cancelScheduled} color={C.violet} sub="Cancelaram, mas ainda têm acesso" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Vendas por dia" sub="Últimos 30 dias · passe o mouse nas barras para ver o valor do dia">
          <StackedBars data={data.salesDaily} aLabel="Vendas novas" bLabel="Renovações" money />
        </Panel>
        <Panel className="lg:col-span-2" title="Clientes ativos por plano">
          <Donut items={data.byPlan} total={k.active} caption="ativos" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Uso da ferramenta" sub="Tokens gerados por dia e quantas pessoas usaram (30 dias)">
          <AreaLine data={data.usageDaily} aLabel="Ativações" bLabel="Pessoas" />
        </Panel>
        <Panel className="lg:col-span-2" title="Funil de ativação" sub="Quem paga, cria a conta e usa de fato">
          <Funnel steps={data.funnel} />
        </Panel>
      </div>

      <div className="pt-6">
        <p className="eyebrow">Acompanhamento</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">Precisa de atenção</h2>
      </div>
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
        <Panel title="Parados há mais de 14 dias" sub="Sem gerar token há mais de 14 dias. Risco de cancelar.">
          <AttentionList items={data.idle} empty="Ninguém parado há mais de 14 dias." tone="warn" />
        </Panel>
      </div>
    </div>
  );
}

// ---------- Ativação ----------

export function TabActivation() {
  const { data } = useAdmin();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title={`Primeiro acesso pendente · ${data.pending.length}`} sub="Pagaram (ou foram liberados) e ainda não criaram a conta no site.">
        <ContactList rows={data.pending} templateId="primeiro-acesso" empty="Ninguém pendente. Todos criaram a conta." />
      </Panel>
      <Panel title={`Nunca geraram token · ${data.neverUsed.length}`} sub="Criaram a conta, mas nunca ativaram a ferramenta. Maior risco de reembolso.">
        <ContactList rows={data.neverUsed} templateId="nunca-ativou" empty="Todos que criaram a conta já geraram token." />
      </Panel>
    </div>
  );
}

// ---------- Uso ----------

export function TabUsage() {
  const { data, openClient } = useAdmin();
  const p = usePager(data.topUsers);
  return (
    <div className="space-y-4">
      <Panel title="Uso da ferramenta" sub="Tokens gerados por dia e quantas pessoas usaram (30 dias)">
        <AreaLine data={data.usageDaily} aLabel="Ativações" bLabel="Pessoas" />
      </Panel>
      <Panel title="Quem mais usa" sub="Últimos 30 dias. Muitos IPs diferentes numa conta em 7 dias podem indicar login compartilhado.">
        {data.topUsers.length === 0 ? (
          <Empty>Nenhuma ativação nos últimos 30 dias.</Empty>
        ) : (
          <>
            <div className="max-h-[600px] overflow-auto overscroll-contain rounded-xl border border-white/5">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 bg-[#0b1222]">
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="py-3 pr-4 font-medium">Cliente</th>
                    <th className="py-3 pr-4 text-right font-medium">7 dias</th>
                    <th className="py-3 pr-4 text-right font-medium">30 dias</th>
                    <th className="py-3 pr-4 text-right font-medium">IPs (7d)</th>
                    <th className="py-3 pr-4 font-medium">Último</th>
                    <th className="py-3 pr-4 font-medium">Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {p.slice.map((u, i) => (
                    <tr key={u.email} onClick={() => openClient(u.email)} className="cursor-pointer border-b border-white/5 hover:bg-white/[0.04]">
                      <td className="px-4 py-3 font-mono text-ink-mute">{String(p.from + i).padStart(2, "0")}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ink">{u.name || u.email}</p>
                        {u.name && <p className="text-[12px] text-ink-mute">{u.email}</p>}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{u.uses7}</td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{u.uses30}</td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{u.ips7}</td>
                      <td className="py-3 pr-4 text-ink-mute">{u.last}</td>
                      <td className="py-3 pr-4">{u.suspicious ? <Badge tone="bad">Verificar</Badge> : <Badge tone="ok">Normal</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager p={p} />
          </>
        )}
      </Panel>
    </div>
  );
}

// ---------- Lastlink ----------

const EVENT_FILTERS = [
  { id: "todos", label: "Todos", test: () => true },
  { id: "vendas", label: "Vendas", test: (e: string) => ["purchase_order_confirmed", "recurrent_payment"].includes(e) },
  { id: "reembolsos", label: "Reembolsos", test: (e: string) => ["payment_refund", "payment_chargeback", "refund_requested"].includes(e) },
  { id: "cancelamentos", label: "Cancelamentos", test: (e: string) => e.startsWith("subscription_cancel") || e === "subscription_expired" },
  { id: "carrinhos", label: "Carrinhos", test: (e: string) => e === "abandoned_cart" },
] as const;

export function TabLastlink() {
  const { data, openClient } = useAdmin();
  const [f, setF] = useState<(typeof EVENT_FILTERS)[number]["id"]>("todos");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const flt = EVENT_FILTERS.find((x) => x.id === f)!;
    const term = q.trim().toLowerCase();
    return data.events.filter((e) => flt.test(e.event.toLowerCase()) && (!term || (e.email ?? "").includes(term)));
  }, [data.events, f, q]);
  const p = usePager(list);
  const known = new Set(data.clients.map((c) => c.email));

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Panel className="xl:col-span-3" title="Avisos recebidos" sub="Tudo que a Lastlink mandou e o que o sistema fez com cada aviso (último ano).">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por e-mail" className="field !h-10 sm:max-w-xs" />
          <div className="flex flex-wrap gap-1.5">
            {EVENT_FILTERS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setF(x.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${f === x.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 text-ink-mute hover:text-ink-soft"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty>Nenhum aviso.</Empty>
        ) : (
          <>
            <Scroll max={620}>
              <ul className="divide-y divide-white/5">
                {p.slice.map((e) => {
                  const r = resultOf(e.result);
                  const clickable = !!e.email && known.has(e.email);
                  return (
                    <li key={e.id} onClick={() => clickable && openClient(e.email!)} className={`flex items-center gap-3 py-3 ${clickable ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {eventLabel(e.event)}
                          {e.amount ? <span className="ml-2 font-mono text-[12px] text-ink-mute">{brl(e.amount)}</span> : null}
                          {e.isTest && <span className="ml-2 text-[11px] text-ink-mute">(teste)</span>}
                        </p>
                        {e.paid !== null && e.amount !== null && e.paid - e.amount > 0.01 && (
                          <p className="truncate text-[12px] text-ink-mute">Cliente pagou {brl(e.paid, true)} parcelado (juros do cartão)</p>
                        )}
                        <p className="truncate text-[12px] text-ink-mute">
                          {e.email ?? "sem e-mail"} · {e.when}
                        </p>
                      </div>
                      <Badge tone={r.tone}>{r.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </Scroll>
            <Pager p={p} />
          </>
        )}
      </Panel>
      <Panel className="xl:col-span-2" title={`Carrinhos abandonados · ${data.abandoned.length}`} sub="Entraram no checkout e não compraram (30 dias).">
        <ContactList rows={data.abandoned} templateId="carrinho" empty="Nenhum carrinho abandonado." />
      </Panel>
    </div>
  );
}

// ---------- E-mails ----------

function TemplateEditor({ t }: { t: EmailTemplate }) {
  const { data } = useAdmin();
  const router = useRouter();
  const [d, setD] = useState(t);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Último campo em que o cursor esteve: a variável clicada entra exatamente ali.
  const form = useRef<HTMLDivElement>(null);
  const [confirm, confirmEl] = useConfirm();
  const focused = useRef<{ key: "subject" | "body" | "button_url"; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);
  const dirty = d.subject !== t.subject || d.body !== t.body || d.button_label !== t.button_label || d.button_url !== t.button_url;
  const vars = templateVars({ email: "cliente@exemplo.com", name: "Maria Silva", plan: "Mensal", renewal: "10/11/2026" }, data.checkoutUrl);
  const field = "field !h-11 !text-sm";

  function insertVar(name: string) {
    const token = `{{${name}}}`;
    // Campo com o cursor agora (o botão não tira o foco); senão o último usado; senão a mensagem.
    const active = document.activeElement;
    const inForm = active instanceof HTMLElement && form.current?.contains(active) ? active : null;
    const field = inForm?.dataset.field as "subject" | "body" | "button_url" | undefined;
    const f = field ? { key: field, el: inForm as HTMLInputElement | HTMLTextAreaElement } : (focused.current ?? { key: "body" as const, el: null });
    const cur = (f.key === "button_url" ? d.button_url : d[f.key]) ?? "";
    const start = f.el?.selectionStart ?? cur.length;
    const end = f.el?.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    setD({ ...d, [f.key]: next });
    requestAnimationFrame(() => {
      if (!f.el) return;
      f.el.focus();
      f.el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setBusy(true);
    const r = await saveTemplateAction({ id: t.id, subject: d.subject, body: d.body, button_label: d.button_label, button_url: d.button_url });
    setBusy(false);
    setMsg(r.ok ? "Salvo ✓" : (r.error ?? "Erro"));
    if (r.ok) router.refresh();
  }
  async function reset() {
    const ok = await confirm({
      title: "Restaurar o texto padrão?",
      message: "O assunto, a mensagem e o botão deste modelo voltam ao texto original. As suas alterações serão perdidas.",
      confirmLabel: "Restaurar",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await resetTemplateAction(t.id);
    setBusy(false);
    if (r.ok) {
      const def = DEFAULT_TEMPLATES.find((x) => x.id === t.id);
      if (def) setD(def);
      router.refresh();
    }
    setMsg(r.ok ? "Restaurado para o texto padrão ✓" : (r.error ?? "Erro"));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {confirmEl}
      <div ref={form} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-ink-mute">Assunto</span>
          <input data-field="subject" value={d.subject} onFocus={(e) => (focused.current = { key: "subject", el: e.currentTarget })} onChange={(e) => setD({ ...d, subject: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-ink-mute">Mensagem (também usada no WhatsApp)</span>
          <textarea data-field="body" value={d.body} onFocus={(e) => (focused.current = { key: "body", el: e.currentTarget })} onChange={(e) => setD({ ...d, body: e.target.value })} rows={12} className="field !h-auto !py-3 !text-sm leading-relaxed" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-ink-mute">Texto do botão</span>
            <input value={d.button_label ?? ""} onChange={(e) => setD({ ...d, button_label: e.target.value || null })} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-ink-mute">Link do botão</span>
            <input data-field="button_url" value={d.button_url ?? ""} onFocus={(e) => (focused.current = { key: "button_url", el: e.currentTarget })} onChange={(e) => setD({ ...d, button_url: e.target.value || null })} className={field} />
          </label>
        </div>
        <p className="text-[12px] text-ink-mute">Variáveis: clique para colocar onde está o cursor. O sistema troca pelo dado de cada pessoa no envio.</p>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertVar(v.key)}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-left text-[11px] text-ink-mute hover:text-ink"
            >
              <span className="font-mono text-[#7be3ff]">{`{{${v.key}}}`}</span>
              <span className="ml-1.5">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={save}
            className="inline-flex h-10 items-center rounded-xl bg-[#ff2d55] px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Salvar modelo
          </button>
          <button type="button" disabled={busy} onClick={reset} className="btn-ghost !h-10">
            Restaurar padrão
          </button>
          {msg && <span className="text-[13px] text-ink-mute">{msg}</span>}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12px] uppercase tracking-[0.12em] text-ink-mute">Prévia (exemplo: Maria Silva)</p>
        <div className="overflow-hidden rounded-2xl bg-[#ffffff] text-[#18181b]">
          <div className="bg-[#070b16] px-5 py-3 text-sm font-bold text-[#eaf2ff]">Dominion</div>
          <div className="px-5 py-4">
            <p className="mb-3 text-[13px] font-semibold text-[#6b7280]">Assunto: {fill(d.subject, vars)}</p>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{fill(d.body, vars)}</div>
            {d.button_label && d.button_url && <span className="mt-4 inline-block rounded-xl bg-[#ff2d55] px-5 py-2.5 text-sm font-semibold text-white">{d.button_label}</span>}
          </div>
          <div className="border-t border-[#eceef2] px-5 py-3 text-[12px] text-[#6b7280]">Precisa de ajuda? Fale com a gente no WhatsApp</div>
        </div>
      </div>
    </div>
  );
}

function ReplyTo() {
  const { data } = useAdmin();
  const router = useRouter();
  const [v, setV] = useState(data.email.replyTo ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await saveReplyToAction(v);
        setMsg(r.ok ? "Salvo ✓" : (r.error ?? "Erro"));
        if (r.ok) router.refresh();
      }}
    >
      <input type="email" value={v} onChange={(e) => setV(e.target.value)} placeholder="suporte@seudominio.com" className="field !h-11 !text-sm sm:max-w-sm" />
      <button type="submit" className="btn-ghost !h-11">
        Salvar
      </button>
      {msg && <span className="text-[13px] text-ink-mute">{msg}</span>}
    </form>
  );
}

const DELIVERY: Record<string, { label: string; tone: Tone }> = {
  delivered: { label: "Entregue", tone: "ok" },
  opened: { label: "Aberto", tone: "info" },
  clicked: { label: "Clicado", tone: "info" },
  sent: { label: "Enviado", tone: "mute" },
  queued: { label: "Na fila", tone: "mute" },
  scheduled: { label: "Agendado", tone: "mute" },
  delivery_delayed: { label: "Atrasado", tone: "warn" },
  bounced: { label: "Devolvido", tone: "bad" },
  complained: { label: "Marcou spam", tone: "bad" },
  failed: { label: "Falhou", tone: "bad" },
  canceled: { label: "Cancelado", tone: "mute" },
};
function DeliveryBadge({ status }: { status: string }) {
  const d = DELIVERY[status] ?? { label: status, tone: "mute" as Tone };
  return <Badge tone={d.tone}>{d.label}</Badge>;
}

function RecoveryPanel() {
  const { data, openClient } = useAdmin();
  const r = data.email.recovery;
  const p = usePager(r.list);
  const known = new Set(data.clients.map((c) => c.email));
  return (
    <Panel
      title="Histórico · Recuperação de senha"
      sub="E-mails de “esqueci minha senha” (enviados pelo Supabase). Gastam a mesma cota."
    >
      {!r.ready ? (
        <Empty>Cadastre a RESEND_READ_API_KEY (chave “Full access” do Resend) na Vercel para ver os e-mails de senha e o status de entrega.</Empty>
      ) : (
        <div className="space-y-5">
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["24h", r.last24],
                  ["7 dias", r.last7],
                  ["Resend 24h", r.total24 ?? 0],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <p className="font-mono text-[22px] font-semibold text-ink">{v}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ink-mute">{l}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-[12px] text-ink-mute">Pedidos por dia (7 dias)</p>
              <Columns items={r.daily} every={5} color={C.amber} />
            </div>
            {r.top.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] text-ink-mute">Pediram mais de uma vez</p>
                <ul className="space-y-1.5">
                  {r.top.map((t) => (
                    <li key={t.email} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-ink-soft">{t.email}</span>
                      <Badge tone="warn">{t.count}x</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            {r.list.length === 0 ? (
              <Empty>Nenhum e-mail de recuperação de senha nos últimos 7 dias.</Empty>
            ) : (
              <>
                <Scroll max={360}>
                  <ul className="divide-y divide-white/5">
                    {p.slice.map((x, i) => (
                      <li
                        key={i}
                        onClick={() => known.has(x.email) && openClient(x.email)}
                        className={`flex items-center justify-between gap-3 py-2.5 ${known.has(x.email) ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{x.name || x.email}</p>
                          <p className="truncate text-[12px] text-ink-mute">
                            {x.name ? `${x.email} · ` : ""}
                            {x.when}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2">
                          {x.status && <DeliveryBadge status={x.status} />}
                          <span className="text-[12px] text-ink-mute">{x.rel}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Scroll>
                <Pager p={p} />
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function SentHistoryPanel() {
  const { data } = useAdmin();
  const e = data.email;
  const p = usePager(e.log);
  return (
    <Panel title="Histórico · Enviados pelo painel" sub="E-mails que você ou o Higor enviaram (90 dias), com o status de entrega.">
      {e.log.length === 0 ? (
        <Empty>Nenhum e-mail enviado ainda.</Empty>
      ) : (
        <>
          <Scroll max={520}>
            <ul className="divide-y divide-white/5">
              {p.slice.map((l, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{l.to}</p>
                    <p className="truncate text-[12px] text-ink-mute">
                      {l.template ?? "—"} · {l.subject}
                    </p>
                    <p className="truncate text-[12px] text-ink-mute">
                      {l.when} · por {l.by}
                      {l.error ? ` · ${l.error}` : ""}
                    </p>
                  </div>
                  {l.status === "sent" ? l.delivery ? <DeliveryBadge status={l.delivery} /> : <Badge tone="ok">Enviado</Badge> : <Badge tone="bad">Erro</Badge>}
                </li>
              ))}
            </ul>
          </Scroll>
          <Pager p={p} />
        </>
      )}
    </Panel>
  );
}

export function TabEmails() {
  const { data } = useAdmin();
  const [sel, setSel] = useState(data.email.templates[0].id);
  const t = data.email.templates.find((x) => x.id === sel)!;
  const e = data.email;

  return (
    <div className="space-y-4">
      {(!e.ready || !e.configured) && (
        <div className="rounded-2xl border border-[#ffb547]/35 bg-[#ffb547]/10 px-5 py-4 text-sm text-[#ffd79a]">
          <p className="font-semibold">Falta configurar para enviar e-mails:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {!e.ready && <li>Rodar o SQL do painel no Supabase (cria as tabelas de modelos e histórico).</li>}
            {!e.configured && <li>Cadastrar a variável RESEND_API_KEY na Vercel e fazer um novo deploy.</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi highlight label="Cota usada (24h)" value={`${e.sent24}/${e.limit}`} color={C.cyan} sub={
            e.recovery.ready
              ? `${e.panel24} pelo painel · ${Math.max(0, e.sent24 - e.panel24)} de senha · restam ${Math.max(0, e.limit - e.sent24)}`
              : `Só os do painel (falta a chave de leitura do Resend) · restam ${Math.max(0, e.limit - e.sent24)}`
          } />
        <Kpi label="Enviados em 90 dias" value={e.log.filter((l) => l.status === "sent").length} color={C.green} sub="Pelo painel" />
        <Kpi label="Com erro" value={e.log.filter((l) => l.status !== "sent").length} color={C.pink} sub="Veja o motivo no histórico" />
        <Kpi label="Remetente" value={<span className="text-[15px] sm:text-[17px]">dominion@</span>} color={C.violet} sub="mail.dominion-flow.app" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <SentHistoryPanel />
        <RecoveryPanel />
      </div>

      <Panel title="E-mail para respostas" sub="Quando o cliente clicar em responder, a resposta vai para este e-mail.">
        <ReplyTo />
      </Panel>

      <Panel title="Modelos" sub="Edite os textos. O mesmo texto é usado no botão de WhatsApp.">
        <div className="mb-5 flex flex-wrap gap-2">
          {data.email.templates.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(x.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${sel === x.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 text-ink-mute hover:text-ink-soft"}`}
              title={x.hint}
            >
              {x.name}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[13px] text-ink-mute">{t.hint}</p>
        <TemplateEditor key={`${t.id}:${t.subject}:${t.body}`} t={t} />
      </Panel>

    </div>
  );
}
