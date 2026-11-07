"use client";

import type { Profile } from "@/lib/hera/profile";
import { FEATURES, FIELDS, isBlank } from "@/lib/hera/profile-fields";
import { Chip, Glyph, ICONS, money, shortDate } from "@/components/hera/ui";
import { Block, Rows } from "./FileBlocks";
export { Block, Rows } from "./FileBlocks";
import { FeaturePaneBlocks } from "@/components/hera/features";

/* ─────────────────────────────────────────────────────────
 * YOUR FILE — the right-hand pane. Everything Hera knows about
 * the household, live: readiness for each feature, the policy,
 * the home, and contact details. Refreshes as the agent saves.
 * ───────────────────────────────────────────────────────── */

const optionLabel = (key: string, value: unknown) => FIELDS.find((f) => f.key === key)?.options?.find((o) => o.value === String(value))?.label;

function display(key: string, value: unknown): string | null {
  if (isBlank(value)) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return optionLabel(key, value) ?? String(value);
}

export default function FilePane({ profile, onReset }: { profile: Profile | null; onReset: () => void }) {
  if (!profile) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-card bg-field" />)}</div>;
  }
  const { person, property, policy, readiness } = profile;
  const empty = !policy && Object.keys(person).length === 0 && Object.keys(property).length === 0;
  const address = [property.street, property.city, property.province].filter(Boolean).join(", ");
  const protection = FIELDS.filter((f) => f.section === "protection");

  return (
    <div className="divide-y divide-line">
      <Block title="Ready for" icon={ICONS.check}>
        <ul className="space-y-1.5">
          {FEATURES.map((f) => {
            const r = readiness[f.id];
            return (
              <li key={f.id} className="flex items-center justify-between gap-3 text-[12.5px]" title={r.missing.join(", ")}>
                <span className="text-ink">{f.label}</span>
                {r.ready ? <Chip tone="green">Ready</Chip> : <Chip tone="orange">{r.missing.length} missing</Chip>}
              </li>
            );
          })}
        </ul>
        {empty && <p className="mt-3 text-[12px] leading-snug text-ink-3">Nothing on file yet. Share your policy and Hera fills this in as you talk.</p>}
      </Block>

      <Block title="Policy" icon={ICONS.shield}>
        {policy ? (
          <>
            <Rows
              rows={[
                ["Insurer", policy.insurer],
                ["Policy", policy.policyNumber],
                ["Renews", policy.periodEnd ? shortDate(policy.periodEnd) : null],
                ["Premium", policy.annualPremium != null ? `${money(policy.annualPremium)}/yr` : null],
                ["Deductible", policy.deductible != null ? money(policy.deductible) : null],
              ]}
            />
            <div className="mt-2.5 flex flex-wrap gap-1">
              {policy.coverages.map((c) => (
                <Chip key={c.key} tone={c.status === "covered" ? "green" : c.status === "limited" ? "orange" : "red"}>
                  {c.name}
                </Chip>
              ))}
            </div>
            {policy.documentName && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                <Glyph d={ICONS.file} size={12} /> {policy.documentName}
              </div>
            )}
          </>
        ) : (
          <p className="text-[12.5px] text-ink-3">No policy yet.</p>
        )}
      </Block>

      <Block title="Home" icon={ICONS.home}>
        <Rows
          rows={[
            ["Address", address || null],
            ["Type", display("propertyType", property.propertyType)],
            ["Built", display("yearBuilt", property.yearBuilt)],
            ["Size", property.squareFeet ? `${property.squareFeet.toLocaleString()} sq ft` : null],
            ["Basement", display("basement", property.basement)],
            ["Roof", property.roofYear ? `Replaced ${property.roofYear}` : null],
            ["Heating", display("heating", property.heating)],
          ]}
        />
        <div className="mt-2.5 flex flex-wrap gap-1">
          {protection.map((f) => {
            const v = property[f.key as keyof typeof property];
            return (
              <Chip key={f.key} tone={v === true ? "green" : "default"}>
                {v === true && <Glyph d={ICONS.check} size={10} stroke={3} />}
                <span className={v === undefined ? "text-ink-3" : v === false ? "line-through decoration-ink-3" : ""}>{f.label}</span>
              </Chip>
            );
          })}
        </div>
      </Block>

      <FeaturePaneBlocks profile={profile} />

      <Block title="You" icon={ICONS.user}>
        <Rows
          rows={[
            ["Name", display("fullName", person.fullName)],
            ["Email", display("email", person.email)],
            ["Phone", display("phone", person.phone)],
            ["Date of birth", person.dateOfBirth ? "On file" : null],
            ["Claims (5 yrs)", display("claimsLast5Years", person.claimsLast5Years)],
            ["Broker", display("brokerEmail", policy?.brokerEmail)],
            ["Lender", display("mortgageLender", property.mortgageLender)],
          ]}
        />
      </Block>

      <div className="pt-4">
        <button type="button" onClick={onReset} className="text-[12px] text-ink-3 transition-colors duration-100 hover:text-red">
          Clear my file and chats
        </button>
      </div>
    </div>
  );
}
