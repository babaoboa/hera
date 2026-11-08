import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dbFile = path.join(process.cwd(), "data", "hera.seed.db");
mkdirSync(path.dirname(dbFile), { recursive: true });
rmSync(dbFile, { force: true });

const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
const db = new DatabaseSync(dbFile);
db.exec(`
  pragma journal_mode = delete;
  pragma foreign_keys = on;
  create table households (
    id text primary key,
    person text not null default '{}',
    property text not null default '{}',
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );
  create table policies (
    id integer primary key autoincrement,
    household_id text not null references households(id) on delete cascade,
    insurer text not null,
    policy_number text,
    period_start text,
    period_end text,
    annual_premium real,
    data text not null,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );
  create index policies_by_household on policies(household_id, id desc);
  create table documents (
    id integer primary key autoincrement,
    household_id text not null references households(id) on delete cascade,
    policy_id integer references policies(id) on delete set null,
    filename text not null,
    bytes integer not null,
    content blob not null,
    created_at text not null default (datetime('now'))
  );
  create table premium_history (
    household_id text not null references households(id) on delete cascade,
    period_start text not null,
    amount real not null,
    primary key (household_id, period_start)
  );
  create table feature_data (
    household_id text not null references households(id) on delete cascade,
    feature text not null,
    key text not null,
    value text not null,
    updated_at text not null default (datetime('now')),
    primary key (household_id, feature, key)
  );
  create table chats (
    id text primary key,
    household_id text not null references households(id) on delete cascade,
    title text not null default 'New chat',
    messages text not null default '[]',
    revision integer not null default 0,
    running integer not null default 0,
    created_at text not null,
    updated_at text not null
  );
  create index chats_by_household on chats(household_id, updated_at desc);
  pragma user_version = 3;
`);

const household = "demo-household";
db.prepare(`
  insert into households (id, person, property)
  values (?, ?, ?)
`).run(
  household,
  JSON.stringify({
    fullName: "Maya Patel",
    email: "maya.patel@example.com",
    phone: "613-555-0142",
    dateOfBirth: "1988-04-12",
    claimsLast5Years: 0,
  }),
  JSON.stringify({
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
  }),
);

const premium = db.prepare(`
  insert into premium_history (household_id, period_start, amount) values (?, ?, ?)
`);
for (const [periodStart, amount] of [["2023-03-15", 1480], ["2024-03-15", 1610], ["2025-03-15", 1705]]) {
  premium.run(household, periodStart, amount);
}

db.close();
console.log(`Seeded ${dbFile}`);
