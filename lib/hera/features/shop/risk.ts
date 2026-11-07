import type { Profile } from "../../profile";
import type { Surroundings } from "./geo";

/* shop feature — Hera's risk rules, coverage-gap rules and the SAMPLE quotes.
 * Rules are real and deterministic; the quotes are fictional (no public quote API). */

export type Impact = "up" | "down" | "neutral";
export type Factor = {
  id: string;
  label: string;
  detail: string;
  impact: Impact;
  weight: number;
};
export type Gap = {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};
export type FloodRisk = "low" | "moderate" | "high";

export type Quote = {
  id: string;
  insurer: string;
  annualPremium: number;
  deductible: number;
  flood: { included: boolean; limit: number | null };
  sewerBackupLimit: number;
  settlementBasis: "replacement_cost" | "guaranteed_replacement_cost" | "actual_cash_value";
  rating: number;
  highlights: string[];
};
export type QuotesData = {
  current: { insurer: string; annualPremium: number };
  quotes: Quote[];
  bestValueId: string;
  sample: true;
  generatedAt: string;
};

const YEAR = new Date().getFullYear();
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function floodRiskOf(s: Surroundings): FloodRisk {
  const d = s.water?.distanceM;
  if (d == null) return "low";
  return d < 500 ? "high" : d < 1500 ? "moderate" : "low";
}

export function riskFactors(profile: Profile, s: Surroundings): Factor[] {
  const p = profile.property;
  const f: Factor[] = [];
  const add = (id: string, label: string, detail: string, impact: Impact, weight = 0) => f.push({ id, label, detail, impact, weight });

  if (s.fireStation) {
    const good = s.fireStation.distanceM < 5000;
    add(
      "fire_hall",
      "Fire hall",
      `${km(s.fireStation.distanceM)} away${good ? " — within the 5 km insurers like" : " — over 5 km"}`,
      good ? "down" : "up",
      good ? -0.04 : 0.08,
    );
  } else add("fire_hall", "Fire hall", "None found within 8 km", "up", 0.1);

  if (s.hydrant) {
    const good = s.hydrant.distanceM < 300;
    add("hydrant", "Fire hydrant", `${km(s.hydrant.distanceM)} away${good ? " — protected" : ""}`, good ? "down" : "up", good ? -0.03 : 0.05);
  } else add("hydrant", "Fire hydrant", "None found within 1 km", "up", 0.07);

  const flood = floodRiskOf(s);
  const waterName = s.water?.name?.replace(/\s*\(estimated\)/, "") ?? (s.water?.kind === "river" ? "a river" : "water");
  if (flood === "high") add("water", "Flood exposure", `${km(s.water!.distanceM)} from ${waterName} — high`, "up", 0.15);
  else if (flood === "moderate") add("water", "Flood exposure", `${km(s.water!.distanceM)} from ${waterName} — moderate`, "up", 0.06);
  else add("water", "Flood exposure", s.water ? `${km(s.water.distanceM)} from ${waterName} — low` : "No river or lake within 2 km", "neutral");

  if (p.yearBuilt) {
    const age = YEAR - p.yearBuilt;
    add(
      "home_age",
      "Home age",
      `Built ${p.yearBuilt} (${age} yrs)`,
      age > 40 ? "up" : age < 15 ? "down" : "neutral",
      age > 40 ? 0.06 : age < 15 ? -0.03 : 0,
    );
  }
  if (p.roofYear) {
    const age = YEAR - p.roofYear;
    add(
      "roof",
      "Roof",
      `Replaced ${p.roofYear} (${age} yrs)`,
      age > 20 ? "up" : age <= 10 ? "down" : "neutral",
      age > 20 ? 0.08 : age <= 10 ? -0.03 : 0,
    );
  }
  if (p.plumbing) {
    const bad = p.plumbing === "poly_b" || p.plumbing === "galvanized";
    const name = {
      copper: "Copper",
      pex: "PEX",
      poly_b: "Poly-B",
      galvanized: "Galvanized steel",
      mixed: "Mixed",
      unknown: "Unknown",
    }[p.plumbing];
    add("plumbing", "Plumbing", `${name}${bad ? " — insurers surcharge it" : ""}`, bad ? "up" : "neutral", bad ? 0.1 : 0);
  }
  if (p.heating) {
    const bad = p.heating === "oil" || p.heating === "wood";
    const name = {
      natural_gas: "Natural gas",
      electric: "Electric",
      heat_pump: "Heat pump",
      oil: "Oil",
      propane: "Propane",
      wood: "Wood stove",
      other: "Other",
    }[p.heating];
    add("heating", "Heating", `${name}${bad ? " — higher fire/spill risk" : ""}`, bad ? "up" : "neutral", bad ? 0.08 : 0);
  }
  const protections = (
    [
      ["monitoredAlarm", "Monitored alarm", -0.05],
      ["waterLeakSensors", "Leak sensors", -0.04],
      ["sumpPump", "Sump pump", -0.03],
      ["backwaterValve", "Backwater valve", -0.04],
    ] as const
  ).filter(([k]) => p[k] === true);
  if (protections.length)
    add(
      "protections",
      "Protections",
      protections.map(([, l]) => l).join(", "),
      "down",
      protections.reduce((a, [, , w]) => a + w, 0),
    );
  else add("protections", "Protections", "No alarm, leak sensors or backflow protection", "up", 0.03);

  const claims = profile.person.claimsLast5Years;
  if (claims != null) {
    add(
      "claims",
      "Claims history",
      claims === 0 ? "Claims-free 5 years" : `${claims} claim${claims > 1 ? "s" : ""} in 5 years`,
      claims === 0 ? "down" : "up",
      claims === 0 ? -0.06 : 0.1 * claims,
    );
  }
  return f;
}

