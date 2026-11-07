/* negotiate feature — the rate case. Pure functions and types, safe to import on the client. */

export type MissingDiscount = {
  key: string;
  name: string;
  /** why the user likely qualifies, from their file */
  why: string;
  /** typical discount range, as fractions of the premium */
  pct: [number, number];
  /** estimated yearly saving range in dollars */
  saving: [number, number];
  /** a question to ask, not counted in the target */
  question?: boolean;
};

export type HistoryBar = { year: string; amount: number; sample: boolean };

export type CompetingOffer =
  | { kind: "quote"; insurer: string; annualPremium: number; comparable: boolean }
  | { kind: "market"; low: number; high: number };

export type RateCase = {
  insurer: string;
  policyNumber: string | null;
  premium: number;
  renewal: string | null;
  deductible: number | null;
  discountsOnFile: string[];
  protections: string[];
  claimsFreeYears: number | null;
  tenureYears: number | null;
  history: HistoryBar[];
  missing: MissingDiscount[];
  competing: CompetingOffer;
  target: number;
  saving: number;
  createdAt: string;
};

export type NegotiationEmail = { to: string; subject: string; body: string; source: "model" | "template" };

export type SimulatedReply = {
  from: string;
  subject: string;
  body: string;
  newPremium: number;
  saving: number;
  simulated: true;
};

export type NegotiateStatus = "draft" | "sent" | "reply";

/* Typical Canadian home-insurance discount ranges (estimates, not quotes). */
const DISCOUNTS: { key: string; name: string; pct: [number, number]; onFile: RegExp }[] = [
  { key: "claims_free", name: "Claims-free discount", pct: [0.1, 0.15], onFile: /claim/i },
  { key: "alarm", name: "Monitored alarm", pct: [0.05, 0.1], onFile: /alarm|monitor|security/i },
  { key: "leak", name: "Water leak sensors", pct: [0.03, 0.08], onFile: /leak|water.*(sensor|detect)|smart water/i },
  { key: "water", name: "Sump pump / backwater valve", pct: [0.05, 0.1], onFile: /sump|backwater|sewer|water protection/i },
  { key: "roof", name: "Newer roof", pct: [0.03, 0.08], onFile: /roof/i },
  { key: "sprinklers", name: "Sprinkler system", pct: [0.05, 0.1], onFile: /sprinkler/i },
  { key: "bundle", name: "Bundle home + auto", pct: [0.1, 0.15], onFile: /bundl|multi.?(line|policy)|auto|car/i },
];

const round = (n: number, to = 5) => Math.round(n / to) * to;
const mid = ([a, b]: [number, number]) => (a + b) / 2;

type Input = {
  insurer: string;
  policyNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  premium: number;
  deductible: number | null;
  discounts: string[];
  coversFlood: boolean;
  property: { monitoredAlarm?: boolean; waterLeakSensors?: boolean; sumpPump?: boolean; backwaterValve?: boolean; sprinklers?: boolean; roofYear?: number };
  claimsLast5Years?: number;
  premiumHistory: { periodStart: string; amount: number }[];
  shop: { quotes?: { id?: string; insurer?: string; annualPremium?: number; flood?: unknown }[]; bestValueId?: string } | null;
  now?: Date;
};

