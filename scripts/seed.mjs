// Reset Hera's database to the demo household (Maya Patel, Birchwood Mutual). Needs `npm run dev` running.
//
//   npm run seed            home details + premium history; upload the policy live in the chat
//   npm run seed -- --full  also loads the demo policy, so every feature is ready right away
//
// Seeding goes through the running app so the database is only ever opened by one process.

const base = process.env.HERA_URL ?? "http://localhost:3000";
const full = process.argv.includes("--full");

const res = await fetch(`${base}/api/dev/seed${full ? "?full=1" : ""}`, { method: "POST" }).catch(() => null);
if (!res) {
  console.error(`Couldn't reach ${base}. Start the app with \`npm run dev\` first (or set HERA_URL).`);
  process.exit(1);
}
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Seed failed: ${body.error ?? res.statusText}`);
  process.exit(1);
}

const { person, property, policy, premiumHistory, readiness } = body.profile;
const money = (n) => `$${Number(n).toLocaleString("en-CA")}`;
console.log(`Seeded ${person.fullName} · ${property.street}, ${property.city}`);
console.log(`Premiums: ${premiumHistory.map((p) => `${p.periodStart.slice(0, 4)} ${money(p.amount)}`).join(" → ")}`);
console.log(policy ? `Policy: ${policy.insurer} ${policy.policyNumber} (loaded)` : "Policy: not loaded. Drop public/demo/birchwood-policy.pdf into the chat when Hera asks.");
for (const [feature, r] of Object.entries(readiness)) {
  console.log(`  ${feature.padEnd(10)} ${r.ready ? "ready" : `needs ${r.missing.join(", ")}`}`);
}
console.log("Refresh the browser to start from a clean chat.");
