import { tool, type UIMessage } from "ai";
import { z } from "zod";
import { getProfile } from "@/lib/hera/profile";
import type { FeatureModule } from "../types";
import { seenTool } from "../types";
import { inventoryReview } from "./review";
import {
  buildClaim,
  claimNumber,
  claimSummary,
  confirmationNumber,
  getClaim,
  honesty,
  inventoryTotal,
  saveClaim,
  today,
  uid,
} from "./store";

/* claim feature — server side. Walks a flood claim the way Canadian insurers process it:
 * report the loss → protect & keep items → inventory → living expenses → proof of loss. */

type ConfirmAction = "submit_fnol" | "submit_proof_of_loss";

/** Every confirm_claim_action in the conversation, oldest first. */
function confirms(history: UIMessage[]) {
  return history.flatMap((m) =>
    m.parts.flatMap((p) => {
      if (p.type !== "tool-confirm_claim_action") return [];
      const part = p as { input?: { action?: ConfirmAction }; output?: { approved?: boolean }; state: string };
      return [{ action: part.input?.action, approved: part.state === "output-available" ? part.output?.approved === true : null }];
    }),
  );
}

const noClaim = { error: "There's no claim yet — call start_claim first." };

const tools = {
  start_claim: tool({
    description:
      "Open the flood claim in the user's file: date of loss, cause, the coverages and limits that apply, deductible, and real deadline dates from the policy. Returns a 'before you clean up' checklist. The UI shows a claim tracker card.",
    inputSchema: z.object({
      dateOfLoss: z.string().nullable().describe("YYYY-MM-DD only if the user said when it happened; otherwise null (today)"),
      cause: z.string().nullable().describe("e.g. 'Overland flood', 'Sewer backup'; null = overland flood"),
      livable: z.boolean().nullable().describe("Can they stay in the home? null if unknown"),
    }),
    execute: async (input) => {
      const profile = getProfile();
      if (!profile.policy) return { error: "No policy on file." };
      const existing = getClaim();
      if (existing && !existing.proofOfLoss) return { reopened: true, ...claimSummary(existing), checklist: existing.checklist };
      const claim = saveClaim(buildClaim(profile, input));
      return { ...claimSummary(claim), checklist: claim.checklist };
    },
  }),

  // No execute: the UI fills the insurer's form on screen and asks the user to approve.
  confirm_claim_action: tool({
    description:
      "Show the user the filled-in Birchwood Mutual form (first notice of loss, or sworn proof of loss) and ask them to approve submitting it. Nothing is submitted without approval.",
    inputSchema: z.object({
      action: z.enum(["submit_fnol", "submit_proof_of_loss"]),
      summary: z.string().describe("One short sentence on what will be submitted"),
    }),
  }),

  submit_first_notice: tool({
    description: "Submit the approved first notice of loss to the insurer (demo — simulated). Returns the claim number.",
    inputSchema: z.object({}),
    execute: async () => {
      const claim = getClaim();
      if (!claim) return noClaim;
      if (!claim.fnol) claim.fnol = { claimNumber: claimNumber(), submittedAt: new Date().toISOString() };
      saveClaim(claim);
      return {
        demo: true,
        claimNumber: claim.fnol.claimNumber,
        next: "An adjuster usually calls within 24–48 hours. Meanwhile: photos of every room, keep damaged items, keep receipts.",
      };
    },
  }),

  build_inventory: tool({
    description:
      "Show the photo-led belongings workflow: choose camera-roll photos from before or after the loss; identify belongings and estimate replacement costs; attach receipt images; review, edit and confirm each lost or damaged item; then continue to expenses and final review.",
    inputSchema: z.object({}),
    execute: async () => {
      const claim = getClaim();
      if (!claim) return noClaim;
      return { shown: true, items: claim.inventory.length, total: inventoryTotal(claim), contentsLimit: claim.contentsLimit };
    },
  }),

  log_expense: tool({
    description:
      "Log an additional living expense (hotel, meals, other) the user mentioned, or call with amount null just to show the living-expenses tracker card.",
    inputSchema: z.object({
      kind: z.enum(["hotel", "meals", "other"]).nullable(),
      label: z.string().nullable().describe("e.g. 'Hotel — 2 nights'"),
      amount: z.union([z.number(), z.string()]).nullable().describe("Total CAD as a number, e.g. 378"),
    }),
    execute: async ({ kind, label, amount: raw }) => {
      const amount = raw == null ? null : Number(String(raw).replace(/[$,\s]/g, "")) || null;
      const claim = getClaim();
      if (!claim) return noClaim;
      if (claim.proofOfLoss && amount) return { error: "This claim has already been submitted." };
      if (amount && amount > 0) {
        const k = kind ?? "other";
        claim.expenses.push({ id: uid(), kind: k, label: label?.trim() || { hotel: "Hotel", meals: "Meals", other: "Other expense" }[k], amount, date: today() });
        saveClaim(claim);
      }
      const used = claim.expenses.reduce((s, e) => s + e.amount, 0);
      return { logged: !!amount, used, limit: claim.aleLimit };
    },
  }),

  prepare_proof_of_loss: tool({
    description:
      "Build the honesty check before the sworn proof of loss: item count, totals, how many items are photo-backed vs from memory. Call when the inventory is done and the user wants to file proof of loss.",
    inputSchema: z.object({}),
    execute: async () => {
      const claim = getClaim();
      if (!claim) return noClaim;
      const review = inventoryReview(claim);
      if (!review.ready) return { error: review.pending ? `Review or remove the ${review.pending} unconfirmed belongings in your inventory first.` : "Add and confirm the belongings you lost before preparing the claim." };
      const deadline = claim.deadlines.find((d) => /proof/i.test(d.name));
      return { ...honesty(claim), deductible: claim.deductible, proofOfLossDue: deadline?.due ?? deadline?.detail ?? null };
    },
  }),

  submit_proof_of_loss: tool({
    description: "Submit the approved sworn proof of loss (demo — simulated). Returns a confirmation number.",
    inputSchema: z.object({}),
    execute: async () => {
      const claim = getClaim();
      if (!claim) return noClaim;
      if (!claim.fnol) return { error: "Approve the initial loss report first." };
      if (!inventoryReview(claim).ready) return { error: "Review and confirm every belonging before submitting." };
      if (!claim.proofOfLoss) {
        claim.proofOfLoss = { confirmation: confirmationNumber(), amount: honesty(claim).total, submittedAt: new Date().toISOString() };
        saveClaim(claim);
      }
      return {
        demo: true,
        claimNumber: claim.fnol?.claimNumber ?? null,
        confirmation: claim.proofOfLoss.confirmation,
        amount: claim.proofOfLoss.amount,
        next: "The adjuster reviews the proof of loss and inventory, may inspect the damaged items, then issues payment minus the deductible.",
      };
    },
  }),
};

