"use client";

import { useState } from "react";
import type { Coverage, Policy } from "@/lib/hera/policy-schema";
import { Chip, Glyph, ICONS, fadeUp, money, shortDate } from "@/components/hera/ui";

/* ─────────────────────────────────────────────────────────
 * COVERAGE CARD — "what you're covered for", built from the
 * policy Hera just read. Rows sort covered → limited → not
 * covered; bars show limits on a sqrt scale so small sub-limits
 * stay visible; tapping a row reveals the exact clause.
 * ───────────────────────────────────────────────────────── */

type PolicyLike = Pick<
  Policy,
  "insurer" | "policyNumber" | "periodStart" | "periodEnd" | "annualPremium" | "deductible" | "settlementBasis" | "coverages" | "exclusions" | "deadlines"
>;

const STATUS = {
  covered: { label: "Covered", fg: "text-green", bg: "bg-green-tint", color: "var(--green)", icon: ICONS.check },
  limited: { label: "Limited", fg: "text-orange", bg: "bg-orange-tint", color: "var(--orange)", icon: ICONS.alert },
  not_covered: { label: "Not covered", fg: "text-red", bg: "bg-red-tint", color: "var(--red)", icon: ICONS.x },
} as const;

const ORDER = { covered: 0, limited: 1, not_covered: 2 } as const;

const SETTLEMENT: Record<Policy["settlementBasis"], string> = {
  replacement_cost: "Replacement cost",
  guaranteed_replacement_cost: "Guaranteed replacement cost",
  actual_cash_value: "Actual cash value",
  unknown: "Settlement basis not stated",
};

function StatusIcon({ status }: { status: Coverage["status"] }) {
  const s = STATUS[status];
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${s.bg} ${s.fg}`} aria-label={s.label}>
      <Glyph d={s.icon} size={12} stroke={3} />
    </span>
  );
}

export default function CoverageCard({ policy }: { policy: PolicyLike }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = [...policy.coverages].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const max = Math.max(1, ...rows.map((r) => r.limit ?? 0));
  const count = (s: Coverage["status"]) => rows.filter((r) => r.status === s).length;

  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="border-b border-line px-4 pb-3.5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-ink">What you&apos;re covered for</div>
            <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
              {policy.insurer}
              {policy.policyNumber && ` · ${policy.policyNumber}`}
              {policy.periodEnd && ` · renews ${shortDate(policy.periodEnd)}`}
            </div>
          </div>
          <div className="flex shrink-0 gap-3 pt-0.5 text-[12px] text-ink-2">
            {(["covered", "limited", "not_covered"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5 tabular-nums">
                <span className="size-1.5 rounded-full" style={{ background: STATUS[s].color }} />
                {count(s)}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>Deductible {money(policy.deductible)}</Chip>
          <Chip>{SETTLEMENT[policy.settlementBasis]}</Chip>
          {policy.annualPremium != null && <Chip>{money(policy.annualPremium)}/yr</Chip>}
        </div>
      </div>

      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const isOpen = open === r.key;
          const pct = r.limit ? Math.max(6, Math.sqrt(r.limit / max) * 100) : 0;
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.key)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-hover sm:grid-cols-[auto_1fr_120px_auto]"
              >
                <StatusIcon status={r.status} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{r.name}</span>
                  <span className="block text-[12px] leading-snug text-ink-3">{r.note}</span>
                </span>
                <span className="hidden h-1 overflow-hidden rounded-full bg-field sm:block">
                  {r.status !== "not_covered" && <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: STATUS[r.status].color }} />}
                </span>
                <span className={`text-right text-[12.5px] font-medium tabular-nums ${r.status === "not_covered" ? "text-red" : "text-ink"}`}>
                  {r.status === "not_covered" ? "Not covered" : r.limit != null ? money(r.limit) : "Included"}
                </span>
              </button>
              {isOpen && r.clause && (
                <blockquote className="mx-4 mb-3 rounded-[8px] bg-inset px-3 py-2 text-[12px] italic leading-relaxed text-ink-2 shadow-hairline">
                  “{r.clause}”
                </blockquote>
              )}
            </li>
          );
        })}
      </ul>

      {(policy.deadlines.length > 0 || policy.exclusions.length > 0) && (
        <div className="space-y-3 border-t border-line bg-inset px-4 py-3">
          {policy.deadlines.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              {policy.deadlines.map((d) => (
                <span key={d.name}>
                  <span className="font-medium text-ink">{d.name}</span> <span className="text-ink-3">{d.detail}</span>
                </span>
              ))}
            </div>
          )}
          {policy.exclusions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {policy.exclusions.slice(0, 8).map((x) => (
                <span key={x.name} title={x.clause ?? undefined}>
                  <Chip tone="red">{x.name}</Chip>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
