import type { DayPoint } from "./data";

// Gráficos em SVG puro (sem bibliotecas). Cores do tema escuro.
export const C = {
  cyan: "#3fd0ff",
  blue: "#2f6bff",
  pink: "#ff2d55",
  green: "#2ee6b8",
  amber: "#ffb547",
  violet: "#9b7bff",
  grid: "rgba(255,255,255,0.08)",
  text: "#6b7690",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Barras empilhadas por dia (a = embaixo, b = em cima). */
export function StackedBars({
  data,
  aLabel,
  bLabel,
  aColor = C.cyan,
  bColor = C.blue,
  money = false,
}: {
  data: DayPoint[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  money?: boolean;
}) {
  const W = 640;
  const H = 200;
  const pad = { l: 30, r: 8, t: 10, b: 24 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.a + d.b)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / data.length;
  const bw = Math.max(3, slot * 0.62);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${aLabel} e ${bLabel} por dia`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={C.text}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          const ha = (d.a / max) * ih;
          const hb = (d.b / max) * ih;
          const tip = `${d.label}: ${d.a} ${aLabel.toLowerCase()}, ${d.b} ${bLabel.toLowerCase()}${money && d.amount ? ` · ${brl(d.amount)}` : ""}`;
          return (
            <g key={d.key}>
              <title>{tip}</title>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" />
              {d.a > 0 && <rect x={x} y={y(d.a)} width={bw} height={ha} rx={2} fill={aColor} />}
              {d.b > 0 && <rect x={x} y={y(d.a + d.b)} width={bw} height={hb} rx={2} fill={bColor} />}
              {(i % 5 === 4 || i === data.length - 1) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={C.text}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend items={[{ label: aLabel, color: aColor }, { label: bLabel, color: bColor }]} />
    </div>
  );
}

/** Área/linha diária (a) com pontos e barras finas (b) como segunda série. */
export function AreaLine({ data, aLabel, bLabel }: { data: DayPoint[]; aLabel: string; bLabel: string }) {
  const W = 640;
  const H = 200;
  const pad = { l: 30, r: 8, t: 10, b: 24 };
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.a, d.b))));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / Math.max(1, data.length - 1);
  const x = (i: number) => pad.l + i * step;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.a).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, max / 2, max];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${aLabel} por dia`}>
        <defs>
          <linearGradient id="adm-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={C.pink} stopOpacity="0.35" />
            <stop offset="100%" stopColor={C.pink} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={C.text}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect key={`b${d.key}`} x={x(i) - 3} y={y(d.b)} width={6} height={y(0) - y(d.b)} rx={2} fill={C.violet} opacity={0.55} />
        ))}
        <path d={area} fill="url(#adm-area)" />
        <path d={line} fill="none" stroke={C.pink} strokeWidth={2.2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={d.key}>
            <title>{`${d.label}: ${d.a} ${aLabel.toLowerCase()} · ${d.b} ${bLabel.toLowerCase()}`}</title>
            <rect x={x(i) - step / 2} y={pad.t} width={step} height={ih} fill="transparent" />
            {d.a > 0 && <circle cx={x(i)} cy={y(d.a)} r={2.6} fill={C.pink} />}
            {(i % 5 === 4 || i === data.length - 1) && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={C.text}>
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <Legend items={[{ label: aLabel, color: C.pink }, { label: bLabel, color: C.violet }]} />
    </div>
  );
}

export const PLAN_COLORS: Record<string, string> = {
  Mensal: C.cyan,
  Anual: C.blue,
  Vitalício: C.pink,
  "Outros períodos": C.amber,
  "Liberado à mão": C.violet,
};

/** Rosca com o total no meio. */
export function Donut({ items, total, caption }: { items: { label: string; value: number }[]; total: number; caption: string }) {
  const R = 52;
  const len = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0" role="img" aria-label={caption}>
        <circle cx={70} cy={70} r={R} fill="none" stroke={C.grid} strokeWidth={16} />
        {total > 0 &&
          items.map((it) => {
            const part = (it.value / total) * len;
            const el = (
              <circle
                key={it.label}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={PLAN_COLORS[it.label] ?? C.cyan}
                strokeWidth={16}
                strokeDasharray={`${Math.max(0, part - 1.5)} ${len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${it.label}: ${it.value}`}</title>
              </circle>
            );
            offset += part;
            return el;
          })}
        <text x={70} y={68} textAnchor="middle" fontSize="28" fontWeight="600" fill="#eaf2ff">
          {total}
        </text>
        <text x={70} y={86} textAnchor="middle" fontSize="9" letterSpacing="1.5" fill={C.text}>
          {caption.toUpperCase()}
        </text>
      </svg>
      <ul className="w-full space-y-2.5">
        {items.length === 0 && <li className="text-sm text-ink-mute">Nenhum cliente ativo ainda.</li>}
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAN_COLORS[it.label] ?? C.cyan }} />
            <span className="flex-1 text-ink-soft">{it.label}</span>
            <span className="font-mono font-semibold text-ink">{it.value}</span>
            <span className="w-11 text-right font-mono text-xs text-ink-mute">{total ? Math.round((it.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Funil em barras horizontais, com a taxa de passagem entre as etapas. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  const colors = [C.cyan, C.blue, C.green];
  return (
    <ul className="space-y-4">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-soft">{s.label}</span>
              <span className="font-mono">
                <span className="font-semibold text-ink">{s.value}</span>
                {rate !== null && <span className="ml-2 text-xs text-ink-mute">{rate}% da etapa anterior</span>}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full" style={{ width: `${(s.value / max) * 100}%`, background: colors[i % colors.length] }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2 text-xs text-ink-mute">
          <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
