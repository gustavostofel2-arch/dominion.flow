"use client";

import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/ui";
import type { ClientRow } from "./data";

const SITE = "https://dominion-flow.app/login";

export function firstAccessMessage(name: string | null, email: string) {
  const first = name?.trim().split(/\s+/)[0];
  return (
    `Olá${first ? `, ${first}` : ""}! Seu acesso ao Dominion já está liberado. ` +
    `Para criar sua senha, entre em ${SITE}, clique em "Primeiro acesso" e use este e-mail: ${email}`
  );
}

export function CopyButton({ text, label = "Copiar", done = "Copiado" }: { text: string; label?: string; done?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {
          /* sem permissão de área de transferência: ignora */
        }
      }}
      className="dk-copy-btn inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium"
    >
      {ok ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {ok ? done : label}
    </button>
  );
}

export function WhatsAppLink({ number, text }: { number: string | null; text: string }) {
  if (!number) return null;
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#2ee6b8]/35 bg-[#2ee6b8]/10 px-2.5 text-xs font-medium text-[#2ee6b8] transition hover:bg-[#2ee6b8]/20"
    >
      WhatsApp
    </a>
  );
}

/** Lista de pendências: copiar e-mail, copiar mensagem pronta ou abrir no WhatsApp. */
export function PendingActions({ name, email, whatsapp }: { name: string | null; email: string; whatsapp: string | null }) {
  const msg = firstAccessMessage(name, email);
  return (
    <div className="flex flex-wrap gap-2">
      <CopyButton text={email} label="E-mail" />
      <CopyButton text={msg} label="Mensagem" done="Copiada" />
      <WhatsAppLink number={whatsapp} text={msg} />
    </div>
  );
}

// ---------- Tabela de clientes ----------

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "inativos", label: "Inativos" },
  { id: "semconta", label: "Sem conta" },
  { id: "parados", label: "Parados +14d" },
  { id: "Mensal", label: "Mensal" },
  { id: "Anual", label: "Anual" },
  { id: "Vitalício", label: "Vitalício" },
  { id: "Liberado à mão", label: "Manual" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const SORTS = [
  { id: "recentes", label: "Compra mais recente" },
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
    case "parados":
      return c.idle;
    default:
      return c.active && c.category === f;
  }
}

function StatusBadge({ c }: { c: ClientRow }) {
  return c.active ? (
    <span className="dk-badge-ok inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2ee6b8]" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-ink-mute">
      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
      Inativo
    </span>
  );
}

function AccountBadge({ c }: { c: ClientRow }) {
  return c.hasAccount ? (
    <span className="text-[13px] text-ink-soft">Criada {c.accountCreated}</span>
  ) : (
    <span className="inline-flex rounded-full border border-[#ffb547]/35 bg-[#ffb547]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#ffb547]">
      Não criou
    </span>
  );
}

const brl = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("todos");
  const [sort, setSort] = useState<SortId>("recentes");
  const [limit, setLimit] = useState(50);

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
          (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits))),
    );
    out.sort((a, b) => {
      if (sort === "uso") return b.lastUseTs - a.lastUseTs;
      if (sort === "mais-uso") return b.uses30 - a.uses30;
      if (sort === "nome") return (a.name || a.email).localeCompare(b.name || b.email, "pt-BR");
      return b.boughtAtTs - a.boughtAtTs;
    });
    return out;
  }, [rows, q, filter, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(50);
          }}
          placeholder="Buscar por nome, e-mail ou telefone"
          className="field !h-11 lg:max-w-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
          className="field !h-11 lg:ml-auto lg:w-60"
          aria-label="Ordenar"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#0b1222]">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setLimit(50);
            }}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
              filter === f.id
                ? "border-[#3fd0ff]/50 bg-[#3fd0ff]/15 text-[#7be3ff]"
                : "border-white/10 bg-white/[0.03] text-ink-mute hover:text-ink-soft"
            }`}
          >
            {f.label}
            <span className="font-mono opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-mute">
        {list.length} {list.length === 1 ? "cliente" : "clientes"}
      </p>

      {/* Tabela (telas largas) */}
      <div className="mt-3 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              <th className="py-3 pr-4 font-medium">Cliente</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Plano</th>
              <th className="py-3 pr-4 font-medium">Conta</th>
              <th className="py-3 pr-4 font-medium">Último uso</th>
              <th className="py-3 pr-4 text-right font-medium">Ativ. 30d</th>
              <th className="py-3 pr-4 font-medium">Renovação</th>
              <th className="py-3 pr-4 font-medium">Acesso até</th>
              <th className="py-3 font-medium">Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((c) => (
              <tr key={c.email} className="border-b border-white/5 align-top transition hover:bg-white/[0.03]">
                <td className="py-3 pr-4">
                  <div className="max-w-[260px]">
                    <p className="truncate font-medium text-ink">{c.name || "—"}</p>
                    <p className="truncate text-[13px] text-ink-mute">{c.email}</p>
                    {c.phone && <p className="truncate font-mono text-[12px] text-ink-mute">{c.phone}</p>}
                    {c.flags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.flags.map((f) => (
                          <span key={f} className="rounded-md bg-[#ff2d55]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#ff8fa3]">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge c={c} />
                </td>
                <td className="py-3 pr-4">
                  <p className="text-ink-soft">{c.plan}</p>
                  <p className="text-[12px] text-ink-mute">{c.source}</p>
                </td>
                <td className="py-3 pr-4">
                  <AccountBadge c={c} />
                  {c.lastLoginRel && <p className="text-[12px] text-ink-mute">login {c.lastLoginRel}</p>}
                </td>
                <td className="py-3 pr-4">
                  <p className={c.idle ? "text-[#ffb547]" : "text-ink-soft"}>{c.lastUseRel ?? (c.hasAccount ? "Nunca" : "—")}</p>
                  {c.lastUse && <p className="text-[12px] text-ink-mute">{c.lastUse}</p>}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-ink-soft">{c.uses30}</td>
                <td className="py-3 pr-4 text-ink-soft">{c.renewal ?? "—"}</td>
                <td className="py-3 pr-4 text-ink-soft">{c.accessUntil ?? "—"}</td>
                <td className="py-3">
                  <p className="text-ink-soft">{brl(c.amount)}</p>
                  <p className="text-[12px] text-ink-mute">{c.boughtAt}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões (celular e tablet) */}
      <ul className="mt-3 grid gap-3 lg:hidden">
        {list.slice(0, limit).map((c) => (
          <li key={c.email} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{c.name || "—"}</p>
                <p className="truncate text-[13px] text-ink-mute">{c.email}</p>
              </div>
              <StatusBadge c={c} />
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
                <dd>
                  <AccountBadge c={c} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-mute">Último uso</dt>
                <dd className={c.idle ? "text-[#ffb547]" : "text-ink-soft"}>{c.lastUseRel ?? (c.hasAccount ? "Nunca" : "—")}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Ativações 30d</dt>
                <dd className="font-mono text-ink-soft">{c.uses30}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Renovação</dt>
                <dd className="text-ink-soft">{c.renewal ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Acesso até</dt>
                <dd className="text-ink-soft">{c.accessUntil ?? "—"}</dd>
              </div>
            </dl>
            {c.flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {c.flags.map((f) => (
                  <span key={f} className="rounded-md bg-[#ff2d55]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#ff8fa3]">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {list.length === 0 && <p className="mt-6 text-center text-sm text-ink-mute">Nenhum cliente encontrado.</p>}
      {list.length > limit && (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => setLimit((l) => l + 50)} className="btn-ghost">
            Mostrar mais ({list.length - limit} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
