import { z } from "zod";

/* What we extract from a policy document. Fields are required-but-nullable so
 * structured output stays strict: the model must answer, and null means "not stated". */

export const coverageSchema = z.object({
  key: z
    .string()
    .describe(
      "snake_case id, e.g. dwelling, contents, additional_living_expenses, overland_flood, sewer_backup, earthquake, debris_removal, jewellery, liability",
    ),
  name: z.string().describe("Short plain-language name, e.g. 'Your belongings'"),
  status: z
    .enum(["covered", "limited", "not_covered"])
    .describe("limited = covered but with a sub-limit or condition worth flagging"),
  limit: z.number().nullable().describe("Dollar limit in CAD, or null if not stated / not applicable"),
  note: z.string().describe("One short plain-language sentence for a stressed homeowner"),
  clause: z.string().nullable().describe("Exact quote from the policy that supports this (max ~40 words)"),
});

export const addressSchema = z.object({
  street: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable().describe("Two-letter code, e.g. ON"),
  postalCode: z.string().nullable(),
});

export const policySchema = z.object({
  isHomeInsurancePolicy: z.boolean().describe("false if this document is not a home/property insurance policy"),
  insurer: z.string(),
  policyNumber: z.string().nullable(),
  insuredName: z.string().nullable(),
  propertyAddress: z.string().nullable(),
  propertyAddressParts: addressSchema.nullable(),
  periodStart: z.string().nullable().describe("YYYY-MM-DD if stated"),
  periodEnd: z.string().nullable().describe("YYYY-MM-DD if stated — this is the renewal date"),
  annualPremium: z.number().nullable(),
  deductible: z.number().nullable(),
  settlementBasis: z.enum(["replacement_cost", "guaranteed_replacement_cost", "actual_cash_value", "unknown"]),
  coverages: z.array(coverageSchema),
  endorsements: z.array(z.object({ name: z.string(), limit: z.number().nullable() })).describe("Add-ons such as overland water"),
  discounts: z.array(z.string()).describe("Discounts already applied, e.g. 'Claims-free'"),
  exclusions: z
    .array(
      z.object({
        name: z.string().describe("2–4 plain words in sentence case, e.g. 'Gradual seepage', 'Mould', 'Vehicles' — never snake_case"),
        clause: z.string().nullable(),
      }),
    )
    .describe("The most important exclusions, at most 8"),
  deadlines: z
    .array(
      z.object({
        name: z.string().describe("2–4 plain words in sentence case, e.g. 'Report the loss', 'Proof of loss' — never snake_case"),
        detail: z.string().describe("Under 8 words, e.g. 'Within 90 days of the loss', 'Immediately'"),
        clause: z.string().nullable(),
      }),
    )
    .describe("Claim deadlines and duties with a time limit or that the homeowner must act on, at most 5"),
  mortgagee: z.string().nullable().describe("Mortgage lender named on the policy"),
  brokerName: z.string().nullable(),
  brokerEmail: z.string().nullable(),
  brokerPhone: z.string().nullable(),
  insurerClaimsPhone: z.string().nullable(),
});

export type Policy = z.infer<typeof policySchema>;
export type Coverage = z.infer<typeof coverageSchema>;
