"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import LoadingState from "@/components/primitives/LoadingState";
import PromptBar from "@/components/primitives/PromptBar";
import { AssistantMessage, UserMessage } from "@/components/hera/Message";
import { Glyph, ICONS } from "@/components/hera/ui";
import { notifyProfileChanged } from "@/components/hera/useProfile";
import { DEMO_USER } from "@/lib/demo-user";
import { isClientTool } from "@/lib/hera/features/client-tools";
import type { Profile } from "@/lib/hera/profile";
import type { ProfilePatch } from "@/lib/hera/profile-schema";

const transport = new DefaultChatTransport({ api: "/api/chat" });

/* Resume the agent only after the user answers a client tool (ask_* / confirm_*).
 * Server tools already ran, so re-sending on them would loop. */
const answeredClientTool = ({ messages }: { messages: UIMessage[] }) => {
  const last = messages.at(-1)?.parts.at(-1) as { type?: string; state?: string } | undefined;
  return !!last?.type?.startsWith("tool-") && isClientTool(last.type.slice(5)) && last.state === "output-available";
};

/* Any finished tool call may have changed the file — the "Your file" pane refetches. */

export const SUGGESTIONS = [
  { id: "shop", label: "Find me better home insurance", icon: ICONS.search },
  { id: "negotiate", label: "Negotiate a lower rate on my policy", icon: ICONS.tag },
  { id: "claim", label: "I just got into a flood", icon: ICONS.wave },
] as const;

/* ── empty state — same entrance storyboard as the harness ── */

const REVEAL = { blur: 17, offsetY: 23, duration: 800, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
const REVEAL_AT = [170, 330, 400, 550];

function revealStyle(visible: boolean): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translate3d(0, 0, 0)" : `translate3d(0, ${REVEAL.offsetY}px, 0)`,
    filter: visible ? "blur(0px)" : `blur(${REVEAL.blur}px)`,
    transition: ["opacity", "transform", "filter"].map((p) => `${p} ${REVEAL.duration}ms ${REVEAL.easing}`).join(", "),
  };
}

function EmptyState({ name, onSend, onFiles }: { name: string; onSend: (text: string) => void; onFiles: (files: FileList) => void }) {
  const [stage, setStage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timers = REVEAL_AT.map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-[720px] flex-col justify-center px-4 py-10 sm:px-8">
      <h1 className="text-[26px] font-normal tracking-[-0.02em] text-zinc-900">
        <span className="home-reveal block text-zinc-700" style={revealStyle(stage >= 1)}>Hello {name}</span>
        <span className="home-reveal block" style={revealStyle(stage >= 2)}>What&apos;s going on with your home?</span>
      </h1>

      <div className="home-reveal relative mt-7 [--ink-3:var(--ink-2)]" style={revealStyle(stage >= 3)}>
        <PromptBar demo={false} tall placeholder="Ask Hera about your home insurance…" onSend={onSend} />
      </div>

      <div className="home-reveal mt-6 flex flex-col" style={revealStyle(stage >= 4)}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSend(s.label)}
            className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 text-left text-[14px] text-zinc-900 transition-colors duration-150 hover:bg-white/50 focus-visible:outline-zinc-900"
          >
            <span className="shrink-0 text-zinc-700"><Glyph d={s.icon} /></span>
            <span className="min-w-0">{s.label}</span>
          </button>
        ))}
        <div className="mt-1 flex items-center gap-5 pl-0.5 text-[13px] text-zinc-700">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 py-1 transition-colors duration-150 hover:text-zinc-900 focus-visible:outline-zinc-900">
            <Glyph d={ICONS.upload} size={14} />
            Upload your policy to get started
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/* ── one conversation ──────────────────────────────────────── */

