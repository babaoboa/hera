import { connection } from "next/server";
import { applyPatch, getProfile, resetHousehold } from "@/lib/hera/profile";
import { profilePatchSchema } from "@/lib/hera/profile-schema";

/** The household file, for the "Your file" pane. */
export async function GET() {
  await connection();
  return Response.json(getProfile());
}

/** Save answers from the intake form. */
export async function POST(req: Request) {
  const parsed = profilePatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  const saved = applyPatch(parsed.data);
  return Response.json({ saved, profile: getProfile() });
}

/** Start over (demo reset). */
export async function DELETE() {
  resetHousehold();
  return Response.json({ ok: true });
}
