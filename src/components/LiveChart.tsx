"use client";

import { useId } from "react";

export type Series = { label: string; color: string; data: number[]; current: string };

const W = 300;
const H = 90;

export function LiveChart({
  title,
  series,
  max,
  offline,
}: {
  title: string;
  series: Series[];
  /** Fixed y-axis maximum. When omitted the chart auto-scales. */
  max?: number;
  offline?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const all = series.flatMap((s) => s.data);
  const top = max ?? Math.max(10, Math.max(0, ...all) * 1.25);
  const n = Math.max(2, ...series.map((s) => s.data.length));

  const toPath = (data: number[]) => {
    if (data.length === 0) return "";
    const offset = n - data.length;
    return data
      .map((v, i) => {
        const x = ((i + offset) / (n - 1)) * W;
        const y = H - Math.min(1, v / top) * (H - 4) - 2;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <div className="rounded-xl border border-line bg-panel/90 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="flex gap-3">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <span className="font-medium tabular-nums text-zinc-100">{s.current}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full overflow-visible" role="img" aria-label={`${title} chart`}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.label} id={`${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#252938" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          {series.map((s, i) => {
            const d = toPath(s.data);
            if (!d) return null;
            const offset = n - s.data.length;
            const lastX = ((s.data.length - 1 + offset) / (n - 1)) * W;
            const firstX = (offset / (n - 1)) * W;
            return (
              <g key={s.label}>
                {i === 0 && <path d={`${d} L${lastX},${H} L${firstX},${H} Z`} fill={`url(#${uid}-${i})`} />}
                <path d={d} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between text-[10px] tabular-nums text-zinc-600">
          <span>{max ? `${max}` : Math.round(top)}</span>
          <span>0</span>
        </div>
        {offline && (
          <div className="absolute inset-0 grid place-items-center rounded-lg bg-panel/70 text-xs text-zinc-500 backdrop-blur-[1px]">
            VM is powered off
          </div>
        )}
      </div>
    </div>
  );
}
