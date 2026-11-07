"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/Button";
import type { Profile } from "@/lib/hera/profile";
import { FIELDS, SECTIONS, isBlank, sectionsNeeded, type Feature, type Field } from "@/lib/hera/profile-fields";
import type { ProfilePatch } from "@/lib/hera/profile-schema";
import { CardTitle, Chip, Glyph, ICONS, fadeUp } from "@/components/hera/ui";

/* ─────────────────────────────────────────────────────────
 * HOME DETAILS — the intake form Hera shows when the file is
 * missing something a feature needs. Only sections with a
 * missing field for that goal appear; known values are pre-filled.
 * ───────────────────────────────────────────────────────── */

type Value = string | boolean | undefined;
type Values = Record<string, Value>;

const inputCls =
  "h-9 w-full rounded-[8px] bg-field px-3 text-[13px] text-ink shadow-hairline outline-none transition-[box-shadow] duration-150 placeholder:text-ink-3 focus:shadow-[0_0_0_2px_var(--accent)]";

function initialValues(profile: Profile | null): Values {
  const out: Values = {};
  for (const f of FIELDS) {
    const source = f.scope === "person" ? profile?.person : f.scope === "property" ? profile?.property : profile?.policy;
    const v = (source as Record<string, unknown> | null | undefined)?.[f.key];
    if (isBlank(v)) continue;
    out[f.key] = typeof v === "boolean" ? v : String(v);
  }
  return out;
}

function toPatch(values: Values, fields: Field[]): ProfilePatch {
  const patch: Record<"person" | "property" | "policy", Record<string, unknown>> = { person: {}, property: {}, policy: {} };
  for (const f of fields) {
    const v = values[f.key];
    if (isBlank(v)) continue;
    const numeric = f.type === "number" || f.key === "claimsLast5Years";
    patch[f.scope][f.key] = typeof v === "boolean" ? v : numeric ? Number(String(v).replace(/[^\d.]/g, "")) : String(v).trim();
  }
  return patch as ProfilePatch;
}

function FieldInput({ field, value, onChange }: { field: Field; value: Value; onChange: (v: Value) => void }) {
  if (field.type === "bool") {
    return (
      <div className="flex rounded-[8px] bg-field p-0.5 shadow-hairline">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(value === option ? undefined : option)}
            className={`h-8 flex-1 rounded-[6px] text-[12.5px] font-medium transition-colors duration-100 ${
              value === option ? "bg-surface text-ink shadow-hairline" : "text-ink-3 hover:text-ink"
            }`}
          >
            {option ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="relative">
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} className={`${inputCls} appearance-none pr-8`}>
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    );
  }
  return (
    <input
      type={field.type === "number" ? "text" : field.type}
      inputMode={field.type === "number" ? "numeric" : undefined}
      value={typeof value === "string" ? value : ""}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

export default function HomeDetailsCard({
  goal,
  reason,
  profile,
  saved,
  onSave,
}: {
  goal: Feature;
  reason?: string;
  profile: Profile | null;
  /** labels saved once the form was submitted (collapses the card) */
  saved: string[] | null;
  onSave: (patch: ProfilePatch) => Promise<void>;
}) {
  // decided once, when the card opens, so the form doesn't shift while it's being filled
  const [sections] = useState(() => sectionsNeeded(profile, goal));
  const steps = useMemo(() => SECTIONS.filter((s) => sections.includes(s.id)), [sections]);
  const [values, setValues] = useState<Values>(() => initialValues(profile));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (saved) {
    return (
      <div className="flex flex-wrap items-center gap-1.5" style={fadeUp}>
        <Chip tone="green">
          <Glyph d={ICONS.check} size={11} stroke={3} /> Saved to your file
        </Chip>
        {saved.slice(0, 6).map((label) => (
          <Chip key={label}>{label}</Chip>
        ))}
        {saved.length > 6 && <span className="text-[11.5px] text-ink-3">+{saved.length - 6} more</span>}
      </div>
    );
  }

  const current = steps[step];
  const fields = FIELDS.filter((f) => f.section === current?.id);
  const isLast = step === steps.length - 1;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(toPatch(values, FIELDS.filter((f) => sections.includes(f.section))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp}>
      <div className="px-4 pt-4">
        <CardTitle icon={ICONS.home} title="A few details about your home" sub={reason ?? "So Hera can act for you."} />
        {steps.length > 1 && (
          <div className="mt-4 flex gap-1 rounded-[9px] bg-field p-0.5 shadow-hairline">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`h-7 flex-1 rounded-[7px] text-[12.5px] font-medium transition-colors duration-100 ${
                  i === step ? "bg-surface text-ink shadow-hairline" : "text-ink-3 hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3" key={current?.id} style={{ animation: "fade-in 200ms ease both" }}>
        <div className="mb-3 text-[12px] text-ink-3">{current?.blurb}</div>
        <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.key} className="block min-w-0">
              <span className="mb-1 flex items-baseline justify-between gap-2 text-[12px] font-medium text-ink-2">
                {f.label}
                {f.hint && <span className="truncate text-[11px] font-normal text-ink-3">{f.hint}</span>}
              </span>
              <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))} />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-inset px-4 py-3">
        <span className="text-[12px] text-ink-3">{error ?? (steps.length > 1 ? `${step + 1} of ${steps.length}` : "Skip anything you're not sure about")}</span>
        <div className="flex gap-2">
          {step > 0 && (
            <Button size="sm" variant="quiet" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {isLast ? (
            <Button size="sm" variant="primary" disabled={saving} onClick={submit}>
              {saving ? "Saving…" : "Save to my file"}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
