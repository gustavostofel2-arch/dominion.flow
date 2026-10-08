"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand, Footer } from "@/components/ui";
import SignOutButton from "../dashboard/sign-out-button";
import ClientDrawer from "./client-drawer";
import type { Recipient } from "./email-templates";
import type { AdminData, ResendView } from "./data";
import { getResendViewAction } from "./actions";
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

function TabButton({
  active,
  badge,
  onClick,
  block,
  children,
}: {
  active: boolean;
  badge?: number;
  onClick: () => void;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${block ? "h-10 justify-center rounded-xl" : ""} ${
        active ? "bg-[#3fd0ff]/15 text-[#7be3ff] ring-1 ring-[#3fd0ff]/40" : "text-ink-mute hover:bg-white/5 hover:text-ink"
      } ${block && !active ? "bg-white/[0.03] ring-1 ring-white/10" : ""}`}
    >
      {children}
      {badge ? <span className="rounded-full bg-[#ffb547]/20 px-1.5 font-mono text-[11px] text-[#ffb547]">{badge}</span> : null}
    </button>
  );
}

export default function AdminView({ data }: { data: AdminData }) {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [compose, setCompose] = useState<{ targets: Recipient[]; template: string } | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // Busca os dados de novo no servidor sem recarregar a página (uma requisição só).
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  // Atualiza sozinho a cada 5 minutos enquanto a aba do navegador estiver visível e nenhuma
  // janela (e-mail, ficha) estiver aberta. Só lê o Supabase: o Resend é só pelo botão.
  const busy = !!compose || !!clientEmail;
  useEffect(() => {
    if (busy) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5 * 60_000);
    return () => window.clearInterval(id);
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

  // Resend: só quando o admin pede (abrir a aba E-mails pela 1ª vez ou clicar em atualizar).
  const [resend, setResend] = useState<ResendView | null>(null);
  const [resendState, setResendState] = useState<"idle" | "loading" | "error" | "missing">("idle");
  const loadResend = useCallback(() => {
    if (!data.email.readConfigured) {
      setResendState("missing");
      return;
    }
    setResendState("loading");
    getResendViewAction()
      .then((r) => {
        setResend(r);
        setResendState(r ? "idle" : "error");
      })
      .catch(() => setResendState("error"));
  }, [data.email.readConfigured]);

  const ctx = useMemo(
    () => ({
      data,
      resend,
      resendState,
      loadResend,
      sent24: resend ? resend.total24 : data.email.panel24,
      openCompose: (targets: Recipient[], template: string) => setCompose({ targets, template }),
      openClient: (e: string) => setClientEmail(e),
    }),
    [data, resend, resendState, loadResend],
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
          <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-3">
            <Brand subtitle="Painel admin" />

            {/* Computador: abas na mesma linha do logo */}
            <nav className="ml-4 hidden min-w-0 items-center gap-1 lg:flex" aria-label="Abas do painel" role="tablist">
              {TABS.map((t) => (
                <TabButton key={t.id} active={tab === t.id} badge={badge[t.id]} onClick={() => go(t.id)}>
                  {t.label}
                </TabButton>
              ))}
            </nav>
            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <Link href="/dashboard" className="btn-ghost">
                Área de membros
              </Link>
              <SignOutButton />
            </div>

            {/* Celular/tablet: menu de três pontinhos */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="admin-menu"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              className="relative ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-ink-soft transition hover:text-ink lg:hidden"
            >
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              )}
              {!menuOpen && badge.ativacao ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ffb547]" /> : null}
            </button>
          </div>

          {menuOpen && (
            <div id="admin-menu" className="border-t border-white/10 px-5 pb-4 pt-3 lg:hidden">
              <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Abas do painel" role="tablist">
                {TABS.map((t) => (
                  <TabButton
                    key={t.id}
                    active={tab === t.id}
                    badge={badge[t.id]}
                    onClick={() => {
                      go(t.id);
                      setMenuOpen(false);
                    }}
                    block
                  >
                    {t.label}
                  </TabButton>
                ))}
              </nav>
              <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                <Link href="/dashboard" className="btn-ghost flex-1">
                  Área de membros
                </Link>
                <SignOutButton />
              </div>
            </div>
          )}
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
                {refreshing ? "Atualizando…" : `Atualizado ${data.generatedAt} · automático a cada 5 min`}
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
