import type { ToolSet, UIMessage } from "ai";
import type { Profile } from "../profile";
import type { Feature } from "../profile-fields";

/*
 * A feature plugs into the agent with:
 *  - tools:        AI SDK tools (server tools have execute; client tools don't and are
 *                  answered in the UI with addToolOutput)
 *  - clientTools:  names of the tools above WITHOUT execute (the chat resumes after the
 *                  UI answers them)
 *  - instructions: a paragraph appended to Hera's system prompt
 *  - nextStep:     optional — after intake is complete, which tool to force next for
 *                  this goal (deterministic flow). Return null to let the model decide.
 */
export type FeatureModule = {
  id: Feature;
  tools: ToolSet;
  clientTools: string[];
  instructions: string;
  nextStep?: (ctx: { profile: Profile; history: UIMessage[]; calledThisTurn: string[] }) => string | null;
};

/** True if a tool already ran earlier in the conversation. */
export const seenTool = (history: UIMessage[], tool: string) => history.some((m) => m.parts.some((p) => p.type === `tool-${tool}`));
