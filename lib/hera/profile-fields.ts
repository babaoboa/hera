/* Field catalogue shared by the intake form, the "Your file" pane and the
 * readiness checks. Client-safe: no server imports. */

export type FieldType = "text" | "email" | "tel" | "date" | "number" | "select" | "bool";
export type Section = "you" | "home" | "protection" | "contacts";
export type Feature = "shop" | "negotiate" | "claim";
export type Scope = "person" | "property" | "policy";

export type Field = {
  key: string;
  scope: Scope;
  section: Section;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  /** Which features need this field to be on file. */
  neededFor: Feature[];
  /** Never shown to the model (PII minimisation). */
  sensitive?: boolean;
};

const opt = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

export const SECTIONS: { id: Section; label: string; blurb: string }[] = [
  { id: "you", label: "You", blurb: "So Hera can act on your behalf" },
  { id: "home", label: "Home", blurb: "What insurers price on" },
  { id: "protection", label: "Protection", blurb: "These often unlock discounts" },
  { id: "contacts", label: "Contacts", blurb: "Where emails and cheques go" },
];

export const FEATURES: { id: Feature; label: string }[] = [
  { id: "shop", label: "Find better insurance" },
  { id: "negotiate", label: "Negotiate your rate" },
  { id: "claim", label: "Handle a claim" },
];

export const FIELDS: Field[] = [
  { key: "fullName", scope: "person", section: "you", label: "Full name", type: "text", neededFor: ["shop", "negotiate", "claim"] },
  { key: "email", scope: "person", section: "you", label: "Email", type: "email", neededFor: ["negotiate", "claim"] },
  { key: "phone", scope: "person", section: "you", label: "Phone", type: "tel", neededFor: ["claim"] },
  { key: "dateOfBirth", scope: "person", section: "you", label: "Date of birth", type: "date", hint: "Only used for quotes", neededFor: ["shop"], sensitive: true },
  {
    key: "claimsLast5Years", scope: "person", section: "you", label: "Claims in the last 5 years", type: "select",
    options: opt([["0", "None"], ["1", "1"], ["2", "2"], ["3", "3 or more"]]), neededFor: ["shop", "negotiate"],
  },

  { key: "street", scope: "property", section: "home", label: "Street address", type: "text", neededFor: ["shop", "claim"] },
  { key: "city", scope: "property", section: "home", label: "City", type: "text", neededFor: ["shop", "claim"] },
  {
    key: "province", scope: "property", section: "home", label: "Province", type: "select",
    options: opt([["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"]]),
    neededFor: ["shop", "claim"],
  },
  { key: "postalCode", scope: "property", section: "home", label: "Postal code", type: "text", placeholder: "K1A 0B1", neededFor: ["shop"] },
  {
    key: "propertyType", scope: "property", section: "home", label: "Type of home", type: "select",
    options: opt([["detached", "Detached"], ["semi_detached", "Semi-detached"], ["townhouse", "Townhouse"], ["condo", "Condo"], ["other", "Other"]]), neededFor: ["shop"],
  },
  { key: "yearBuilt", scope: "property", section: "home", label: "Year built", type: "number", placeholder: "2011", neededFor: ["shop"] },
  { key: "squareFeet", scope: "property", section: "home", label: "Living area (sq ft)", type: "number", placeholder: "1850", neededFor: ["shop"] },
  {
    key: "basement", scope: "property", section: "home", label: "Basement", type: "select",
    options: opt([["none", "None"], ["unfinished", "Unfinished"], ["finished", "Finished"]]), neededFor: ["shop"],
  },
  { key: "roofYear", scope: "property", section: "home", label: "Roof last replaced", type: "number", placeholder: "2019", neededFor: ["shop", "negotiate"] },
  {
    key: "heating", scope: "property", section: "home", label: "Heating", type: "select",
    options: opt([["natural_gas", "Natural gas"], ["electric", "Electric"], ["heat_pump", "Heat pump"], ["oil", "Oil"], ["propane", "Propane"], ["wood", "Wood stove"], ["other", "Other"]]), neededFor: ["shop"],
  },
  {
    key: "plumbing", scope: "property", section: "home", label: "Plumbing", type: "select",
    options: opt([["copper", "Copper"], ["pex", "PEX"], ["poly_b", "Poly-B"], ["galvanized", "Galvanized"], ["mixed", "Mixed"], ["unknown", "Not sure"]]), neededFor: ["shop"],
  },

  { key: "monitoredAlarm", scope: "property", section: "protection", label: "Monitored alarm", type: "bool", neededFor: ["shop", "negotiate"] },
  { key: "waterLeakSensors", scope: "property", section: "protection", label: "Water leak sensors", type: "bool", neededFor: ["shop", "negotiate"] },
  { key: "sumpPump", scope: "property", section: "protection", label: "Sump pump", type: "bool", neededFor: ["shop", "negotiate", "claim"] },
  { key: "backwaterValve", scope: "property", section: "protection", label: "Backwater valve", type: "bool", neededFor: ["shop", "negotiate"] },
  { key: "sprinklers", scope: "property", section: "protection", label: "Sprinklers", type: "bool", neededFor: ["shop"] },

  { key: "brokerEmail", scope: "policy", section: "contacts", label: "Broker or insurer email", type: "email", hint: "Where Hera sends emails for you", neededFor: ["negotiate"] },
  { key: "insurerClaimsPhone", scope: "policy", section: "contacts", label: "Insurer claims line", type: "tel", neededFor: ["claim"] },
  { key: "mortgageLender", scope: "property", section: "contacts", label: "Mortgage lender", type: "text", hint: "Named on claim cheques", neededFor: ["claim"] },
];

