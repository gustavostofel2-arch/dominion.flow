"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CheckIcon, CopyIcon, KeyIcon, LockIcon } from "@/components/ui";

const CHALLENGE_REGEX = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/;

export default function ActivationForm({
  initiallyActive,
  checkoutUrl,
}: {
  initiallyActive: boolean;
  checkoutUrl: string | null;
}) {
  const router = useRouter();
  const [challenge, setChallenge] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [exp, setExp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inactive, setInactive] = useState(!initiallyActive);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!exp) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [exp]);

  const remaining = exp ? Math.max(0, exp - now) : 0;
  const expired = exp !== null && remaining === 0;
  const normalized = challenge.trim().toUpperCase();
  const validFormat = CHALLENGE_REGEX.test(normalized);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setToken(null);
    setExp(null);
    setCopied(false);

    try {
      const res = await fetch("/api/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge: normalized }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        setInactive(true);
        return;
      }
      if (!res.ok) {
        setError(data.erro ?? "Erro ao gerar token.");
        return;
      }
      setInactive(false);
      setToken(data.token);
      setExp(data.exp);
      setNow(Math.floor(Date.now() / 1000));
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (inactive) {
    return (
      <section className="card relative overflow-hidden p-7 sm:p-9">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-brand" aria-hidden="true" />
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <LockIcon size={26} />
        </span>
        <p className="eyebrow mt-7">Ativação bloqueada</p>
        <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
          Assinatura inativa
        </h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-soft">
          Você precisa de uma assinatura ativa para gerar tokens de ativação. Se acabou de pagar,
          aguarde 1 minuto e atualize a página.
        </p>
        {checkoutUrl ? (
          <a href={checkoutUrl} className="btn-primary mt-8">
            <span>Assinar agora</span>
            <ArrowUpRight size={20} />
          </a>
        ) : (
          <p className="mt-8 rounded-2xl bg-field px-5 py-4 text-sm text-ink-soft">Fale com o suporte para assinar.</p>
        )}
      </section>
    );
  }

  return (
    <section className="card relative overflow-hidden p-7 sm:p-9">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan via-cyan to-brand" aria-hidden="true" />
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-cyan">
          <KeyIcon size={26} />
        </span>
        <p className="eyebrow">Ativação da ferramenta</p>
      </div>
      <h2 className="mt-7 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
        Ative e comece a criar.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Cole o código de sessão que aparece na ferramenta para gerar seu token de ativação.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Código da sessão</span>
          <input
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="ABCD-1234-EFGH-5678"
            spellCheck={false}
            autoComplete="off"
            className="field mt-2 font-mono text-base uppercase tracking-[0.18em]"
          />
        </label>
        {challenge && !validFormat && (
          <p className="text-xs text-ink-mute">Formato esperado: XXXX-XXXX-XXXX-XXXX (letras e números).</p>
        )}
        <button type="submit" disabled={loading || !validFormat} className="btn-primary">
          <span>{loading ? "Gerando..." : "Gerar ativação"}</span>
          <ArrowRight size={20} />
        </button>
      </form>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {token && (
        <div className="mt-8 rounded-3xl border border-line bg-field p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Seu token de ativação</span>
            <span
              className={`rounded-full px-3 py-1 font-mono text-xs ${
                expired ? "bg-red-50 text-red-700" : "bg-cyan-soft text-cyan-ink"
              }`}
            >
              {expired
                ? "Expirado — gere outro"
                : `Expira em ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
            </span>
          </div>
          <textarea
            readOnly
            value={token}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-4 w-full resize-none rounded-2xl border border-line bg-white p-4 font-mono text-xs leading-relaxed break-all text-ink-soft outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={copy}
            disabled={expired}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-ink bg-ink text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink/90 disabled:opacity-40"
          >
            {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
            {copied ? "Copiado!" : "Copiar token"}
          </button>
        </div>
      )}
    </section>
  );
}
