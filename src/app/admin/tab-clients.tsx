"use client";

import { useMemo, useState } from "react";
import { C } from "./charts";
import type { ClientRow } from "./data";
import { useAdmin } from "./messaging";
import { Badge, Checkbox, Columns, Empty, HBars, Kpi, Pager, Panel, brl, usePager } from "./ui-kit";

// Aba Clientes: números da base, perfil do público e a tabela completa.

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "inativos", label: "Inativos" },
  { id: "semconta", label: "Sem conta" },
  { id: "semtoken", label: "Nunca gerou token" },
  { id: "parados", label: "Parados +14d" },
  { id: "reembolsados", label: "Reembolsados" },
  { id: "cancelados", label: "Cancelados" },
  { id: "Mensal", label: "Mensal" },
  { id: "Anual", label: "Anual" },
  { id: "Vitalício", label: "Vitalício" },
  { id: "Liberado à mão", label: "Manual" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const SORTS = [
  { id: "recentes", label: "Compra mais recente" },
  { id: "antigos", label: "Clientes mais antigos" },
  { id: "uso", label: "Uso mais recente" },
  { id: "mais-uso", label: "Mais ativações (30d)" },
  { id: "nome", label: "Nome (A–Z)" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function match(c: ClientRow, f: FilterId) {
  switch (f) {
    case "todos":
      return true;
    case "ativos":
      return c.active;
    case "inativos":
      return !c.active;
    case "semconta":
      return c.active && !c.hasAccount;
    case "semtoken":
      return c.active && c.hasAccount && !c.everUsed;
    case "parados":
      return c.idle;
    case "reembolsados":
      return c.flags.includes("Reembolsado") || c.flags.includes("Chargeback");
    case "cancelados":
      return c.flags.includes("Cancelou") || c.flags.includes("Cancelamento agendado");
    default:
      return c.active && c.category === f;
  }
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: ClientRow[]) {
  const head = [
    "Nome", "E-mail", "Telefone", "Estado", "Status", "Plano", "Origem", "Cliente desde", "Conta criada", "Último login",
    "Último token", "Ativações 30d", "Já gerou token", "Valor da venda", "Cliente pagou", "Pagamento", "Parcelas", "UTM",
    "Renovação", "Acesso até", "Alertas",
  ];
  const lines = rows.map((c) =>
    [
      c.name, c.email, c.phone, c.state, c.active ? "Ativo" : "Inativo", c.plan, c.source, c.since, c.accountCreated ?? "Não criou",
      c.lastLogin, c.lastUse, c.uses30, c.everUsed ? "Sim" : "Não", c.amount?.toFixed(2).replace(".", ","),
      c.paid?.toFixed(2).replace(".", ","), c.method, c.installments, c.utm, c.renewal, c.accessUntil, c.flags.join(" | "),
    ]
      .map(csvCell)
      .join(";"),
  );
  // BOM para o Excel abrir acentos certinho; ";" é o separador do Excel em português.
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `clientes-dominion-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const { openClient, openCompose } = useAdmin();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("todos");
  const [sort, setSort] = useState<SortId>("recentes");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const out = {} as Record<FilterId, number>;
    for (const f of FILTERS) out[f.id] = rows.filter((c) => match(c, f.id)).length;
    return out;
  }, [rows]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const out = rows.filter(
      (c) =>
        match(c, filter) &&
        (!term ||
          c.email.includes(term) ||
          (c.name ?? "").toLowerCase().includes(term) ||
          (c.state ?? "").toLowerCase() === term ||
          (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits))),
    );
    out.sort((a, b) => {
      if (sort === "uso") return b.lastUseTs - a.lastUseTs;
      if (sort === "mais-uso") return b.uses30 - a.uses30;
      if (sort === "antigos") return b.sinceDays - a.sinceDays;
      if (sort === "nome") return (a.name || a.email).localeCompare(b.name || b.email, "pt-BR");
      return b.boughtAtTs - a.boughtAtTs;
    });
    return out;
  }, [rows, q, filter, sort]);

  const p = usePager(list);
  const chosen = list.filter((c) => sel.has(c.email));
  const pageAll = p.slice.length > 0 && p.slice.every((c) => sel.has(c.email));
  const toggle = (email: string, v: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (v) n.add(email);
      else n.delete(email);
      return n;
    });

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, e-mail, telefone ou UF"
          className="field !h-11 lg:max-w-sm"
        />
        <div className="flex gap-2 lg:ml-auto">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className="field !h-11 lg:w-56" aria-label="Ordenar">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#0b1222]">
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => exportCsv(chosen.length ? chosen : list)} className="btn-ghost !h-11 shrink-0">
            ⬇ CSV {chosen.length ? `(${chosen.length})` : ""}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
              filter === f.id ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 bg-white/[0.03] text-ink-mute hover:text-ink-soft"
            }`}
          >
            {f.label}
            <span className="font-mono opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
          <Checkbox
            checked={pageAll}
            onChange={(v) =>
              setSel((s) => {
                const n = new Set(s);
                for (const c of p.slice) {
                  if (v) n.add(c.email);
                  else n.delete(c.email);
                }
                return n;
              })
            }
            label="Selecionar a página"
          />
          Selecionar página
        </label>
        <span className="text-[13px] text-ink-mute">
          {list.length} cliente{list.length === 1 ? "" : "s"} · {chosen.length} selecionado{chosen.length === 1 ? "" : "s"}
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
            onClick={() => openCompose(chosen.map((c) => ({ email: c.email, name: c.name, plan: c.plan, renewal: c.renewal })), "livre")}
            className="inline-flex h-8 items-center rounded-lg bg-[#ff2d55] px-3 text-xs font-semibold text-white transition hover:bg-[#e91e48] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✉ Enviar e-mail para {chosen.length || "…"}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-4">
          <Empty>Nenhum cliente encontrado.</Empty>
        </div>
      ) : (
        <>
          {/* Tabela (telas largas) com rolagem própria e cabeçalho fixo */}
          <div className="mt-3 hidden max-h-[640px] overflow-auto overscroll-contain rounded-xl border border-white/5 lg:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#0b1222]">
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                  <th className="w-10 py-3 pl-4" />
                  <th className="py-3 pr-4 font-medium">Cliente</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Plano</th>
                  <th className="py-3 pr-4 font-medium">UF</th>
                  <th className="py-3 pr-4 font-medium">Conta</th>
                  <th className="py-3 pr-4 font-medium">Último token</th>
                  <th className="py-3 pr-4 text-right font-medium">Ativ. 30d</th>
                  <th className="py-3 pr-4 font-medium">Venda</th>
                  <th className="py-3 pr-4 font-medium">Acesso até</th>
                </tr>
              </thead>
              <tbody>
                {p.slice.map((c) => (
                  <tr
                    key={c.email}
                    onClick={() => openClient(c.email)}
                    className={`cursor-pointer border-b border-white/5 align-top transition hover:bg-white/[0.04] ${sel.has(c.email) ? "bg-[#3fd0ff]/[0.05]" : ""}`}
                  >
                    <td className="py-3 pl-4">
                      <Checkbox checked={sel.has(c.email)} onChange={(v) => toggle(c.email, v)} label={`Selecionar ${c.email}`} />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="max-w-[260px]">
                        <p className="truncate font-medium text-ink">{c.name || "—"}</p>
                        <p className="truncate text-[13px] text-ink-mute">{c.email}</p>
                        {c.flags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {c.flags.map((f) => (
                              <span key={f} className="rounded-md bg-[#ff2d55]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#ff8fa3]">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.lastEmail && <p className="mt-1 text-[11px] text-[#7be3ff]">✉ {c.lastEmail.template} {c.lastEmail.when}</p>}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={c.active ? "ok" : "mute"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-ink-soft">{c.plan}</p>
                      <p className="text-[12px] text-ink-mute">{c.source}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-ink-soft">{c.state ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {c.hasAccount ? <span className="text-[13px] text-ink-soft">Criada {c.accountCreated}</span> : <Badge tone="warn">Não criou</Badge>}
                    </td>
                    <td className="py-3 pr-4">
                      <p className={c.idle || (c.hasAccount && !c.everUsed) ? "text-[#ffb547]" : "text-ink-soft"}>
                        {c.lastUseRel ?? (c.everUsed ? "+90 dias" : c.hasAccount ? "Nunca" : "—")}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-ink-soft">{c.uses30}</td>
                    <td className="py-3 pr-4">
                      <p className="text-ink-soft">{c.amount !== null ? brl(c.amount, true) : "—"}</p>
                      <p className="text-[12px] text-ink-mute">
                        {c.method ?? ""}
                        {c.installments && c.installments > 1 ? ` ${c.installments}x` : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{c.accessUntil ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartões (celular e tablet) */}
          <ul className="mt-3 grid max-h-[640px] gap-3 overflow-y-auto overscroll-contain lg:hidden">
            {p.slice.map((c) => (
              <li key={c.email} onClick={() => openClient(c.email)} className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <span className="pt-1">
                    <Checkbox checked={sel.has(c.email)} onChange={(v) => toggle(c.email, v)} label={`Selecionar ${c.email}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{c.name || "—"}</p>
                    <p className="truncate text-[13px] text-ink-mute">{c.email}</p>
                  </div>
                  <Badge tone={c.active ? "ok" : "mute"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <div>
                    <dt className="text-ink-mute">Plano</dt>
                    <dd className="text-ink-soft">
                      {c.plan} · {c.source}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-mute">Conta</dt>
                    <dd className="text-ink-soft">{c.hasAccount ? `Criada ${c.accountCreated}` : "Não criou"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-mute">Último token</dt>
                    <dd className="text-ink-soft">{c.lastUseRel ?? (c.everUsed ? "+90 dias" : c.hasAccount ? "Nunca" : "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-mute">Acesso até</dt>
                    <dd className="text-ink-soft">{c.accessUntil ?? "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <Pager p={p} />
        </>
      )}
    </div>
  );
}

export default function TabClients() {
  const { data, openClient } = useAdmin();
  const s = data.clientStats;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi highlight label="Clientes na base" value={s.total} color={C.cyan} sub={`${s.active} ativos · ${s.inactive} inativos`} />
        <Kpi highlight label="Ticket médio" value={brl(s.ticket)} color={C.green} sub={`Total vendido no ano: ${brl(s.totalRevenue)}`} />
        <Kpi label="Reembolsos" value={s.refunded + s.chargebacks} color={C.pink} sub={`${s.refunded} reembolsos · ${s.chargebacks} chargebacks · ${pct(s.refunded + s.chargebacks, s.lastlinkBuyers)} dos compradores`} />
        <Kpi label="Cancelados" value={s.canceled} color={C.violet} sub="Cancelaram a assinatura (com ou sem acesso ainda)" />
        <Kpi label="Pix × Cartão" value={`${s.pix} × ${s.card}`} color={C.blue} sub={`${s.cardInstallments} parcelaram no cartão`} />
        <Kpi label="Tempo médio de casa" value={s.avgTenureDays === null ? "—" : `${s.avgTenureDays}d`} color={C.amber} sub="Clientes ativos da Lastlink" />
        <Kpi label="Primeiro acesso pendente" value={data.kpis.pending} color={C.amber} sub="Veja na aba Ativação" />
        <Kpi label="Nunca geraram token" value={data.kpis.neverUsed} color={C.pink} sub="Veja na aba Ativação" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="De onde vêm" sub="Estado pelo DDD do telefone">
          <HBars items={s.states} color={C.cyan} />
        </Panel>
        <Panel title="Origem da venda" sub="utm da primeira compra (Lastlink)">
          <HBars items={s.utm} color={C.violet} empty="Nenhuma venda com utm ainda." />
        </Panel>
        <Panel title="Forma de pagamento" sub="Última compra de cada cliente">
          <HBars items={s.methods} color={C.green} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Horário das compras" sub="Vendas novas por hora do dia (Brasília)">
          <Columns items={s.hours} every={3} color={C.blue} />
        </Panel>
        <Panel className="lg:col-span-2" title="Dia da semana" sub="Vendas novas por dia">
          <Columns items={s.weekdays} color={C.cyan} />
        </Panel>
      </div>

      <Panel title="Clientes mais antigos" sub="Compradores da Lastlink por tempo de casa">
        {s.oldest.length === 0 ? (
          <Empty>Nenhum comprador ainda.</Empty>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {s.oldest.map((o, i) => (
              <li key={o.email} onClick={() => openClient(o.email)} className="flex cursor-pointer items-center gap-3 border-b border-white/5 py-2.5 hover:bg-white/[0.03]">
                <span className="w-6 font-mono text-[12px] text-ink-mute">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{o.name || o.email}</p>
                  <p className="truncate text-[12px] text-ink-mute">
                    {o.plan} · desde {o.since}
                  </p>
                </div>
                <Badge tone={o.active ? "ok" : "mute"}>{o.days}d</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Todos os clientes" sub="Clique em um cliente para ver a ficha completa. Marque para enviar e-mail ou exportar.">
        <ClientsTable rows={data.clients} />
      </Panel>
    </div>
  );
}
