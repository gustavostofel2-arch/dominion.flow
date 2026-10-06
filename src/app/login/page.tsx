"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PasswordInput from "@/components/password-input";
import { ArrowRight, Brand, CheckIcon, CopyIcon, Footer, LockIcon, WindowBar } from "@/components/ui";

type Mode = "login" | "signup";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("modo") === "criar" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erro") === "confirmacao" ? "Link de confirmação inválido ou expirado." : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signup" && password !== confirm) {
      setError("As senhas não conferem. Digite a mesma senha nos dois campos.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    // E-mail sempre em minúsculo e sem espaços: maiúsculas não atrapalham o login.
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message);
        setLoading(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    // Criar acesso: o servidor só cria a conta se o e-mail tiver assinatura ativa.
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.erro ?? "Não foi possível criar o acesso.");
        if (res.status === 409) setMode("login");
        setLoading(false);
        return;
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      setInfo("Acesso criado! Agora é só entrar com seu e-mail e senha.");
      setMode("login");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setConfirm("");
    setError(null);
    setInfo(null);
  }

  return (
    <div className="theme-dark flex min-h-full flex-1 flex-col">
      {/* Atmosfera (decorativa): grade, orbes de luz, feixe e granulado */}
      <div className="dk-bg" aria-hidden="true">
        <div className="dk-grid" />
        <div className="dk-orb dk-orb-blue" />
        <div className="dk-orb dk-orb-cyan" />
        <div className="dk-beam" />
        <div className="dk-noise" />
      </div>

      <div className="dk-header">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-5">
          <Brand />
          <span className="dk-pill hidden items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] sm:inline-flex">
            <span className="dk-pulse" aria-hidden="true" />
            acesso seguro · token assinado
          </span>
        </header>
      </div>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 grid-cols-[minmax(0,1fr)] px-4 py-10 sm:px-5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[960px]:gap-16 min-[960px]:py-14">
        {/* Manifesto + demonstração do fluxo (abaixo de 960px fica depois do formulário) */}
        <section className="order-2 min-[960px]:order-1">
          <p className="eyebrow">Área de membros</p>
          <h1 className="dk-ice mt-5 text-[52px] font-semibold leading-[0.92] tracking-[-0.05em] sm:text-[76px]">
            <span className="flex items-baseline gap-4">
              Abra.
              <span className="dk-text-3 font-mono text-xs font-medium tracking-normal">01</span>
            </span>
            <span className="flex items-baseline gap-4">
              Ative.
              <span className="dk-text-3 font-mono text-xs font-medium tracking-normal">02</span>
            </span>
            <span className="flex items-baseline gap-4">
              <span className="dk-crie" data-text="Crie.">Crie.</span>
              <span className="dk-idx-03 font-mono text-xs font-medium tracking-normal">03</span>
            </span>
          </h1>
          <p className="dk-text-2 mt-6 max-w-md text-[17px] leading-relaxed">
            Suas ferramentas de IA em um lugar só. Um código, um token e você está criando.
          </p>

          <div className="mt-10 max-w-md" aria-hidden="true">
            <div className="glass dk-float overflow-hidden">
              <WindowBar title="flow.google.com · Dominion Creator" />
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <span className="min-w-0">
                  <span className="dk-text-3 block font-mono text-[10px] uppercase tracking-[0.2em]">
                    Código da sessão
                  </span>
                  <span className="dk-code mt-1 block truncate font-mono text-base font-semibold tracking-[0.12em] sm:text-lg">
                    K7QD-29XM-PL4A-8VNE
                  </span>
                </span>
                <span className="dk-copy-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <CopyIcon size={18} />
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2 pl-8 max-[479px]:hidden">
              <span className="dash-v h-10 w-0.5" />
              <span className="dk-text-3 font-mono text-[11px]">cole aqui no site → gere o token</span>
            </div>

            <div className="glass dk-float-late ml-10 overflow-hidden max-[479px]:hidden">
              <WindowBar
                title="dominion · ativação"
                right={
                  <span className="dk-badge-ok rounded-full px-2 py-0.5 font-mono text-[10px]">
                    liberado
                  </span>
                }
              />
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="dk-check flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <CheckIcon size={18} />
                </span>
                <span className="caret dk-text-2 truncate font-mono text-xs">v1.eyJ2ZXJzaW9uIjoxLCJ0b29sSWQi</span>
              </div>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section className="glass-strong order-1 mx-auto w-full max-w-md overflow-hidden min-[960px]:order-2 min-[960px]:mx-0 min-[960px]:ml-auto">
          <WindowBar title={isSignup ? "dominion · criar acesso" : "dominion · entrar"} />

          <div className="p-7 sm:p-9">
            <div className="dk-seg grid grid-cols-2 rounded-2xl p-1" role="tablist">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`dk-tab h-11 rounded-xl text-sm font-semibold ${mode === m ? "dk-tab-on" : ""}`}
                >
                  {m === "login" ? "Entrar" : "Primeiro acesso"}
                </button>
              ))}
            </div>

            <h2 className="dk-ice mt-8 text-[30px] font-semibold leading-tight tracking-[-0.03em]">
              {isSignup ? "Crie seu acesso" : "Bem-vindo de volta"}
            </h2>
            <p className="dk-text-2 mt-2 text-[15px] leading-relaxed">
              {isSignup
                ? "Use o mesmo e-mail informado na compra e escolha uma senha."
                : "Entre com o e-mail da sua compra."}
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              <label className="block">
                <span className="dk-text-3 font-mono text-[11px] uppercase tracking-[0.18em]">E-mail da compra</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field mt-2"
                />
              </label>

              <label className="block">
                <span className="dk-text-3 font-mono text-[11px] uppercase tracking-[0.18em]">Senha</span>
                <PasswordInput
                  key={mode}
                  value={password}
                  onChange={setPassword}
                  minLength={isSignup ? 8 : 6}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder={isSignup ? "Pelo menos 8 caracteres" : "Sua senha"}
                />
                {!isSignup && (
                  <Link href="/esqueci-senha" className="dk-link mt-2 inline-block text-sm font-medium hover:underline">
                    Esqueci minha senha
                  </Link>
                )}
              </label>

              {isSignup && (
                <label className="block">
                  <span className="dk-text-3 font-mono text-[11px] uppercase tracking-[0.18em]">
                    Confirme a senha
                  </span>
                  <PasswordInput
                    value={confirm}
                    onChange={setConfirm}
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Digite a senha de novo"
                    invalid={confirm.length > 0 && confirm !== password}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <span className="dk-mismatch mt-2 block text-xs">As senhas não conferem.</span>
                  )}
                </label>
              )}

              {error && (
                <p className="dk-alert-error rounded-xl px-4 py-3 text-sm">{error}</p>
              )}
              {info && (
                <p className="dk-alert-ok rounded-xl px-4 py-3 text-sm">{info}</p>
              )}

              <button type="submit" disabled={loading} className="btn-primary">
                <span>{loading ? "Aguarde..." : isSignup ? "Criar meu acesso" : "Entrar"}</span>
                <ArrowRight size={20} />
              </button>
            </form>

            <p className="dk-info mt-7 flex gap-3 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed">
              <LockIcon size={16} className="dk-info-icon mt-0.5 shrink-0" />
              O acesso é liberado após a confirmação da compra. No primeiro acesso, use o mesmo e-mail do pagamento.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
