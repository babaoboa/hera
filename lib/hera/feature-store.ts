import { db } from "./db";
import { HOUSEHOLD } from "./profile";
import type { Feature } from "./profile-fields";

/* JSON values a feature keeps between turns (quotes found, claim inventory, email
 * drafts…). Cleared with the household when the user clears their file. */

export function getFeatureData<T>(feature: Feature, key: string, id = HOUSEHOLD): T | null {
  const row = db().prepare("select value from feature_data where household_id = ? and feature = ? and key = ?").get(id, feature, key) as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
}

export function setFeatureData<T>(feature: Feature, key: string, value: T, id = HOUSEHOLD): T {
  db().prepare("insert or ignore into households (id) values (?)").run(id);
  db()
    .prepare(
      `insert into feature_data (household_id, feature, key, value) values (?, ?, ?, ?)
       on conflict (household_id, feature, key) do update set value = excluded.value, updated_at = datetime('now')`,
    )
    .run(id, feature, key, JSON.stringify(value));
  return value;
}
