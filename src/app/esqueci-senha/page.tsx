"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth-shell";
import { ArrowRight, CheckIcon } from "@/components/ui";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erro") === "link" ? "Esse link já foi usado ou expirou. Peça um novo abaixo." : null,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    // Limite de envios do Supabase: avisa para esperar. Qualquer outro caso mostra a mesma
    // mensagem de "enviado", para não revelar quais e-mails têm conta.
    if (error && (error.status === 429 || /rate|limit|seconds/i.test(error.message))) {
      setError("Você pediu vários links em pouco tempo. Aguarde alguns minutos e tente de novo.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell windowTitle="dominion · recuperar senha">
      {sent ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-soft text-cyan-ink">
            <CheckIcon size={26} />
          </span>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Confira seu e-mail</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Se <span className="font-medium text-ink">{email.trim().toLowerCase()}</span> tiver acesso, você vai receber
            um link para criar uma senha nova. O link vale por 1 hora.
          </p>
          <p className="mt-5 rounded-2xl bg-field px-4 py-3.5 text-[13px] leading-relaxed text-ink-soft">
            Não chegou em alguns minutos? Olhe a caixa de spam e as abas Promoções ou Atualizações.
          </p>
          <Link href="/login" className="btn-primary mt-8">
            <span>Voltar para o login</span>
            <ArrowRight size={20} />
          </Link>
        </>
      ) : (
        <>
          <p className="eyebrow">Recuperar acesso</p>
          <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Esqueceu a senha?</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Digite o e-mail da sua compra. Vamos enviar um link para você criar uma senha nova.
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

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary">
              <span>{loading ? "Enviando..." : "Enviar link"}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-ink-soft">
            Lembrou a senha?{" "}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Entrar
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
