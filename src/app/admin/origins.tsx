"use client";

import { useMemo, useState } from "react";
import type { LedgerItem, Utm } from "./data";
import { useAdmin } from "./messaging";
import { Badge, Empty, Pager, Panel, brl, usePager } from "./ui-kit";

// Dashboard: de onde vieram as compras do período (UTMs) e a lista das compras.

const DIMS = [
  { id: "source", label: "Fonte", hint: "utm_source (ex.: instagram, facebook, google)" },
  { id: "medium", label: "Mídia", hint: "utm_medium (ex.: cpc, stories, bio, email)" },
  { id: "campaign", label: "Campanha", hint: "utm_campaign" },
  { id: "content", label: "Anúncio / conteúdo", hint: "utm_content" },
  { id: "term", label: "Termo", hint: "utm_term" },
] as const;
type DimId = (typeof DIMS)[number]["id"];
const NONE = "Direto / sem UTM";

const originOf = (i: LedgerItem, d: DimId) => (i.utm?.[d as keyof Utm] ?? null) || NONE;

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: LedgerItem[], label: string) {
  const head = ["Data", "Hora", "Tipo", "Cliente", "E-mail", "Oferta", "Valor", "Pagamento", "Fonte", "Mídia", "Campanha", "Conteúdo", "Termo", "UTM do 1º contato"];
  const lines = rows.map((i) =>
    [
      `${i.day.slice(8, 10)}/${i.day.slice(5, 7)}/${i.day.slice(0, 4)}`,
      i.time,
      i.kind === "sale" ? "Venda" : "Renovação",
      i.name,
      i.email,
      (i.offer ?? "").replace(/^▸\s*/, ""),
      i.value.toFixed(2).replace(".", ","),
      i.method,
      i.utm?.source,
      i.utm?.medium,
      i.utm?.campaign,
      i.utm?.content,
      i.utm?.term,
      i.inferred ? "sim" : "",
    ]
      .map(csvCell)
      .join(";"),
  );
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `compras-${label}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SalesOrigin({ from, to, rangeLabel }: { from: string; to: string; rangeLabel: string }) {
  const { data, openClient } = useAdmin();
  const [dim, setDim] = useState<DimId>("source");
  const [pick, setPick] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const known = useMemo(() => new Set(data.clients.map((c) => c.email)), [data.clients]);

  // Compras (vendas novas e renovações) do período, da mais recente para a mais antiga.
  const purchases = useMemo(
    () =>
      data.ledger.items
        .filter((i) => (i.kind === "sale" || i.kind === "renewal") && i.day >= from && i.day <= to)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [data.ledger.items, from, to],
  );

  const ranking = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    for (const i of purchases) {
      const k = originOf(i, dim);
      const cur = m.get(k) ?? { n: 0, v: 0 };
      m.set(k, { n: cur.n + 1, v: cur.v + i.value });
    }
    return [...m.entries()].map(([label, x]) => ({ label, ...x })).sort((a, b) => b.n - a.n || b.v - a.v);
  }, [purchases, dim]);

  const total = purchases.length;
  const withUtm = purchases.filter((i) => i.utm).length;
  const maxN = Math.max(1, ...ranking.map((r) => r.n));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return purchases.filter(
      (i) =>
        (!pick || originOf(i, dim) === pick) &&
        (!term ||
          (i.email ?? "").includes(term) ||
          (i.name ?? "").toLowerCase().includes(term) ||
          Object.values(i.utm ?? {}).some((v) => (v ?? "").toLowerCase().includes(term))),
    );
  }, [purchases, pick, dim, q]);
  const p = usePager(list);
  const listValue = list.reduce((a, i) => a + i.value, 0);

  return (
    <div className="space-y-4">
      <Panel
        title="Origem das vendas"
        sub={`${rangeLabel} · ${total} compra${total === 1 ? "" : "s"} · ${total ? Math.round((withUtm / total) * 100) : 0}% com UTM`}
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {DIMS.map((d) => (
            <button
              key={d.id}
              type="button"
              title={d.hint}
              onClick={() => {
                setDim(d.id);
                setPick(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                dim === d.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 text-ink-mute hover:text-ink-soft"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {ranking.length === 0 ? (
          <Empty>Nenhuma compra no período.</Empty>
        ) : (
          <div className="max-h-[420px] overflow-y-auto overscroll-contain pr-1">
            <ul className="space-y-1.5">
              {ranking.map((r) => {
                const on = pick === r.label;
                return (
                  <li key={r.label}>
                    <button
                      type="button"
                      onClick={() => setPick(on ? null : r.label)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        on ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/10" : "border-transparent hover:bg-white/[0.04]"
                      }`}
                      aria-pressed={on}
                    >
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className={`truncate ${r.label === NONE ? "text-ink-mute" : "text-ink"}`}>{r.label}</span>
                        <span className="shrink-0 font-mono">
                          <span className="text-ink">{r.n}</span>
                          <span className="ml-2 text-ink-mute">{brl(r.v)}</span>
                          <span className="ml-2 text-[11px] text-ink-mute">{Math.round((r.n / total) * 100)}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(r.n / maxN) * 100}%`, background: r.label === NONE ? "rgba(255,255,255,0.25)" : "#9b7bff" }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="mt-3 text-[12px] text-ink-mute">Clique numa origem para ver só as compras dela na lista abaixo.</p>
      </Panel>

      <Panel
        title="Compras do período"
        sub={`${list.length} compra${list.length === 1 ? "" : "s"} · ${brl(listValue)}${pick ? ` · filtrado por ${DIMS.find((d) => d.id === dim)!.label.toLowerCase()}: ${pick}` : ""}`}
        right={
          <div className="flex flex-wrap gap-2">
            {pick && (
              <button type="button" onClick={() => setPick(null)} className="btn-ghost !h-9 text-xs">
                ✕ Limpar filtro
              </button>
            )}
            <button type="button" onClick={() => exportCsv(list, `${from}_a_${to}`)} className="btn-ghost !h-9 text-xs" disabled={!list.length}>
              ⬇ CSV
            </button>
          </div>
        }
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, e-mail ou UTM"
          className="field !h-10 !text-sm mb-3 sm:max-w-sm"
        />
        {list.length === 0 ? (
          <Empty>Nenhuma compra com esse filtro.</Empty>
        ) : (
          <>
            {/* Tabela (telas largas) */}
            <div className="hidden max-h-[600px] overflow-auto overscroll-contain rounded-xl border border-white/5 lg:block">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#0b1222]">
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                    <th className="px-4 py-3 font-medium">Quando</th>
                    <th className="py-3 pr-4 font-medium">Cliente</th>
                    <th className="py-3 pr-4 font-medium">Oferta</th>
                    <th className="py-3 pr-4 text-right font-medium">Valor</th>
                    <th className="py-3 pr-4 font-medium">Fonte / mídia</th>
                    <th className="py-3 pr-4 font-medium">Campanha</th>
                    <th className="py-3 pr-4 font-medium">Anúncio / conteúdo</th>
                  </tr>
                </thead>
                <tbody>
                  {p.slice.map((i, idx) => {
                    const click = i.email && known.has(i.email);
                    return (
                      <tr
                        key={`${i.at}-${idx}`}
                        onClick={() => click && openClient(i.email!)}
                        className={`border-b border-white/5 align-top ${click ? "cursor-pointer hover:bg-white/[0.04]" : ""}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="text-ink-soft">
                            {i.day.slice(8, 10)}/{i.day.slice(5, 7)}
                          </p>
                          <p className="font-mono text-[12px] text-ink-mute">{i.time}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="max-w-[220px]">
                            <p className="truncate font-medium text-ink">{i.name || "—"}</p>
                            <p className="truncate text-[12px] text-ink-mute">{i.email}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="max-w-[200px] truncate text-ink-soft">{(i.offer ?? "—").replace(/^▸\s*/, "")}</p>
                          {i.kind === "renewal" && <Badge tone="info">Renovação</Badge>}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <p className="font-mono text-ink-soft">{brl(i.value, true)}</p>
                          <p className="text-[12px] text-ink-mute">{i.method ?? ""}</p>
                        </td>
                        <td className="py-3 pr-4">
                          {i.utm ? (
                            <>
                              <p className="text-ink-soft">{i.utm.source ?? "—"}</p>
                              <p className="text-[12px] text-ink-mute">{i.utm.medium ?? ""}</p>
                              {i.inferred && <p className="text-[11px] text-[#ffb547]">do 1º contato</p>}
                            </>
                          ) : (
                            <span className="text-ink-mute">Direto / sem UTM</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="max-w-[200px] break-words text-ink-soft">{i.utm?.campaign ?? "—"}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="max-w-[220px] break-words text-ink-soft">{i.utm?.content ?? "—"}</p>
                          {i.utm?.term && <p className="text-[12px] text-ink-mute">termo: {i.utm.term}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cartões (celular e tablet) */}
            <ul className="grid max-h-[600px] gap-3 overflow-y-auto overscroll-contain lg:hidden">
              {p.slice.map((i, idx) => (
                <li
                  key={`${i.at}-m${idx}`}
                  onClick={() => i.email && known.has(i.email) && openClient(i.email)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{i.name || i.email}</p>
                      <p className="truncate text-[12px] text-ink-mute">
                        {i.day.slice(8, 10)}/{i.day.slice(5, 7)} {i.time} · {(i.offer ?? "").replace(/^▸\s*/, "")}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-ink-soft">{brl(i.value)}</span>
                  </div>
                  <p className="mt-2 break-words text-[12px] text-ink-soft">
                    {i.utm
                      ? [i.utm.source, i.utm.medium, i.utm.campaign, i.utm.content].filter(Boolean).join(" · ")
                      : "Direto / sem UTM"}
                    {i.inferred ? " (do 1º contato)" : ""}
                  </p>
                </li>
              ))}
            </ul>
            <Pager p={p} />
          </>
        )}
      </Panel>
    </div>
  );
}
