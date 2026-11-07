import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import { db } from "./db";
import { HOUSEHOLD } from "./profile";

export type ChatSummary = { id: string; title: string; createdAt: string; updatedAt: string; running: boolean };
export type SavedChat = ChatSummary & { messages: UIMessage[]; revision: number };
type Row = { id: string; title: string; created_at: string; updated_at: string; messages: string; revision: number; running: number };
const summary = (r: Row): ChatSummary => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at, running: !!r.running });

export function listChats(): ChatSummary[] {
  return (db().prepare("select id, title, created_at, updated_at, running from chats where household_id = ? order by updated_at desc, id").all(HOUSEHOLD) as Row[]).map(summary);
}
export function getChat(id: string): SavedChat | null {
  const r = db().prepare("select * from chats where id = ? and household_id = ?").get(id, HOUSEHOLD) as Row | undefined;
  return r ? { ...summary(r), messages: JSON.parse(r.messages), revision: r.revision } : null;
}
export function createChat(): SavedChat {
  db().prepare("insert or ignore into households (id) values (?)").run(HOUSEHOLD);
  const id = randomUUID();
  const now = new Date().toISOString();
  db().prepare("insert into chats (id, household_id, created_at, updated_at) values (?, ?, ?, ?)").run(id, HOUSEHOLD, now, now);
  return getChat(id)!;
}

/** Persist the user's turn before calling the model; reject simultaneous writers. */
export function beginChatTurn(chat: SavedChat, messages: UIMessage[]): number | null {
  const text = messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.text?.trim();
  const title = text ? text.slice(0, 60) + (text.length > 60 ? "…" : "") : chat.title;
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 180_000).toISOString();
  const result = db().prepare(`update chats set messages = ?, title = ?, revision = revision + 1, running = 1, updated_at = ?
    where id = ? and household_id = ? and revision = ? and (running = 0 or updated_at < ?)`)
    .run(JSON.stringify(messages), title, now, chat.id, HOUSEHOLD, chat.revision, stale);
  return Number(result.changes) ? chat.revision + 1 : null;
}
export function saveChatTurn(id: string, revision: number, messages: UIMessage[], finished = true) {
  db().prepare("update chats set messages = ?, running = ?, updated_at = ? where id = ? and household_id = ? and revision = ?")
    .run(JSON.stringify(messages), finished ? 0 : 1, new Date().toISOString(), id, HOUSEHOLD, revision);
}
