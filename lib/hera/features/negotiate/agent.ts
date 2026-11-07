import { generateText, Output, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { getFeatureData, setFeatureData } from "../../feature-store";
import { heraFallbackModel, heraModel } from "../../model";
import { getProfile } from "../../profile";
import { seenTool, type FeatureModule } from "../types";
import { buildCase, fmt, simulateReply, type NegotiateStatus, type NegotiationEmail, type RateCase } from "./case";

/* negotiate feature — server side. Owned by the negotiate feature; edit freely. */

const pct = ([a, b]: [number, number]) => `${Math.round(a * 100)}–${Math.round(b * 100)}%`;

/** What the model sees from the case: the facts, without the chart data. */
function caseForModel(c: RateCase) {
  return {
    premium: c.premium,
    renewal: c.renewal,
    discountsOnFile: c.discountsOnFile,
    missingDiscounts: c.missing.map((m) => `${m.name}${m.question ? " (ask)" : ""}: ${m.why}; typical ${pct(m.pct)}`),
    competingOffer:
      c.competing.kind === "quote"
        ? `${c.competing.insurer} quoted ${fmt(c.competing.annualPremium)}/yr`
        : `none on file (typical market range ${fmt(c.competing.low)}–${fmt(c.competing.high)}, an estimate)`,
    target: c.target,
    estimatedSaving: c.saving,
  };
}

function templateEmail(c: RateCase, name: string, to: string): NegotiationEmail {
  const asks = c.missing.filter((m) => !m.question);
  const lines = [
    `Hello,`,
    ``,
    `I'm writing about my home policy${c.policyNumber ? ` ${c.policyNumber}` : ""}, which renews on ${c.renewal ?? "its upcoming renewal date"}. My current premium is ${fmt(c.premium)} a year, and I'd like to review it before renewal.`,
    ``,
    ...(asks.length ? [`Based on my file, I believe I qualify for discounts that aren't currently applied:`, ...asks.map((m) => `- ${m.name} (${m.why.toLowerCase()})`), ``] : []),
    ...(c.competing.kind === "quote" ? [`I've also received a quote from ${c.competing.insurer} for ${fmt(c.competing.annualPremium)} a year for comparable coverage.`, ``] : []),
    `I'd prefer to stay with ${c.insurer}. Could you apply these discounts${c.competing.kind === "quote" ? " or match that rate" : ""}, bringing my premium closer to ${fmt(c.target)}?`,
    ``,
    `Thank you,`,
    name,
  ];
  return { to, subject: `Renewal review for policy ${c.policyNumber ?? ""}`.trim(), body: lines.join("\n"), source: "template" };
}

async function writeEmail(c: RateCase, name: string, to: string): Promise<NegotiationEmail> {
  const facts = JSON.stringify({
    policyholder: name,
    insurer: c.insurer,
    policyNumber: c.policyNumber,
    renewalDate: c.renewal,
    currentPremium: fmt(c.premium),
    deductible: c.deductible,
    discountsAlreadyApplied: c.discountsOnFile,
    protections: c.protections,
    claimsFree5Years: c.claimsFreeYears === 5,
    discountsToRequest: c.missing.filter((m) => !m.question).map((m) => ({ name: m.name, reason: m.why })),
    askAbout: c.missing.filter((m) => m.question).map((m) => m.name),
    competingQuote: c.competing.kind === "quote" ? { insurer: c.competing.insurer, annualPremium: fmt(c.competing.annualPremium) } : null,
    targetPremium: fmt(c.target),
  });
  const attempt = async (model: LanguageModel, timeout: number) => {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: z.object({ subject: z.string(), body: z.string() }) }),
      instructions:
        "You write a short, polite, specific email from a homeowner to their insurer or broker asking for a lower renewal premium. " +
        "Use only the facts given — never invent numbers, names or quotes. Cite the renewal date, current premium, claims-free history and protections, " +
        "ask for each listed discount by name, mention the competing quote only if one is given (and ask them to match it), and say they'd prefer to stay. " +
        "Plain text, 120–180 words, no placeholders like [Name]. Sign with the policyholder's name.",
      prompt: `Facts:\n${facts}`,
      timeout,
      maxRetries: 0,
    });
    return output;
  };
  try {
    const out = await attempt(heraModel(), 30_000).catch(() => attempt(heraFallbackModel(), 30_000));
    if (!out.body?.trim()) throw new Error("empty draft");
    return { to, subject: out.subject.trim(), body: out.body.trim(), source: "model" };
  } catch (e) {
    console.warn("[hera] negotiation email falling back to template:", e instanceof Error ? e.message : e);
    return templateEmail(c, name, to);
  }
}

