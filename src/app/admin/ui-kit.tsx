"use client";

import { useState, type ReactNode } from "react";
import { C } from "./charts";

// Peças visuais do painel admin: cartões, paginação, rolagem e gráficos simples.

export const PAGE_SIZE = 30;

export const TONE = {
  ok: "border-[#2ee6b8]/35 bg-[#2ee6b8]/10 text-[#2ee6b8]",
  bad: "border-[#ff2d55]/35 bg-[#ff2d55]/10 text-[#ff8fa3]",
  warn: "border-[#ffb547]/35 bg-[#ffb547]/10 text-[#ffb547]",
  info: "border-[#3fd0ff]/35 bg-[#3fd0ff]/10 text-[#7be3ff]",
  mute: "border-white/10 bg-white/5 text-ink-mute",
};
export type Tone = keyof typeof TONE;

export const brl = (n: number | null | undefined, cents = false) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export function Badge({ tone = "mute", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

export function Kpi({ label, value, sub, color, highlight }: { label: string; value: ReactNode; sub?: ReactNode; color: string; highlight?: boolean }) {
  return (
    <div className={`card p-5 sm:p-6 ${highlight ? "card-strong" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      </div>
      <p className="mt-3 break-words text-[26px] font-semibold leading-none tracking-[-0.03em] sm:text-[36px]">{value}</p>
      {sub && <p className="mt-2 text-[13px] text-ink-mute">{sub}</p>}
    </div>
  );
}

export function Panel({
  title,
  sub,
  right,
  children,
  className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex min-w-0 flex-col p-5 sm:p-7 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {sub && <p className="mt-1 text-[13px] text-ink-mute">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-5 min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-ink-mute">{children}</p>;
}

/** Área com altura máxima e rolagem interna (o cartão nunca cresce sem fim). */
export function Scroll({ children, max = 520 }: { children: ReactNode; max?: number }) {
  return (
    <div className="overflow-y-auto overscroll-contain pr-1" style={{ maxHeight: max }}>
      {children}
    </div>
  );
}

/** Paginação de 30 em 30. Volta para a página 1 quando a lista muda de tamanho. */
export function usePager<T>(items: T[], size = PAGE_SIZE) {
  const [state, setState] = useState({ page: 1, len: items.length });
  const page = state.len === items.length ? state.page : 1;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.min(page, pages);
  return {
    page: safe,
    pages,
    total: items.length,
    from: items.length ? (safe - 1) * size + 1 : 0,
    to: Math.min(safe * size, items.length),
    slice: items.slice((safe - 1) * size, safe * size),
    setPage: (p: number) => setState({ page: Math.min(Math.max(1, p), pages), len: items.length }),
  };
}

export function Pager({ p }: { p: ReturnType<typeof usePager<unknown>> }) {
  if (p.total <= PAGE_SIZE) return null;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= p.pages; i++) {
    if (i === 1 || i === p.pages || Math.abs(i - p.page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
      <span className="text-xs text-ink-mute">
        {p.from}–{p.to} de {p.total}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" disabled={p.page === 1} onClick={() => p.setPage(p.page - 1)} className={`${btn} border-white/10 text-ink-soft disabled:opacity-30`}>
          ‹
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-ink-mute">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => p.setPage(n)}
              className={`${btn} ${n === p.page ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]" : "border-white/10 text-ink-soft hover:text-ink"}`}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" disabled={p.page === p.pages} onClick={() => p.setPage(p.page + 1)} className={`${btn} border-white/10 text-ink-soft disabled:opacity-30`}>
          ›
        </button>
      </div>
    </div>
  );
}

/** Barras horizontais com rótulo e valor (ranking). */
export function HBars({ items, color = C.cyan, empty = "Sem dados ainda." }: { items: { label: string; value: number }[]; color?: string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((a, i) => a + i.value, 0);
  if (total === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-soft">{it.label}</span>
            <span className="shrink-0 font-mono text-ink">
              {it.value} <span className="text-[11px] text-ink-mute">{Math.round((it.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Colunas verticais pequenas (ex.: vendas por hora do dia). */
export function Columns({ items, color = C.blue, every = 1 }: { items: { label: string; value: number }[]; color?: string; every?: number }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {items.map((it) => (
          <div key={it.label} className="group relative flex h-full flex-1 items-end" title={`${it.label}: ${it.value}`}>
            <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(it.value ? 6 : 2, (it.value / max) * 100)}%`, background: it.value ? color : "rgba(255,255,255,0.07)" }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {items.map((it, i) => (
          <span key={it.label} className="flex-1 text-center font-mono text-[9px] text-ink-mute">
            {i % every === 0 ? it.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 shrink-0 cursor-pointer accent-[#3fd0ff]"
    />
  );
}
