"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AgentDesktop, { type DesktopPage } from "@/components/hera/AgentDesktop";
import ConfirmCard from "@/components/hera/ConfirmCard";
import { Block, Rows } from "@/components/hera/FileBlocks";
import { AgentStep, Chip, Glyph, ICONS, fadeUp, money } from "@/components/hera/ui";
import LoadingState from "@/components/primitives/LoadingState";
import type { ReactNode } from "react";
import type { StoredPolicy } from "@/lib/hera/profile";
import type { FeaturePane, FeatureRenderer, ToolPart } from "../types";
import QuoteTable from "./QuoteTable";
import RiskCard from "./RiskCard";
import type { CompareResult, QuoteDraft, QuotesData, ScanResult } from "./types";

/* shop feature — UI. Owned by the shop feature. */

const done = (p: ToolPart) => p.state === "output-available";
const errored = (p: ToolPart) => p.state === "output-error";
const fmt = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

const SITES: Record<string, { color: string; host: string; style: "bank" | "direct" | "classic" | "explorer" }> = {
  northline: { style: "explorer", color: "#285887", host: "northline-mutual.example" },
  cedarcrest: { style: "bank", color: "#367435", host: "cedarcrest-home.example" },
  tamarack: { style: "classic", color: "#c73727", host: "tamarack-general.example" },
  fernwood: { style: "direct", color: "#ed3184", host: "fernwood-direct.example" },
};

/* Desktops that already started in this tab render finished on remount, so a re-render
 * never replays the browsing. While one is still playing, the approval card waits. */
const started = new Set<string>();
const playing = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const useDesktopIdle = () =>
  useSyncExternalStore(
    subscribe,
    () => playing.size === 0,
    () => true,
  );

function QuoteFlow({ id, data, policy }: { id: string; data: CompareResult; policy: StoredPolicy | null }) {
  const [finished, setFinished] = useState(() => started.has(id));
  useEffect(() => {
    if (finished) {
      if (playing.delete(id)) emit();
      return;
    }
    started.add(id);
    playing.add(id);
    emit();
    return () => { playing.delete(id); emit(); };
  }, [id, finished]);
  const short = new Set(["Address", "Year built", "Claims (5 yrs)", "Protections"]);
  const pages: DesktopPage[] = data.quotes.map((q, i) => ({
    url: `${SITES[q.id]?.host ?? `${q.id}.example`}/home-quote`,
    mode: "quote",
    site: { style: SITES[q.id]?.style, name: q.insurer, color: SITES[q.id]?.color ?? "#4a4a4a" },
    title: i === 3 ? "Let’s make home feel covered." : "Tell us about your home",
    note: i === 0 ? "Filled in from your Hera file" : "Same details from your Hera file",
    fields: i === 0 ? data.formFields : data.formFields.filter((f) => short.has(f.label)),
    result: { label: "Your quote", value: `${money(q.annualPremium)}/yr` },
  }));
  return (
    <div className="space-y-4">
      <AgentDesktop
        pages={pages}
        instant={finished}
        onDone={() => {
          playing.delete(id);
          emit();
          setFinished(true);
        }}
      />
      {finished && <QuoteTable data={data} policy={policy} />}
    </div>
  );
}

/** Holds the approval card back until Hera has finished "browsing". */
function AfterDesktop({ children }: { children: ReactNode }) {
  return useDesktopIdle() ? <>{children}</> : null;
}

function DraftCard({ draft }: { draft: QuoteDraft }) {
  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-ink">Quote request to {draft.insurer}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{draft.subject}</div>
        </div>
        <span className="shrink-0 whitespace-nowrap">
          <Chip tone="orange">Draft ready — not sent</Chip>
        </span>
      </div>
      <dl className="mx-4 mt-3 divide-y divide-line rounded-[8px] bg-inset text-[12.5px] shadow-hairline">
        <div className="flex gap-3 px-3 py-2">
          <dt className="w-12 shrink-0 text-ink-3">To</dt>
          <dd className="min-w-0 truncate text-ink">{draft.to}</dd>
        </div>
        <div className="px-3 py-2.5">
          <dd className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">{draft.body}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-line bg-inset px-4 py-2.5 text-[11.5px] text-ink-3">
        {draft.draftedBy === "template" ? "Drafted from Hera's template." : "Drafted by Hera from your file."}
      </div>
    </div>
  );
}

