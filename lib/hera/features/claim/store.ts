import { getFeatureData, setFeatureData } from "@/lib/hera/feature-store";
import type { Profile } from "@/lib/hera/profile";

/* The claim, kept in feature data under ("claim", "claim"). Photos live under
 * ("claim", "photos") as small thumbnails so the claim itself stays compact. */

export type Evidence = "photo" | "receipt" | "memory" | "sample";
export type InventoryItem = {
  id: string;
  name: string;
  room: string;
  cost: number; // estimated replacement cost, CAD
  confidence: number | null; // 0–1 from the vision model; null when the user added it
  evidence: Evidence;
  photoId?: string;
  confirmed?: boolean;
  valueSource?: "ai" | "you";
  notes?: string;
  receipt?: { photoId: string; merchant: string | null; purchasedAt: string | null; purchasePrice: number };
};
export type Expense = { id: string; kind: "hotel" | "meals" | "other"; label: string; amount: number; date: string };
export type ClaimCoverage = { key: string; name: string; status: string; limit: number | null };
export type ClaimDeadline = { name: string; detail: string; due: string | null };
export type Claim = {
  dateOfLoss: string;
  cause: string;
  livable: boolean;
  insurer: string;
  policyNumber: string | null;
  deductible: number | null;
  settlementBasis: string;
  coverages: ClaimCoverage[];
  contentsLimit: number | null;
  aleLimit: number | null;
  deadlines: ClaimDeadline[];
  checklist: string[];
  fnol: { claimNumber: string; submittedAt: string } | null;
  inventory: InventoryItem[];
  inventorySample: boolean;
  expenses: Expense[];
  proofOfLoss: { confirmation: string; amount: number; submittedAt: string } | null;
};
export type Photo = { id: string; room: string; thumb: string; kind?: "before" | "after" | "receipt" };

export const getClaim = () => getFeatureData<Claim>("claim", "claim");
export const saveClaim = (claim: Claim) => setFeatureData("claim", "claim", claim);
export const getPhotos = () => getFeatureData<Photo[]>("claim", "photos") ?? [];
export const savePhotos = (photos: Photo[]) => setFeatureData("claim", "photos", photos);

export const uid = () => Math.random().toString(36).slice(2, 10);
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
export const claimNumber = () => `BW-C-${digits(7)}`;
export const confirmationNumber = () => `POL-${digits(6)}`;

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => {
  // local calendar date in Ottawa, not UTC
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts;
};

/** "Within 90 days of the loss" → a date; "Immediately" → the date of loss; otherwise null. */
export function dueDate(detail: string, from: string): string | null {
  const d = new Date(`${from}T12:00:00Z`);
  if (/immediate|as soon as|promptly|right away|without delay/i.test(detail)) return from;
  const m = detail.match(/(\d+)\s*(day|week|month|year)s?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "day") d.setUTCDate(d.getUTCDate() + n);
  if (unit === "week") d.setUTCDate(d.getUTCDate() + n * 7);
  if (unit === "month") d.setUTCMonth(d.getUTCMonth() + n);
  if (unit === "year") d.setUTCFullYear(d.getUTCFullYear() + n);
  return iso(d);
}

const RELEVANT = [
  { re: /overland|flood|surface water/i, order: 0 },
  { re: /sewer|backup|back-up/i, order: 1 },
  { re: /groundwater|seepage/i, order: 2 },
  { re: /content|belonging|personal property/i, order: 2.5 },
  { re: /living|ale|additional/i, order: 3 },
  { re: /dwelling|building/i, order: 4 },
];
const rank = (c: { key: string; name: string }) => RELEVANT.find((r) => r.re.test(`${c.key} ${c.name}`))?.order ?? -1;

