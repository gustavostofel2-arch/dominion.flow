"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Brand, CheckIcon, CopyIcon, EyeIcon, Footer, LockIcon, WindowBar } from "@/components/ui";

type Mode = "login" | "signup";

function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength: number;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-2">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.invalid || undefined}
        className={`field pr-14 ${props.invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-ink-mute transition hover:text-ink"
      >
        <EyeIcon open={visible} size={20} />
      </button>
    </div>
  );
}

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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6">
        <Brand />
        <span className="hidden rounded-full border border-line bg-white/80 px-3 py-1.5 font-mono text-[11px] text-ink-mute sm:inline-flex">
          acesso seguro · token assinado
        </span>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14">
        {/* Manifesto + demonstração do fluxo (no celular fica abaixo do formulário) */}
        <section className="order-2 lg:order-1">
          <p className="eyebrow">Área de membros</p>
          <h1 className="mt-5 text-[52px] font-semibold leading-[0.92] tracking-[-0.05em] sm:text-[76px]">
            <span className="flex items-baseline gap-4">
              Abra.
              <span className="font-mono text-xs font-medium tracking-normal text-ink-mute">01</span>
            </span>
            <span className="flex items-baseline gap-4">
              Ative.
              <span className="font-mono text-xs font-medium tracking-normal text-ink-mute">02</span>
            </span>
            <span className="flex items-baseline gap-4">
              <span className="glitch">Crie.</span>
              <span className="font-mono text-xs font-medium tracking-normal text-brand">03</span>
            </span>
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft">
            Suas ferramentas de IA em um lugar só. Um código, um token e você está criando.
          </p>

          <div className="mt-10 hidden max-w-md lg:block" aria-hidden="true">
            <div className="card overflow-hidden">
              <WindowBar title="flow.google.com · Dominion Creator" />
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
                    Código da sessão
                  </span>
                  <span className="mt-1 block font-mono text-lg font-semibold tracking-[0.12em] text-cyan-ink">
                    K7QD-29XM-PL4A-8VNE
                  </span>
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-soft">
                  <CopyIcon size={18} />
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2 pl-8">
              <span className="dash-v h-10 w-0.5" />
              <span className="font-mono text-[11px] text-ink-mute">cole aqui no site → gere o token</span>
            </div>

            <div className="card ml-10 overflow-hidden">
              <WindowBar
                title="dominion · ativação"
                right={
                  <span className="rounded-full bg-cyan-soft px-2 py-0.5 font-mono text-[10px] text-cyan-ink">
                    liberado
                  </span>
                }
              />
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                  <CheckIcon size={18} />
                </span>
                <span className="caret truncate font-mono text-xs text-ink-soft">v1.eyJ2ZXJzaW9uIjoxLCJ0b29sSWQi</span>
              </div>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section className="card order-1 mx-auto w-full max-w-md overflow-hidden lg:order-2 lg:mx-0 lg:ml-auto">
          <WindowBar title={isSignup ? "dominion · criar acesso" : "dominion · entrar"} />

          <div className="p-7 sm:p-9">
            <div className="grid grid-cols-2 rounded-2xl border border-line bg-field p-1" role="tablist">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`h-11 rounded-xl text-sm font-semibold transition ${
                    mode === m
                      ? "bg-white text-ink shadow-[0_1px_3px_rgba(24,24,27,0.12)]"
                      : "text-ink-mute hover:text-ink"
                  }`}
                >
                  {m === "login" ? "Entrar" : "Primeiro acesso"}
                </button>
              ))}
            </div>

            <h2 className="mt-8 text-[30px] font-semibold leading-tight tracking-[-0.03em]">
              {isSignup ? "Crie seu acesso" : "Bem-vindo de volta"}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {isSignup
                ? "Use o mesmo e-mail informado na compra e escolha uma senha."
                : "Entre com o e-mail da sua compra."}
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">E-mail da compra</span>
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
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">Senha</span>
                <PasswordInput
                  key={mode}
                  value={password}
                  onChange={setPassword}
                  minLength={isSignup ? 8 : 6}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder={isSignup ? "Pelo menos 8 caracteres" : "Sua senha"}
                />
              </label>

              {isSignup && (
                <label className="block">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
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
                    <span className="mt-2 block text-xs text-red-600">As senhas não conferem.</span>
                  )}
                </label>
              )}

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}
              {info && (
                <p className="rounded-xl border border-cyan/40 bg-cyan-soft px-4 py-3 text-sm text-cyan-ink">{info}</p>
              )}

              <button type="submit" disabled={loading} className="btn-primary">
                <span>{loading ? "Aguarde..." : isSignup ? "Criar meu acesso" : "Entrar"}</span>
                <ArrowRight size={20} />
              </button>
            </form>

            <p className="mt-7 flex gap-3 rounded-2xl bg-field px-4 py-3.5 text-[13px] leading-relaxed text-ink-soft">
              <LockIcon size={16} className="mt-0.5 shrink-0 text-ink-mute" />
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