const findCoverage = (profile: Profile, re: RegExp) => {
  const pol = profile.policy;
  if (!pol) return null;
  const cov = pol.coverages.find((c) => re.test(`${c.key} ${c.name}`));
  if (cov) return { covered: cov.status !== "not_covered", limit: cov.limit };
  const end = pol.endorsements.find((e) => re.test(e.name));
  if (end) return { covered: true, limit: end.limit };
  return null;
};

export function coverageGaps(profile: Profile, s: Surroundings): Gap[] {
  const pol = profile.policy;
  const p = profile.property;
  const gaps: Gap[] = [];
  if (!pol) return gaps;
  const flood = floodRiskOf(s);
  const overland = findCoverage(profile, /overland|flood|surface water/i);
  if (flood !== "low" && !overland?.covered) {
    gaps.push({
      id: "overland_flood",
      title: "No overland flood coverage",
      detail: `You're ${km(s.water!.distanceM)} from water, and your policy doesn't cover water that comes in over the ground.`,
      severity: flood === "high" ? "high" : "medium",
    });
  }
  const sewer = findCoverage(profile, /sewer|backup|back-up/i);
  if (p.basement === "finished" && (!sewer?.covered || (sewer.limit ?? 0) < 25_000)) {
    gaps.push({
      id: "sewer_backup",
      title: sewer?.covered ? `Sewer backup capped at $${(sewer.limit ?? 0).toLocaleString("en-CA")}` : "No sewer backup coverage",
      detail: "A finished basement can take $25,000+ to restore after a backup.",
      severity: "high",
    });
  }
  if (pol.settlementBasis === "actual_cash_value") {
    gaps.push({
      id: "acv",
      title: "Pays actual cash value",
      detail: "Claims are paid minus depreciation, not what it costs to replace.",
      severity: "medium",
    });
  }
  const contents = findCoverage(profile, /contents|belongings|personal property/i);
  if (contents?.limit != null && p.squareFeet && contents.limit < p.squareFeet * 40) {
    gaps.push({
      id: "contents",
      title: `Belongings limit looks low`,
      detail: `$${contents.limit.toLocaleString("en-CA")} for a ${p.squareFeet.toLocaleString("en-CA")} sq ft home — typical is $${(p.squareFeet * 50).toLocaleString("en-CA")}+.`,
      severity: "medium",
    });
  }
  const quake = findCoverage(profile, /earthquake/i);
  if (!quake?.covered)
    gaps.push({
      id: "earthquake",
      title: "Earthquake not covered",
      detail: "Low risk in Ottawa, but a cheap add-on.",
      severity: "low",
    });
  return gaps;
}

/* ───────── SAMPLE quotes ───────── */

const round5 = (n: number) => Math.round(n / 5) * 5;

export function sampleQuotes(profile: Profile, s: Surroundings, factors: Factor[]): QuotesData {
  const pol = profile.policy;
  const current = {
    insurer: pol?.insurer ?? "Current insurer",
    annualPremium: pol?.annualPremium ?? 1850,
  };
  const flood = floodRiskOf(s);
  // How far the household's real risk sits from an average home, softened (current premium already prices some of it).
  const risk = Math.min(1.25, Math.max(0.82, 1 + factors.reduce((a, f) => a + f.weight, 0) * 0.5));
  const market = current.annualPremium * 0.9 * risk;
  const floodLoad = flood === "high" ? 1.08 : flood === "moderate" ? 1.04 : 1;
  const floodLimit = flood === "high" ? 75_000 : 50_000;

  const quotes: Quote[] = [
    {
      id: "northline",
      insurer: "Northline Mutual",
      annualPremium: round5(market * 0.86),
      deductible: 2500,
      flood: { included: false, limit: null },
      sewerBackupLimit: 10_000,
      settlementBasis: "actual_cash_value",
      rating: 3.9,
      highlights: ["Lowest price", "No overland flood", "Depreciation taken off claims"],
    },
    {
      id: "cedarcrest",
      insurer: "Cedarcrest Home",
      annualPremium: round5(market * 0.94 * floodLoad),
      deductible: 1000,
      flood: { included: true, limit: floodLimit },
      sewerBackupLimit: 50_000,
      settlementBasis: "replacement_cost",
      rating: 4.5,
      highlights: ["Overland flood included", "Sewer backup $50k", "Claims-free discount applied"],
    },
    {
      id: "tamarack",
      insurer: "Tamarack General",
      annualPremium: round5(market * 1.16 * floodLoad),
      deductible: 500,
      flood: { included: true, limit: 100_000 },
      sewerBackupLimit: 100_000,
      settlementBasis: "guaranteed_replacement_cost",
      rating: 4.7,
      highlights: ["Guaranteed rebuild cost", "Highest limits", "$500 deductible"],
    },
    {
      id: "fernwood",
      insurer: "Fernwood Direct",
      annualPremium: round5(market * 1.03),
      deductible: 1000,
      flood: { included: true, limit: 25_000 },
      sewerBackupLimit: 25_000,
      settlementBasis: "replacement_cost",
      rating: 4.2,
      highlights: ["Online-only", "Flood capped at $25k", "Monthly billing free"],
    },
  ];
  // Best value: cheapest quote that covers flood and pays replacement cost.
  const solid = quotes.filter((q) => q.flood.included && q.settlementBasis !== "actual_cash_value");
  const best = solid.reduce((a, b) => (b.annualPremium < a.annualPremium ? b : a));
  return {
    current,
    quotes,
    bestValueId: best.id,
    sample: true,
    generatedAt: new Date().toISOString(),
  };
}
