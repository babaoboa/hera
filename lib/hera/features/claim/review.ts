import type { Claim } from "./store";

/** Shared by the review UI and server tools so chat cannot skip item review. */
export function inventoryReview(claim: Claim) {
  const pending = claim.inventory.filter((item) => !item.confirmed || item.evidence === "sample");
  return {
    pending: pending.length,
    confirmed: claim.inventory.length - pending.length,
    ready: claim.inventory.length > 0 && pending.length === 0,
    total: claim.inventory.reduce((total, item) => total + item.cost, 0),
  };
}
