import { generateText, tool, type LanguageModel, type UIMessage } from "ai";
import { z } from "zod";
import { getFeatureData, setFeatureData } from "../../feature-store";
import { heraFallbackModel, heraModel } from "../../model";
import { applyPatch, getProfile, type Profile } from "../../profile";
import { seenTool, type FeatureModule } from "../types";
import { surroundings, type Surroundings } from "./geo";
import { coverageGaps, floodRiskOf, riskFactors, sampleQuotes, type QuotesData } from "./risk";

/* shop feature — "find me better insurance". Owned by the shop feature. */

const addressOf = (p: Profile) => [p.property.street, p.property.city, p.property.province, p.property.postalCode].filter(Boolean).join(", ");

async function neighbourhood(profile: Profile): Promise<Surroundings> {
  const address = addressOf(profile);
  const cached = getFeatureData<{ address: string; data: Surroundings }>("shop", "neighbourhood");
  if (cached && cached.address === address) return cached.data;
  const data = await surroundings(profile.property);
  // Only cache a live result; an estimate is retried next time (the venue may have internet).
  if (!data.estimated) setFeatureData("shop", "neighbourhood", { address, data });
  return data;
}

/** The household facts Hera "types" into each sample quote page. */
function formFields(p: Profile) {
  const pr = p.property;
  const yes = (b?: boolean) => (b ? "Yes" : "No");
  const label = (s?: string) =>
    s
      ? s
          .replace(/_/g, " ")
          .replace(/^./, (c) => c.toUpperCase())
          .replace("Poly b", "Poly-B")
      : "—";
  return [
    { label: "Address", value: addressOf(p) || "—" },
    { label: "Year built", value: String(pr.yearBuilt ?? "—") },
    {
      label: "Living area",
      value: pr.squareFeet ? `${pr.squareFeet.toLocaleString("en-CA")} sq ft` : "—",
    },
    { label: "Roof replaced", value: String(pr.roofYear ?? "—") },
    { label: "Heating", value: label(pr.heating) },
    {
      label: "Claims (5 yrs)",
      value: String(p.person.claimsLast5Years ?? "—"),
    },
    {
      label: "Protections",
      value:
        [
          pr.monitoredAlarm && "Monitored alarm",
          pr.waterLeakSensors && "Leak sensors",
          pr.sumpPump && "Sump pump",
          pr.backwaterValve && "Backwater valve",
        ]
          .filter(Boolean)
          .join(", ") || "None",
    },
    { label: "Finished basement", value: yes(pr.basement === "finished") },
  ];
}

const SETTLEMENT = {
  replacement_cost: "replacement cost",
  guaranteed_replacement_cost: "guaranteed replacement cost",
  actual_cash_value: "actual cash value",
};

function templateEmail(profile: Profile, q: QuotesData["quotes"][number]) {
  const pr = profile.property;
  const name = profile.person.fullName ?? "the homeowner";
  return `Hello ${q.insurer} team,

I'd like to request a formal home insurance quote matching the sample you showed: ${q.flood.included ? `overland flood ($${q.flood.limit?.toLocaleString("en-CA")})` : "no overland flood"}, sewer backup $${q.sewerBackupLimit.toLocaleString("en-CA")}, a $${q.deductible.toLocaleString("en-CA")} deductible and ${SETTLEMENT[q.settlementBasis]} settlement, at about $${q.annualPremium.toLocaleString("en-CA")}/year.

The home is a ${pr.yearBuilt ?? ""} ${pr.propertyType?.replace("_", "-") ?? "house"} at ${addressOf(profile)}, ${pr.squareFeet?.toLocaleString("en-CA") ?? "?"} sq ft, roof replaced ${pr.roofYear ?? "—"}, ${profile.person.claimsLast5Years === 0 ? "claims-free for 5 years" : `${profile.person.claimsLast5Years ?? 0} claims in 5 years`}. My current policy renews ${profile.policy?.periodEnd ?? "soon"}.

Could you confirm the price and any discounts before then?

Thank you,
${name}`;
}

async function draftEmail(profile: Profile, q: QuotesData["quotes"][number]) {
  const facts = {
    homeowner: profile.person.fullName,
    address: addressOf(profile),
    home: { ...profile.property, floodRisk: undefined, distanceToFireHallKm: undefined, distanceToHydrantM: undefined, mortgageLender: undefined },
    claimsLast5Years: profile.person.claimsLast5Years,
    currentPolicy: {
      insurer: profile.policy?.insurer,
      annualPremium: profile.policy?.annualPremium,
      renews: profile.policy?.periodEnd,
    },
    quote: q,
  };
  const prompt = `Write a short, polite email (under 160 words) from the homeowner to ${q.insurer} asking for a formal home insurance quote matching this sample quote.
Mention the coverage they want (flood, sewer backup, deductible, settlement basis), the key home facts, and the renewal date of their current policy. Don't mention Hera, AI or that the quote was a sample. Never include date of birth.
Plain text only, no subject line, no placeholders like [Name]. Sign with the homeowner's name.
Facts: ${JSON.stringify(facts)}`;
  const attempt = async (model: LanguageModel, timeout: number) => {
    const { text } = await generateText({
      model,
      prompt,
      timeout,
      maxRetries: 0,
    });
    if (!text.trim() || text.length < 80) throw new Error("empty draft");
    return text.trim();
  };
  try {
    return {
      body: await attempt(heraModel(), 25_000),
      draftedBy: "model" as const,
    };
  } catch {
    try {
      return {
        body: await attempt(heraFallbackModel(), 15_000),
        draftedBy: "model" as const,
      };
    } catch {
      return {
        body: templateEmail(profile, q),
        draftedBy: "template" as const,
      };
    }
  }
}

