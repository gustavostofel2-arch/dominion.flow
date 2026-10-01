"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Brand, EyeIcon, FilmIcon, Footer, NodesIcon } from "@/components/ui";

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

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
        body: JSON.stringify({ email, password }),
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-4">
          <Brand />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        {/* Apresentação (só em telas largas) */}
        <section className="hidden lg:block">
          <p className="eyebrow">Seu próximo projeto começa aqui</p>
          <h1 className="mt-6 text-[64px] font-semibold leading-[0.98] tracking-[-0.04em]">
            Menos etapas.
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">Mais criação.</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-5 bg-brand/85" aria-hidden="true" />
            </span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Entre na sua área de membros, ative suas ferramentas e transforme ideias em imagens e vídeos.
          </p>

          <div className="mt-10 grid max-w-md gap-3">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white/80 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-soft text-cyan-ink">
                <NodesIcon size={22} />
              </span>
              <span>
                <span className="block text-sm font-semibold">Dominion Flow</span>
                <span className="block text-sm text-ink-soft">Workflows em nodes, no estilo Freepik.</span>
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white/80 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <FilmIcon size={22} />
              </span>
              <span>
                <span className="block text-sm font-semibold">Dominion Creator</span>
                <span className="block text-sm text-ink-soft">Da foto do produto aos vídeos prontos.</span>
              </span>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section className="card mx-auto w-full max-w-md p-7 sm:p-10">
          <p className="eyebrow">Bem-vindo à Dominion</p>
          <h2 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
            {isSignup ? "Crie seu acesso" : "Entre no seu espaço"}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {isSignup
              ? "Use o mesmo e-mail informado na compra e escolha uma senha."
              : "Use o e-mail da sua compra para continuar."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-medium">E-mail da compra</span>
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
              <span className="text-sm font-medium">Senha</span>
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
                <span className="text-sm font-medium">Confirme a senha</span>
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
              <span>{loading ? "Aguarde..." : isSignup ? "Criar meu acesso" : "Entrar na minha conta"}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft">
            {isSignup ? "Já tem acesso? " : "Primeiro acesso? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setConfirm("");
                setError(null);
                setInfo(null);
              }}
              className="font-semibold text-brand hover:underline"
            >
              {isSignup ? "Entrar" : "Criar meu acesso"}
            </button>
          </p>

          <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-ink-mute">
            O acesso é liberado após a confirmação da compra. No primeiro acesso, crie sua conta com o mesmo
            e-mail do pagamento.
          </p>
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