export const negotiate: FeatureModule = {
  id: "negotiate",
  tools: {
    review_rate: tool({
      description:
        "Review the user's current rate: premium, renewal, discounts already applied vs. ones their file says they qualify for, premium history and any competing quote. Builds and saves the case for a lower rate; the UI shows Hera checking the insurer portal and a case card.",
      inputSchema: z.object({}),
      execute: async () => {
        const profile = getProfile();
        const policy = profile.policy;
        if (!policy || policy.annualPremium == null) return { error: "No premium on file — I need the policy's annual premium to build the case." };
        const c = buildCase({
          insurer: policy.insurer,
          policyNumber: policy.policyNumber,
          periodStart: policy.periodStart,
          periodEnd: policy.periodEnd,
          premium: policy.annualPremium,
          deductible: policy.deductible,
          discounts: policy.discounts ?? [],
          coversFlood: policy.coverages.some((cv) => /flood|overland/i.test(`${cv.key} ${cv.name}`) && cv.status !== "not_covered"),
          property: profile.property,
          claimsLast5Years: profile.person.claimsLast5Years,
          premiumHistory: profile.premiumHistory,
          shop: getFeatureData("shop", "quotes"),
        });
        setFeatureData("negotiate", "case", c);
        setFeatureData<NegotiateStatus>("negotiate", "status", "draft");
        return { case: c };
      },
      toModelOutput: ({ output }) => ({ type: "json", value: output.case ? caseForModel(output.case) : output }),
    }),

    draft_negotiation_email: tool({
      description: "Draft the email asking the insurer/broker for the missing discounts or a matched rate, from the saved case. The UI types it into a compose window.",
      inputSchema: z.object({}),
      execute: async () => {
        const c = getFeatureData<RateCase>("negotiate", "case");
        if (!c) return { error: "Review the rate first (review_rate)." };
        const profile = getProfile();
        const to = profile.policy?.brokerEmail || `service@${c.insurer.toLowerCase().replace(/[^a-z]+/g, "")}.example`;
        const email = await writeEmail(c, profile.person.fullName ?? "Policyholder", to);
        setFeatureData("negotiate", "email", email);
        setFeatureData<NegotiateStatus>("negotiate", "status", "draft");
        return email;
      },
    }),

    // No execute: the UI shows a ConfirmCard with the draft and answers { approved }.
    confirm_send_email: tool({
      description: "Ask the user to approve sending the drafted negotiation email. Call after draft_negotiation_email. Never send without this.",
      inputSchema: z.object({ note: z.string().describe("One short line on what sending does") }),
    }),

    send_negotiation_email: tool({
      description: "Send the approved negotiation email (simulated in this demo — nothing is really sent). Only after confirm_send_email came back approved: true.",
      inputSchema: z.object({}),
      execute: async () => {
        const c = getFeatureData<RateCase>("negotiate", "case");
        const email = getFeatureData<NegotiationEmail>("negotiate", "email");
        if (!c || !email) return { error: "There's no drafted email to send." };
        const sentAt = new Date().toISOString();
        setFeatureData("negotiate", "sent", { to: email.to, sentAt, simulated: true });
        const reply = setFeatureData("negotiate", "reply", simulateReply(c));
        setFeatureData<NegotiateStatus>("negotiate", "status", "reply");
        return { sent: true, simulated: true, to: email.to, reply };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: output.reply ? { sent: true, simulated: true, to: output.to, simulatedReply: { newPremium: output.reply.newPremium, saving: output.reply.saving } } : output,
      }),
    }),
  },
  clientTools: ["confirm_send_email"],
  instructions: `NEGOTIATE (goal: lower the current rate) — once the file is ready the steps run in order:
1. review_rate builds the case; the UI shows you checking the Birchwood Mutual portal and a case card. In 1–2 sentences name the target premium and the biggest missing discounts. Call savings "estimated"; never present sample history as real.
2. draft_negotiation_email drafts the email; the UI types it out. Say one line, then call confirm_send_email.
3. Only if confirm_send_email returns approved: true, send_negotiation_email runs (simulated). Then summarise the simulated reply in one line and say it's a demo reply. If declined, say the draft is saved.
Keep every message to 1–2 short sentences; the cards carry the numbers.`,
  nextStep: ({ history, calledThisTurn }) => {
    const seen = (name: string) => seenTool(history, name) || calledThisTurn.includes(name);
    if (!seen("review_rate")) return "review_rate";
    if (!seen("draft_negotiation_email")) return "draft_negotiation_email";
    if (!seen("confirm_send_email")) return "confirm_send_email";
    const approved = history.some((m) =>
      m.parts.some((p) => p.type === "tool-confirm_send_email" && "output" in p && (p.output as { approved?: boolean } | undefined)?.approved === true),
    );
    if (approved && !seen("send_negotiation_email")) return "send_negotiation_email";
    return null;
  },
};
