"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
      <section className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-6 dark:border-amber-400/30 dark:bg-amber-400/10">
        <h2 className="font-semibold">Assinatura inativa</h2>
        <p className="mt-1 text-sm opacity-80">
          Você precisa de uma assinatura ativa para gerar tokens de ativação. Se acabou de pagar,
          aguarde 1 minuto e atualize a página.
        </p>
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700"
          >
            Assinar agora
          </a>
        ) : (
          <p className="mt-4 text-sm opacity-80">Fale com o suporte para assinar.</p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Cole o código de sessão do Flow</span>
          <input
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            spellCheck={false}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 font-mono uppercase tracking-wider outline-none focus:border-violet-500 dark:border-white/15"
          />
        </label>
        {challenge && !validFormat && (
          <p className="text-xs opacity-70">Formato esperado: XXXX-XXXX-XXXX-XXXX (letras e números).</p>
        )}
        <button
          type="submit"
          disabled={loading || !validFormat}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Gerando..." : "Gerar ativação"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {token && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Token de ativação</span>
            <span className={expired ? "text-red-600 dark:text-red-400" : "opacity-70"}>
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
            className="mt-2 w-full resize-none rounded-lg border border-black/15 bg-black/[0.03] p-3 font-mono text-xs break-all dark:border-white/15 dark:bg-white/5"
          />
          <button
            type="button"
            onClick={copy}
            disabled={expired}
            className="mt-2 w-full rounded-lg border border-violet-600 px-4 py-2 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
          >
            {copied ? "Copiado!" : "Copiar token"}
          </button>
        </div>
      )}
    </section>
  );
}
