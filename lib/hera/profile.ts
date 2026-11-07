import { db, transaction } from "./db";
import type { Policy } from "./policy-schema";
import { PROVINCES, type Person, type PolicyPatch, type ProfilePatch, type Property } from "./profile-schema";
import { FEATURES, FIELDS, fieldLabel, isBlank, type Feature, type Field } from "./profile-fields";

/* Single-household demo. Every function takes a household id so multi-user is a
 * matter of passing the signed-in user's id instead. */
export const HOUSEHOLD = "default";

export type StoredPolicy = Omit<Policy, "isHomeInsurancePolicy"> & { id: number; documentName: string | null; updatedAt: string };
export type Readiness = Record<Feature, { ready: boolean; missing: string[] }>;
export type Profile = {
  person: Person;
  property: Property;
  policy: StoredPolicy | null;
  pendingDocument: { id: number; filename: string } | null;
  premiumHistory: { periodStart: string; amount: number }[];
  /** JSON each feature saved (quotes, claim inventory…), keyed by feature then key. */
  features: Partial<Record<Feature, Record<string, unknown>>>;
  readiness: Readiness;
};

type Row = Record<string, unknown>;
type PolicyData = Omit<Policy, "isHomeInsurancePolicy">;

const parse = <T>(value: unknown, fallback: T): T => {
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const compact = <T extends object>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => !isBlank(v))) as Partial<T>;

const EMPTY_POLICY: Omit<PolicyData, "insurer"> = {
  policyNumber: null, insuredName: null, propertyAddress: null, propertyAddressParts: null,
  periodStart: null, periodEnd: null, annualPremium: null, deductible: null, settlementBasis: "unknown",
  coverages: [], endorsements: [], discounts: [], exclusions: [], deadlines: [],
  mortgagee: null, brokerName: null, brokerEmail: null, brokerPhone: null, insurerClaimsPhone: null,
};

function ensureHousehold(id: string) {
  db().prepare("insert or ignore into households (id) values (?)").run(id);
}

function currentPolicyRow(id: string) {
  return db()
    .prepare(
      `select p.*, (select filename from documents d where d.policy_id = p.id order by d.id desc limit 1) as document_name
         from policies p where p.household_id = ? order by p.id desc limit 1`,
    )
    .get(id) as Row | undefined;
}

