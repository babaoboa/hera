const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '..', request.slice(2)) : request, ...args);
};
const dir = mkdtempSync(path.join(tmpdir(), 'hera-claim-test-'));
process.env.HERA_DB_PATH = path.join(dir, 'test.db');
let found = null;
let receipt = null;
let analyze;
const visionPath = require.resolve('../lib/hera/features/claim/vision.ts');
require.cache[visionPath] = { id: visionPath, filename: visionPath, loaded: true, exports: {
  identifyItems: async (...args) => { analyze?.(...args); return found; },
  readReceipt: async () => receipt,
} };
const { getProfile, resetHousehold } = require('../lib/hera/profile.ts');
const { saveClaim, getClaim, getPhotos } = require('../lib/hera/features/claim/store.ts');
const { inventoryReview } = require('../lib/hera/features/claim/review.ts');
const { POST: upload } = require('../app/api/claim/photos/route.ts');
const { POST: edit } = require('../app/api/claim/route.ts');
const { claim: feature } = require('../lib/hera/features/claim/agent.ts');
const item = { id: 'sofa', name: 'Grey sofa', room: 'Basement', cost: 1200, confidence: .9, evidence: 'photo', confirmed: false, valueSource: 'ai' };
const base = { dateOfLoss: '2026-11-07', cause: 'Overland flood', livable: false, insurer: 'Test insurer', policyNumber: 'test', deductible: 2500, settlementBasis: 'replacement_cost', coverages: [], contentsLimit: 50000, aleLimit: 10000, deadlines: [], checklist: [], fnol: { claimNumber: 'TEST', submittedAt: '2026-11-07' }, inventory: [], inventorySample: false, expenses: [], proofOfLoss: null };
const jpeg = 'data:image/jpeg;base64,aGVsbG8=';
const request = (body) => new Request('http://localhost/api/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const photoRequest = (extra = {}) => request({ room: 'Basement', kind: 'before', images: [jpeg], thumbs: [jpeg], ...extra });
beforeEach(() => { resetHousehold(); getProfile(); saveClaim(structuredClone(base)); found = null; receipt = null; analyze = null; });
after(() => { globalThis.__heraDb?.close(); rmSync(dir, { recursive: true, force: true }); });

test('failed photo analysis leaves the inventory untouched instead of inventing belongings', async () => {
  assert.equal((await upload(photoRequest())).status, 503);
  assert.deepEqual(getClaim().inventory, []);
  assert.deepEqual(getPhotos(), []);
});
test('before-loss context and the actual source-photo index are preserved; items need review', async () => {
  found = { model: 'test', items: [{ name: 'TV', replacementCostCad: 900, confidence: .8, imageIndex: 1 }] };
  analyze = (images, room, kind) => { assert.equal(images.length, 2); assert.equal(room, 'Basement'); assert.equal(kind, 'before'); };
  assert.equal((await upload(photoRequest({ images: [jpeg, jpeg], thumbs: [jpeg, jpeg] }))).status, 200);
  const saved = getClaim().inventory[0];
  assert.equal(saved.photoId, getPhotos()[1].id);
  assert.equal(getPhotos()[1].kind, 'before');
  assert.equal(saved.confirmed, false);
  assert.equal(inventoryReview(getClaim()).ready, false);
});
test('edits made during a model call survive the upload', async () => {
  found = { model: 'test', items: [{ name: 'TV', replacementCostCad: 900, confidence: .8, imageIndex: 0 }] };
  analyze = () => { const claim = getClaim(); claim.expenses.push({ id: 'hotel', kind: 'hotel', amount: 200, label: 'Hotel', date: '2026-11-07' }); saveClaim(claim); };
  await upload(photoRequest());
  assert.equal(getClaim().expenses[0].amount, 200);
});
test('receipts keep purchase price separate and reopen item confirmation', async () => {
  saveClaim({ ...base, inventory: [{ ...item, confirmed: true }] });
  receipt = { matched: true, merchant: 'Furniture shop', purchasedAt: '2024-02-10', purchasePrice: 749.99 };
  assert.equal((await upload(photoRequest({ kind: 'receipt', itemId: item.id }))).status, 200);
  const saved = getClaim().inventory[0];
  assert.equal(saved.cost, 1200);
  assert.equal(saved.receipt.purchasePrice, 749.99);
  assert.equal(saved.confirmed, false);
  assert.equal(saved.evidence, 'receipt');
  assert.equal(saved.receipt.photoId, getPhotos()[0].id);
});
test('unmatched receipts and invalid uploads never change the claim', async () => {
  saveClaim({ ...base, inventory: [item] });
  receipt = { matched: false, merchant: null, purchasedAt: null, purchasePrice: null };
  assert.equal((await upload(photoRequest({ kind: 'receipt', itemId: item.id }))).status, 422);
  assert.equal((await upload(photoRequest({ thumbs: [] }))).status, 400);
  assert.equal((await upload(photoRequest({ images: Array(5).fill(jpeg), thumbs: Array(5).fill(jpeg) }))).status, 400);
  assert.equal(getClaim().inventory[0].receipt, undefined);
});
test('review allows editing estimates and blocks unconfirmed or example items from proof of loss', async () => {
  saveClaim({ ...base, inventory: [item] });
  assert.ok((await feature.tools.prepare_proof_of_loss.execute({})).error);
  assert.ok((await feature.tools.submit_proof_of_loss.execute({})).error);
  const update = { op: 'update_item', id: item.id, name: 'Grey sofa', room: 'Basement', cost: 1350.25, notes: 'Three years old, water damaged', confirmed: true };
  assert.equal((await edit(request(update))).status, 200);
  assert.equal(getClaim().inventory[0].cost, 1350.25);
  assert.equal(getClaim().inventory[0].valueSource, 'you');
  assert.equal(inventoryReview(getClaim()).ready, true);
  assert.equal((await feature.tools.prepare_proof_of_loss.execute({})).contentsTotal, 1350.25);
  assert.equal((await feature.tools.submit_proof_of_loss.execute({})).amount, 1350.25);
  assert.equal((await edit(request({ ...update, cost: 100 }))).status, 409);
  assert.equal((await upload(photoRequest())).status, 409);
  saveClaim({ ...base, inventory: [{ ...item, evidence: 'sample', confirmed: true }] });
  assert.equal(inventoryReview(getClaim()).ready, false);
  assert.equal((await edit(request(update))).status, 400);
});
test('manually added belongings require a positive value and cannot invent receipt evidence', async () => {
  const data = { op: 'add_item', name: 'Coat', room: 'Bedroom', cost: 0, evidence: 'memory' };
  assert.equal((await edit(request(data))).status, 400);
  assert.equal((await edit(request({ ...data, cost: 150, evidence: 'receipt' }))).status, 200);
  assert.equal(getClaim().inventory[0].evidence, 'memory');
  assert.equal(getClaim().inventory[0].confirmed, true);
  assert.equal((await edit(request({ op: 'set_evidence', id: getClaim().inventory[0].id, evidence: 'receipt' }))).status, 400);
});

test('claims use the stated peril deductible rather than the general deductible or coverage limit', () => {
  const { buildClaim } = require('../lib/hera/features/claim/store.ts');
  const profile = { property: {}, policy: { insurer: 'Birchwood Mutual', deductible: 1000, settlementBasis: 'replacement_cost', deadlines: [], coverages: [
    { key: 'water_overland_flood', name: 'Overland Water', status: 'covered', limit: 50000, note: 'Deductible $2,500', clause: '$50,000 / $2,500 deductible' },
    { key: 'water_sewer_backup', name: 'Sewer backup', status: 'covered', limit: 10000, note: '', clause: '$10,000 sub-limit / $750 deductible' },
  ] } };
  assert.equal(buildClaim(profile, {cause:'Overland flood'}).deductible, 2500);
  assert.equal(buildClaim(profile, {cause:'Sewer backup'}).deductible, 750);
  assert.equal(buildClaim(profile, {cause:'Burst pipe'}).deductible, 1000);
  profile.policy.coverages[0].note = 'Up to $50,000';
  profile.policy.coverages[0].clause = null;
  assert.equal(buildClaim(profile, {cause:'Overland flood'}).deductible, 1000);
});
