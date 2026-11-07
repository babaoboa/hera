"use client";

import { useEffect, useState, type ReactNode } from "react";
import AgentDesktop, { type DesktopPage } from "@/components/hera/AgentDesktop";
import ConfirmCard from "@/components/hera/ConfirmCard";
import { Block, Rows } from "@/components/hera/FileBlocks";
import { AgentStep, CardTitle, Chip, Glyph, ICONS, fadeUp, money, shortDate } from "@/components/hera/ui";
import LoadingState from "@/components/primitives/LoadingState";
import type { Profile } from "@/lib/hera/profile";
import type { NegotiateStatus, NegotiationEmail, RateCase, SimulatedReply } from "@/lib/hera/features/negotiate/case";
import type { FeaturePane, FeatureRenderer, ToolPart } from "../types";

/* negotiate feature — UI. Owned by the negotiate feature; edit freely. */

const site = (page: string) => ({ name: `Birchwood Mutual · ${page}`, color: "#2f5d50" });
const PORTAL = "portal.birchwoodmutual.example";
const done = (p: ToolPart) => p.state === "output-available";
const hasError = (o: unknown): o is { error: string } => typeof o === "object" && o !== null && "error" in o;
const yesNo = (v: boolean | undefined) => (v == null ? "Not on file" : v ? "Yes" : "No");

/* ── computer use: a scripted visit to the insurer portal, with the user's real data ── */

function portalPages(profile: Profile | null, c: RateCase | null): DesktopPage[] {
  const policy = profile?.policy;
  const p = profile?.property ?? {};
  const num = policy?.policyNumber ?? c?.policyNumber ?? "—";
  const premium = c?.premium ?? policy?.annualPremium ?? null;
  const discounts = c?.discountsOnFile ?? (policy?.discounts ?? []).filter((d) => /[a-z]{3}/i.test(d));
  const history = profile?.premiumHistory ?? [];
  return [
    {
      url: `${PORTAL}/policies/${encodeURIComponent(num)}`,
      mode: "portal",
      site: site("Policy"),
      title: "Policy summary",
      note: `Signed in as ${profile?.person.fullName ?? "policyholder"}`,
      fields: [
        { label: "Policy number", value: num },
        { label: "Renewal date", value: shortDate(c?.renewal ?? policy?.periodEnd) },
        { label: "Deductible", value: money(c?.deductible ?? policy?.deductible) },
        { label: "Claims in last 5 years", value: profile?.person.claimsLast5Years == null ? "Not on file" : String(profile.person.claimsLast5Years) },
      ],
      result: { label: "Annual premium", value: money(premium) },
    },
    {
      url: `${PORTAL}/billing`,
      mode: "portal",
      site: site("Billing"),
      title: "Billing & renewal",
      fields: [
        { label: "Current term", value: `${shortDate(policy?.periodStart)} – ${shortDate(policy?.periodEnd)}` },
        { label: "Annual premium", value: money(premium) },
        { label: "Terms on file", value: String(Math.max(1, history.length)) },
        { label: "Payment plan", value: "Annual" },
      ],
      result: { label: "Renews", value: shortDate(c?.renewal ?? policy?.periodEnd) },
    },
    {
      url: `${PORTAL}/policies/${encodeURIComponent(num)}/discounts`,
      mode: "portal",
      site: site("Discounts"),
      title: "Discounts on file",
      fields: [
        { label: "Discounts applied", value: discounts.length ? discounts.join(", ") : "None" },
        { label: "Monitored alarm", value: yesNo(p.monitoredAlarm) },
        { label: "Water leak sensors", value: yesNo(p.waterLeakSensors) },
        { label: "Sump pump / backwater valve", value: p.sumpPump == null && p.backwaterValve == null ? "Not on file" : yesNo(p.sumpPump || p.backwaterValve) },
      ],
      result: { label: "Discounts applied", value: String(discounts.length) },
    },
  ];
}

/* ── the case card ── */

