"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CardTitle, Chip, Glyph, ICONS, fadeUp, money } from "@/components/hera/ui";
import { notifyProfileChanged } from "@/components/hera/useProfile";
import LoadingState from "@/components/primitives/LoadingState";
import { inventoryReview } from "@/lib/hera/features/claim/review";
import type { Claim, InventoryItem, Photo } from "@/lib/hera/features/claim/store";
import type { Profile } from "@/lib/hera/profile";
import type { RenderContext } from "../types";

const field = "h-9 w-full rounded-[8px] bg-field px-3 text-[13px] text-ink shadow-hairline outline-none focus:ring-2 focus:ring-accent";
const rooms = ["Basement", "Living room", "Bedroom", "Kitchen", "Garage", "Other"];
const reminders: Record<string, string[]> = {
  Basement: ["Stored clothing", "Tools", "Holiday decorations", "Books"],
  "Living room": ["Rugs", "Game consoles", "Books", "Curtains"],
  Bedroom: ["Clothing", "Bedding", "Shoes", "Jewellery"],
};

async function edit(body: Record<string, unknown>) {
  const response = await fetch("/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(typeof result.error === "string" ? result.error : "Couldn't save. Please try again.");
  }
  notifyProfileChanged();
}

async function resize(file: File, max: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't read that image. Try a JPEG or PNG."));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ItemReview({ item, photos, disabled, onReceipt, onError }: {
  item: InventoryItem; photos: Photo[]; disabled: boolean;
  onReceipt: (id: string) => void; onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState({ name: item.name, room: item.room, cost: String(item.cost), notes: item.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const photo = photos.find((photo) => photo.id === item.photoId);
  const receiptPhoto = photos.find((photo) => photo.id === item.receipt?.photoId);
  const confirmed = item.confirmed && item.evidence !== "sample";
  const save = async (confirm: boolean) => {
    setSaving(true);
    try {
      await edit({ op: "update_item", id: item.id, ...draft, cost: Number(draft.cost.replace(/[$,]/g, "")), confirmed: confirm });
      setEditing(!confirm);
    } catch (error) { onError(error instanceof Error ? error.message : "Couldn't save this item."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    setSaving(true);
    try { await edit({ op: "remove_item", id: item.id }); }
    catch (error) { onError(error instanceof Error ? error.message : "Couldn't remove this item."); }
    finally { setSaving(false); }
  };
  return <li className="rounded-[12px] bg-surface p-3 shadow-hairline">
    <div className="flex items-start gap-3">
      {photo ? <details className="shrink-0">
        <summary className="cursor-pointer list-none" aria-label={`View source photo for ${item.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumb} alt={`Source photo for ${item.name}`} className="size-12 rounded-[8px] object-cover" />
        </summary>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumb} alt={`Source photo for ${item.name}`} className="mt-2 w-36 rounded-[8px]" />
      </details> : <span className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-field text-ink-3"><Glyph d={ICONS.tag} size={18} /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-ink">{item.name}</span>
          <Chip tone={confirmed ? "green" : "orange"}>{confirmed ? "Confirmed" : "Needs your review"}</Chip>
        </div>
        <div className="mt-1 text-[11.5px] text-ink-3">{item.room} · {photo ? photo.kind === "before" ? "Before-loss photo" : "Room photo" : item.evidence === "sample" ? "Example item — remove and replace" : "Added by you"}</div>
      </div>
    </div>
    {!editing ? <div className="mt-3">
      <div className="flex items-center justify-between text-[12px]">
      <span className="text-ink-2">Replacement estimate <b className="ml-1 text-ink">{money(item.cost)}</b></span>
      <button type="button" disabled={disabled || saving} onClick={() => confirmed ? void save(false) : setEditing(true)} className="text-accent underline underline-offset-2">Edit details</button>
      </div>
      {item.notes && <p className="mt-2 text-[11.5px] text-ink-3">{item.notes}</p>}
      {!confirmed && <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="accent" disabled={disabled || saving || item.evidence === "sample"} onClick={() => void save(true)}>{saving ? "Saving…" : "Confirm lost or damaged"}</Button>
        <span className="text-[11px] text-ink-3">{item.valueSource === "you" ? "Your estimate" : "AI estimate · edit if needed"}</span>
      </div>}
    </div> : <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void save(true); }}>
      <div className="grid gap-2 sm:grid-cols-[1fr_135px]">
        <label className="text-[11.5px] text-ink-2">Belonging<input required maxLength={80} className={`${field} mt-1`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="text-[11.5px] text-ink-2">Value · CAD<input required inputMode="decimal" className={`${field} mt-1 tabular-nums`} value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} /></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[135px_1fr]">
        <label className="text-[11.5px] text-ink-2">Room<input required maxLength={40} className={`${field} mt-1`} value={draft.room} onChange={(event) => setDraft({ ...draft, room: event.target.value })} /></label>
        <label className="text-[11.5px] text-ink-2">Details · optional<input maxLength={500} className={`${field} mt-1`} placeholder="Brand, age, or what happened to it" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div>
      <p className="text-[11.5px] leading-relaxed text-ink-3">{item.valueSource === "you" ? "Your estimate" : "AI estimate"} · cost to buy a similar item new, not a verified shop price. Edit it if needed.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant="accent" disabled={disabled || saving || item.evidence === "sample"}>{saving ? "Saving…" : "Confirm lost or damaged"}</Button>
        <span className="text-[11px] text-ink-3">Confirm the item, value, and any receipt details.</span>
      </div>
    </form>}
    {item.receipt && <div className="mt-3 rounded-[8px] bg-inset px-3 py-2 text-[11.5px] text-ink-2">
      <div className="font-medium">Receipt · {item.receipt.purchasePrice.toLocaleString("en-CA", { style: "currency", currency: "CAD" })} paid{item.receipt.merchant ? ` at ${item.receipt.merchant}` : ""}</div>
      <div className="mt-1 text-ink-3">{item.receipt.purchasedAt ? `${item.receipt.purchasedAt} · ` : ""}Purchase price is separate from today’s replacement estimate.</div>
      {receiptPhoto && <details className="mt-1"><summary className="cursor-pointer text-accent">View receipt</summary>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={receiptPhoto.thumb} alt={`Receipt for ${item.name}`} className="mt-2 max-h-72 rounded-[6px] object-contain" />
      </details>}
    </div>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-[11.5px]">
      <button type="button" disabled={disabled || saving} className="text-accent" onClick={() => onReceipt(item.id)}>{item.receipt ? "Replace receipt" : "Attach receipt"}</button>
      <button type="button" disabled={disabled || saving} className="text-ink-3 hover:text-ink" onClick={() => void remove()}>Remove item</button>
    </div>
  </li>;
}

export default function InventoryCard({ claim, photos, profile, ctx }: { claim: Claim; photos: Photo[]; profile: Profile | null; ctx: RenderContext }) {
  const [stage, setStage] = useState<"photos" | "review">(claim.inventory.length ? "review" : "photos");
  const [room, setRoom] = useState("Basement");
  const [customRoom, setCustomRoom] = useState("");
  const [kind, setKind] = useState<"before" | "after">("before");
  const [filter, setFilter] = useState("All rooms");
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState({ name: "", cost: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const receiptItem = useRef<string | null>(null);
  const review = inventoryReview(claim);
  const sourceRoom = room === "Other" ? customRoom.trim() : room;
  const locked = !!claim.proofOfLoss;
  const unavailable = busy || locked;
  const visible = claim.inventory.filter((item) => filter === "All rooms" || item.room === filter);
  const error = (text: string) => setNotice({ text, error: true });

  const upload = async (files: FileList | null, receipt = false) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    if (list.length > (receipt ? 1 : 4)) { error(receipt ? "Choose one receipt image." : "Choose up to 4 photos at a time. You can add more afterwards."); return; }
    if (list.some((file) => !file.type.startsWith("image/"))) { error("Choose image files. A photo or screenshot works for receipts."); return; }
    if (!sourceRoom && !receipt) { error("Name the room first."); return; }
    setBusy(true);
    setNotice(null);
    const selected = claim.inventory.find((item) => item.id === receiptItem.current);
    try {
      const images = await Promise.all(list.map((file) => resize(file, receipt ? 1600 : 1024, 0.8)));
      const thumbs = await Promise.all(list.map((file) => resize(file, receipt ? 700 : 320, 0.65)));
      const response = await fetch("/api/claim/photos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: receipt ? selected?.room ?? sourceRoom : sourceRoom, kind: receipt ? "receipt" : kind, itemId: receipt ? receiptItem.current : undefined, images, thumbs }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn't analyze those images.");
      notifyProfileChanged();
      setStage("review");
      setFilter("All rooms");
      setNotice({ text: receipt ? "Receipt attached. Check the purchase details and confirm the item again." : result.added ? `Found ${result.added} belonging${result.added === 1 ? "" : "s"}. Check each item and its estimate below.` : "No identifiable belongings found. Try a clearer room photo or add an item manually." });
    } catch (failure) { error(failure instanceof Error ? failure.message : "Couldn't analyze those images."); }
    finally {
      setBusy(false);
      if (photoInput.current) photoInput.current.value = "";
      if (receiptInput.current) receiptInput.current.value = "";
    }
  };

  return <section className="max-w-[620px] overflow-hidden rounded-card bg-surface shadow-card" style={fadeUp} aria-label="Build your belongings claim">
    <div className="p-5 pb-4">
      <CardTitle icon={ICONS.tag} title="Your photos. Your belongings." sub="You don’t have to remember everything. Start with photos you already have — Hera will help rebuild the list." />
      <ol className="mt-5 grid grid-cols-3 gap-3 text-[11.5px]">
        {["Choose photos", "Review belongings", "Prepare claim"].map((label, index) => <li key={label} aria-current={(stage === "photos" ? 0 : 1) === index ? "step" : undefined} className={(stage === "photos" ? 0 : 1) === index ? "text-accent" : "text-ink-3"}>
          <div className={`mb-2 h-1 rounded-full ${index === 0 || (index === 1 && stage === "review") ? "bg-accent" : "bg-field"}`} />{index + 1}. {label}
        </li>)}
      </ol>
    </div>

    {!locked && <div className="border-t border-line px-5 py-4">
      {stage === "review" && <button type="button" disabled={busy} className="mb-3 text-[12px] text-accent" onClick={() => setStage("photos")}>+ Add more photos</button>}
      {stage === "photos" && <div>
        <div className="mb-3 text-[13px] font-medium text-ink">Start with one room</div>
        <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
          <label className="text-[11.5px] text-ink-2">Room<select className={`${field} mt-1`} value={room} disabled={busy} onChange={(event) => setRoom(event.target.value)}>{rooms.map((name) => <option key={name}>{name}</option>)}</select></label>
          <fieldset disabled={busy} className="min-w-0"><legend className="text-[11.5px] text-ink-2">When were these taken?</legend>
            <div className="mt-1 flex min-h-9 flex-wrap gap-3 text-[12px] text-ink-2">{(["before", "after"] as const).map((value) => <label key={value} className="flex items-center gap-1.5"><input type="radio" name="photo-timing" checked={kind === value} onChange={() => setKind(value)} className="accent-[var(--accent)]" />{value === "before" ? "Before the loss" : "After the loss"}</label>)}</div>
          </fieldset>
        </div>
        {room === "Other" && <input aria-label="Room name" maxLength={40} className={`${field} mt-2`} placeholder="e.g. Home office" value={customRoom} onChange={(event) => setCustomRoom(event.target.value)} />}
        <div className="mt-4 rounded-[12px] border border-dashed border-line-strong bg-inset px-5 py-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-[12px] bg-accent-tint text-accent"><Glyph d={ICONS.upload} size={20} /></div>
          <p className="text-[13px] font-medium text-ink">Everyday photos can help tell the story</p>
          <p className="mx-auto mt-1.5 max-w-96 text-[12px] leading-relaxed text-ink-3">{kind === "before" ? "A birthday, a family dinner, a corner of the room. Hera looks for belongings in the background, too." : "Choose room photos showing belongings after the damage. Close-ups help identify details."}</p>
          <Button className="mt-4" variant="accent" disabled={unavailable || !sourceRoom} onClick={() => photoInput.current?.click()}><Glyph d={ICONS.upload} size={14} />Choose from your photos</Button>
          <p className="mt-2 text-[11px] text-ink-3">Up to 4 images at a time · only photos you choose are analyzed</p>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">Hera identifies belongings and estimates replacement costs in CAD. You confirm what was actually lost or damaged.</p>
        {claim.inventory.length > 0 && <button type="button" className="mt-3 text-[12px] text-accent" onClick={() => setStage("review")}>Return to {claim.inventory.length} belongings →</button>}
      </div>}
      <input ref={photoInput} type="file" accept="image/*" multiple hidden aria-label="Choose room photos" onChange={(event) => void upload(event.target.files)} />
      <input ref={receiptInput} type="file" accept="image/*" hidden aria-label="Choose receipt image" onChange={(event) => void upload(event.target.files, true)} />
      {busy && <div className="mt-3" role="status"><LoadingState variant="Dots" label="Reading your photos and looking for details" /></div>}
      {notice && <p role={notice.error ? "alert" : "status"} className={`mt-3 text-[12px] leading-relaxed ${notice.error ? "text-orange" : "text-ink-2"}`}>{notice.text}</p>}
    </div>}

    {(stage === "review" || locked) && claim.inventory.length > 0 && <div className="border-t border-line bg-inset px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-[13px] font-medium text-ink">Review your belongings</h3><p className="mt-1 text-[11.5px] text-ink-3">{review.confirmed} of {claim.inventory.length} confirmed · remove duplicates or items you didn’t lose.</p></div>
        <select aria-label="Filter belongings by room" className={`${field} !w-auto`} value={filter} onChange={(event) => setFilter(event.target.value)}>{["All rooms", ...new Set(claim.inventory.map((item) => item.room))].map((name) => <option key={name}>{name}</option>)}</select>
      </div>
      <ul className="space-y-3">{visible.map((item) => <ItemReview key={item.id} item={item} photos={photos} disabled={unavailable} onError={error} onReceipt={(id) => { receiptItem.current = id; receiptInput.current?.click(); }} />)}</ul>
    </div>}

    {!locked && <div className="border-t border-line px-5 py-4">
      <button type="button" className="text-[12px] font-medium text-accent" aria-expanded={manual} onClick={() => setManual(!manual)}>{manual ? "−" : "+"} Add something the photos missed</button>
      {manual && <form className="mt-3 space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true); setNotice(null);
        try {
          await edit({ op: "add_item", name: draft.name.trim(), room: sourceRoom, cost: Number(draft.cost.replace(/[$,]/g, "")), evidence: "memory" });
          setDraft({ name: "", cost: "" }); setStage("review"); setFilter("All rooms");
        } catch (failure) { error(failure instanceof Error ? failure.message : "Couldn't add this belonging."); }
        finally { setBusy(false); }
      }}>
        <p className="text-[11.5px] text-ink-3">Anything else in {sourceRoom || "this room"}? {(reminders[sourceRoom] ?? ["Clothing", "Small electronics", "Stored belongings"]).join(", ")}. Only add what you lost.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <label className="text-[11.5px] text-ink-2">Belonging<input required maxLength={80} className={`${field} mt-1`} placeholder="e.g. Winter coat" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="text-[11.5px] text-ink-2">Value · CAD<input required inputMode="decimal" className={`${field} mt-1`} placeholder="e.g. 150" value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} /></label>
        </div>
        <label className="block text-[11.5px] text-ink-2">Room<input required maxLength={40} className={`${field} mt-1`} value={sourceRoom} onChange={(event) => { setRoom("Other"); setCustomRoom(event.target.value); }} /></label>
        <Button type="submit" size="sm" disabled={unavailable || !draft.name.trim() || !draft.cost.trim() || !sourceRoom}>Add lost or damaged item</Button>
      </form>}
    </div>}

    {claim.inventory.length > 0 && <div className="border-t border-line bg-inset px-5 py-4">
      <div className="flex items-baseline justify-between gap-3"><span className="text-[12px] text-ink-2">Draft replacement total</span><strong className="text-[20px] tabular-nums tracking-tight text-ink">{money(review.total)}</strong></div>
      <p className="mt-1 text-[11.5px] text-ink-3">{claim.contentsLimit ? `Contents limit in your policy: ${money(claim.contentsLimit)}` : "Your policy’s contents limit needs checking."} · before deductible</p>
      {claim.contentsLimit != null && review.total > claim.contentsLimit && <p className="mt-2 text-[12px] text-orange">Your estimate is above the contents limit. Review this with the adjuster.</p>}
      <details className="mt-3 text-[11.5px] text-ink-2"><summary className="cursor-pointer">How your policy fits this claim</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>{claim.insurer} · {claim.policyNumber ?? "Policy number not found"} · deductible: {money(claim.deductible)}</p>
          <p>{claim.settlementBasis === "actual_cash_value" ? "Your policy uses actual cash value, which accounts for depreciation. The replacement total above is a starting estimate; the payout may be lower." : claim.settlementBasis === "unknown" ? "The settlement basis wasn’t found in your policy. Keep the replacement estimates for the adjuster to review." : "Your policy lists replacement cost. Replacement requirements, limits and exclusions still apply."}</p>
          {(profile?.policy?.coverages ?? []).filter((coverage) => /water|flood|sewer|content|belonging|personal.property/i.test(`${coverage.key} ${coverage.name}`)).map((coverage) => <div key={coverage.key}><b>{coverage.name}</b> · {coverage.status.replaceAll("_", " ")}{coverage.limit ? ` · ${money(coverage.limit)}` : ""}<p>{coverage.note}</p>{coverage.clause && <p className="mt-1 border-l-2 border-line pl-2 text-ink-3">{coverage.clause}</p>}</div>)}
          <p>The water source and policy conditions affect coverage. This estimate is not a payout calculation.</p>
        </div>
      </details>
      {!locked && <div className="mt-4 border-t border-line pt-4">
        <Button variant="accent" disabled={unavailable || ctx.busy || !review.ready} onClick={() => ctx.sendText("My belongings inventory is reviewed. Show the living-expenses step so I can add costs or continue without them.")}>Continue to expenses <span aria-hidden="true">→</span></Button>
        <p className="mt-2 text-[11.5px] text-ink-3">{review.pending ? `Confirm or remove ${review.pending} remaining item${review.pending === 1 ? "" : "s"} to continue.` : review.ready ? "Next: optional hotel and meal costs, then your final review." : "Add belongings from photos or memory to get started."}</p>
      </div>}
    </div>}
  </section>;
}
