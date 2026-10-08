"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand, Footer } from "@/components/ui";
import SignOutButton from "../dashboard/sign-out-button";
import ClientDrawer from "./client-drawer";
import type { Recipient } from "./email-templates";
import type { AdminData } from "./data";
import { AdminCtx, ComposeModal } from "./messaging";
import TabClients from "./tab-clients";
import { TabActivation, TabDashboard, TabEmails, TabLastlink, TabUsage } from "./tabs";

// Painel administrativo em abas. Os dados chegam prontos do servidor (page.tsx).

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "ativacao", label: "Ativação" },
  { id: "clientes", label: "Clientes" },
  { id: "uso", label: "Uso" },
  { id: "lastlink", label: "Lastlink" },
  { id: "emails", label: "E-mails" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TITLES: Record<TabId, [string, string]> = {
  dashboard: ["Visão", "geral"],
  ativacao: ["Ativação dos", "clientes"],
  clientes: ["Base de", "clientes"],
  uso: ["Uso da", "ferramenta"],
  lastlink: ["Avisos da", "Lastlink"],
  emails: ["E-mails e", "modelos"],
};

export default function AdminView({ email, data }: { email: string; data: AdminData }) {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [compose, setCompose] = useState<{ targets: Recipient[]; template: string } | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // Busca os dados de novo no servidor sem recarregar a página (uma requisição só).
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  // Atualiza sozinho a cada 1 minuto enquanto a aba do navegador estiver visível
  // e nenhuma janela (e-mail, ficha) estiver aberta.
  const busy = !!compose || !!clientEmail;
  useEffect(() => {
    if (busy) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [busy, refresh]);

  // A aba fica no endereço (#clientes etc.) para voltar nela ao atualizar a página.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((id: string) => {
    if (!TABS.some((t) => t.id === id)) return;
    setTab(id as TabId);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  }, []);

  const ctx = useMemo(
    () => ({
      data,
      openCompose: (targets: Recipient[], template: string) => setCompose({ targets, template }),
      openClient: (e: string) => setClientEmail(e),
    }),
    [data],
  );
  const client = clientEmail ? data.clients.find((c) => c.email === clientEmail) : undefined;
  const badge: Partial<Record<TabId, number>> = { ativacao: data.kpis.pending + data.kpis.neverUsed };
  const [t1, t2] = TITLES[tab];

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="theme-dark admin-lite flex min-h-full flex-1 flex-col">
        <div className="dk-bg" aria-hidden="true">
          <div className="dk-grid" />
          <div className="dk-orb dk-orb-blue" />
          <div className="dk-orb dk-orb-cyan" />
          <div className="dk-noise" />
        </div>

        <header className="dk-header sticky top-0 z-30">
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
          <nav className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-5 pb-3" aria-label="Abas do painel" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => go(t.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  tab === t.id ? "bg-[#3fd0ff]/15 text-[#7be3ff] ring-1 ring-[#3fd0ff]/40" : "text-ink-mute hover:bg-white/5 hover:text-ink"
                }`}
              >
                {t.label}
                {badge[t.id] ? <span className="rounded-full bg-[#ffb547]/20 px-1.5 font-mono text-[11px] text-[#ffb547]">{badge[t.id]}</span> : null}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 pt-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Painel admin</p>
              <h1 className="mt-3 text-[36px] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[52px]">
                {t1} <span className="glitch">{t2}</span>.
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-mute">
              <span className="dk-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <span className="dk-pulse" />
                {refreshing ? "Atualizando…" : `Atualizado ${data.generatedAt} · automático a cada 1 min`}
              </span>
              <button type="button" onClick={refresh} disabled={refreshing} className="btn-ghost disabled:opacity-60">
                {refreshing ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>

          {tab === "dashboard" && <TabDashboard go={go} />}
          {tab === "ativacao" && <TabActivation />}
          {tab === "clientes" && <TabClients />}
          {tab === "uso" && <TabUsage />}
          {tab === "lastlink" && <TabLastlink />}
          {tab === "emails" && <TabEmails />}
        </main>
        <Footer />

        {client && <ClientDrawer key={client.email} client={client} onClose={() => setClientEmail(null)} />}
        {compose && <ComposeModal targets={compose.targets} initialTemplate={compose.template} onClose={() => setCompose(null)} />}
      </div>
    </AdminCtx.Provider>
  );
}
