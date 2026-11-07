"use client";

import type { Profile } from "@/lib/hera/profile";
import { ClaimPane, renderClaim } from "./claim/render";
import { NegotiatePane, renderNegotiate } from "./negotiate/render";
import { ShopPane, renderShop } from "./shop/render";
import type { RenderContext, ToolPart } from "./types";

const RENDERERS = [renderShop, renderNegotiate, renderClaim];
const PANES = [ShopPane, NegotiatePane, ClaimPane];

export function renderFeaturePart(part: ToolPart, key: string, ctx: RenderContext) {
  for (const render of RENDERERS) {
    const node = render(part, key, ctx);
    if (node !== undefined) return node;
  }
  return undefined;
}

export function FeaturePaneBlocks({ profile }: { profile: Profile }) {
  return (
    <>
      {PANES.map((Pane, i) => (
        <Pane key={i} profile={profile} />
      ))}
    </>
  );
}