const tools = {
  scan_neighbourhood: tool({
    description:
      "Find better insurance, step 1: locate the home on OpenStreetMap, measure the nearest fire hall, fire hydrant and river/lake, build the home's risk profile and list coverage gaps in the current policy. Saves flood risk and distances to the file.",
    inputSchema: z.object({}),
    execute: async () => {
      const profile = getProfile();
      const s = await neighbourhood(profile);
      const floodRisk = floodRiskOf(s);
      applyPatch({
        property: {
          floodRisk,
          ...(s.fireStation
            ? {
                distanceToFireHallKm: Math.round(s.fireStation.distanceM / 100) / 10,
              }
            : {}),
          ...(s.hydrant ? { distanceToHydrantM: s.hydrant.distanceM } : {}),
        },
      });
      const factors = riskFactors(getProfile(), s).map(({ weight, ...f }) => (void weight, f));
      const gaps = coverageGaps(getProfile(), s);
      const result = { ...s, floodRisk, factors, gaps };
      setFeatureData("shop", "scan", result); // latest scan, for the file pane
      return result;
    },
  }),

  compare_quotes: tool({
    description:
      "Find better insurance, step 2: fill each insurer's quote page with the household's file and compare their quotes with the current policy. Quotes are SAMPLE quotes from fictional insurers (no public quote API) — say so.",
    inputSchema: z.object({}),
    execute: async () => {
      const profile = getProfile();
      const s = await neighbourhood(profile);
      const data = setFeatureData("shop", "quotes", sampleQuotes(profile, s, riskFactors(profile, s)));
      return {
        ...data,
        floodRisk: floodRiskOf(s),
        formFields: formFields(profile),
      };
    },
  }),

  // Client tool — the UI shows a ConfirmCard and answers { approved }.
  confirm_quote_request: tool({
    description: "Ask the user to approve requesting a formal quote from one insurer. Hera only drafts the email; nothing is sent.",
    inputSchema: z.object({
      quoteId: z.string().describe("id from compare_quotes, e.g. cedarcrest"),
      reason: z.string().describe("One short sentence on why this quote is the pick"),
    }),
  }),

  draft_quote_request: tool({
    description: "After the user approves confirm_quote_request, draft the quote-request email to that insurer. Saved as a draft — NOT sent (demo).",
    inputSchema: z.object({ quoteId: z.string() }),
    execute: async ({ quoteId }) => {
      const data = getFeatureData<QuotesData>("shop", "quotes");
      const q = data?.quotes.find((x) => x.id === quoteId) ?? data?.quotes.find((x) => x.id === data.bestValueId);
      if (!q) return { error: "Compare quotes first." };
      const profile = getProfile();
      const { body, draftedBy } = await draftEmail(profile, q);
      const draft = {
        quoteId: q.id,
        insurer: q.insurer,
        to: `quotes@${q.insurer.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        subject: `Home insurance quote request — ${addressOf(profile)}`,
        body,
        draftedBy,
        sent: false,
        createdAt: new Date().toISOString(),
      };
      setFeatureData("shop", "request", draft);
      return draft;
    },
  }),
};

/** The latest approved confirm_quote_request that hasn't been drafted yet. */
function approvedNotDrafted(history: UIMessage[]) {
  let pending = false;
  for (const m of history) {
    for (const p of m.parts) {
      if (p.type === "tool-confirm_quote_request" && "output" in p && (p.output as { approved?: boolean } | undefined)?.approved) pending = true;
      if (p.type === "tool-draft_quote_request") pending = false;
    }
  }
  return pending;
}

export const shop: FeatureModule = {
  id: "shop",
  tools,
  clientTools: ["confirm_quote_request"],
  instructions: `FIND BETTER INSURANCE (once the shop goal is ready):
- scan_neighbourhood runs first: the UI shows a risk-profile card with a map and coverage gaps. In 1–2 sentences name the biggest risk and the most important gap. If its result says estimated: true, say the neighbourhood numbers are an estimate.
- compare_quotes runs next: the UI shows Hera filling each insurer's quote page, then a comparison table. These are SAMPLE quotes from fictional insurers — say so plainly. Recommend the best value (bestValueId) in 1–2 sentences: price vs current, and whether it fixes the gaps (e.g. flood). Then call confirm_quote_request with that quoteId.
- When confirm_quote_request comes back approved, call draft_quote_request with the same quoteId. Say the email is drafted, not sent. If declined, acknowledge and offer the other options.
- Never repeat the table or the numbers in a list; the cards show them.`,
  nextStep: ({ history, calledThisTurn }) => {
    const seen = (t: string) => seenTool(history, t) || calledThisTurn.includes(t);
    if (!seen("scan_neighbourhood")) return "scan_neighbourhood";
    if (!seen("compare_quotes")) return "compare_quotes";
    if (approvedNotDrafted(history) && !calledThisTurn.includes("draft_quote_request")) return "draft_quote_request";
    return null;
  },
};
