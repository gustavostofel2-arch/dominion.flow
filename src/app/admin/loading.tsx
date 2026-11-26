// Mostrada na hora ao abrir /admin, enquanto o servidor monta os números do painel
// (a leitura do banco leva alguns segundos). Sem isto, o clique parecia não fazer nada.
export default function AdminLoading() {
  return (
    <div className="theme-dark admin-lite flex min-h-full flex-1 flex-col" role="status" aria-live="polite">
      <div className="dk-bg" aria-hidden="true">
        <div className="dk-grid" />
        <div className="dk-orb dk-orb-blue" />
        <div className="dk-orb dk-orb-cyan" />
        <div className="dk-noise" />
      </div>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center">
        <span className="dk-pulse" aria-hidden="true" />
        <p className="eyebrow">Painel admin</p>
        <p className="text-lg text-ink-soft">Carregando os números…</p>
      </main>
    </div>
  );
}
