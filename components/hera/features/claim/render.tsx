"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import AgentDesktop, { type DesktopPage } from "@/components/hera/AgentDesktop";
import ConfirmCard from "@/components/hera/ConfirmCard";
import { Block, Rows } from "@/components/hera/FileBlocks";
import { AgentStep, CardTitle, Chip, Glyph, ICONS, fadeUp, money, shortDate } from "@/components/hera/ui";
import { notifyProfileChanged } from "@/components/hera/useProfile";
import type { Profile } from "@/lib/hera/profile";
import type { Claim, Evidence, Expense, Photo } from "@/lib/hera/features/claim/store";
import type { FeaturePane, FeatureRenderer, RenderContext, ToolPart } from "../types";

import InventoryCard from "./InventoryCard";
import { inventoryReview } from "@/lib/hera/features/claim/review";

/* claim feature — UI. Owned by the claim feature. */

const SITE = { name: "Birchwood Mutual", color: "#2f5d50" };
const PORTAL = "claims.birchwoodmutual.example";
const CARD = "max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card";
const inputCls =
  "h-8 w-full rounded-[8px] bg-field px-2.5 text-[12.5px] text-ink shadow-hairline outline-none transition-[box-shadow] duration-150 placeholder:text-ink-3 focus:shadow-[0_0_0_2px_var(--accent)]";

const claimOf = (profile: Profile | null) => (profile?.features.claim?.claim as Claim | undefined) ?? null;
const photosOf = (profile: Profile | null) => (profile?.features.claim?.photos as Photo[] | undefined) ?? [];
const sum = (xs: { cost?: number; amount?: number }[]) => xs.reduce((s, x) => s + (x.cost ?? x.amount ?? 0), 0);
const done = (p: ToolPart) => p.state === "output-available";
const hasError = (o: unknown): o is { error: string } => !!o && typeof o === "object" && "error" in o;

async function claimOp(body: Record<string, unknown>) {
  const res = await fetch("/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) notifyProfileChanged();
  return res.ok;
}

function Meter({ value, max, tone = "accent" }: { value: number; max: number | null; tone?: "accent" | "orange" }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const over = !!max && value > max;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-field shadow-hairline">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, background: over || tone === "orange" ? "var(--orange)" : "var(--accent)" }}
      />
    </div>
  );
}

/* ─────────── tracker ─────────── */

function stepsOf(c: Claim) {
  return [
    { label: "Report loss", state: c.fnol ? "done" : "now" },
    { label: "Inventory", state: c.proofOfLoss ? "done" : c.inventory.length ? "now" : c.fnol ? "now" : "todo" },
    { label: "Living expenses", state: c.proofOfLoss ? "done" : c.expenses.length ? "now" : "todo" },
    { label: "Proof of loss", state: c.proofOfLoss ? "done" : "todo" },
  ] as const;
}