function HistoryChart({ history }: { history: RateCase["history"] }) {
  const max = Math.max(...history.map((h) => h.amount), 1);
  return (
    <div>
      <div className="flex h-[92px] items-end gap-2">
        {history.map((h, i) => {
          const last = i === history.length - 1;
          return (
            <div key={h.year} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[11px] tabular-nums ${h.sample ? "text-ink-3" : "text-ink-2"}`}>{money(h.amount)}</span>
              <div
                className={`w-full max-w-[56px] rounded-t-[5px] ${h.sample ? "shadow-hairline" : last ? "bg-accent" : "bg-accent-tint"}`}
                style={{
                  height: `${Math.max(8, (h.amount / max) * 60)}px`,
                  ...(h.sample ? { background: "repeating-linear-gradient(135deg, var(--field) 0 4px, var(--line-strong) 4px 5px)" } : {}),
                }}
                title={h.sample ? "Estimated value" : "From your policy"}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2 border-t border-line pt-1">
        {history.map((h) => (
          <span key={h.year} className="flex-1 text-center text-[11px] tabular-nums text-ink-3">
            {h.year}
          </span>
        ))}
      </div>
    </div>
  );
}

function CaseCard({ c }: { c: RateCase }) {
  const counted = c.missing.filter((m) => !m.question);
  const asks = c.missing.filter((m) => m.question);
  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="px-4 pt-4">
        <CardTitle icon={ICONS.tag} title="Your case for a lower rate" sub={`${c.insurer}${c.renewal ? ` · renews ${shortDate(c.renewal)}` : ""}`} tone="green" />
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="rounded-[8px] bg-inset px-3 py-2 shadow-hairline">
            <div className="text-[11.5px] text-ink-3">Premium now</div>
            <div className="text-[17px] font-medium tabular-nums text-ink">{money(c.premium)}<span className="text-[12px] text-ink-3">/yr</span></div>
          </div>
          <div className="rounded-[8px] bg-green-tint px-3 py-2">
            <div className="text-[11.5px] text-green">Target</div>
            <div className="text-[17px] font-medium tabular-nums text-green">{money(c.target)}<span className="text-[12px] opacity-75">/yr</span></div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="mb-2 text-[12px] font-medium text-ink-2">Premium history</div>
        <HistoryChart history={c.history} />
      </div>

      <div className="mt-4 border-t border-line">
        <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-ink-2">Discounts you&apos;re likely missing</div>
        {c.missing.length === 0 ? (
          <div className="px-4 pb-3 text-[12.5px] text-ink-3">Your file doesn&apos;t show any obvious missing discounts.</div>
        ) : (
          <ul className="divide-y divide-line">
            {[...counted, ...asks].map((m) => (
              <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">
                    {m.name} {m.question && <Chip>Ask</Chip>}
                  </div>
                  <div className="truncate text-[12px] text-ink-3">{m.why}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-[12.5px] tabular-nums ${m.question ? "text-ink-3" : "text-green"}`}>
                    {money(m.saving[0])}–{money(m.saving[1])}
                  </div>
                  <div className="text-[11px] text-ink-3">typical, per yr</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <div className="min-w-0">
          <div className="text-[13px] text-ink">Competing offer</div>
          <div className="text-[12px] text-ink-3">
            {c.competing.kind === "quote"
              ? `${c.competing.insurer}${c.competing.comparable ? " · comparable coverage" : ""}`
              : "No quotes yet · typical market range (estimate)"}
          </div>
        </div>
        <div className="shrink-0 text-[12.5px] tabular-nums text-ink">
          {c.competing.kind === "quote" ? `${money(c.competing.annualPremium)}/yr` : `${money(c.competing.low)}–${money(c.competing.high)}`}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-inset px-4 py-3">
        <span className="text-[12.5px] text-ink-2">Estimated saving</span>
        <span className="text-[14px] font-medium tabular-nums text-green">{money(c.saving)}/yr</span>
      </div>
    </div>
  );
}

function RateReview({ part, profile, live }: { part: ToolPart; profile: Profile | null; live: boolean }) {
  const [instant] = useState(!live);
  const [browsed, setBrowsed] = useState(instant);
  const out = done(part) ? (part.output as { case?: RateCase; error?: string }) : null;
  // fixed once, so re-renders while the reply streams don't restart the animation
  const [pages] = useState(() => portalPages(profile, out?.case ?? null));
  if (part.state === "output-error") return <AgentStep icon={ICONS.alert} tone="warn" label={`Couldn't review your rate — ${part.errorText}`} />;
  if (out?.error) return <AgentStep icon={ICONS.alert} tone="warn" label={out.error} />;
  return (
    <div className="space-y-3">
      <AgentDesktop pages={pages} instant={instant} onDone={() => setBrowsed(true)} />
      {browsed && out?.case ? (
        <CaseCard c={out.case} />
      ) : (
        <div className="flex min-h-6 items-center" style={fadeUp}>
          <LoadingState label="Building your case" variant="Dots" />
        </div>
      )}
    </div>
  );
}

/* ── the email ── */

function ComposeCard({ email, live, sent }: { email: NegotiationEmail; live: boolean; sent?: boolean }) {
  const [chars, setChars] = useState(live ? 0 : email.body.length);
  const typing = chars < email.body.length;
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setChars((c) => Math.min(email.body.length, c + 3)), 32);
    return () => clearTimeout(t);
  }, [chars, typing, email.body.length]);

  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
          <Glyph d={MAIL} size={15} /> {sent ? "Sent email" : "Draft email"}
        </div>
        {typing ? <Chip tone="accent">Hera is writing…</Chip> : sent ? <Chip tone="green">Sent</Chip> : <Chip>Not sent</Chip>}
      </div>
      <dl className="divide-y divide-line text-[12.5px]">
        <div className="flex gap-3 px-4 py-2">
          <dt className="w-14 shrink-0 text-ink-3">To</dt>
          <dd className="min-w-0 truncate text-ink">{email.to}</dd>
        </div>
        <div className="flex gap-3 px-4 py-2">
          <dt className="w-14 shrink-0 text-ink-3">Subject</dt>
          <dd className="min-w-0 truncate font-medium text-ink">{email.subject}</dd>
        </div>
      </dl>
      <div className="min-h-[120px] whitespace-pre-wrap border-t border-line bg-inset px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        {email.body.slice(0, chars)}
        {typing && <span className="stream-caret is-streaming" />}
      </div>
    </div>
  );
}

