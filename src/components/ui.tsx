// Peças visuais compartilhadas (marca, ícones, rodapé). Sem lógica.
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ArrowUpRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
);
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);
export const KeyIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.2-8.2M17 6l2 2M15 8l2 2" />
  </Icon>
);
export const NodesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="15" y="15" width="6" height="6" rx="1.5" />
    <rect x="15" y="3" width="6" height="6" rx="1.5" />
    <path d="M9 6h6M18 9v6M9 6c3 0 3 12 6 12" />
  </Icon>
);
export const FilmIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </Icon>
);
export const EyeIcon = ({ open, ...p }: IconProps & { open: boolean }) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {!open && <path d="M3 3l18 18" />}
  </Icon>
);

/** Marca: "D" com sombra rosa/ciano deslocada (pegada TikTok do dominion.ia). */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="brand-mark relative inline-flex shrink-0 items-center justify-center rounded-xl bg-ink font-mono font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      <span className="brand-mark-cyan absolute translate-x-[-1.5px] translate-y-[-1px] text-cyan">D</span>
      <span className="absolute translate-x-[1.5px] translate-y-[1px] text-brand">D</span>
      <span className="relative">D</span>
    </span>
  );
}

export function Brand({ subtitle = "Área de membros" }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-3">
      <BrandMark />
      <span className="flex flex-col leading-tight">
        <span className="text-[17px] font-semibold tracking-tight">Dominion</span>
        <span className="brand-sub font-mono text-[10px] uppercase tracking-[0.24em] text-ink-mute">{subtitle}</span>
      </span>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="site-footer mt-auto border-t border-line bg-white/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="site-footer-name font-semibold tracking-tight">Dominion</span>
        <span className="site-footer-text text-ink-mute">Ferramentas de IA para criar mais, em menos etapas.</span>
      </div>
    </footer>
  );
}

/** Barra de "janela de app" para cartões: três pontos + endereço em mono. */
export function WindowBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="winbar flex items-center justify-between gap-3 border-b border-line px-5 py-3">
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        <span className="winbar-dot-cyan h-2.5 w-2.5 rounded-full bg-cyan" />
        <span className="winbar-dot-gray h-2.5 w-2.5 rounded-full bg-line-strong" />
      </span>
      <span className="winbar-title truncate font-mono text-[11px] text-ink-mute">{title}</span>
      <span className="min-w-[30px] text-right">{right}</span>
    </div>
  );
}