function Steps({ claim }: { claim: Claim }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {stepsOf(claim).map((s, i) => (
        <li key={s.label} className="min-w-0">
          <div className={`h-1 rounded-full ${s.state === "done" ? "bg-green" : s.state === "now" ? "bg-accent" : "bg-field shadow-hairline"}`} />
          <div className={`mt-1.5 flex items-center gap-1 truncate text-[11.5px] ${s.state === "todo" ? "text-ink-3" : "text-ink-2"}`}>
            {s.state === "done" ? <span className="text-green"><Glyph d={ICONS.check} size={11} stroke={3} /></span> : <span className="tabular-nums text-ink-3">{i + 1}</span>}
            {s.label}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ClaimTracker({ claim }: { claim: Claim }) {
  const [checked, setChecked] = useState<number[]>([]);
  return (
    <div className={CARD} style={fadeUp}>
      <div className="px-4 pt-4">
        <CardTitle
          icon={ICONS.wave}
          title="Your claim"
          sub={`${claim.cause} · ${shortDate(claim.dateOfLoss)} · ${claim.insurer}${claim.fnol ? ` · ${claim.fnol.claimNumber}` : ""}`}
        />
        <div className="mt-4">
          <Steps claim={claim} />
        </div>
      </div>

      {claim.coverages.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 px-4">
          {claim.coverages.map((c) => (
            <Chip key={c.key} tone={c.status === "covered" ? "green" : c.status === "limited" ? "orange" : "red"}>
              {c.name}
              {!!c.limit && <span className="tabular-nums opacity-80">· {money(c.limit)}</span>}
            </Chip>
          ))}
          {claim.deductible != null && <Chip>Deductible <span className="tabular-nums">{money(claim.deductible)}</span></Chip>}
        </div>
      )}

      {claim.deadlines.length > 0 && (
        <div className="mt-4 px-4">
          <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3">Deadlines</div>
          <dl className="divide-y divide-line rounded-[8px] bg-inset shadow-hairline">
            {claim.deadlines.map((d) => (
              <div key={d.name} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[12.5px]">
                <dt className="min-w-0 text-ink-2">
                  {d.name} <span className="text-ink-3">· {d.detail}</span>
                </dt>
                <dd className="shrink-0 font-medium tabular-nums text-ink">{d.due ? (d.due === claim.dateOfLoss ? "Now" : shortDate(d.due)) : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-4 px-4 pb-1">
        <div className="mb-1 text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3">Before you clean up</div>
        <ul className="divide-y divide-line">
          {claim.checklist.map((item, i) => {
            const on = checked.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setChecked((c) => (on ? c.filter((x) => x !== i) : [...c, i]))}
                  className="flex w-full items-start gap-2.5 py-2 text-left text-[12.5px] leading-snug"
                >
                  <span
                    className={`mt-px flex size-4 shrink-0 items-center justify-center rounded-[5px] transition-colors ${on ? "bg-green text-white" : "bg-field shadow-hairline"}`}
                  >
                    {on && <Glyph d={ICONS.check} size={10} stroke={3.2} />}
                  </span>
                  <span className={on ? "text-ink-3 line-through" : "text-ink-2"}>{item}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-2 border-t border-line bg-inset px-4 py-3 text-[12px] text-ink-3">
        Settlement: {claim.settlementBasis.replaceAll("_", " ")} · Hera works for you, not the insurer.
      </div>
    </div>
  );
}

/* ─────────── forms Hera fills on the insurer's portal ─────────── */

function fnolPage(claim: Claim, profile: Profile | null): DesktopPage {
  const p = profile?.property;
  const address = [p?.street, p?.city, p?.province].filter(Boolean).join(", ") || profile?.policy?.propertyAddress || "—";
  return {
    url: `${PORTAL}/report-a-claim`,
    site: { ...SITE, name: claim.insurer },
    mode: "claim",
    title: "Report a claim",
    note: "Pre-filled from your Hera file",
    fields: [
      { label: "Policy number", value: claim.policyNumber ?? "—" },
      { label: "Policyholder", value: profile?.person.fullName ?? profile?.policy?.insuredName ?? "—" },
      { label: "Property address", value: address },
      { label: "Phone", value: profile?.person.phone ?? "—" },
      { label: "Date of loss", value: shortDate(claim.dateOfLoss) },
      { label: "Cause of loss", value: claim.cause },
      { label: "Is the home livable?", value: claim.livable ? "Yes" : "No — staying elsewhere" },
      { label: "Mortgage lender", value: profile?.property.mortgageLender ?? profile?.policy?.mortgagee ?? "—" },
    ],
  };
}

function polPage(claim: Claim): DesktopPage {
  const contents = sum(claim.inventory);
  const ale = sum(claim.expenses);
  return {
    url: `${PORTAL}/claims/${claim.fnol?.claimNumber ?? "new"}/proof-of-loss`,
    site: { ...SITE, name: claim.insurer },
    mode: "claim",
    title: "Sworn statement in proof of loss",
    note: `Claim ${claim.fnol?.claimNumber ?? "—"} · from your Hera inventory`,
    fields: [
      { label: "Date and cause", value: `${shortDate(claim.dateOfLoss)} · ${claim.cause}` },
      { label: "Items claimed", value: String(claim.inventory.length) },
      { label: "Contents (replacement cost)", value: money(contents) },
      { label: "Additional living expenses", value: money(ale) },
      { label: "Deductible", value: money(claim.deductible) },
      { label: "Total claimed", value: money(contents + ale) },
    ],
    result: { label: "Ready to sign", value: money(contents + ale) },
  };
}

function ClaimConfirm({ part, ctx, claim }: { part: ToolPart; ctx: RenderContext; claim: Claim }) {
  const input = (part.input ?? {}) as { action?: "submit_fnol" | "submit_proof_of_loss"; summary?: string };
  const answered = done(part);
  const decision = answered ? (part.output as { approved?: boolean })?.approved === true : undefined;
  const [shown, setShown] = useState(answered);
  const pol = input.action === "submit_proof_of_loss";
  const total = sum(claim.inventory) + sum(claim.expenses);
  const decide = (approved: boolean) => ctx.answer("confirm_claim_action", part.toolCallId, { approved, action: input.action });

  return (
    <div className="space-y-3">
      {decision === undefined && (
        <AgentDesktop
          pages={[pol ? polPage(claim) : fnolPage(claim, ctx.profile)]}
          instant={answered}
          pauseLabel="Waiting for your approval"
          onDone={() => setShown(true)}
        />
      )}
      {(shown || answered) &&
        (pol ? (
          <ConfirmCard
            title={`Submit sworn proof of loss — ${money(total)}?`}
            detail="Review your belongings, receipts and expenses before approving this statement."
            rows={[
              ["Claim", claim.fnol?.claimNumber ?? "—"],
              ["Items", `${claim.inventory.length} · ${money(sum(claim.inventory))}`],
              ["Living expenses", money(sum(claim.expenses))],
            ]}
            approveLabel="I confirm — submit"
            approvedLabel="Proof of loss approved"
            decision={decision}
            disabled={ctx.busy || !inventoryReview(claim).ready}
            onDecide={decide}
          />
        ) : (
          <ConfirmCard
            title={`Submit the initial report to ${claim.insurer}?`}
            detail={input.summary ?? "Hera filled the claim report from your policy and household details."}
            rows={[
              ["Policy", claim.policyNumber ?? "—"],
              ["Date of loss", shortDate(claim.dateOfLoss)],
              ["Cause", claim.cause],
            ]}
            approveLabel="Submit report"
            approvedLabel="Claim report approved"
            decision={decision}
            disabled={ctx.busy}
            onDecide={decide}
          />
        ))}
    </div>
  );
}

function Submitted({ title, rows, next }: { title: string; rows: [string, string][]; next: ReactNode }) {
  return (
    <div className={CARD} style={fadeUp}>
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle icon={ICONS.check} tone="green" title={title} sub="Your approved claim details are saved in your Hera file." />
        </div>
      </div>
      <dl className="mx-4 mt-3 divide-y divide-line rounded-[8px] bg-inset shadow-hairline">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[12.5px]">
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-medium tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t border-line bg-inset px-4 py-3 text-[12.5px] leading-snug text-ink-2">{next}</div>
    </div>
  );
}

/* ─────────── inventory ─────────── */

/* ─────────── living expenses ─────────── */

function ExpensesCard({ claim, ctx }: { claim: Claim; ctx: RenderContext }) {
  const [kind, setKind] = useState<Expense["kind"]>("hotel");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const used = sum(claim.expenses);
  return (
    <div className={CARD} style={fadeUp}>
      <div className="px-4 pt-4">
        <CardTitle icon={ICONS.home} title="Any extra costs while you’re away?" sub="Add hotel stays, extra meal costs or laundry. If you don’t have any, continue to your claim review." />
        <div className="mt-3.5">
          <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
            <span className="tabular-nums text-ink">
              <span className="font-medium">{money(used)}</span>
              <span className="text-ink-3">{claim.aleLimit ? ` of ${money(claim.aleLimit)} policy limit` : " · policy limit not found"}</span>
            </span>
            {claim.aleLimit && <span className="tabular-nums text-ink-3">{money(Math.max(0, claim.aleLimit - used))} left</span>}
          </div>
          <Meter value={used} max={claim.aleLimit} />
        </div>
      </div>
      {claim.expenses.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {claim.expenses.map((e) => (
            <li key={e.id} className="group flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
              <span className="min-w-0 truncate text-ink">
                {e.label} <span className="text-ink-3">· {shortDate(e.date)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium tabular-nums text-ink">{money(e.amount)}</span>
                <button type="button" aria-label="Remove" onClick={() => void claimOp({ op: "remove_expense", id: e.id })} className="text-ink-3 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100">
                  <Glyph d={ICONS.x} size={12} stroke={2.4} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex flex-wrap gap-2 border-t border-line bg-inset px-4 py-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = Number(amount.replace(/[$,]/g, ""));
          if (!(n > 0) || !Number.isFinite(n)) { setError("Enter a valid amount."); return; }
          setSaving(true); setError("");
          try {
            const saved = await claimOp({ op: "add_expense", kind, amount: n });
            if (saved) setAmount("");
            else setError("Couldn't save that expense. Please try again.");
          } catch { setError("Couldn't save that expense. Please try again."); }
          finally { setSaving(false); }
        }}
      >
        <div className="flex shrink-0 gap-1 rounded-full bg-field p-0.5 shadow-hairline">
          {(["hotel", "meals", "other"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-2.5 py-1 text-[12px] capitalize ${kind === k ? "bg-surface text-ink shadow-btn" : "text-ink-3"}`}>
              {k}
            </button>
          ))}
        </div>
        <input className={`${inputCls} min-w-24 flex-1 tabular-nums`} inputMode="decimal" placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        <Button size="sm" variant="secondary" type="submit" disabled={saving || !!claim.proofOfLoss || !amount.trim()} className="h-8 shrink-0">
          Log
        </Button>
      </form>
      {error && <p role="alert" className="px-4 py-2 text-[12px] text-orange">{error}</p>}
      {!claim.proofOfLoss && <div className="border-t border-line px-4 py-4">
        <Button variant="accent" disabled={saving || ctx.busy || !inventoryReview(claim).ready || !!amount.trim()} onClick={() => ctx.sendText("I have finished reviewing my belongings and extra living expenses. Prepare my claim for final review and approval.")}>{claim.expenses.length ? "Review my claim" : "No extra costs — review my claim"} →</Button>
        <p className="mt-2 text-[11.5px] text-ink-3">{amount.trim() ? "Log the expense above or clear the amount before continuing." : "Next: review the total, supporting evidence and policy details."}</p>
      </div>}
    </div>
  );
}

/* ─────────── honesty check ─────────── */

function HonestyCard({ claim }: { claim: Claim }) {
  const count = (e: Evidence) => claim.inventory.filter((i) => i.evidence === e).length;
  const contents = sum(claim.inventory);
  const ale = sum(claim.expenses);
  const memory = count("memory");
  const rows: [string, string | null][] = [
    ["Items confirmed", `${inventoryReview(claim).confirmed} of ${claim.inventory.length}`],
    ["With an ownership photo", String(claim.inventory.filter((item) => !!item.photoId).length)],
    ["With a receipt", String(claim.inventory.filter((item) => !!item.receipt).length)],
    ["From memory", String(memory)],
    ...(count("sample") ? ([["Example items to replace", String(count("sample"))]] as [string, string][]) : []),
    ["Contents", money(contents)],
    ["Living expenses", money(ale)],
  ];
  return (
    <div className={CARD} style={fadeUp}>
      <div className="px-4 pt-4">
        <CardTitle
          icon={ICONS.shield}
          tone="accent"
          title="Review your claim"
          sub="Hera has organized your belongings, evidence and expenses. Check the details before approving your proof of loss."
        />
      </div>
      <div className="mx-4 mt-3 rounded-[8px] bg-inset px-3 py-2.5 shadow-hairline">
        <Rows rows={rows} />
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-line bg-inset px-4 py-3 text-[12.5px]">
        <span className="text-ink-3">Total claimed · before {money(claim.deductible)} deductible</span>
        <span className="font-semibold tabular-nums text-ink">{money(contents + ale)}</span>
      </div>
    </div>
  );
}

/* ─────────── renderer ─────────── */

const OWNED = new Set([
  "tool-start_claim",
  "tool-confirm_claim_action",
  "tool-submit_first_notice",
  "tool-build_inventory",
  "tool-log_expense",
  "tool-prepare_proof_of_loss",
  "tool-submit_proof_of_loss",
]);

const LOADING: Record<string, string> = {
  "tool-start_claim": "Opening your claim",
  "tool-submit_first_notice": "Submitting your claim report",
  "tool-build_inventory": "Opening your inventory",
  "tool-log_expense": "Updating living expenses",
  "tool-prepare_proof_of_loss": "Checking your claim",
  "tool-submit_proof_of_loss": "Submitting proof of loss",
};

export const renderClaim: FeatureRenderer = (part, key, ctx) => {
  if (!OWNED.has(part.type)) return undefined;
  if (part.state === "input-streaming") return null;
  if (part.state === "output-error") return <AgentStep key={key} icon={ICONS.alert} tone="warn" label="That step didn't go through — try asking again." />;
  const out = part.output;
  if (hasError(out)) return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={out.error} />;

  const claim = claimOf(ctx.profile);
  if (part.type === "tool-confirm_claim_action") {
    if (!claim) return <AgentStep key={key} icon={ICONS.folder} label="Getting the form ready" running />;
    return <ClaimConfirm key={key} part={part} ctx={ctx} claim={claim} />;
  }
  if (!done(part) || !claim) return <AgentStep key={key} icon={ICONS.folder} label={LOADING[part.type]} running />;

  switch (part.type) {
    case "tool-start_claim":
      return <ClaimTracker key={key} claim={claim} />;
    case "tool-submit_first_notice": {
      const o = out as { claimNumber: string };
      return (
        <Submitted
          key={key}
          title={`Claim report recorded · ${claim.insurer}`}
          rows={[
            ["Claim number", o.claimNumber],
            ["Date of loss", shortDate(claim.dateOfLoss)],
            ["Cause", claim.cause],
          ]}
          next="Next: choose photos from your camera roll. Hera will identify belongings and estimate their replacement costs. You review what was lost or damaged."
        />
      );
    }
    case "tool-build_inventory":
      return <InventoryCard key={key} claim={claim} photos={photosOf(ctx.profile)} profile={ctx.profile} ctx={ctx} />;
    case "tool-log_expense":
      return <ExpensesCard key={key} claim={claim} ctx={ctx} />;
    case "tool-prepare_proof_of_loss":
      return <HonestyCard key={key} claim={claim} />;
    case "tool-submit_proof_of_loss": {
      const o = out as { confirmation: string; amount: number; claimNumber: string | null };
      return (
        <Submitted
          key={key}
          title="Proof of loss submitted"
          rows={[
            ["Claim number", o.claimNumber ?? "—"],
            ["Confirmation", o.confirmation],
            ["Amount claimed", money(o.amount)],
            ["Deductible", money(claim.deductible)],
          ]}
          next="Your claim package is ready for the adjuster: the belongings you confirmed, photo references, receipt details and extra living expenses. Coverage and the settlement amount are subject to review."
        />
      );
    }
  }
  return null;
};

/* ─────────── pane ─────────── */

export const ClaimPane: FeaturePane = ({ profile }) => {
  const claim = claimOf(profile);
  if (!claim) return null;
  const status = claim.proofOfLoss ? "Proof of loss filed" : claim.fnol ? "Reported · building inventory" : "Opened · not reported yet";
  const next = claim.proofOfLoss ? null : claim.deadlines.filter((d) => d.due && d.due > claim.dateOfLoss).sort((a, b) => a.due!.localeCompare(b.due!))[0];
  const contents = sum(claim.inventory);
  const ale = sum(claim.expenses);
  return (
    <Block title="Your claim" icon={ICONS.wave}>
      <Rows
        rows={[
          ["Claim number", claim.fnol?.claimNumber ?? null],
          ["Status", status],
          ["Next deadline", next ? `${next.name} · ${shortDate(next.due)}` : null],
          ["Inventory", claim.inventory.length ? `${money(contents)}${claim.contentsLimit ? ` of ${money(claim.contentsLimit)}` : ""}` : null],
          ["Living expenses", ale ? `${money(ale)}${claim.aleLimit ? ` of ${money(claim.aleLimit)}` : ""}` : null],
        ]}
      />
    </Block>
  );
};
