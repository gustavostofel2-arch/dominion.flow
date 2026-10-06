import type { ReactNode } from "react";
import { Brand, Footer, WindowBar } from "@/components/ui";

/** Moldura das telas de conta (esqueci a senha, nova senha): cartão central em "janela". */
export default function AuthShell({ windowTitle, children }: { windowTitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6">
        <Brand />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-12">
        <section className="card w-full max-w-md overflow-hidden">
          <WindowBar title={windowTitle} />
          <div className="p-7 sm:p-9">{children}</div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
