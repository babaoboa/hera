"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Chip, Glyph, ICONS, fadeUp } from "@/components/hera/ui";

/* ─────────────────────────────────────────────────────────
 * CONFIRM CARD — every action Hera takes on the user's behalf
 * (sending, submitting, requesting) stops here first. Use it to
 * answer a confirm_* client tool: answer(tool, id, { approved }).
 * ───────────────────────────────────────────────────────── */

export default function ConfirmCard({
  title,
  detail,
  rows = [],
  children,
  approveLabel = "Approve",
  declineLabel = "Not now",
  decision,
  approvedLabel,
  disabled,
  onDecide,
}: {
  title: ReactNode;
  detail?: ReactNode;
  rows?: [string, ReactNode][];
  /** a preview of what will be sent (e.g. an email) */
  children?: ReactNode;
  approveLabel?: string;
  declineLabel?: string;
  /** once answered: true = approved, false = declined */
  decision?: boolean | null;
  /** chip shown after approval, e.g. "Quote request sent to Northline" */
  approvedLabel?: string;
  disabled?: boolean;
  onDecide: (approved: boolean) => void;
}) {
  if (decision === true) {
    return (
      <div style={fadeUp}>
        <Chip tone="green">
          <Glyph d={ICONS.check} size={11} stroke={3} /> {approvedLabel ?? "Approved"}
        </Chip>
      </div>
    );
  }
  if (decision === false) {
    return (
      <div style={fadeUp}>
        <Chip>Skipped for now</Chip>
      </div>
    );
  }

  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="px-4 pt-4">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-chip bg-orange-tint px-1.5 py-0.5 text-[11px] font-medium text-orange">
          <span className="size-1.5 animate-pulse rounded-full bg-orange" /> Needs your approval
        </div>
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        {detail && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{detail}</div>}
      </div>
      {rows.length > 0 && (
        <dl className="mx-4 mt-3 divide-y divide-line rounded-[8px] bg-inset shadow-hairline">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[12.5px]">
              <dt className="shrink-0 text-ink-3">{k}</dt>
              <dd className="min-w-0 text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {children && <div className="mx-4 mt-3">{children}</div>}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-line bg-inset px-4 py-3">
        <Button size="sm" variant="quiet" disabled={disabled} onClick={() => onDecide(false)}>
          {declineLabel}
        </Button>
        <Button size="sm" variant="primary" disabled={disabled} onClick={() => onDecide(true)}>
          {approveLabel}
        </Button>
      </div>
    </div>
  );
}