export const fieldLabel = (key: string) =>
  FIELDS.find((f) => f.key === key)?.label ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export const isBlank = (v: unknown) => v === undefined || v === null || v === "";

type FileValues = { person: object; property: object; policy: object | null };

/** Sections of the intake form that still hold a missing field for this feature. */
export function sectionsNeeded(file: FileValues | null, feature: Feature): Section[] {
  const fields = FIELDS.filter((f) => f.neededFor.includes(feature));
  const missing = fields.filter((f) => isBlank((file?.[f.scope] as Record<string, unknown> | null | undefined)?.[f.key]));
  const pick = (list: Field[]) => SECTIONS.map((s) => s.id).filter((id) => list.some((f) => f.section === id));
  return missing.length > 0 ? pick(missing) : pick(fields);
}

/** Explicit requests outrank incidental policy facts within the same message. */
const GOAL_REQUESTS: { goal: Feature; pattern: RegExp }[] = [
  { goal: "claim", pattern: /\b(?:file|filing|submit|submitting|start|open|make|handle|report|track|help\s+with)\s+(?:(?:me|a|an|the|my|this|insurance|home)\s+){0,4}claims?\b/g },
  { goal: "negotiate", pattern: /\bnegotiat(?:e|ing|ion)\b|\b(?:lower|reduce|reducing)\s+(?:(?:my|the|current|insurance|home|policy)\s+){0,4}(?:rate|premium|bill|cost|payment)s?\b|\b(?:get|find|ask\s+for)\s+(?:(?:me|a|an|the)\s+){0,3}discounts?\b/g },
  { goal: "shop", pattern: /\b(?:find|shop(?:ping)?(?:\s+around)?(?:\s+for)?|compare|comparing|get|buy|switch(?:ing)?(?:\s+to)?)\s+(?:(?:me|a|an|the|some|new|better|cheaper|different|home|insurance|policy)\s+){0,6}(?:insurance|polic(?:y|ies)|quotes?|insurers?|providers?|options|coverage)\b|\b(?:new|better|cheaper)\s+(?:home\s+)?insurance\b/g },
];

function isNegated(text: string, index: number) {
  // Keep negation local to its clause; "don't file a claim, compare quotes" still shops.
  const prefix = text.slice(0, index).split(/[,;.!?]|\b(?:but|instead|however)\b/).at(-1) ?? "";
  return /\b(?:no|not|never|don't|do not|doesn't|didn't|haven't|hasn't|without)\s+(?:\w+\s+){0,3}$/.test(prefix);
}

/** Latest recognizable request wins; factual follow-ups retain the previous goal. */
export function detectFeature(texts: string[]): Feature | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const said = texts[i].toLowerCase().replace(/[’‘]/g, "'");
    const requests = GOAL_REQUESTS.flatMap(({ goal, pattern }) =>
      [...said.matchAll(pattern)]
        .filter((match) => !isNegated(said, match.index))
        .map((match) => ({ goal, index: match.index })),
    );
    // A later request in the same message can explicitly change direction.
    if (requests.length) return requests.sort((a, b) => b.index - a.index)[0].goal;

    // An actual loss report is a claim signal; coverage, sensors and claim history aren't.
    const incidents = /\b(?:i|we)\s+(?:just\s+)?(?:got\s+into|had|experienced|suffered)\s+(?:(?:a|an|the)\s+)?(?:flood|fire|theft|break-in)\b|\b(?:my|our|the)\s+(?:home|house|basement|roof|kitchen|apartment|pipe|pipes)\s+(?:(?:has|have|was|is|just|been|got)\s+){0,3}(?:flooded|flooding|damaged|destroyed|burned|burnt|burning|leaking|burst|on fire)\b|\b(?:i|we)\s+need\s+(?:to\s+)?(?:make\s+)?a\s+claim\b/g;
    if ([...said.matchAll(incidents)].some((match) => !isNegated(said, match.index))) return "claim";
  }
  return null;
}
