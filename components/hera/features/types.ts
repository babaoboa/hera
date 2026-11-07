import type { ReactNode } from "react";
import type { UIMessage } from "ai";
import type { Profile } from "@/lib/hera/profile";

export type ToolPart = {
  type: string;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | (string & {});
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type RenderContext = {
  message: UIMessage;
  profile: Profile | null;
  /** Hera is still replying */
  busy: boolean;
  /** Send a user message (e.g. a follow-up button) */
  sendText: (text: string) => void;
  /** Answer a client tool (ask_* / confirm_*) — the chat resumes automatically */
  answer: (tool: string, toolCallId: string, output: unknown) => void;
};

/** Return a node for parts this feature owns, or undefined to pass. */
export type FeatureRenderer = (part: ToolPart, key: string, ctx: RenderContext) => ReactNode | undefined;

/** Optional block in the "Your file" pane. Return null when there's nothing to show. */
export type FeaturePane = (props: { profile: Profile }) => ReactNode;
