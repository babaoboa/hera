"use client";

import type { ReactNode } from "react";

/* Small shared pieces for Hera's chat artifacts, built on the app's tokens. */

export const fadeUp = { animation: "fade-up 400ms cubic-bezier(0.23,1,0.32,1) both" } as const;

export const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
};

export function Glyph({ d, size = 15, stroke = 1.9 }: { d: ReactNode; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );
}

export const ICONS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  alert: <path d="M12 7v6M12 17h.01" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  upload: <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  folder: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  save: <><path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  wave: <><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></>,
};

/** A quiet trace line for a tool call — spinner while running, glyph when done. */
export function AgentStep({
  icon,
  label,
  running = false,
  tone = "default",
  children,
}: {
  icon: ReactNode;
  label: ReactNode;
  running?: boolean;
  tone?: "default" | "warn";
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px]" style={fadeUp}>
      <span className={`flex size-5 items-center justify-center rounded-[6px] ${tone === "warn" ? "bg-orange-tint text-orange" : "bg-hover-2 text-ink-2"}`}>
        {running ? <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" /> : <Glyph d={icon} size={12} stroke={2.2} />}
      </span>
      <span className={running ? "text-ink-2" : tone === "warn" ? "text-orange" : "text-ink-3"}>{label}</span>
      {children}
    </div>
  );
}

export function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "green" | "orange" | "red" | "accent" }) {
  const cls = {
    default: "bg-field text-ink-2 shadow-hairline",
    green: "bg-green-tint text-green",
    orange: "bg-orange-tint text-orange",
    red: "bg-red-tint text-red",
    accent: "bg-accent-tint text-accent-ink",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11.5px] font-medium ${cls}`}>{children}</span>;
}

/** Card header used by every Hera artifact. */
export function CardTitle({ icon, title, sub, tone = "accent" }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; tone?: "accent" | "green" | "orange" | "red" }) {
  const cls = { accent: "bg-accent-tint text-accent-ink", green: "bg-green-tint text-green", orange: "bg-orange-tint text-orange", red: "bg-red-tint text-red" }[tone];
  return (
    <div className="flex items-start gap-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-control ${cls}`}>
        <Glyph d={icon} size={16} />
      </span>
      <div className="min-w-0 pt-px">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        {sub && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}