const MAIL = (
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </>
);

function ReplyCard({ reply, premium }: { reply: SimulatedReply; premium?: number }) {
  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="px-4 pt-4">
        <div className="mb-2">
          <Chip tone="orange">Reply received</Chip>
        </div>
        <CardTitle icon={MAIL} title={reply.subject} sub={`From ${reply.from}`} tone="green" />
      </div>
      <p className="mx-4 mt-3 rounded-[8px] bg-inset px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2 shadow-hairline">{reply.body}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line bg-inset px-4 py-3 text-[12.5px]">
        <span className="text-ink-2">
          New premium {premium != null && <span className="text-ink-3 line-through tabular-nums">{money(premium)}</span>}{" "}
          <span className="font-medium tabular-nums text-ink">{money(reply.newPremium)}/yr</span>
        </span>
        <span className="font-medium tabular-nums text-green">Saves {money(reply.saving)}/yr</span>
      </div>
    </div>
  );
}

function findEmail(ctx: Parameters<FeatureRenderer>[2]): NegotiationEmail | null {
  for (const p of [...ctx.message.parts].reverse()) {
    const t = p as unknown as ToolPart;
    if (t.type === "tool-draft_negotiation_email" && done(t) && !hasError(t.output)) return t.output as NegotiationEmail;
  }
  return (ctx.profile?.features.negotiate?.email as NegotiationEmail | undefined) ?? null;
}

