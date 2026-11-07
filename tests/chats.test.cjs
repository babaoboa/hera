const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
// Run the real storage modules without adding a test runtime dependency.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const dir = mkdtempSync(path.join(tmpdir(), 'hera-chat-test-'));
process.env.HERA_DB_PATH = path.join(dir, 'test.db');
const { createChat, listChats, getChat, beginChatTurn, saveChatTurn } = require('../lib/hera/chats.ts');
const { resetHousehold } = require('../lib/hera/profile.ts');
after(() => { globalThis.__heraDb?.close(); rmSync(dir, { recursive: true, force: true }); });

test('independent chats persist messages, files and tool cards across a new process', () => {
  const a = createChat();
  const b = createChat();
  assert.notEqual(a.id, b.id);
  const user = { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Help with my policy' }, { type: 'file', mediaType: 'application/pdf', filename: 'policy.pdf', url: 'data:application/pdf;base64,JVBERg==' }] };
  const rev = beginChatTurn(a, [user]);
  assert.equal(rev, 1);
  const assistant = { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Here is your policy.' }, { type: 'tool-ask_home_details', toolCallId: 'form-1', state: 'input-available', input: { goal: 'claim' } }] };
  saveChatTurn(a.id, rev, [user, assistant]);
  assert.deepEqual(getChat(a.id).messages, [user, assistant]);
  assert.deepEqual(getChat(b.id).messages, []);
  assert.equal(getChat(a.id).title, 'Help with my policy');
  const child = spawnSync(process.execPath, ['-e', `const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.env.HERA_DB_PATH); console.log(db.prepare('select messages from chats where id = ?').get(${JSON.stringify(a.id)}).messages); db.close();`], { encoding: 'utf8', env: process.env });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), [user, assistant]);
});

test('concurrent requests and stale completion cannot overwrite a later turn', () => {
  const chat = createChat();
  const messages = [{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];
  const rev = beginChatTurn(chat, messages);
  assert.equal(beginChatTurn(chat, messages), null);
  assert.equal(beginChatTurn(getChat(chat.id), messages), null);
  saveChatTurn(chat.id, rev, messages);
  const next = beginChatTurn(getChat(chat.id), messages);
  saveChatTurn(chat.id, rev, []);
  assert.deepEqual(getChat(chat.id).messages, messages);
  saveChatTurn(chat.id, next, messages);
  assert.equal(getChat(chat.id).running, false);
});

test('client tool output replaces the existing assistant message on continuation', () => {
  const chat = createChat();
  const input = [{ id: 'a', role: 'assistant', parts: [{ type: 'tool-ask_home_details', toolCallId: 'form', state: 'input-available', input: { goal: 'claim' } }] }];
  const rev = beginChatTurn(chat, input);
  saveChatTurn(chat.id, rev, input);
  const answered = structuredClone(input);
  answered[0].parts[0].state = 'output-available';
  answered[0].parts[0].output = { submitted: true };
  const next = beginChatTurn(getChat(chat.id), answered);
  saveChatTurn(chat.id, next, answered);
  assert.deepEqual(getChat(chat.id).messages, answered);
  assert.equal(getChat(chat.id).messages.length, 1);
});

test('demo reset clears chat history along with the household', () => {
  assert.ok(listChats().length > 0);
  resetHousehold();
  assert.deepEqual(listChats(), []);
  assert.equal(createChat().messages.length, 0);
});
