import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { extractPolicy } from "./extract";
import { addDocument, applyPatch, getProfile, HOUSEHOLD, resetHousehold, savePolicyFromDocument } from "./profile";
import type { PolicyPatch, ProfilePatch } from "./profile-schema";

/**
 * The demo household: Maya Patel, insured by Birchwood Mutual (both fictional).
 * Picked so every feature has something real to find: a flood endorsement for the
 * claim, protective devices with no discounts applied for the rate negotiation, and
 * a home near the river for the neighbourhood scan.
 */
export const DEMO_HOUSEHOLD = {
  person: {
    fullName: "Maya Patel",
    email: "maya.patel@example.com",
    phone: "613-555-0142",
    dateOfBirth: "1988-04-12",
    claimsLast5Years: 0,
  },
  property: {
    street: "412 Riverbend Road",
    city: "Ottawa",
    province: "ON",
    postalCode: "K0A 1L0",
    propertyType: "detached",
    yearBuilt: 2011,
    squareFeet: 1850,
    basement: "finished",
    roofYear: 2019,
    heating: "natural_gas",
    plumbing: "pex",
    monitoredAlarm: true,
    waterLeakSensors: true,
    sumpPump: true,
    backwaterValve: false,
    sprinklers: false,
    mortgageLender: "Maple Ridge Bank",
  },
} satisfies ProfilePatch;

/** Earlier terms. The current one ($1,925 from 2026-03-15) comes from the policy itself: +30% in three years. */
const PAST_PREMIUMS: [periodStart: string, amount: number][] = [
  ["2023-03-15", 1480],
  ["2024-03-15", 1610],
  ["2025-03-15", 1705],
];

/** Contacts the demo PDF doesn't print, so no feature has to stop and ask for them. */
const POLICY_CONTACTS = {
  brokerEmail: "service@birchwoodmutual.example",
  insurerClaimsPhone: "1-800-555-0199",
} satisfies PolicyPatch;

const DEMO_POLICY = { filename: "birchwood-policy.pdf" };

/**
 * Wipe the household (policies, documents, premium history, feature data and chats
 * cascade with it) and load the demo household.
 *
 * withPolicy: false leaves the policy out so it can be uploaded live in the demo.
 * withPolicy: true also reads the demo PDF (cached by file hash, so normally no model call)
 * and fills the policy contacts, so every feature is ready straight away.
 */
export async function seedDemo({ withPolicy = false } = {}) {
  // Read the policy before touching the db, so a failed read leaves the current data alone.
  const pdf = withPolicy ? await readFile(path.join(process.cwd(), "public", "demo", "birchwood-policy.pdf")) : null;
  const policy = pdf ? await extractPolicy(pdf, DEMO_POLICY.filename) : null;

  resetHousehold();
  applyPatch(DEMO_HOUSEHOLD);
  const addPremium = db().prepare("insert or replace into premium_history (household_id, period_start, amount) values (?, ?, ?)");
  for (const [periodStart, amount] of PAST_PREMIUMS) addPremium.run(HOUSEHOLD, periodStart, amount);

  if (pdf && policy) {
    savePolicyFromDocument(policy, addDocument(DEMO_POLICY.filename, pdf));
    applyPatch({ policy: POLICY_CONTACTS });
  }
  return getProfile();
}