function writePolicy(householdId: string, data: PolicyData, policyId?: number): number {
  const cols = [data.insurer, data.policyNumber, data.periodStart, data.periodEnd, data.annualPremium, JSON.stringify(data)];
  if (policyId) {
    db()
      .prepare(
        `update policies set insurer = ?, policy_number = ?, period_start = ?, period_end = ?, annual_premium = ?, data = ?,
                updated_at = datetime('now') where id = ?`,
      )
      .run(...cols, policyId);
    return policyId;
  }
  const { lastInsertRowid } = db()
    .prepare(
      `insert into policies (household_id, insurer, policy_number, period_start, period_end, annual_premium, data)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(householdId, ...cols);
  return Number(lastInsertRowid);
}

/** Merge into person/property JSON. onlyBlank = never overwrite what's already on file. */
function mergeHousehold(id: string, scope: "person" | "property", changes: Row, onlyBlank = false): string[] {
  const row = db().prepare(`select ${scope} as data from households where id = ?`).get(id) as Row;
  const current = parse<Row>(row.data, {});
  const applied = Object.fromEntries(Object.entries(changes).filter(([k, v]) => !isBlank(v) && (!onlyBlank || isBlank(current[k]))));
  if (Object.keys(applied).length === 0) return [];
  db()
    .prepare(`update households set ${scope} = ?, updated_at = datetime('now') where id = ?`)
    .run(JSON.stringify({ ...current, ...applied }), id);
  return Object.keys(applied).map(fieldLabel);
}

function featureRows(id: string): Profile["features"] {
  const rows = db().prepare("select feature, key, value from feature_data where household_id = ?").all(id) as { feature: Feature; key: string; value: string }[];
  const out: Profile["features"] = {};
  for (const r of rows) (out[r.feature] ??= {})[r.key] = parse(r.value, null);
  return out;
}

function valueOf(profile: Omit<Profile, "readiness">, field: Field): unknown {
  const source = field.scope === "person" ? profile.person : field.scope === "property" ? profile.property : profile.policy;
  return (source as Row | null)?.[field.key];
}

export function readiness(profile: Omit<Profile, "readiness">): Readiness {
  return Object.fromEntries(
    FEATURES.map(({ id }) => {
      const missing = [
        ...(profile.policy ? [] : ["Your policy"]),
        ...FIELDS.filter((f) => f.neededFor.includes(id) && isBlank(valueOf(profile, f))).map((f) => f.label),
      ];
      return [id, { ready: missing.length === 0, missing }];
    }),
  ) as Readiness;
}

export function getProfile(id = HOUSEHOLD): Profile {
  ensureHousehold(id);
  const household = db().prepare("select person, property from households where id = ?").get(id) as Row;
  const policyRow = currentPolicyRow(id);
  const pending = db()
    .prepare("select id, filename from documents where household_id = ? and policy_id is null order by id desc limit 1")
    .get(id) as Row | undefined;
  const history = db()
    .prepare("select period_start, amount from premium_history where household_id = ? order by period_start")
    .all(id) as Row[];

  const profile: Omit<Profile, "readiness"> = {
    person: parse<Person>(household.person, {}),
    property: parse<Property>(household.property, {}),
    policy: policyRow
      ? {
          ...parse<PolicyData>(policyRow.data, { insurer: String(policyRow.insurer), ...EMPTY_POLICY }),
          id: Number(policyRow.id),
          documentName: (policyRow.document_name as string | null) ?? null,
          updatedAt: String(policyRow.updated_at),
        }
      : null,
    pendingDocument: pending ? { id: Number(pending.id), filename: String(pending.filename) } : null,
    premiumHistory: history.map((r) => ({ periodStart: String(r.period_start), amount: Number(r.amount) })),
    features: featureRows(id),
  };
  return { ...profile, readiness: readiness(profile) };
}

/** What the model sees: sensitive fields masked, long clause text dropped. */
export function profileForModel(profile: Profile) {
  const person: Row = { ...profile.person };
  for (const f of FIELDS) if (f.sensitive && f.scope === "person" && !isBlank(person[f.key])) person[f.key] = "on file";
  const policy = profile.policy && {
    ...profile.policy,
    coverages: profile.policy.coverages.map((c) => ({ key: c.key, name: c.name, status: c.status, limit: c.limit, note: c.note })),
    exclusions: profile.policy.exclusions.map((x) => x.name),
  };
  // Feature data can be large (claim photos, quote tables). Features read their own data
  // in their tools, so the model only needs to know what exists.
  const features = Object.fromEntries(Object.entries(profile.features).map(([feature, data]) => [feature, Object.keys(data ?? {})]));
  return { ...profile, person, policy, features };
}

/** One line for the system prompt so the agent always knows where intake stands. */
export function statusLine(profile: Profile): string {
  if (profile.pendingDocument) {
    return `A policy document ("${profile.pendingDocument.filename}") was received but has NOT been read yet — call read_policy now.`;
  }
  if (!profile.policy) return "No policy on file yet.";
  const ready = FEATURES.map(({ id, label }) => {
    const r = profile.readiness[id];
    return `${label}: ${r.ready ? "ready" : `missing ${r.missing.join(", ")}`}`;
  }).join("; ");
  return `${profile.policy.insurer}${profile.policy.policyNumber ? ` #${profile.policy.policyNumber}` : ""} is on file. ${ready}.`;
}

/** Save facts from chat or the intake form. Returns labels of what changed. */
export function applyPatch(patch: ProfilePatch, id = HOUSEHOLD): string[] {
  ensureHousehold(id);
  return transaction(db(), () => {
    const saved: string[] = [];
    if (patch.person) saved.push(...mergeHousehold(id, "person", compact(patch.person)));
    if (patch.property) saved.push(...mergeHousehold(id, "property", compact(patch.property)));

    const changes = patch.policy ? (compact(patch.policy) as PolicyPatch) : {};
    if (Object.keys(changes).length > 0) {
      const row = currentPolicyRow(id);
      if (row) {
        writePolicy(id, { ...parse<PolicyData>(row.data, { insurer: String(row.insurer), ...EMPTY_POLICY }), ...changes }, Number(row.id));
        saved.push(...Object.keys(changes).map(fieldLabel));
      } else if (changes.insurer) {
        writePolicy(id, { ...EMPTY_POLICY, ...changes, insurer: changes.insurer });
        saved.push(...Object.keys(changes).map(fieldLabel));
      }
      // Without a policy (and no insurer named) there's nothing to attach these to. Creating a
      // placeholder would make intake think a policy is on file and skip asking for the real one.
    }
    return saved;
  });
}

export function addDocument(filename: string, content: Buffer, id = HOUSEHOLD): number {
  ensureHousehold(id);
  const { lastInsertRowid } = db()
    .prepare("insert into documents (household_id, filename, bytes, content) values (?, ?, ?, ?)")
    .run(id, filename, content.length, content);
  return Number(lastInsertRowid);
}

export function getDocument(documentId: number, id = HOUSEHOLD): { filename: string; content: Buffer } | null {
  const row = db().prepare("select filename, content from documents where id = ? and household_id = ?").get(documentId, id) as Row | undefined;
  return row ? { filename: String(row.filename), content: Buffer.from(row.content as Uint8Array) } : null;
}

/**
 * Store a freshly read policy as the current one, link its PDF, record the premium,
 * and pre-fill household facts the policy already states (never overwriting the user).
 */
export function savePolicyFromDocument(policy: Policy, documentId: number | null, id = HOUSEHOLD): { prefilled: string[] } {
  ensureHousehold(id);
  return transaction(db(), () => {
    const { isHomeInsurancePolicy, ...data } = policy;
    void isHomeInsurancePolicy; // a validation flag, not something we store
    const policyId = writePolicy(id, data);
    if (documentId) db().prepare("update documents set policy_id = ? where id = ? and household_id = ?").run(policyId, documentId, id);
    if (data.periodStart && data.annualPremium != null) {
      db()
        .prepare("insert or replace into premium_history (household_id, period_start, amount) values (?, ?, ?)")
        .run(id, data.periodStart, data.annualPremium);
    }

    const address = data.propertyAddressParts;
    const province = address?.province?.toUpperCase();
    const prefilled = [
      ...mergeHousehold(id, "person", { fullName: data.insuredName }, true),
      ...mergeHousehold(
        id,
        "property",
        {
          street: address?.street,
          city: address?.city,
          province: province && (PROVINCES as readonly string[]).includes(province) ? province : null,
          postalCode: address?.postalCode,
          mortgageLender: data.mortgagee,
        },
        true,
      ),
    ];
    return { prefilled };
  });
}

export function resetHousehold(id = HOUSEHOLD) {
  db().prepare("delete from households where id = ?").run(id);
}

/** Drop an uploaded document that turned out not to be a policy. */
export function discardDocument(documentId: number, id = HOUSEHOLD) {
  db().prepare("delete from documents where id = ? and household_id = ? and policy_id is null").run(documentId, id);
}
