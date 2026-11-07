import { connection } from "next/server";
import { createChat, listChats } from "@/lib/hera/chats";

export async function GET() {
  await connection();
  return Response.json({ chats: listChats() });
}
export async function POST() {
  return Response.json(createChat(), { status: 201 });
}
