const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { detectFeature } = require('../lib/hera/profile-fields.ts');

const cases = [
  ['shopping suggestion', ['Find me better home insurance'], 'shop'],
  ['negotiation suggestion', ['Negotiate a lower rate on my policy'], 'negotiate'],
  ['flood suggestion', ['I just got into a flood'], 'claim'],
  ['broker is not broke', ['Negotiate with my broker'], 'negotiate'],
  ['no claims while shopping', ['Find better insurance; I have no claims'], 'shop'],
  ['quote with flood coverage', ['Compare quotes with flood coverage'], 'shop'],
  ['lower premium', ['Can you lower my insurance premium?'], 'negotiate'],
  ['claim request', ['Help with my claim'], 'claim'],
  ['new loss', ['My basement is flooded'], 'claim'],
  ['burst pipe', ['Our pipes have just burst'], 'claim'],
  ['negative loss', ['My basement is not flooded'], null],
  ['negative claim', ["I don't want to file a claim"], null],
  ['negative negotiation', ['Do not negotiate with my broker'], null],
  ['negated claim and new request', ["Don't file a claim, compare quotes instead"], 'shop'],
  ['explicit goal change', ['I just got into a flood', 'Actually, compare new insurance quotes'], 'shop'],
  ['switch to negotiation', ['Find better insurance', 'Negotiate with my broker instead'], 'negotiate'],
  ['switch to claim', ['Negotiate my rate', 'Now help with my claim'], 'claim'],
  ['same-message correction', ['File a claim; actually compare quotes instead'], 'shop'],
  ['neutral continuation', ['Compare quotes', "Here's my policy.", 'Yes'], 'shop'],
  ['claim-history follow-up', ['Find better insurance', 'I have no claims'], 'shop'],
  ['safety equipment follow-up', ['Negotiate my rate', 'I have water leak sensors and a fire alarm'], 'negotiate'],
  ['premium fact during claim', ['Help with my claim', 'My annual premium is 1200'], 'claim'],
  ['unrelated words', ['My broker is Bill. I live on Firefly Lane.'], null],
  ['unrelated find', ['Find my email address'], null],
  ['policy question', ['Does my policy include flood coverage?'], null],
  ['empty history', [], null],
];
for (const [name, texts, expected] of cases) {
  test(name, () => assert.equal(detectFeature(texts), expected));
}
