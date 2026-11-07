import { mkdirSync } from "node:fs";
import path from "node:path";

/*
 * Local SQLite via Node's built-in driver (Node 22.13+): no native module to
 * compile, so the same node_modules works on every machine.
 *
 * households       — one row per family: person + property as JSON (partial, filled over time)
 * policies         — every policy Hera has read; the newest row is the current policy
 * documents        — the original policy PDFs (policy_id is null until read)
 * premium_history  — what they paid each term; ammunition for negotiating
 * feature_data     — JSON values per feature (see feature-store.ts)
 */

/* Minimal typings for the parts of node:sqlite we use. Loaded with
 * process.getBuiltinModule so neither the bundler nor @types/node need to know
 * about it (it ships with Node 22.13+). */
type SQLValue = string | number | bigint | null | Uint8Array;
type Statement = {
  run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SQLValue[]): unknown;
  all(...params: SQLValue[]): unknown[];
};
export type Database = { exec(sql: string): void; prepare(sql: string): Statement };
type SqliteModule = { DatabaseSync: new (file: string) => Database };

function loadSqlite(): SqliteModule {
  const mod = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule?.("node:sqlite");
  if (!mod) throw new Error("Hera needs Node.js 22.13 or newer (for the built-in node:sqlite module).");
  return mod as SqliteModule;
}

const DB_FILE = process.env.HERA_DB_PATH ?? path.join(process.cwd(), "data", "hera.db");

const MIGRATIONS = [
  `create table households (
     id         text primary key,
     person     text not null default '{}',
     property   text not null default '{}',
     created_at text not null default (datetime('now')),
     updated_at text not null default (datetime('now'))
   );
   create table policies (
     id             integer primary key autoincrement,
     household_id   text not null references households(id) on delete cascade,
     insurer        text not null,
     policy_number  text,
     period_start   text,
     period_end     text,
     annual_premium real,
     data           text not null,
     created_at     text not null default (datetime('now')),
     updated_at     text not null default (datetime('now'))
   );
   create index policies_by_household on policies(household_id, id desc);
   create table documents (
     id           integer primary key autoincrement,
     household_id text not null references households(id) on delete cascade,
     policy_id    integer references policies(id) on delete set null,
     filename     text not null,
     bytes        integer not null,
     content      blob not null,
     created_at   text not null default (datetime('now'))
   );
   create table premium_history (
     household_id text not null references households(id) on delete cascade,
     period_start text not null,
     amount       real not null,
     primary key (household_id, period_start)
   );`,
  // Free-form storage for features (quotes, claim inventory, drafts…) so they never need their own migration.
  `create table feature_data (
     household_id text not null references households(id) on delete cascade,
     feature      text not null,
     key          text not null,
     value        text not null,
     updated_at   text not null default (datetime('now')),
     primary key (household_id, feature, key)
   );`,
  `create table chats (
     id text primary key,
     household_id text not null references households(id) on delete cascade,
     title text not null default 'New chat',
     messages text not null default '[]',
     revision integer not null default 0,
     running integer not null default 0,
     created_at text not null,
     updated_at text not null
   );
   create index chats_by_household on chats(household_id, updated_at desc);`,
];

function open(): Database {
  mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(DB_FILE);
  db.exec("pragma journal_mode = wal; pragma foreign_keys = on;");
  migrate(db);
  return db;
}

function migrate(db: Database) {
  const { user_version: version } = db.prepare("pragma user_version").get() as { user_version: number };
  for (let v = version; v < MIGRATIONS.length; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v]);
      db.exec(`pragma user_version = ${v + 1}`);
    });
  }
}

export function transaction<T>(db: Database, fn: () => T): T {
  db.exec("begin");
  try {
    const result = fn();
    db.exec("commit");
    return result;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

/* One connection per server process; survives `next dev` hot reloads. */
const g = globalThis as unknown as { __heraDb?: Database };
let checkedMigrations = false;
export const db = () => {
  const connection = (g.__heraDb ??= open());
  // A dev hot reload can retain a connection opened before a new migration.
  if (!checkedMigrations) {
    migrate(connection);
    checkedMigrations = true;
  }
  return connection;
};
