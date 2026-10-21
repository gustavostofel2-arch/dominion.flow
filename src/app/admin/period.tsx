"use client";

import { useMemo, useState } from "react";
import { C, StackedBars } from "./charts";
import type { DayPoint, LedgerItem } from "./data";
import { useAdmin } from "./messaging";
import { HBars, Kpi, Panel, brl } from "./ui-kit";

// Filtro de período do Dashboard: vendas, faturamento, reembolsos e uso de qualquer intervalo.
// Tudo calculado aqui a partir do livro de vendas (sem buscar no banco de novo).

type PresetId = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes-passado" | "ano" | "custom";
const PRESETS: { id: PresetId; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Este mês" },
  { id: "mes-passado", label: "Mês passado" },
  { id: "ano", label: "Este ano" },
  { id: "custom", label: "Personalizado" },
];

// Datas como texto AAAA-MM-DD (dia de Brasília); contas em UTC para não depender do fuso do navegador.
const toDate = (k: string) => new Date(`${k}T00:00:00Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (k: string, n: number) => toKey(new Date(toDate(k).getTime() + n * 86_400_000));
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000) + 1;
const fmt = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
const fmtShort = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function presetRange(id: PresetId, today: string): [string, string] {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  switch (id) {
    case "hoje":
      return [today, today];
    case "ontem":
      return [addDays(today, -1), addDays(today, -1)];
    case "7d":
      return [addDays(today, -6), today];
    case "mes":
      return [`${today.slice(0, 7)}-01`, today];
    case "mes-passado": {
      const first = toKey(new Date(Date.UTC(m === 1 ? y - 1 : y, (m + 10) % 12, 1)));
      const last = addDays(`${today.slice(0, 7)}-01`, -1);
      return [first, last];
    }
    case "ano":
      return [`${y}-01-01`, today];
    default:
      return [addDays(today, -29), today];
  }
}

type Totals = {
  sales: number;
  renewals: number;
  revenue: number;
  refunds: number;
  refundValue: number;
  chargebacks: number;
  activations: number;
  accounts: number;
};

function totals(items: LedgerItem[], act: Record<string, number>, acc: Record<string, number>, from: string, to: string): Totals {
  const t: Totals = { sales: 0, renewals: 0, revenue: 0, refunds: 0, refundValue: 0, chargebacks: 0, activations: 0, accounts: 0 };
  for (const i of items) {
    if (i.day < from || i.day > to) continue;
    if (i.kind === "sale") {
      t.sales++;
      t.revenue += i.value;
    } else if (i.kind === "renewal") {
      t.renewals++;
      t.revenue += i.value;
    } else if (i.kind === "refund") {
      t.refunds++;
      t.refundValue += i.value;
    } else {
      t.chargebacks++;
      t.refundValue += i.value;
    }
  }
  for (const [k, v] of Object.entries(act)) if (k >= from && k <= to) t.activations += v;
  for (const [k, v] of Object.entries(acc)) if (k >= from && k <= to) t.accounts += v;
  return t;
}

/** Variação contra o período anterior de mesmo tamanho. */
function Delta({ now, before, money }: { now: number; before: number; money?: boolean }) {
  if (before === 0 && now === 0) return <span className="text-ink-mute">igual ao período anterior</span>;
  if (before === 0) return <span className="text-[#2ee6b8]">novo · antes: {money ? brl(0) : 0}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct > 0;
  const color = pct === 0 ? "text-ink-mute" : up ? "text-[#2ee6b8]" : "text-[#ff8fa3]";
  return (
    <span className={color}>
      {pct === 0 ? "=" : up ? "▲" : "▼"} {Math.abs(pct)}% · antes: {money ? brl(before) : before}
    </span>
  );
}

export default function PeriodSection() {
  const { data } = useAdmin();
  const L = data.ledger;
  const [preset, setPreset] = useState<PresetId>("30d");
  const [custom, setCustom] = useState<[string, string]>(() => presetRange("30d", L.todayKey));

  const [from, to] = useMemo(() => {
    if (preset !== "custom") return presetRange(preset, L.todayKey);
    let [a, b] = custom;
    if (a > b) [a, b] = [b, a];
    return [a < L.salesFrom ? L.salesFrom : a, b > L.todayKey ? L.todayKey : b];
  }, [preset, custom, L.todayKey, L.salesFrom]);

  const len = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -len);
  const cur = useMemo(() => totals(L.items, L.activations, L.accounts, from, to), [L, from, to]);
  const prev = useMemo(() => totals(L.items, L.activations, L.accounts, prevFrom, prevTo), [L, prevFrom, prevTo]);
  const ticket = cur.sales + cur.renewals ? cur.revenue / (cur.sales + cur.renewals) : 0;
  const prevTicket = prev.sales + prev.renewals ? prev.revenue / (prev.sales + prev.renewals) : 0;

  // Gráfico: por dia até 62 dias; acima disso, por mês.
  const series: DayPoint[] = useMemo(() => {
    const byMonth = len > 62;
    const buckets = new Map<string, DayPoint>();
    if (byMonth) {
      let k = `${from.slice(0, 7)}-01`;
      while (k <= to) {
        const key = k.slice(0, 7);
        buckets.set(key, { key, label: `${MONTHS[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`, a: 0, b: 0, amount: 0 });
        const [y, m] = [Number(k.slice(0, 4)), Number(k.slice(5, 7))];
        k = toKey(new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1)));
      }
    } else {
      for (let k = from; k <= to; k = addDays(k, 1)) buckets.set(k, { key: k, label: fmtShort(k), a: 0, b: 0, amount: 0 });
    }
    for (const i of L.items) {
      if (i.day < from || i.day > to || (i.kind !== "sale" && i.kind !== "renewal")) continue;
      const b = buckets.get(byMonth ? i.day.slice(0, 7) : i.day);
      if (!b) continue;
      if (i.kind === "sale") b.a++;
      else b.b++;
      b.amount += i.value;
    }
    return [...buckets.values()];
  }, [L.items, from, to, len]);

  const breakdown = useMemo(() => {
    const offers = new Map<string, { n: number; v: number }>();
    const methods = new Map<string, number>();
    for (const i of L.items) {
      if (i.day < from || i.day > to || (i.kind !== "sale" && i.kind !== "renewal")) continue;
      const o = (i.offer ?? "Sem oferta").replace(/^▸\s*/, "");
      const cur = offers.get(o) ?? { n: 0, v: 0 };
      offers.set(o, { n: cur.n + 1, v: cur.v + i.value });
      const m = i.method ?? "—";
      methods.set(m, (methods.get(m) ?? 0) + 1);
    }
    return {
      offers: [...offers.entries()].sort((a, b) => b[1].v - a[1].v).map(([label, x]) => ({ label: `${label} · ${brl(x.v)}`, value: x.n })),
      methods: [...methods.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
    };
  }, [L.items, from, to]);

  const usageLimited = from < L.usageFrom;
  const rangeLabel = from === to ? fmt(from) : `${fmt(from)} a ${fmt(to)}`;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (p.id === "custom" && preset !== "custom") setCustom([from, to]);
                setPreset(p.id);
              }}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                preset === p.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 text-ink-mute hover:text-ink-soft"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <input
              type="date"
              value={custom[0]}
              min={L.salesFrom}
              max={L.todayKey}
              onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])}
              className="field !h-10 !w-auto !px-3 !text-sm"
              aria-label="Data inicial"
            />
            <span className="text-sm text-ink-mute">até</span>
            <input
              type="date"
              value={custom[1]}
              min={L.salesFrom}
              max={L.todayKey}
              onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])}
              className="field !h-10 !w-auto !px-3 !text-sm"
              aria-label="Data final"
            />
          </div>
        )}
        <p className={`text-[13px] text-ink-mute ${preset === "custom" ? "" : "lg:ml-auto"}`}>
          {rangeLabel} · {len} dia{len === 1 ? "" : "s"} · comparado com {fmt(prevFrom)}
          {prevFrom === prevTo ? "" : ` a ${fmt(prevTo)}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi highlight label="Faturamento" value={brl(cur.revenue)} color={C.cyan} sub={<Delta now={cur.revenue} before={prev.revenue} money />} />
        <Kpi highlight label="Vendas novas" value={cur.sales} color={C.blue} sub={<Delta now={cur.sales} before={prev.sales} />} />
        <Kpi label="Ticket médio" value={brl(ticket)} color={C.green} sub={<Delta now={Math.round(ticket)} before={Math.round(prevTicket)} money />} />
        <Kpi
          label="Reembolsos"
          value={cur.refunds + cur.chargebacks}
          color={C.pink}
          sub={
            <span>
              {brl(cur.refundValue)} · {cur.chargebacks} chargeback{cur.chargebacks === 1 ? "" : "s"}
            </span>
          }
        />
        <Kpi label="Renovações" value={cur.renewals} color={C.violet} sub={<Delta now={cur.renewals} before={prev.renewals} />} />
        <Kpi label="Contas criadas" value={cur.accounts} color={C.amber} sub={<Delta now={cur.accounts} before={prev.accounts} />} />
        <Kpi
          label="Ativações (tokens)"
          value={cur.activations}
          color={C.pink}
          sub={usageLimited ? <span>uso só dos últimos 90 dias</span> : <Delta now={cur.activations} before={prev.activations} />}
        />
        <Kpi
          label="Média por dia"
          value={(cur.sales / len).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          color={C.blue}
          sub={`vendas/dia · ${brl(cur.revenue / len)} por dia`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title={len > 62 ? "Vendas por mês" : "Vendas por dia"} sub={`${rangeLabel} · passe o mouse nas barras para ver o valor`}>
          <StackedBars data={series} aLabel="Vendas novas" bLabel="Renovações" money />
        </Panel>
        <Panel className="lg:col-span-2" title="Por oferta" sub="Quantidade de vendas e valor no período">
          <HBars items={breakdown.offers} color={C.violet} empty="Nenhuma venda no período." />
          {breakdown.methods.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[12px] uppercase tracking-[0.12em] text-ink-mute">Forma de pagamento</p>
              <HBars items={breakdown.methods} color={C.green} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
