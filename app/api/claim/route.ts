import { connection } from "next/server";
import { z } from "zod";
import { getClaim, getPhotos, saveClaim, today, uid } from "@/lib/hera/features/claim/store";

/** The claim and its photo thumbnails, for the claim cards. */
export async function GET() {
  await connection();
  return Response.json({ claim: getClaim(), photos: getPhotos() });
}

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_item"),
    name: z.string().trim().min(1).max(80),
    room: z.string().trim().min(1).max(40),
    cost: z.number().finite().positive().max(1_000_000),
    evidence: z.enum(["memory", "receipt"]),
  }),
  z.object({
    op: z.literal("update_item"),
    id: z.string(),
    name: z.string().trim().min(1).max(80),
    room: z.string().trim().min(1).max(40),
    cost: z.number().finite().positive().max(1_000_000),
    confirmed: z.boolean(),
    notes: z.string().max(500).optional(),
  }),
  z.object({ op: z.literal("remove_item"), id: z.string() }),
  z.object({ op: z.literal("set_evidence"), id: z.string(), evidence: z.enum(["photo", "receipt", "memory"]) }),
  z.object({
    op: z.literal("add_expense"),
    kind: z.enum(["hotel", "meals", "other"]),
    label: z.string().max(80).optional(),
    amount: z.number().positive().max(100_000),
  }),
  z.object({ op: z.literal("remove_expense"), id: z.string() }),
]);

/** Edits made directly in the claim cards (adding items from memory, logging a hotel night…). */
export async function POST(req: Request) {
  const parsed = opSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const claim = getClaim();
  if (!claim) return Response.json({ error: "Start the claim first." }, { status: 400 });
  if (claim.proofOfLoss) return Response.json({ error: "This claim has already been submitted." }, { status: 409 });
  const op = parsed.data;
  if (op.op === "add_item") claim.inventory.push({ id: uid(), name: op.name, room: op.room, cost: Math.round(op.cost * 100) / 100, confidence: null, evidence: "memory", confirmed: true, valueSource: "you" });
  if (op.op === "update_item") {
    const item = claim.inventory.find((item) => item.id === op.id);
    if (!item) return Response.json({ error: "That item could not be found." }, { status: 404 });
    if (item.evidence === "sample" && op.confirmed) return Response.json({ error: "Remove sample items and add your own belongings." }, { status: 400 });
    if (item.cost !== op.cost) item.valueSource = "you";
    Object.assign(item, { name: op.name, room: op.room, cost: Math.round(op.cost * 100) / 100, confirmed: op.confirmed, notes: op.notes });
  }
  if (op.op === "remove_item") claim.inventory = claim.inventory.filter((i) => i.id !== op.id);
  if (op.op === "set_evidence") return Response.json({ error: "Attach a receipt instead of changing the evidence label." }, { status: 400 });
  if (op.op === "add_expense") {
    const label = op.label?.trim() || { hotel: "Hotel night", meals: "Meals", other: "Other expense" }[op.kind];
    claim.expenses.push({ id: uid(), kind: op.kind, label, amount: Math.round(op.amount * 100) / 100, date: today() });
  }
  if (op.op === "remove_expense") claim.expenses = claim.expenses.filter((e) => e.id !== op.id);
  saveClaim(claim);
  return Response.json({ claim });
}
