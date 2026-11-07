"use client";

import type { ReactNode } from "react";
import { Glyph } from "./ui";

export function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3">
        <Glyph d={icon} size={13} />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Rows({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <dt className="shrink-0 text-ink-3">{label}</dt>
          <dd className={`min-w-0 truncate text-right ${value ? "text-ink" : "text-ink-3"}`}>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