/* Live = the part is still being worked on in this reply; old messages render finished. */
function LiveGate({ busy, children }: { busy: boolean; children: (live: boolean) => ReactNode }) {
  const [live] = useState(busy);
  return <>{children(live)}</>;
}

export const renderNegotiate: FeatureRenderer = (part, key, ctx) => {
  switch (part.type) {
    case "tool-review_rate":
      if (part.state === "input-streaming") return null;
      return <LiveGate key={key} busy={ctx.busy}>{(live) => <RateReview part={part} profile={ctx.profile} live={live} />}</LiveGate>;

    case "tool-draft_negotiation_email": {
      if (part.state === "output-error") return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={`Couldn't draft the email — ${part.errorText}`} />;
      if (!done(part)) {
        return (
          <div key={key} className="flex min-h-6 items-center" style={fadeUp}>
            <LoadingState label="Drafting your email" variant="Dots" />
          </div>
        );
      }
      if (hasError(part.output)) return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={part.output.error} />;
      const email = part.output as NegotiationEmail;
      return <LiveGate key={key} busy={ctx.busy}>{(live) => <ComposeCard email={email} live={live} />}</LiveGate>;
    }

    case "tool-confirm_send_email": {
      if (part.state === "input-streaming") return null;
      const email = findEmail(ctx);
      const decision = done(part) ? Boolean((part.output as { approved?: boolean })?.approved) : undefined;
      return (
        <ConfirmCard
          key={key}
          title="Send this email to Birchwood Mutual?"
          detail={(part.input as { note?: string })?.note ?? "Hera will send it from your file and watch for a reply."}
          rows={email ? [["To", email.to], ["Subject", email.subject]] : []}
          approveLabel="Send email"
          decision={decision}
          approvedLabel={email ? `Approved — sending to ${email.to}` : "Approved"}
          disabled={part.state !== "input-available"}
          onDecide={(approved) => ctx.answer("confirm_send_email", part.toolCallId, { approved })}
        >
          {email && (
            <div className="line-clamp-4 whitespace-pre-wrap rounded-[8px] bg-inset px-3 py-2 text-[12px] leading-relaxed text-ink-2 shadow-hairline">{email.body}</div>
          )}
        </ConfirmCard>
      );
    }

    case "tool-send_negotiation_email": {
      if (part.state === "output-error") return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={`Couldn't send — ${part.errorText}`} />;
      if (!done(part)) return <AgentStep key={key} icon={MAIL} label="Sending your email" running />;
      if (hasError(part.output)) return <AgentStep key={key} icon={ICONS.alert} tone="warn" label={part.output.error} />;
      const out = part.output as { to: string; reply: SimulatedReply };
      const c = ctx.profile?.features.negotiate?.case as RateCase | undefined;
      return (
        <div key={key} className="space-y-3">
          <AgentStep icon={ICONS.check} label={`Email sent to ${out.to}`}>
          </AgentStep>
          <ReplyCard reply={out.reply} premium={c?.premium} />
        </div>
      );
    }
  }
  return undefined;
};

/* ── "Your file" pane ── */

const STATUS_LABEL: Record<NegotiateStatus, string> = { draft: "Draft", sent: "Sent", reply: "Reply received" };

export const NegotiatePane: FeaturePane = ({ profile }) => {
  const data = profile.features.negotiate;
  const c = data?.case as RateCase | undefined;
  if (!c) return null;
  const status = (data?.status as NegotiateStatus | undefined) ?? "draft";
  const reply = data?.reply as SimulatedReply | undefined;
  const hasEmail = Boolean(data?.email);
  return (
    <Block title="Rate negotiation" icon={ICONS.tag}>
      <Rows
        rows={[
          ["Premium now", money(c.premium)],
          ["Target", money(c.target)],
          ["Estimated saving", `${money(c.saving)}/yr`],
          ...(reply ? ([["Offered", `${money(reply.newPremium)}/yr`]] as [string, string][]) : []),
          ["Status", hasEmail || status !== "draft" ? STATUS_LABEL[status] : "Case built"],
        ]}
      />
    </Block>
  );
};
