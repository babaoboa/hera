"use client";

import { CardTitle, Glyph, ICONS, fadeUp, money } from "@/components/hera/ui";
import type { StoredPolicy } from "@/lib/hera/profile";
import type { Quote, QuotesData } from "./types";

/* ─────────────────────────────────────────────────────────
 * QUOTE TABLE — your current policy beside the four SAMPLE
 * quotes. Best value is highlighted; savings are vs. what you
 * pay today. Scrolls sideways on narrow screens.
 * ───────────────────────────────────────────────────────── */

const BASIS = {
  replacement_cost: "Replacement",
  guaranteed_replacement_cost: "Guaranteed",
  actual_cash_value: "Cash value",
  unknown: "—",
} as const;

type Col = {
  id: string;
  insurer: string;
  premium: number | null;
  deductible: number | null;
  flood: { included: boolean; limit: number | null } | null;
  sewer: number | null;
  basis: keyof typeof BASIS;
  rating: number | null;
  current?: boolean;
};

function currentColumn(data: QuotesData, policy: StoredPolicy | null): Col {
  const find = (re: RegExp) => {
    const c = policy?.coverages.find((x) => re.test(`${x.key} ${x.name}`));
    if (c) return { included: c.status !== "not_covered", limit: c.limit };
    const e = policy?.endorsements.find((x) => re.test(x.name));
    return e ? { included: true, limit: e.limit } : null;
  };
  const sewer = find(/sewer|backup|back-up/i);
  return {
    id: "current",
    insurer: data.current.insurer,
    premium: data.current.annualPremium,
    deductible: policy?.deductible ?? null,
    flood: find(/overland|flood|surface water/i) ?? {
      included: false,
      limit: null,
    },
    sewer: sewer?.included ? sewer.limit : 0,
    basis: policy?.settlementBasis ?? "unknown",
    rating: null,
    current: true,
  };
}

const quoteColumn = (q: Quote): Col => ({
  id: q.id,
  insurer: q.insurer,
  premium: q.annualPremium,
  deductible: q.deductible,
  flood: q.flood,
  sewer: q.sewerBackupLimit,
  basis: q.settlementBasis,
  rating: q.rating,
});

export default function QuoteTable({ data, policy }: { data: QuotesData; policy: StoredPolicy | null }) {
  const cols = [currentColumn(data, policy), ...data.quotes.map(quoteColumn)];
  const best = data.quotes.find((q) => q.id === data.bestValueId);
  const saving = best ? data.current.annualPremium - best.annualPremium : 0;

  const rows: { label: string; cell: (c: Col) => React.ReactNode }[] = [
    {
      label: "Price / yr",
      cell: (c) => (
        <span className="font-semibold text-ink">
          {money(c.premium)}
          {!c.current && c.premium != null && (
            <span className={`block text-[11px] font-medium ${c.premium < data.current.annualPremium ? "text-green" : "text-ink-3"}`}>
              {c.premium < data.current.annualPremium
                ? `−${money(data.current.annualPremium - c.premium)}`
                : `+${money(c.premium - data.current.annualPremium)}`}
            </span>
          )}
        </span>
      ),
    },
    { label: "Deductible", cell: (c) => money(c.deductible) },
    {
      label: "Overland flood",
      cell: (c) =>
        c.flood?.included ? (
          <span className="text-green">{c.flood.limit ? money(c.flood.limit) : "Included"}</span>
        ) : (
          <span className="text-red">Not covered</span>
        ),
    },
    {
      label: "Sewer backup",
      cell: (c) => (c.sewer ? money(c.sewer) : <span className="text-red">Not covered</span>),
    },
    {
      label: "Payout basis",
      cell: (c) => <span className={c.basis === "actual_cash_value" ? "text-orange" : ""}>{BASIS[c.basis]}</span>,
    },
    {
      label: "Rating",
      cell: (c) => (c.rating ? `${c.rating.toFixed(1)}★` : "—"),
    },
  ];

  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <CardTitle
          icon={ICONS.tag}
          tone="green"
          title="Quotes for your home"
          sub={best ? `${best.insurer} is the best value${saving > 0 ? ` — ${money(saving)}/yr less, with flood included` : ""}` : undefined}
        />
      </div>
      <div className="overflow-x-auto border-t border-line [scrollbar-width:thin]">
        <table className="w-full min-w-[560px] border-collapse text-[12px] tabular-nums">
          <thead>
            <tr>
              <th className="w-[92px]" />
              {cols.map((c) => (
                <th
                  key={c.id}
                  className={`px-2 pb-2 pt-3 text-left align-bottom font-medium ${c.id === data.bestValueId ? "bg-green-tint" : c.current ? "bg-inset" : ""}`}
                >
                  {c.id === data.bestValueId && (
                    <span className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-green">
                      <Glyph d={ICONS.check} size={10} stroke={3} /> Best value
                    </span>
                  )}
                  {c.current && <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-3">You today</span>}
                  <span className="block leading-tight text-ink">{c.insurer}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <th className="px-4 py-2 text-left font-normal text-ink-3">{r.label}</th>
                {cols.map((c) => (
                  <td
                    key={c.id}
                    className={`px-2 py-2 align-top text-ink-2 ${c.id === data.bestValueId ? "bg-green-tint" : c.current ? "bg-inset" : ""}`}
                  >
                    {r.cell(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line bg-inset px-4 py-2.5 text-[11.5px] text-ink-3">
        Quotes based on your file and risk profile. Final pricing and coverage need insurer confirmation.
      </div>
    </div>
  );
}
