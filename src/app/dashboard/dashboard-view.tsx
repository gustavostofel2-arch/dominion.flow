import Link from "next/link";
import { TOOLS, type Tool } from "@/lib/tools";
import { ArrowUpRight, Brand, Footer, WindowBar } from "@/components/ui";
import ActivationForm from "./activation-form";
import SignOutButton from "./sign-out-button";

// Visual do painel (só apresentação). Os dados vêm de page.tsx.
const STEPS = [
  { n: "01", title: "Abra a ferramenta", text: "Abra uma das ferramentas no Google Flow e copie o código de sessão." },
  { n: "02", title: "Gere sua ativação", text: "Cole o código no campo de ativação e copie o token gerado." },
  { n: "03", title: "Comece a criar", text: "Volte para a ferramenta, cole o token e clique em Ativar." },
];

export type DashboardViewProps = {
  email: string | undefined;
  hello: string;
  active: boolean;
  plan: string | null | undefined;
  /** Data da próxima cobrança (dd/mm/aaaa) ou "Cancelada". Vazio para contas sem renovação. */
  renewal: string | null;
  checkoutUrl: string | null;
  /** Só true para os e-mails do painel admin (decidido no servidor). */
  showAdmin?: boolean;
};

/** Ilustração do Dominion Flow: três nodes ligados por curvas. */
function FlowArt() {
  return (
    <svg viewBox="0 0 320 120" className="h-full w-full" aria-hidden="true">
      <path d="M92 38 C140 38 140 82 188 82" fill="none" stroke="#25f4ee" strokeWidth="2.5" />
      <path d="M92 38 C150 38 160 30 228 30" fill="none" stroke="#fe2c55" strokeWidth="2.5" strokeDasharray="5 5" />
      <rect x="20" y="20" width="72" height="36" rx="10" fill="#fff" stroke="#d6d3cc" />
      <rect x="30" y="31" width="34" height="5" rx="2.5" fill="#18181b" />
      <rect x="30" y="41" width="48" height="4" rx="2" fill="#d6d3cc" />
      <rect x="188" y="64" width="80" height="36" rx="10" fill="#18181b" />
      <rect x="198" y="75" width="40" height="5" rx="2.5" fill="#25f4ee" />
      <rect x="198" y="85" width="56" height="4" rx="2" fill="#52525b" />
      <rect x="228" y="14" width="72" height="32" rx="10" fill="#fe2c55" />
      <rect x="238" y="24" width="30" height="5" rx="2.5" fill="#fff" />
      <rect x="238" y="33" width="44" height="4" rx="2" fill="#ffd1da" />
      <circle cx="92" cy="38" r="4.5" fill="#fff" stroke="#18181b" strokeWidth="2" />
      <circle cx="188" cy="82" r="4.5" fill="#fff" stroke="#18181b" strokeWidth="2" />
      <circle cx="228" cy="30" r="4.5" fill="#fff" stroke="#18181b" strokeWidth="2" />
    </svg>
  );
}

