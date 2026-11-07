import { z } from "zod";
import { policySchema } from "./policy-schema";

/* The household file Hera keeps: who you are, your home, and your policy.
 * Person + property are partial on purpose — Hera fills them in over time. */

export const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

export const personSchema = z
  .object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
    dateOfBirth: z.string().describe("YYYY-MM-DD — only used for insurance quotes"),
    claimsLast5Years: z.number().int().min(0),
  })
  .partial();

export const propertySchema = z
  .object({
    street: z.string(),
    city: z.string(),
    province: z.enum(PROVINCES),
    postalCode: z.string(),
    propertyType: z.enum(["detached", "semi_detached", "townhouse", "condo", "other"]),
    yearBuilt: z.number().int(),
    squareFeet: z.number().int(),
    basement: z.enum(["none", "unfinished", "finished"]),
    roofYear: z.number().int().describe("Year the roof was last replaced"),
    heating: z.enum(["natural_gas", "electric", "heat_pump", "oil", "propane", "wood", "other"]),
    plumbing: z.enum(["copper", "pex", "poly_b", "galvanized", "mixed", "unknown"]),
    monitoredAlarm: z.boolean(),
    waterLeakSensors: z.boolean(),
    sumpPump: z.boolean(),
    backwaterValve: z.boolean(),
    sprinklers: z.boolean(),
    mortgageLender: z.string(),
    /* Filled in later by Hera's neighbourhood research ("find me better insurance"). */
    floodRisk: z.enum(["low", "moderate", "high"]),
    distanceToFireHallKm: z.number(),
    distanceToHydrantM: z.number(),
  })
  .partial();

/** Corrections / additions to the current policy (e.g. a broker email the user mentions). */
export const policyPatchSchema = policySchema.omit({ isHomeInsurancePolicy: true }).partial();

export const profilePatchSchema = z.object({
  person: personSchema.optional(),
  property: propertySchema.optional(),
  policy: policyPatchSchema.optional(),
});

export type Person = z.infer<typeof personSchema>;
export type Property = z.infer<typeof propertySchema>;
export type PolicyPatch = z.infer<typeof policyPatchSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
