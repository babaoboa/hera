import type { Surroundings } from "@/lib/hera/features/shop/geo";
import type { FloodRisk, Gap, Impact, QuotesData } from "@/lib/hera/features/shop/risk";

/* Tool output shapes the shop UI renders (type-only imports from the server module). */

export type ScanResult = Surroundings & {
  floodRisk: FloodRisk;
  factors: { id: string; label: string; detail: string; impact: Impact }[];
  gaps: Gap[];
};

export type CompareResult = QuotesData & {
  floodRisk: FloodRisk;
  formFields: { label: string; value: string }[];
};

export type QuoteDraft = {
  quoteId: string;
  insurer: string;
  to: string;
  subject: string;
  body: string;
  draftedBy: "model" | "template";
  sent: false;
};

export type { Quote, QuotesData } from "@/lib/hera/features/shop/risk";
