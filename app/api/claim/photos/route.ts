import { z } from "zod";
import { identifyItems, readReceipt } from "@/lib/hera/features/claim/vision";
import { getClaim, getPhotos, saveClaim, savePhotos, uid, type Photo } from "@/lib/hera/features/claim/store";

export const maxDuration = 90;

const image = z.string().max(1_500_000).startsWith("data:image/jpeg;base64,");
const uploadSchema = z.object({
  room: z.string().trim().min(1).max(40),
  kind: z.enum(["before", "after", "receipt"]).default("before"),
  itemId: z.string().optional(),
  images: z.array(image).min(1).max(4),
  thumbs: z.array(image.max(120_000)).min(1).max(4),
}).refine((data) => data.images.length === data.thumbs.length && (data.kind !== "receipt" || (data.images.length === 1 && !!data.itemId)));

export async function POST(req: Request) {
  const parsed = uploadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose up to 4 readable photos, or one receipt image." }, { status: 400 });
  const { room, kind, images, thumbs, itemId } = parsed.data;
  const original = getClaim();
  if (!original) return Response.json({ error: "Start the claim first." }, { status: 400 });
  if (original.proofOfLoss) return Response.json({ error: "This claim has already been submitted." }, { status: 409 });
  const photos: Photo[] = images.map((_, i) => ({ id: uid(), room, kind, thumb: thumbs[i] }));

  if (kind === "receipt") {
    const item = original.inventory.find((item) => item.id === itemId);
    if (!item) return Response.json({ error: "Select a belonging before attaching its receipt." }, { status: 404 });
    const receipt = await readReceipt(images[0], item.name);
    if (!receipt) return Response.json({ error: "Receipt analysis is unavailable. Try again with a clear receipt photo." }, { status: 503 });
    if (!receipt.matched || receipt.purchasePrice == null || !Number.isFinite(receipt.purchasePrice) || receipt.purchasePrice <= 0 || receipt.purchasePrice > 1_000_000) {
      return Response.json({ error: "Couldn't read a matching CAD purchase amount. Try a clearer receipt or choose the correct belonging." }, { status: 422 });
    }
    // Re-read after model calls so unrelated edits made during analysis are preserved.
    const claim = getClaim();
    const current = claim?.inventory.find((item) => item.id === itemId);
    if (!claim || claim.proofOfLoss || !current || current.name !== item.name) return Response.json({ error: "The item changed during analysis. Please try again." }, { status: 409 });
    current.receipt = { photoId: photos[0].id, merchant: receipt.merchant, purchasedAt: receipt.purchasedAt, purchasePrice: Math.round(receipt.purchasePrice * 100) / 100 };
    current.evidence = "receipt";
    current.confirmed = false;
    savePhotos([...getPhotos(), ...photos]);
    saveClaim(claim);
    return Response.json({ added: 0, receipt: true });
  }

  const found = await identifyItems(images, room, kind, original.inventory.filter((item) => item.room === room).map((item) => item.name));
  if (!found) return Response.json({ error: "Photo analysis is unavailable. Your inventory hasn't changed. Try again or add a belonging manually." }, { status: 503 });
  const claim = getClaim();
  if (!claim || claim.proofOfLoss) return Response.json({ error: "The claim changed during analysis. Please try again." }, { status: 409 });
  claim.inventory.push(...found.items.map((item) => ({
    id: uid(), name: item.name, room,
    cost: Math.round(item.replacementCostCad),
    confidence: Math.max(0, Math.min(1, item.confidence)),
    evidence: "photo" as const, photoId: photos[item.imageIndex].id,
    confirmed: false, valueSource: "ai" as const,
  })));
  savePhotos([...getPhotos(), ...photos]);
  saveClaim(claim);
  return Response.json({ added: found.items.length, sample: false });
}