export default function ChatThread({
  chatId,
  initialMessages,
  initiallyRunning,
  onSaved,
  hidden,
  profile,
  onTitle,
  onStarted,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  initiallyRunning: boolean;
  onSaved: () => Promise<void>;
  hidden: boolean;
  profile: Profile | null;
  onTitle: (chatId: string, title: string) => void;
  onStarted: (chatId: string) => void;
}) {
  const { messages, sendMessage, status, error, regenerate, addToolOutput, setMessages } = useChat({
    id: chatId,
    messages: initialMessages,
    onFinish: () => { void onSaved(); },
    transport,
    sendAutomaticallyWhen: answeredClientTool,
  });
  const [recovering, setRecovering] = useState(initiallyRunning);
  const busy = recovering || status === "submitted" || status === "streaming";
  useEffect(() => {
    if (!recovering) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`, { cache: "no-store" });
        if (!res.ok) return;
        const chat = await res.json();
        if (cancelled) return;
        setMessages(chat.messages);
        if (!chat.running || Date.now() - Date.parse(chat.updatedAt) > 180_000) {
          setRecovering(false);
          void onSaved();
        }
      } catch { /* retry on the next poll */ }
    }, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [chatId, recovering, setMessages, onSaved]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerH, setComposerH] = useState(150);
  const started = messages.length > 0;

  /* anything sent while Hera is still replying waits, then goes out once she's done */
  const queued = useRef<{ text: string; files?: FileList } | null>(null);
  const send = (message: { text: string; files?: FileList }) => {
    if (busy) queued.current = message;
    else void sendMessage(message);
  };
  const sendText = (text: string) => {
    if (text.trim()) send({ text });
  };
  const sendFiles = (files: FileList) => send({ text: "Here's my policy.", files });
  useEffect(() => {
    if (busy || !queued.current) return;
    const message = queued.current;
    queued.current = null;
    void sendMessage(message);
  }, [busy, sendMessage]);
  const answer = (tool: string, toolCallId: string, output: unknown) => {
    void addToolOutput({ tool, toolCallId, output } as Parameters<typeof addToolOutput>[0]);
  };
  const saveDetails = async (toolCallId: string, patch: ProfilePatch) => {
    const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) throw new Error("Couldn't save — check the highlighted fields.");
    const { saved, profile: updated } = (await res.json()) as { saved: string[]; profile: Profile };
    notifyProfileChanged();
    void addToolOutput({
      tool: "ask_home_details",
      toolCallId,
      output: { submitted: true, saved, readiness: updated.readiness },
    });
  };

  const firstText = messages[0]?.parts.find((p) => p.type === "text")?.text;
  useEffect(() => {
    if (started) onStarted(chatId);
    if (firstText) onTitle(chatId, firstText.length > 60 ? `${firstText.slice(0, 60)}…` : firstText);
  }, [started, firstText, chatId, onStarted, onTitle]);

  /* keep the "Your file" pane live as the agent saves things */
  const fileToolsDone = messages.reduce(
    (n, m) => n + m.parts.filter((p) => p.type.startsWith("tool-") && (p as { state?: string }).state === "output-available").length,
    0,
  );
  useEffect(() => {
    if (fileToolsDone > 0) notifyProfileChanged();
  }, [fileToolsDone]);
  useEffect(() => {
    if (status === "ready") notifyProfileChanged();
  }, [status]);

  /* composer floats over the thread; pad the thread by its height */
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const measure = () => setComposerH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [started]);

  /* follow growth while pinned to the bottom; scrolling up releases the pin */
  useEffect(() => {
    const el = scrollRef.current;
    const content = el?.firstElementChild;
    if (!started || !el || !content) return;
    let stick = true;
    let raf = 0;
    const onScroll = () => {
      stick = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    const pin = () => {
      if (!stick) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(pin);
    resize.observe(content);
    const mutate = new MutationObserver(pin);
    mutate.observe(content, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      resize.disconnect();
      mutate.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [started]);

  const firstName = profile?.person.fullName?.trim().split(/\s+/)[0] || DEMO_USER.name;
  let body: ReactNode;

  if (!started) {
    body = (
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'linear-gradient(rgb(255 255 255 / 72%), rgb(255 255 255 / 72%)), url("/home-background.png")' }}
      >
        <EmptyState name={firstName} onSend={sendText} onFiles={sendFiles} />
      </div>
    );
  } else {
    const last = messages.at(-1);
    body = (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-8 px-4 pt-8 sm:px-8 lg:px-12" style={{ paddingBottom: composerH + 16 }}>
            {messages.map((m) => (
              <div key={m.id} className="mx-auto w-full max-w-[720px]">
                {m.role === "user" ? (
                  <UserMessage message={m} />
                ) : (
                  <AssistantMessage
                    message={m}
                    streaming={status === "streaming" && m.id === last?.id}
                    busy={busy}
                    profile={profile}
                    onFiles={sendFiles}
                    onSaveDetails={saveDetails}
                    sendText={sendText}
                    answer={answer}
                  />
                )}
              </div>
            ))}
            {(recovering || status === "submitted" || (status === "streaming" && last?.role === "user")) && (
              <div className="mx-auto flex min-h-6 w-full max-w-[720px] items-center" style={{ animation: "fade-in 200ms ease-out both" }}>
                <LoadingState label="Thinking" variant="Dots" />
              </div>
            )}
            {error && (
              <div className="mx-auto flex w-full max-w-[720px] items-center gap-3 text-[12.5px] text-red">
                <span className="rounded-chip bg-red-tint px-2 py-1">{error.message}</span>
                <button type="button" onClick={() => void regenerate()} className="font-medium text-ink-2 underline-offset-2 hover:underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: composerH + 32, background: "linear-gradient(to top, var(--page) 64%, transparent)" }} />
        <div ref={composerRef} className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[720px]">
            <PromptBar demo={false} tall placeholder="Reply" onSend={sendText} />
          </div>
        </div>
      </div>
    );
  }

  return <div className={hidden ? "hidden" : "flex min-h-0 flex-1 flex-col"}>{body}</div>;
}
