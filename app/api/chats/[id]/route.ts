import { connection } from "next/server";
import { getChat } from "@/lib/hera/chats";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const chat = getChat((await params).id);
  return chat ? Response.json(chat) : Response.json({ error: "Chat not found" }, { status: 404 });
}
