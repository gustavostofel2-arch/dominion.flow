import type { ReactNode } from "react";
import { Brand, Footer, WindowBar } from "@/components/ui";

/** Moldura das telas de conta (esqueci a senha, nova senha): cartão central em "janela". */
export default function AuthShell({ windowTitle, children }: { windowTitle: string; children: ReactNode }) {
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
      <div className="dk-header">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-5">
          <Brand />
        </header>
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-12">
        <section className="card card-strong w-full max-w-md overflow-hidden">
          <WindowBar title={windowTitle} />
          <div className="p-7 sm:p-9">{children}</div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
