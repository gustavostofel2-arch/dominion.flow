"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("modo") === "criar" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erro") === "confirmacao" ? "Link de confirmação inválido ou expirado." : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
              className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-violet-500 dark:border-white/15"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Senha</span>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 8 : 6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-violet-500 dark:border-white/15"
            />
          </label>

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
