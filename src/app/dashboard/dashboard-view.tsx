import { TOOLS } from "@/lib/tools";
import { ArrowUpRight, Brand, FilmIcon, Footer, NodesIcon } from "@/components/ui";
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
  until: string | null;
  renewLabel: string;
  plan: string | null | undefined;
  checkoutUrl: string | null;
};

export default function DashboardView({ email, hello, active, until, renewLabel, plan, checkoutUrl }: DashboardViewProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white/75 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm text-ink-mute sm:block">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-10 sm:pt-14">
        {/* Boas-vindas */}
        <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Seu espaço criativo</p>
            <h1 className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.04em] sm:text-6xl">
              Olá{hello ? `, ${hello}` : ""}.
            </h1>
            <p className="mt-4 text-[17px] text-ink-soft">
              {active ? "Suas ferramentas estão prontas. Escolha o próximo passo." : "Sua assinatura está inativa."}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs ${
                active ? "border-cyan/50 bg-cyan-soft text-cyan-ink" : "border-brand/30 bg-brand-soft text-brand"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? "bg-cyan-ink" : "bg-brand"}`} />
              {active ? "Acesso liberado" : "Acesso inativo"}
            </span>
            {active && until && (
              <span className="text-sm text-ink-mute">
                {renewLabel} <span className="font-medium text-ink">{until}</span>
                {plan ? ` · ${plan.trim()}` : ""}
              </span>
            )}
          </div>
        </section>

        {/* Ativação + passo a passo */}
        <section id="ativacao" className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <ActivationForm initiallyActive={active} checkoutUrl={checkoutUrl} />

          <div className="card p-7 sm:p-9">
            <p className="eyebrow">Como ativar</p>
            <ol className="mt-6 space-y-5">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-5">
                  <span className="font-mono text-sm font-semibold text-brand">{s.n}</span>
                  <span>
                    <span className="block text-[17px] font-semibold tracking-tight">{s.title}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-7 rounded-2xl bg-field px-5 py-4 text-sm leading-relaxed text-ink-soft">
              O token vale por alguns minutos e só para a sessão aberta. Fechou ou recarregou a ferramenta? É só
              gerar outro.
            </p>
          </div>
        </section>

        {/* Ferramentas */}
        <section className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Suas ferramentas</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Escolha onde criar hoje.</h2>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {TOOLS.map((tool) => {
              const isFlow = tool.id === "flow";
              return (
                <article key={tool.id} className="card flex flex-col p-7 sm:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                        isFlow ? "bg-cyan text-ink" : "bg-brand text-white"
                      }`}
                    >
                      {isFlow ? <NodesIcon size={30} /> : <FilmIcon size={30} />}
                    </span>
                    <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                      {tool.tagline}
                    </span>
                  </div>

                  <h3 className="mt-8 text-[30px] font-semibold leading-tight tracking-[-0.03em]">{tool.name}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{tool.description}</p>

                  <ul className="mt-6 flex flex-wrap gap-2">
                    {tool.features.map((f) => (
                      <li key={f} className="rounded-full bg-field px-3 py-1.5 font-mono text-[11px] text-ink-soft">
                        ✓ {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary mt-8"
                  >
                    <span>Abrir {tool.name}</span>
                    <ArrowUpRight size={20} />
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