export const claim: FeatureModule = {
  id: "claim",
  tools,
  clientTools: ["confirm_claim_action"],
  instructions: `CLAIM (flood, water, fire or other damage): once the file is ready, walk them through the claim in order — the app forces the first steps. Keep every claim message to 2–3 short sentences; the cards already show coverages, limits and deadlines, so don't list them again.
1. start_claim opens the claim and shows a tracker card with deadlines and a "before you clean up" checklist. In 2–3 sentences: be kind, name the one or two most urgent things (protect the home, keep damaged items, photos before cleanup).
2. confirm_claim_action with action "submit_fnol" fills Birchwood Mutual's "Report a claim" form on screen; say in one line that you've filled it from their file and it needs their OK.
3. After they approve, submit_first_notice records it — give them the claim number, then build_inventory opens the photo-led workflow. Explain: choose existing camera-roll photos, even everyday photos from before the loss; Hera finds belongings and estimates replacement costs in CAD; they review what was actually lost or damaged. Receipts can be attached as images to each belonging. A receipt shows original purchase price, not necessarily replacement value. Never assume everything visible is damaged. Never imply estimates are verified live retail prices or guaranteed payouts. The inventory card handles editing and confirmations; don't ask them to type an itemized list in chat.
4. Hotel, meals or other extra costs while they can't live at home → log_expense with the total as a number (e.g. 2 nights at $189 → 378). Only say an expense is logged after log_expense returns logged: true.
5. When they press Continue to expenses, call log_expense with amount null to show the optional expenses step, and pause for them to log costs or continue. Don't skip straight to proof of loss. When they press Review my claim, call prepare_proof_of_loss, then confirm_claim_action with action "submit_proof_of_loss". All belongings must be confirmed first. Keep the review calm and supportive: check the details and approve the statement. After approval, submit_proof_of_loss.
If they decline, let them return when ready. Never invent dollar amounts, limits or dates; use tool outputs. All submissions in this prototype are simulated and saved locally; do not claim external delivery or actual insurer acceptance. The presenter knows this, so don't add demo labels or repeat simulation disclaimers in the conversation.`,
  nextStep: ({ history, calledThisTurn }) => {
    const c = getClaim();
    if (!seenTool(history, "start_claim") && !calledThisTurn.includes("start_claim")) return "start_claim";
    if (!c) return null;
    const asked = confirms(history);
    const fnolAsk = asked.filter((a) => a.action === "submit_fnol").at(-1);
    if (!c.fnol && !fnolAsk && !calledThisTurn.includes("confirm_claim_action")) return "confirm_claim_action";
    if (!c.fnol && fnolAsk?.approved) return "submit_first_notice";
    if (c.fnol && !seenTool(history, "build_inventory") && !calledThisTurn.includes("build_inventory")) return "build_inventory";
    if (calledThisTurn.includes("prepare_proof_of_loss") && inventoryReview(c).ready && !calledThisTurn.includes("confirm_claim_action")) return "confirm_claim_action";
    const polAsk = asked.filter((a) => a.action === "submit_proof_of_loss").at(-1);
    if (!c.proofOfLoss && polAsk?.approved) return "submit_proof_of_loss";
    return null;
  },
};
