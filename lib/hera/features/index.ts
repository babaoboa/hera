import type { ToolSet } from "ai";
import type { Feature } from "../profile-fields";
import { claim } from "./claim/agent";
import { negotiate } from "./negotiate/agent";
import { shop } from "./shop/agent";
import type { FeatureModule } from "./types";

/* The registry. Features live in their own folders; nothing else needs editing to add one. */
export const FEATURE_MODULES: Record<Feature, FeatureModule> = { shop, negotiate, claim };

export const featureTools: ToolSet = Object.assign({}, ...Object.values(FEATURE_MODULES).map((m) => m.tools));

export const featureInstructions = Object.values(FEATURE_MODULES)
  .map((m) => m.instructions.trim())
  .filter(Boolean)
  .join("\n\n");
