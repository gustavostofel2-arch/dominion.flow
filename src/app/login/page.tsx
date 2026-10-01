"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const INPUT_CLASS =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-violet-500 dark:border-white/15";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength: number;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.invalid || undefined}
        className={`${INPUT_CLASS} pr-11 ${props.invalid ? "border-red-500 dark:border-red-400" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center opacity-60 hover:opacity-100"
      >
        <EyeIcon open={visible} />
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

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Dominion Flow</h1>
        <p className="mt-1 text-sm opacity-70">
          {mode === "login"
            ? "Entre para gerar sua ativação."
            : "Use o mesmo e-mail da sua compra e escolha uma senha."}
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 ${INPUT_CLASS}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Senha</span>
            <PasswordInput
              key={mode}
              value={password}
              onChange={setPassword}
              minLength={mode === "signup" ? 8 : 6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "signup" && <span className="mt-1 block text-xs opacity-60">Mínimo de 8 caracteres.</span>}
          </label>

          {mode === "signup" && (
            <label className="block">
              <span className="text-sm font-medium">Confirme a senha</span>
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                minLength={8}
                autoComplete="new-password"
                invalid={confirm.length > 0 && confirm !== password}
              />
              {confirm.length > 0 && confirm !== password && (
                <span className="mt-1 block text-xs text-red-600 dark:text-red-400">As senhas não conferem.</span>
              )}
            </label>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-700 dark:text-emerald-400">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar acesso"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setConfirm("");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm opacity-70 hover:opacity-100"
        >
          {mode === "login" ? "Primeiro acesso? Criar acesso" : "Já tem acesso? Entrar"}
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
