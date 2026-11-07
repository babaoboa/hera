/* Run the real photo + receipt routes in an isolated, temporary household.
 * Uses configured NVIDIA credentials; never edits the presenter's household. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const kit = path.join(root, 'output/claim-demo-kit');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hera-presentation-'));
process.env.HERA_DB_PATH = path.join(temp, 'verify.db');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args); };
const { getProfile } = require('../lib/hera/profile.ts');
const { buildClaim, saveClaim, getClaim, getPhotos } = require('../lib/hera/features/claim/store.ts');
const { POST: upload } = require('../app/api/claim/photos/route.ts');
const { POST: edit } = require('../app/api/claim/route.ts');
const { inventoryReview } = require('../lib/hera/features/claim/review.ts');
const request = (body) => new Request('http://localhost/api/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function image(file, max, quality) { return 'data:image/jpeg;base64,' + (await sharp(file).resize({width:max, height:max, fit:'inside', withoutEnlargement:true}).jpeg({quality}).toBuffer()).toString('base64'); }
async function send(body) { const response = await upload(request(body)); const out = await response.json(); if (!response.ok) throw new Error(out.error); return out; }
(async () => {
  try {
    const profile = getProfile();
    profile.policy = { insurer:'Birchwood Mutual', policyNumber:'BW-48213', deductible:2500, settlementBasis:'replacement_cost', deadlines:[{name:'Proof of loss',detail:'Within 90 days of the loss'}], coverages:[{key:'contents',name:'Personal property',status:'covered',limit:80000},{key:'overland_flood',name:'Overland Water',status:'limited',limit:50000},{key:'additional_living_expenses',name:'Living expenses',status:'covered',limit:30000}] };
    saveClaim(buildClaim(profile, {dateOfLoss:'2026-11-07',cause:'Overland flood',livable:false}));
    for (const [file,room] of [['01-living-room-before.jpg','Living room'],['02-home-office-before.jpg','Home office']]) {
      const filename = path.join(kit,'photos',file);
      const result = await send({room,kind:'before',images:[await image(filename,1024,80)],thumbs:[await image(filename,320,65)]});
      console.log(JSON.stringify({phase:'photo',file,added:result.added}));
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(kit,'receipts-manifest.json'),'utf8'));
    const patterns = [/sofa|couch/i,/coffee table/i,/monitor|computer display/i,/desktop.*(?:computer|tower|pc)|computer tower|gaming.*(?:pc|computer)/i];
    const receiptChecks = [];
    for (let index=0; index<manifest.length; index++) {
      const receipt = manifest[index];
      const item = getClaim().inventory.find(item=>item.room===receipt.room && patterns[index].test(item.name));
      if (!item) throw new Error('Missing target for '+receipt.file);
      const filename = path.join(kit,'receipts',receipt.file+'.jpg');
      await send({room:item.room,kind:'receipt',itemId:item.id,images:[await image(filename,1600,80)],thumbs:[await image(filename,700,65)]});
      const saved = getClaim().inventory.find(candidate=>candidate.id===item.id);
      if (saved.receipt.purchasePrice !== receipt.purchasePrice) throw new Error('Incorrect purchase price for '+receipt.file);
      receiptChecks.push({file:receipt.file+'.jpg',matchedItem:saved.name,purchasePrice:saved.receipt.purchasePrice,merchant:saved.receipt.merchant,purchasedAt:saved.receipt.purchasedAt,passed:true});
      console.log(JSON.stringify({phase:'receipt',...receiptChecks.at(-1)}));
    }
    for (const item of getClaim().inventory) {
      const response=await edit(request({op:'update_item',id:item.id,name:item.name,room:item.room,cost:item.cost,confirmed:true,notes:'Presentation scenario: reported lost in the flood.'}));
      if(!response.ok)throw new Error('Could not confirm '+item.name);
    }
    const claim=getClaim();
    const catalogue={checkedAt:new Date().toISOString(),mode:'Live model rehearsal in an isolated temporary household',prices:'Model-generated replacement estimates in CAD, not verified retailer quotes. Receipts are fictional purchases.',inventory:claim.inventory.map(({id,name,room,cost,confirmed,receipt})=>({id,name,room,replacementEstimateCad:cost,confirmed,receipt:receipt?{merchant:receipt.merchant,purchasedAt:receipt.purchasedAt,purchasePriceCad:receipt.purchasePrice}:null})),receipts:receiptChecks,review:inventoryReview(claim),photosStored:getPhotos().length};
    fs.writeFileSync(path.join(kit,'verified-catalogue.json'),JSON.stringify(catalogue,null,2)+'\n');
    console.log(JSON.stringify({phase:'complete',...catalogue.review,photosStored:catalogue.photosStored}));
  } finally { globalThis.__heraDb?.close(); fs.rmSync(temp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