export const renderShop: FeatureRenderer = (part, key, ctx) => {
  switch (part.type) {
    case "tool-scan_neighbourhood": {
      if (errored(part))
        return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={`Couldn't check your neighbourhood — ${part.errorText}`} />;
      if (!done(part)) return <AgentStep key={key} icon={ICONS.search} label="Looking at what's around your home" running />;
      const scan = part.output as ScanResult;
      return (
        <div key={key} className="space-y-3">
          <AgentStep icon={ICONS.search} label="Checked what's around your home">
            {scan.fireStation && <Chip>Fire hall {fmt(scan.fireStation.distanceM)}</Chip>}
            {scan.water && <Chip>Water {fmt(scan.water.distanceM)}</Chip>}
          </AgentStep>
          <AgentStep icon={ICONS.save} label="Saved to your file">
            <Chip>Flood risk</Chip>
            {scan.fireStation && <Chip>Distance to fire hall</Chip>}
            {scan.hydrant && <Chip>Distance to hydrant</Chip>}
          </AgentStep>
          <RiskCard scan={scan} />
        </div>
      );
    }
    case "tool-compare_quotes": {
      if (errored(part)) return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={`Couldn't compare quotes — ${part.errorText}`} />;
      if (!done(part)) return <AgentStep key={key} icon={ICONS.tag} label="Getting quotes from four insurers" running />;
      const data = part.output as CompareResult;
      return (
        <div key={key} className="space-y-3">
          <AgentStep icon={ICONS.tag} label="Filled four quote forms with your file">
          </AgentStep>
          <QuoteFlow id={part.toolCallId} data={data} policy={ctx.profile?.policy ?? null} />
        </div>
      );
    }
    case "tool-confirm_quote_request": {
      if (part.state === "input-streaming") return null;
      const input = (part.input ?? {}) as { quoteId?: string; reason?: string };
      const data = ctx.profile?.features.shop?.quotes as QuotesData | undefined;
      const q = data?.quotes.find((x) => x.id === input.quoteId);
      const output = part.output as { approved?: boolean } | undefined;
      const decision = done(part) ? Boolean(output?.approved) : undefined;
      return (
        <AfterDesktop key={key}>
          <ConfirmCard
            title={`Request a formal quote from ${q?.insurer ?? "this insurer"}?`}
            detail={input.reason ?? "Hera will draft the request email for you to review. Nothing is sent."}
            rows={
              q
                ? [
                    ["Annual price", `${money(q.annualPremium)}/yr`],
                    ["Overland flood", q.flood.included ? money(q.flood.limit) : "Not covered"],
                    ["Sewer backup", money(q.sewerBackupLimit)],
                    ["Deductible", money(q.deductible)],
                  ]
                : []
            }
            approveLabel="Draft the request"
            approvedLabel={`Drafting a quote request to ${q?.insurer ?? "the insurer"}`}
            decision={decision}
            disabled={ctx.busy}
            onDecide={(approved) =>
              ctx.answer("confirm_quote_request", part.toolCallId, {
                approved,
                quoteId: input.quoteId,
              })
            }
          />
        </AfterDesktop>
      );
    }
    case "tool-draft_quote_request": {
      if (errored(part)) return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={`Couldn't draft the email — ${part.errorText}`} />;
      if (!done(part)) {
        return (
          <div key={key} className="flex min-h-6 items-center" style={fadeUp}>
            <LoadingState label="Drafting your quote request" variant="Dots" />
          </div>
        );
      }
      const out = part.output as QuoteDraft | { error: string };
      if ("error" in out) return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={out.error} />;
      return <DraftCard key={key} draft={out} />;
    }
    default:
      return undefined;
  }
};

const FLOOD_LABEL = { low: "Low", moderate: "Moderate", high: "High" } as const;

export const ShopPane: FeaturePane = ({ profile }) => {
  const scan = profile.features.shop?.scan as ScanResult | undefined;
  const quotes = profile.features.shop?.quotes as QuotesData | undefined;
  const pr = profile.property;
  if (!scan && !quotes && !pr.floodRisk) return null;
  const best = quotes?.quotes.find((q) => q.id === quotes.bestValueId);
  return (
    <>
      <Block title={scan?.estimated ? "Neighbourhood · estimated" : "Neighbourhood"} icon={ICONS.home}>
        <Rows
          rows={[
            ["Fire hall", pr.distanceToFireHallKm != null ? `${pr.distanceToFireHallKm} km` : null],
            ["Hydrant", pr.distanceToHydrantM != null ? `${pr.distanceToHydrantM} m` : null],
            [
              "Water",
              scan?.water ? `${fmt(scan.water.distanceM)}${scan.water.name ? ` · ${scan.water.name.replace(/\s*\(estimated\)/, "")}` : ""}` : null,
            ],
            ["Flood risk", pr.floodRisk ? FLOOD_LABEL[pr.floodRisk] : null],
          ]}
        />
      </Block>
      {best && quotes && (
        <Block title="Best quote" icon={ICONS.tag}>
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="flex items-center gap-1.5 text-ink">
              <span className="text-green">
                <Glyph d={ICONS.check} size={12} stroke={2.6} />
              </span>
              {best.insurer}
            </span>
            <span className="tabular-nums font-medium text-ink">{money(best.annualPremium)}/yr</span>
          </div>
          {quotes.current.annualPremium > best.annualPremium && (
            <div className="mt-1 text-right text-[12px] tabular-nums text-green">
              Saves {money(quotes.current.annualPremium - best.annualPremium)} vs {quotes.current.insurer}
            </div>
          )}
        </Block>
      )}
    </>
  );
};