/** Ilustração do Dominion Creator: tira de quadros + multiplicação de saídas. */
function CreatorArt() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-4 px-6" aria-hidden="true">
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`relative h-14 flex-1 rounded-lg border ${
              i === 2 ? "border-brand bg-brand-soft" : "border-line bg-white"
            }`}
          >
            <span className="absolute inset-x-2 top-2 h-1 rounded bg-line" />
            {i === 2 && (
              <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-brand" />
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-ink-soft sm:gap-2 sm:text-[11px]">
        <span className="rounded-md bg-white px-1.5 py-1 ring-1 ring-line sm:px-2">10 prompts</span>
        <span>×</span>
        <span className="rounded-md bg-white px-1.5 py-1 ring-1 ring-line sm:px-2">4 imagens</span>
        <span>×</span>
        <span className="rounded-md bg-white px-1.5 py-1 ring-1 ring-line sm:px-2">2 falas</span>
        <span>=</span>
        <span className="rounded-md bg-ink px-1.5 py-1 text-white sm:px-2">80 vídeos</span>
      </div>
    </div>
  );
}

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const isFlow = tool.id === "flow";
  return (
    <article className="card flex flex-col overflow-hidden">
      <WindowBar title={`flow.google.com · ${tool.name}`} right={<span className="font-mono text-[11px] text-ink-mute">0{index + 1}</span>} />
      <div
        className="dk-art h-40 border-b border-line bg-field"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(24,24,27,0.10) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        {isFlow ? <FlowArt /> : <CreatorArt />}
      </div>

      <div className="flex flex-1 flex-col p-7 sm:p-8">
        <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isFlow ? "text-cyan-ink" : "text-brand"}`}>
          {tool.tagline}
        </span>
        <h3 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em]">{tool.name}</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{tool.description}</p>

        <ul className="mt-5 space-y-2">
          {tool.features.map((f) => (
            <li key={f} className="flex items-center gap-3 text-sm text-ink-soft">
              <span className={`h-1.5 w-1.5 rounded-full ${isFlow ? "bg-cyan-ink" : "bg-brand"}`} />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <span className="sm:hidden">Abrir ferramenta</span>
            <span className="hidden sm:inline">Abrir {tool.name}</span>
            <ArrowUpRight size={20} />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function DashboardView({ email, hello, active, plan, renewal, checkoutUrl, showAdmin }: DashboardViewProps) {
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
      <header className="dk-header sticky top-0 z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm text-ink-mute sm:block">{email}</span>
            {showAdmin && (
              <Link href="/admin" className="btn-ghost">
                <span className="sm:hidden">Admin</span>
                <span className="hidden sm:inline">Painel admin</span>
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-10 sm:pt-14">
        {/* Boas-vindas + status */}
        <section className="grid gap-6 md:grid-cols-2 md:items-end">
          <div>
            <p className="eyebrow">Painel do membro</p>
            <h1 className="mt-4 text-[46px] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[68px]">
              Olá{hello ? ", " : ""}
              {hello && <span className="glitch">{hello}</span>}.
            </h1>
            <p className="mt-4 max-w-xl text-[17px] text-ink-soft">
              {active
                ? "Tudo pronto. Abra uma ferramenta, gere sua ativação e comece a criar."
                : "Sua assinatura está inativa. Renove para voltar a ativar suas ferramentas."}
            </p>
          </div>

          <div className="card overflow-hidden">
            <WindowBar title="status da assinatura" />
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between px-5 py-3.5">
                <dt className="text-ink-mute">Status</dt>
                <dd className={`flex items-center gap-2 font-semibold ${active ? "text-cyan-ink" : "text-brand"}`}>
                  <span className={`h-2 w-2 rounded-full ${active ? "bg-cyan-ink" : "bg-brand"}`} />
                  {active ? "Ativa" : "Inativa"}
                </dd>
              </div>
              {active && plan && (
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-ink-mute">Plano</dt>
                  <dd className="truncate font-medium">{plan.trim()}</dd>
                </div>
              )}
              {active && renewal && (
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-ink-mute">Renovação</dt>
                  <dd className="font-mono font-semibold">{renewal}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        {/* Ativação + passo a passo */}
        <section id="ativacao" className="mt-10 grid gap-6 md:grid-cols-2">
          <ActivationForm initiallyActive={active} checkoutUrl={checkoutUrl} />

          <div className="card p-7 sm:p-9">
            <p className="eyebrow">Como ativar</p>
            <ol className="mt-7">
              {STEPS.map((s, i) => (
                <li key={s.n} className="relative flex gap-5 pb-8 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span className="dash-v absolute left-[19px] top-11 bottom-1 w-0.5" aria-hidden="true" />
                  )}
                  <span
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                      i === STEPS.length - 1 ? "bg-brand text-white" : "border border-line bg-white text-ink"
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className="pt-1.5">
                    <span className="block text-[17px] font-semibold tracking-tight">{s.title}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-8 rounded-2xl bg-field px-5 py-4 text-sm leading-relaxed text-ink-soft">
              O token vale por alguns minutos e só para a sessão aberta. Fechou ou recarregou a ferramenta? É só
              gerar outro.
            </p>
          </div>
        </section>

        {/* Ferramentas */}
        <section className="mt-16">
          <p className="eyebrow">Suas ferramentas</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Escolha onde <span className="glitch-sm">criar</span> hoje.
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {TOOLS.map((tool, i) => (
              <ToolCard key={tool.id} tool={tool} index={i} />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
