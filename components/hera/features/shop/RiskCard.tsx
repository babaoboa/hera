"use client";

import { CardTitle, Chip, Glyph, ICONS, fadeUp } from "@/components/hera/ui";
import type { ScanResult } from "./types";

/* ─────────────────────────────────────────────────────────
 * RISK CARD — "Your home's risk profile". A small map of what
 * is around the home (real bearing + distance from OSM, on a
 * log scale so a hydrant 80 m away and a fire hall 2 km away
 * both read), then each factor with its effect on price, then
 * the gaps Hera found in the current policy.
 * ───────────────────────────────────────────────────────── */

const fmt = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

const SIZE = 220;
const C = SIZE / 2;
const RMAX = C - 14;
const DMAX = 8000;
const radius = (d: number) => (Math.log(1 + d / 40) / Math.log(1 + DMAX / 40)) * RMAX;
const RINGS = [100, 500, 2000, 8000];

const MARKS = [
  { key: "fireStation", label: "Fire hall", color: "var(--red)" },
  { key: "hydrant", label: "Hydrant", color: "var(--orange)" },
  { key: "water", label: "River / lake", color: "var(--accent)" },
] as const;

function NeighbourhoodMap({ scan }: { scan: ScanResult }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      className="max-w-full shrink-0"
      role="img"
      aria-label="Map of what's around your home"
    >
      {RINGS.map((d) => (
        <g key={d}>
          <circle cx={C} cy={C} r={radius(d)} fill="none" stroke="var(--line-strong)" strokeDasharray={d === 8000 ? undefined : "2 3"} />
          <text x={C} y={C + radius(d) + 9} fontSize="8.5" textAnchor="middle" fill="var(--ink-3)">
            {fmt(d)}
          </text>
        </g>
      ))}
      <text x={C} y={9} fontSize="8.5" textAnchor="middle" fill="var(--ink-3)">
        N
      </text>
      {/* flood exposure halo around the home when water is close */}
      {scan.water && scan.water.distanceM < 1500 && <circle cx={C} cy={C} r={radius(scan.water.distanceM)} fill="var(--accent)" opacity={0.07} />}
      {MARKS.map(({ key, color, label }) => {
        const p = scan[key];
        if (!p) return null;
        const r = radius(p.distanceM);
        const a = (p.bearing * Math.PI) / 180;
        const x = C + r * Math.sin(a);
        const y = C - r * Math.cos(a);
        return (
          <g key={key}>
            <line x1={C} y1={C} x2={x} y2={y} stroke={color} strokeOpacity={0.45} strokeWidth={1.2} />
            <circle cx={x} cy={y} r={5.5} fill={color} stroke="var(--surface)" strokeWidth={2}>
              <title>{`${label}: ${fmt(p.distanceM)}`}</title>
            </circle>
          </g>
        );
      })}
      <rect x={C - 8} y={C - 8} width={16} height={16} rx={4} fill="var(--ink)" />
      <path
        d={`M${C - 4.5} ${C + 0.5} L${C} ${C - 4} L${C + 4.5} ${C + 0.5} M${C - 3} ${C - 0.5} V${C + 4} H${C + 3} V${C - 0.5}`}
        stroke="var(--surface)"
        strokeWidth={1.4}
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FLOOD = {
  low: { tone: "green", label: "Low" },
  moderate: { tone: "orange", label: "Moderate" },
  high: { tone: "red", label: "High" },
} as const;
const SEVERITY = {
  high: "text-red bg-red-tint",
  medium: "text-orange bg-orange-tint",
  low: "text-ink-3 bg-field",
} as const;

export default function RiskCard({ scan }: { scan: ScanResult }) {
  const flood = FLOOD[scan.floodRisk];
  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <CardTitle
          icon={ICONS.home}
          title="Your home's risk profile"
          sub={scan.location.label?.split(",").slice(0, 3).join(",") ?? "Hera's estimate"}
        />
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Chip tone={flood.tone}>
            <Glyph d={ICONS.wave} size={11} stroke={2.4} /> Flood risk {flood.label.toLowerCase()}
          </Chip>
          {scan.estimated && <Chip tone="orange">Estimated</Chip>}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-4 border-t border-line px-4 py-4 sm:flex-row sm:items-center">
        <NeighbourhoodMap scan={scan} />
        <ul className="w-full min-w-0 space-y-2.5 text-[12.5px]">
          {MARKS.map(({ key, label, color }) => {
            const p = scan[key];
            return (
              <li key={key} className="flex items-baseline gap-2">
                <span className="mt-[3px] size-2 shrink-0 self-start rounded-full" style={{ background: color }} />
                <span className="text-ink-3">{label}</span>
                <span className="min-w-0 flex-1 truncate text-right text-ink">
                  {p ? (
                    <>
                      <span className="tabular-nums font-medium">{fmt(p.distanceM)}</span>
                      {p.name && <span className="text-ink-3"> · {p.name.replace(/\s*\(estimated\)/, "")}</span>}
                    </>
                  ) : (
                    <span className="text-ink-3">None nearby</span>
                  )}
                </span>
              </li>
            );
          })}
          <li className="pt-1 text-[11px] leading-snug text-ink-3">
            Log scale · {scan.source}
            {scan.estimated ? " — estimated" : ""}
          </li>
        </ul>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {scan.factors.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]">
            <span className="w-[104px] shrink-0 text-ink-3">{f.label}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{f.detail}</span>
            {f.impact === "up" ? <Chip tone="red">price ↑</Chip> : f.impact === "down" ? <Chip tone="green">price ↓</Chip> : <Chip>neutral</Chip>}
          </li>
        ))}
      </ul>

      {scan.gaps.length > 0 && (
        <div className="border-t border-line">
          <div className="px-4 pb-1 pt-3 text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3">Gaps in your current policy</div>
          <ul className="divide-y divide-line">
            {scan.gaps.map((g) => (
              <li key={g.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full ${SEVERITY[g.severity]}`}>
                  <Glyph d={g.severity === "low" ? ICONS.alert : ICONS.x} size={11} stroke={3} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-ink">{g.title}</div>
                  <div className="text-[12px] leading-snug text-ink-3">{g.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-line bg-inset px-4 py-2.5 text-[11.5px] text-ink-3">
        Hera&apos;s estimate from public map data and your file — not an insurer&apos;s rating.
      </div>
    </div>
  );
}
