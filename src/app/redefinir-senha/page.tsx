"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth-shell";
import PasswordInput from "@/components/password-input";
import { ArrowRight, CheckIcon, LockIcon } from "@/components/ui";

type State = "checking" | "ready" | "no-session" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chega aqui com sessão criada pelo link do e-mail (/auth/confirm). Se vier no formato
  // padrão do Supabase (?code=...), troca o código pela sessão aqui mesmo — isso só
  // funciona no mesmo navegador em que o link foi pedido.
  useEffect(() => {
    const supabase = createClient();
    const code = new URLSearchParams(window.location.search).get("code");
    const exchange = code ? supabase.auth.exchangeCodeForSession(code) : Promise.resolve(null);
    exchange
      .catch(() => null)
      .then(() => supabase.auth.getUser())
      .then(({ data }) => {
        if (code) window.history.replaceState(null, "", "/redefinir-senha");
        setState(data.user ? "ready" : "no-session");
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não conferem. Digite a mesma senha nos dois campos.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        /different|same/i.test(error.message)
          ? "A senha nova precisa ser diferente da anterior."
          : "Não foi possível salvar a senha. Peça um link novo e tente de novo.",
      );
      return;
    }
    setState("done");
  }

  return (
    <AuthShell windowTitle="dominion · nova senha">
      {state === "checking" && <p className="text-sm text-ink-mute">Verificando o link...</p>}

      {state === "no-session" && (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <LockIcon size={26} />
          </span>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Link expirado</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Este link já foi usado ou passou do prazo. Peça um novo para criar sua senha.
          </p>
          <Link href="/esqueci-senha" className="btn-primary mt-8">
            <span>Pedir novo link</span>
            <ArrowRight size={20} />
          </Link>
        </>
      )}

      {state === "done" && (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-soft text-cyan-ink">
            <CheckIcon size={26} />
          </span>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Senha atualizada</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Pronto! Use a senha nova nos próximos acessos.
          </p>
          <button
            type="button"
            onClick={() => {
              router.replace("/dashboard");
              router.refresh();
            }}
            className="btn-primary mt-8"
          >
            <span>Ir para o painel</span>
            <ArrowRight size={20} />
          </button>
        </>
      )}

      {state === "ready" && (
        <>
          <p className="eyebrow">Recuperar acesso</p>
          <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Crie uma senha nova</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Escolha uma senha com pelo menos 8 caracteres.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">Nova senha</span>
              <PasswordInput
                value={password}
                onChange={setPassword}
                minLength={8}
                autoComplete="new-password"
                placeholder="Pelo menos 8 caracteres"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">Confirme a senha</span>
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

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary">
              <span>{loading ? "Salvando..." : "Salvar nova senha"}</span>
              <ArrowRight size={20} />
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
