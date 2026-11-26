"use client";

import { useEffect, useMemo, useState } from "react";
import { getAffiliateSalesAction } from "./actions";
import { useAdmin } from "./messaging";
import { C } from "./charts";
import type { AffiliateSale } from "./affiliates";
import AffiliateDrawer from "./affiliate-drawer";
import { Badge, Empty, Kpi, Pager, Panel, brl, usePager } from "./ui-kit";

// Aba Afiliados: quem vendeu, quanto vendeu e quanto de comissão gerou.

const DAY = 86_400_000;
const PERIODS = [
  { id: "7", label: "7 dias", days: 7 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "90", label: "90 dias", days: 90 },
  { id: "all", label: "Tudo", days: null },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const SORTS = [
  { id: "vendas", label: "Mais vendas" },
  { id: "faturamento", label: "Maior faturamento" },
  { id: "comissao", label: "Maior comissão" },
  { id: "recente", label: "Venda mais recente" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

type AffRow = {
  key: string;
  name: string | null;
  email: string | null;
  pct: number | null;
  news: number;
  renewals: number;
  refunds: number;
  revenue: number;
  commission: number;
  /** Vendas (sem reembolso) por período da cobrança. */
  mensal: number;
  anual: number;
  outros: number;
  /** Clientes indicados que têm acesso ativo agora. */
  active: number;
  lastAt: string;
  lastWhen: string;
};

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const money = (n: number) => n.toFixed(2).replace(".", ",");

function exportCsv(rows: AffRow[]) {
  const head = ["Posição", "Afiliado", "E-mail", "Comissão %", "Vendas novas", "Renovações", "Mensais", "Anuais", "Outros", "Assinaturas ativas", "Reembolsos", "Faturamento", "Comissão", "Última venda"];
  const lines = rows.map((a, i) =>
    [i + 1, a.name, a.email, a.pct, a.news, a.renewals, a.mensal, a.anual, a.outros, a.active, a.refunds, money(a.revenue), money(a.commission), a.lastWhen].map(csvCell).join(";"),
  );
  // BOM para o Excel abrir acentos certinho; ";" é o separador do Excel em português.
  const blob = new Blob(["﻿" +[head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `afiliados-dominion-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TabAffiliates() {
  const { data } = useAdmin();
  // As vendas de afiliados são lidas só ao abrir esta aba (e de novo quando o painel atualiza).
  const [sales, setSales] = useState<AffiliateSale[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getAffiliateSalesAction()
      .then((s) => {
        if (!alive) return;
        setSales(s);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [data.generatedAt]);

  if (!sales) {
    return failed ? (
      <Empty>Não consegui carregar os afiliados. Clique em Atualizar para tentar de novo.</Empty>
    ) : (
      <Empty>Carregando os afiliados…</Empty>
    );
  }
  return <AffiliatesView sales={sales} />;
}

function AffiliatesView({ sales }: { sales: AffiliateSale[] }) {
  const [period, setPeriod] = useState<PeriodId>("all");
  // Momento em que a aba abriu: base dos períodos (7/30/90 dias).
  const [openedAt] = useState(() => Date.now());
  const [sort, setSort] = useState<SortId>("vendas");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const inPeriod = useMemo(() => {
    const days = PERIODS.find((x) => x.id === period)?.days ?? null;
    if (days === null) return sales;
    const since = openedAt - days * DAY;
    return sales.filter((s) => new Date(s.at).getTime() >= since);
  }, [sales, period, openedAt]);

  const { data } = useAdmin();
  const activeEmails = useMemo(() => new Set(data.clients.filter((c) => c.active).map((c) => c.email)), [data.clients]);

  const rows = useMemo(() => {
    const map = new Map<string, AffRow>();
    const buyers = new Map<string, Set<string>>();
    for (const s of inPeriod) {
      let a = map.get(s.affKey);
      if (!a) {
        a = { key: s.affKey, name: s.affName, email: s.affEmail, pct: s.pct, news: 0, renewals: 0, refunds: 0, revenue: 0, commission: 0, mensal: 0, anual: 0, outros: 0, active: 0, lastAt: s.at, lastWhen: s.when };
        map.set(s.affKey, a);
        buyers.set(s.affKey, new Set());
      }
      if (s.at > a.lastAt) {
        a.lastAt = s.at;
        a.lastWhen = s.when;
        a.pct = s.pct ?? a.pct;
        a.name = s.affName ?? a.name;
        a.email = s.affEmail ?? a.email;
      }
      if (s.refunded) {
        a.refunds++;
        continue;
      }
      if (s.renewal) a.renewals++;
      else a.news++;
      if (s.period === "Mensal") a.mensal++;
      else if (s.period === "Anual") a.anual++;
      else a.outros++;
      if (s.buyer) buyers.get(s.affKey)?.add(s.buyer);
      a.revenue += s.value;
      a.commission += s.commission;
    }
    for (const [key, set] of buyers) {
      const a = map.get(key);
      if (a) a.active = [...set].filter((e) => activeEmails.has(e)).length;
    }
    const out = [...map.values()];
    out.sort((x, y) => {
      if (sort === "faturamento") return y.revenue - x.revenue;
      if (sort === "comissao") return y.commission - x.commission;
      if (sort === "recente") return y.lastAt.localeCompare(x.lastAt);
      return y.news + y.renewals - (x.news + x.renewals) || y.revenue - x.revenue;
    });
    return out;
  }, [inPeriod, sort, activeEmails]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? rows.filter((a) => (a.name ?? "").toLowerCase().includes(term) || (a.email ?? "").includes(term)) : rows;
  }, [rows, q]);

  const recent = useMemo(() => inPeriod.slice(0, 15), [inPeriod]);
  const p = usePager(list);

  const totals = useMemo(() => {
    let sold = 0;
    let revenue = 0;
    let commission = 0;
    let refunds = 0;
    for (const s of inPeriod) {
      if (s.refunded) {
        refunds++;
        continue;
      }
      sold++;
      revenue += s.value;
      commission += s.commission;
    }
    return { sold, revenue, commission, refunds };
  }, [inPeriod]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi highlight label="Afiliados que venderam" value={rows.length} color={C.cyan} sub="No período escolhido" />
        <Kpi highlight label="Vendas por afiliados" value={totals.sold} color={C.green} sub={`${totals.refunds} reembolsada${totals.refunds === 1 ? "" : "s"}`} />
        <Kpi label="Faturamento gerado" value={brl(totals.revenue)} color={C.blue} sub="Sem contar as reembolsadas" />
        <Kpi label="Comissão dos afiliados" value={brl(totals.commission, true)} color={C.amber} sub="Valor que a Lastlink repassa a eles" />
      </div>

      <Panel
        title="Top afiliados"
        sub="Quem mais vendeu. Vendas novas e renovações contam juntas; reembolsos ficam de fora dos valores."
        right={
          <button type="button" onClick={() => exportCsv(list)} disabled={list.length === 0} className="btn-ghost !h-9 disabled:opacity-50">
            ⬇ CSV
          </button>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou e-mail do afiliado"
            className="field !h-11 lg:max-w-sm"
          />
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {PERIODS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setPeriod(x.id)}
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium transition ${
                  period === x.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 bg-white/[0.03] text-ink-mute hover:text-ink-soft"
                }`}
              >
                {x.label}
              </button>
            ))}
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className="field !h-9 w-48 !py-0 text-xs" aria-label="Ordenar">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0b1222]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="mt-4">
            <Empty>{sales.length === 0 ? "Nenhuma venda de afiliado ainda." : "Nenhum afiliado encontrado neste período."}</Empty>
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-[#0b1222]">
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                    <th className="w-12 py-3 pl-4 font-medium">#</th>
                    <th className="py-3 pr-4 font-medium">Afiliado</th>
                    <th className="py-3 pr-4 text-right font-medium">Novas</th>
                    <th className="py-3 pr-4 text-right font-medium">Renov.</th>
                    <th className="py-3 pr-4 text-right font-medium">Mensal</th>
                    <th className="py-3 pr-4 text-right font-medium">Anual</th>
                    <th className="py-3 pr-4 text-right font-medium">Outros</th>
                    <th className="py-3 pr-4 text-right font-medium">Ativas</th>
                    <th className="py-3 pr-4 text-right font-medium">Reemb.</th>
                    <th className="py-3 pr-4 text-right font-medium">Faturamento</th>
                    <th className="py-3 pr-4 text-right font-medium">Comissão</th>
                    <th className="py-3 pr-4 font-medium">Última venda</th>
                  </tr>
                </thead>
                <tbody>
                  {p.slice.map((a, i) => (
                    <tr key={a.key} onClick={() => setSelected(a.key)} className="cursor-pointer border-b border-white/5 align-top transition hover:bg-white/[0.04]">
                      <td className="py-3 pl-4 font-mono text-[12px] text-ink-mute">{String(p.from + i).padStart(2, "0")}</td>
                      <td className="py-3 pr-4">
                        <div className="max-w-[300px]">
                          <p className="truncate font-medium text-ink">{a.name || "—"}</p>
                          <p className="truncate text-[13px] text-ink-mute">{a.email ?? "sem e-mail"}</p>
                          {a.pct !== null && <p className="mt-0.5 text-[11px] text-[#7be3ff]">{a.pct}% de comissão</p>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{a.news}</td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{a.renewals}</td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{a.mensal}</td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{a.anual}</td>
                      <td className="py-3 pr-4 text-right font-mono text-ink-soft">{a.outros}</td>
                      <td className="py-3 pr-4 text-right font-mono font-medium text-[#2ee6b8]">{a.active}</td>
                      <td className="py-3 pr-4 text-right font-mono">{a.refunds > 0 ? <span className="text-[#ff8fa3]">{a.refunds}</span> : <span className="text-ink-mute">0</span>}</td>
                      <td className="py-3 pr-4 text-right text-ink-soft">{brl(a.revenue, true)}</td>
                      <td className="py-3 pr-4 text-right font-medium text-ink">{brl(a.commission, true)}</td>
                      <td className="py-3 pr-4 text-ink-soft">{a.lastWhen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager p={p} />
          </>
        )}
      </Panel>

      <Panel title="Últimas vendas de afiliados" sub="As 15 vendas mais recentes do período">
        {recent.length === 0 ? (
          <Empty>Nenhuma venda de afiliado neste período.</Empty>
        ) : (
          <ul>
            {recent.map((s) => (
              <li
                key={s.id}
                onClick={() => setSelected(s.affKey)}
                className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/5 py-2.5 transition hover:bg-white/[0.03]"
              >
                <span className="w-28 shrink-0 font-mono text-[12px] text-ink-mute">{s.when}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.affName || s.affEmail || "Afiliado"}</p>
                  <p className="truncate text-[12px] text-ink-mute">
                    cliente {s.buyer ?? "—"} · {s.offer ?? "—"}
                  </p>
                </div>
                <Badge tone={s.period === "Vitalício" ? "warn" : "ok"}>{s.period}</Badge>
                {s.renewal && <Badge tone="info">Renovação</Badge>}
                {s.refunded && <Badge tone="bad">Reembolsada</Badge>}
                <span className="w-24 text-right text-sm text-ink-soft">{brl(s.value, true)}</span>
                <span className="w-24 text-right text-sm font-medium text-[#ffb547]">{brl(s.commission, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {selected && <AffiliateDrawer key={selected} affKey={selected} sales={sales} onClose={() => setSelected(null)} />}
    </div>
  );
}
