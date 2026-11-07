"use client";

import { Fragment, type ReactNode } from "react";
import type { UIMessage } from "ai";
import LoadingState from "@/components/primitives/LoadingState";
import ThinkingState from "@/components/primitives/ThinkingState";
import CoverageCard from "@/components/hera/CoverageCard";
import HomeDetailsCard from "@/components/hera/HomeDetailsCard";
import PolicyUploadCard from "@/components/hera/PolicyUploadCard";
import { AgentStep, Chip, Glyph, ICONS, fadeUp } from "@/components/hera/ui";
import { renderFeaturePart } from "@/components/hera/features";
import type { ToolPart as FeatureToolPart } from "@/components/hera/features/types";
import type { Profile, StoredPolicy } from "@/lib/hera/profile";
import type { Feature } from "@/lib/hera/profile-fields";
import type { ProfilePatch } from "@/lib/hera/profile-schema";

/* Renders one chat message: user bubbles, assistant text, and an artifact per tool call. */

type Part = UIMessage["parts"][number];
type ToolPart = { toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string };

const asTool = (part: Part, name: string) => (part.type === `tool-${name}` ? (part as unknown as ToolPart) : null);
const done = (t: ToolPart) => t.state === "output-available";
const hasError = (o: unknown): o is { error: string } => typeof o === "object" && o !== null && "error" in o;

/** Minimal formatting for model text: paragraphs, "- " bullets and **bold**. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
        chunk.startsWith("**") && chunk.endsWith("**") ? (
          <strong key={i} className="font-medium text-ink">{chunk.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{chunk}</Fragment>
        ),
      )}
    </>
  );
}

function RichText({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="max-w-[620px] space-y-3 text-[13.5px] leading-[1.65] text-ink">
      {blocks.map((block, i) => {
        const last = i === blocks.length - 1;
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-•]\s/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ink-3">
              {lines.map((l, j) => (
                <li key={j}><Inline text={l.replace(/^\s*[-•]\s/, "")} /></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={block} />
            {last && streaming && <span className="stream-caret is-streaming" />}
          </p>
        );
      })}
    </div>
  );
}

export function UserMessage({ message }: { message: UIMessage }) {
  return (
    <div className="flex flex-col items-end gap-1.5 pl-10 sm:pl-24" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
      {message.parts.map((part, i) =>
        part.type === "file" ? (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-[12.5px] text-ink-2 shadow-hairline">
            <span className="flex size-6 items-center justify-center rounded-[6px] bg-red-tint text-red">
              <Glyph d={ICONS.file} size={13} />
            </span>
            {part.filename ?? "policy.pdf"}
          </div>
        ) : part.type === "text" && part.text ? (
          <div key={i} className="rounded-xl bg-field px-3.5 py-2 text-[13px] leading-relaxed text-ink shadow-hairline">{part.text}</div>
        ) : null,
      )}
    </div>
  );
}

export function AssistantMessage({
  message,
  streaming,
  busy,
  profile,
  onFiles,
  onSaveDetails,
  sendText,
  answer,
}: {
  message: UIMessage;
  streaming: boolean;
  busy: boolean;
  profile: Profile | null;
  onFiles: (files: FileList) => void;
  onSaveDetails: (toolCallId: string, patch: ProfilePatch) => Promise<void>;
  sendText: (text: string) => void;
  answer: (tool: string, toolCallId: string, output: unknown) => void;
}) {
  const featureCtx = { message, profile, busy, sendText, answer };
  const received = profile?.pendingDocument?.filename ?? profile?.policy?.documentName ?? (profile?.policy ? "on file" : null);
  const lastText = message.parts.findLastIndex((p) => p.type === "text");

  // Within a step the model may stream its sentence after the tool call; show words first, then the card.
  const ordered = message.parts
    .map((part, i) => ({ part, i }))
    .reduce<{ part: Part; i: number }[][]>((steps, entry) => {
      if (entry.part.type === "step-start" || steps.length === 0) steps.push([]);
      steps[steps.length - 1].push(entry);
      return steps;
    }, [])
    .flatMap((step) => [
      ...step.filter((e) => e.part.type === "reasoning"),
      ...step.filter((e) => e.part.type === "text"),
      ...step.filter((e) => e.part.type !== "text" && e.part.type !== "reasoning"),
    ]);

  const nodes: ReactNode[] = ordered.map(({ part, i }) => {
    if (part.type === "reasoning") {
      const thinking = streaming && part.state === "streaming";
      return part.text.trim() || thinking ? (
        <ThinkingState
          key={i}
          variant="Reasoning"
          streaming={thinking}
          done="Reasoning"
          rows={[{ primary: part.text }]}
        />
      ) : null;
    }
    if (part.type === "text") {
      return part.text.trim() ? <RichText key={i} text={part.text} streaming={streaming && i === lastText} /> : null;
    }

    let t: ToolPart | null;
    if ((t = asTool(part, "get_insurance_policy"))) {
      return <AgentStep key={i} icon={ICONS.folder} label={done(t) ? "Checked your file" : "Opening your file"} running={!done(t)} />;
    }
    if ((t = asTool(part, "add_insurance_policy"))) {
      const saved = done(t) ? ((t.output as { saved?: string[] })?.saved ?? []) : [];
      return (
        <AgentStep key={i} icon={ICONS.save} label={done(t) ? "Saved to your file" : "Saving to your file"} running={!done(t)}>
          {saved.map((s) => <Chip key={s}>{s}</Chip>)}
        </AgentStep>
      );
    }
    if ((t = asTool(part, "request_policy")) && done(t)) {
      return <PolicyUploadCard key={i} reason={(t.input as { reason?: string })?.reason} received={received} disabled={busy} onFiles={onFiles} />;
    }
    if ((t = asTool(part, "read_policy"))) {
      if (t.state === "output-error") return <AgentStep key={i} icon={ICONS.alert} tone="warn" label={`Couldn't read the policy — ${t.errorText}`} />;
      if (!done(t)) {
        return (
          <div key={i} className="flex min-h-6 items-center" style={fadeUp}>
            <LoadingState label="Reading your policy" variant="Dots" />
          </div>
        );
      }
      const out = t.output as { policy: StoredPolicy; prefilled: string[] } | { error: string };
      if (hasError(out)) return <AgentStep key={i} icon={ICONS.alert} tone="warn" label={out.error} />;
      return (
        <div key={i} className="space-y-3">
          <CoverageCard policy={out.policy} />
          {out.prefilled.length > 0 && (
            <AgentStep icon={ICONS.save} label="Filled in from your policy">
              {out.prefilled.map((s) => <Chip key={s}>{s}</Chip>)}
            </AgentStep>
          )}
        </div>
      );
    }
    if ((t = asTool(part, "ask_home_details"))) {
      if (t.state === "input-streaming") return null;
      const input = t.input as { goal: Feature; reason?: string };
      const saved = done(t) ? ((t.output as { saved?: string[] })?.saved ?? []) : null;
      const id = t.toolCallId;
      return <HomeDetailsCard key={i} goal={input.goal} reason={input.reason} profile={profile} saved={saved} onSave={(patch) => onSaveDetails(id, patch)} />;
    }
    if (part.type.startsWith("tool-")) return renderFeaturePart(part as unknown as FeatureToolPart, String(i), featureCtx) ?? null;
    return null;
  });

  return <article className="flex min-w-0 flex-col gap-4">{nodes}</article>;
}