export function buildCase(input: Input): RateCase {
  const { premium, property: p } = input;
  const discounts = input.discounts.filter((d) => /[a-z]{3}/i.test(d)); // drop extraction junk like "/"
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const onFile = (re: RegExp) => discounts.some((d) => re.test(d));

  const eligible: Record<string, string | null> = {
    claims_free: input.claimsLast5Years === 0 ? "No claims in the last 5 years" : null,
    alarm: p.monitoredAlarm ? "You have a monitored alarm" : null,
    leak: p.waterLeakSensors ? "You have water leak sensors" : null,
    water:
      p.sumpPump || p.backwaterValve
        ? `You have a ${[p.sumpPump && "sump pump", p.backwaterValve && "backwater valve"].filter(Boolean).join(" and ")}`
        : null,
    roof: p.roofYear && year - p.roofYear < 10 ? `Roof replaced in ${p.roofYear}` : null,
    sprinklers: p.sprinklers ? "You have sprinklers" : null,
    bundle: "Worth asking if you also insure a car",
  };

  const missing: MissingDiscount[] = DISCOUNTS.filter((d) => eligible[d.key] && !onFile(d.onFile)).map((d) => ({
    key: d.key,
    name: d.name,
    why: eligible[d.key]!,
    pct: d.pct,
    saving: [round(premium * d.pct[0]), round(premium * d.pct[1])],
    ...(d.key === "bundle" ? { question: true } : {}),
  }));

  // Discounts stack multiplicatively; cap the total so the ask stays credible.
  const counted = missing.filter((m) => !m.question);
  const discountPct = Math.min(0.3, 1 - counted.reduce((left, m) => left * (1 - mid(m.pct)), 1));
  let target = premium * (1 - discountPct);

  // Leverage: a real quote from the shop feature, or a labelled typical market range.
  let competing: CompetingOffer;
  const quotes = (input.shop?.quotes ?? []).filter((q) => typeof q.annualPremium === "number" && q.annualPremium > 0);
  const comparable = quotes.filter((q) => !input.coversFlood || Boolean(q.flood));
  const pool = comparable.length ? comparable : quotes;
  const best = pool.find((q) => q.id && q.id === input.shop?.bestValueId) ?? [...pool].sort((a, b) => a.annualPremium! - b.annualPremium!)[0];
  if (best && best.annualPremium! < premium) {
    competing = { kind: "quote", insurer: best.insurer ?? "Another insurer", annualPremium: best.annualPremium!, comparable: comparable.includes(best) };
    target = Math.min(target, best.annualPremium!);
  } else {
    competing = { kind: "market", low: round(premium * 0.85, 10), high: round(premium * 0.95, 10) };
  }
  target = round(Math.max(target, premium * 0.65), 10);

  // History: real rows first; if there's only one term, show labelled sample prior years.
  const real = input.premiumHistory.map((h) => ({ year: h.periodStart.slice(0, 4), amount: h.amount, sample: false }));
  if (!real.length) real.push({ year: String(input.periodStart?.slice(0, 4) ?? year), amount: premium, sample: false });
  const history: HistoryBar[] = [...real];
  if (real.length < 2) {
    const first = Number(real[0].year);
    for (let k = 1; k <= 2; k++) history.unshift({ year: String(first - k), amount: round(real[0].amount / Math.pow(1.09, k)), sample: true });
  }

  const protections = [
    p.monitoredAlarm && "Monitored alarm",
    p.waterLeakSensors && "Water leak sensors",
    p.sumpPump && "Sump pump",
    p.backwaterValve && "Backwater valve",
    p.sprinklers && "Sprinklers",
  ].filter((x): x is string => Boolean(x));

  return {
    insurer: input.insurer,
    policyNumber: input.policyNumber,
    premium,
    renewal: input.periodEnd,
    deductible: input.deductible,
    discountsOnFile: discounts,
    protections,
    claimsFreeYears: input.claimsLast5Years === 0 ? 5 : null,
    tenureYears: real.length > 1 ? real.length : null,
    history,
    missing,
    competing,
    target,
    saving: Math.max(0, premium - target),
    createdAt: now.toISOString(),
  };
}

/** A deterministic, clearly simulated insurer reply for the demo payoff. */
export function simulateReply(c: RateCase): SimulatedReply {
  const offered = c.missing.filter((m) => !m.question).slice(0, 2);
  const matched = c.competing.kind === "quote";
  const newPremium = matched ? c.target : round(c.premium - c.saving * 0.7, 10);
  const saving = Math.max(0, c.premium - newPremium);
  const names = offered.map((m) => m.name.toLowerCase());
  const body = [
    "Thank you for reaching out ahead of your renewal, and for being a valued Birchwood Mutual customer.",
    names.length
      ? `We've reviewed your file and can apply the ${names.join(" and ")} to your policy${c.policyNumber ? ` ${c.policyNumber}` : ""}.`
      : "We've reviewed your file and applied a loyalty adjustment to your policy.",
    matched && c.competing.kind === "quote"
      ? `Taking into account the offer you received from ${c.competing.insurer}, your renewal premium will be ${fmt(newPremium)} per year.`
      : `Your renewal premium will be ${fmt(newPremium)} per year.`,
    "No further action is needed — the new rate will take effect at renewal.",
  ].join(" ");
  return { from: `${c.insurer} Retention Team`, subject: "Re: Your renewal premium", body, newPremium, saving, simulated: true };
}

export const fmt = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