export function buildClaim(profile: Profile, input: { dateOfLoss?: string | null; livable?: boolean | null; cause?: string | null }): Claim {
  const policy = profile.policy!;
  const cause = input.cause?.trim() || "Overland flood";
  const peril = /sewer|back.?up/i.test(cause) ? /sewer|back.?up/i : /ground.?water|seepage/i.test(cause) ? /ground.?water|seepage/i : /overland|flood|surface water/i.test(cause) ? /overland|flood|surface water/i : null;
  const coverage = peril ? policy.coverages.find((coverage) => peril.test(`${coverage.key} ${coverage.name}`)) : undefined;
  // Prefer a deductible explicitly stated for this peril. Never confuse its coverage limit with the deductible.
  const wording = coverage ? `${coverage.note} ${coverage.clause ?? ""}` : "";
  const amount = wording.match(/deductible(?:\s+(?:of|is))?\s*[:=-]?\s*(?:CAD\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1]
    ?? wording.match(/\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:CAD\s*)?deductible/i)?.[1];
  const deductible = amount == null ? policy.deductible : Number(amount.replaceAll(",", ""));
  const dateOfLoss = input.dateOfLoss && /^\d{4}-\d{2}-\d{2}$/.test(input.dateOfLoss) ? input.dateOfLoss : today();
  const coverages = policy.coverages
    .filter((c) => rank(c) >= 0)
    .sort((a, b) => rank(a) - rank(b))
    .map((c) => ({ key: c.key, name: c.name, status: c.status, limit: c.limit }));
  const limitOf = (re: RegExp) => policy.coverages.find((c) => re.test(`${c.key} ${c.name}`))?.limit ?? null;
  const deadlines = policy.deadlines.map((d) => ({ name: d.name, detail: d.detail, due: dueDate(d.detail, dateOfLoss) }));
  const mortgagee = profile.property.mortgageLender ?? policy.mortgagee;
  const checklist = [
    `Report the loss to ${policy.insurer} now${policy.insurerClaimsPhone ? ` (${policy.insurerClaimsPhone})` : ""} — Hera can file it for you.`,
    "Protect the home from more damage: stop the water if it's safe, move dry items up, run fans. Keep receipts for emergency repairs.",
    "Photograph or video every room before you clean up.",
    "Keep damaged items for the adjuster to inspect — don't throw anything out until they say so.",
    "Keep every receipt for hotel, meals and other extra costs while you can't live at home.",
    ...(mortgagee ? [`Let ${mortgagee} know — they're named on the policy and on any cheque for the building.`] : []),
  ];
  return {
    dateOfLoss,
    cause,
    livable: input.livable ?? false,
    insurer: policy.insurer,
    policyNumber: policy.policyNumber,
    deductible,
    settlementBasis: policy.settlementBasis,
    coverages,
    contentsLimit: limitOf(/content|belonging|personal property/i),
    aleLimit: limitOf(/living|ale\b|additional_living/i),
    deadlines,
    checklist,
    fnol: null,
    inventory: [],
    inventorySample: false,
    expenses: [],
    proofOfLoss: null,
  };
}

export const inventoryTotal = (c: Claim) => c.inventory.reduce((s, i) => s + i.cost, 0);
export const expensesTotal = (c: Claim) => c.expenses.reduce((s, e) => s + e.amount, 0);

export function honesty(c: Claim) {
  const by = (e: Evidence) => c.inventory.filter((i) => i.evidence === e).length;
  return {
    items: c.inventory.length,
    contentsTotal: inventoryTotal(c),
    photoBacked: by("photo"),
    receiptBacked: by("receipt"),
    fromMemory: by("memory"),
    sample: by("sample"),
    livingExpenses: expensesTotal(c),
    total: inventoryTotal(c) + expensesTotal(c),
  };
}

/** What the model sees — compact. */
export function claimSummary(c: Claim) {
  return {
    claimNumber: c.fnol?.claimNumber ?? null,
    dateOfLoss: c.dateOfLoss,
    cause: c.cause,
    deductible: c.deductible,
    coverages: c.coverages.map((x) => `${x.name}: ${x.status}${x.limit ? `, limit $${x.limit}` : ""}`),
    deadlines: c.deadlines.map((d) => `${d.name}: ${d.due ?? d.detail}`),
    inventory: { items: c.inventory.length, total: inventoryTotal(c), contentsLimit: c.contentsLimit, sample: c.inventorySample },
    livingExpenses: { total: expensesTotal(c), limit: c.aleLimit },
    proofOfLoss: c.proofOfLoss ? { confirmation: c.proofOfLoss.confirmation, amount: c.proofOfLoss.amount } : null,
  };
}

