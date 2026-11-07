"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SidebarNav from "@/components/primitives/SidebarNav";
import ChatThread from "@/components/hera/ChatThread";
import FilePane from "@/components/hera/FilePane";
import { Glyph, ICONS } from "@/components/hera/ui";
import { notifyProfileChanged, useProfile } from "@/components/hera/useProfile";

/* ─────────────────────────────────────────────────────────
 * HERA — the harness shell (sidebar · tabbed chats · docked
 * pane) wired to a real agent. Each tab is its own useChat
 * conversation; the right pane is the household file, which
 * fills in live as the agent reads the policy and saves facts.
 * ───────────────────────────────────────────────────────── */

import type { ChatSummary, SavedChat } from "@/lib/hera/chats";

type Tab = SavedChat;
const ACTIVE_CHAT_KEY = "hera-active-chat";
async function request<T>(url: string, method = "GET"): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store" });
  if (!response.ok) throw new Error("Couldn't load your chats. Please try again.");
  return response.json();
}

export default function HeraHarness() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [started, setStarted] = useState<Set<string>>(new Set());
  const [paneOpen, setPaneOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const creating = useRef(false);
  const initialization = useRef<Promise<{ chats: ChatSummary[]; chat: SavedChat }> | null>(null);
  const { profile } = useProfile();
  const activeStarted = started.has(activeId);

  const activate = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_CHAT_KEY, id);
  }, []);
  const refreshChats = useCallback(async () => {
    try { setChats((await request<{ chats: ChatSummary[] }>("/api/chats")).chats); }
    catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Share the initialization request across StrictMode's effect replay.
    initialization.current ??= (async () => {
      const { chats } = await request<{ chats: ChatSummary[] }>("/api/chats");
      const savedId = localStorage.getItem(ACTIVE_CHAT_KEY);
      const id = chats.find((c) => c.id === savedId)?.id ?? chats[0]?.id;
      const chat = id ? await request<SavedChat>(`/api/chats/${id}`) : await request<SavedChat>("/api/chats", "POST");
      return { chats: id ? chats : [chat], chat };
    })();
    initialization.current.then(({ chats, chat }) => {
      if (cancelled) return;
      setChats(chats);
      setTabs([chat]);
      setStarted(new Set(chat.messages.length ? [chat.id] : []));
      activate(chat.id);
      setLoading(false);
    }).catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [activate]);

  const newChat = async () => {
    if (creating.current || loading) return;
    creating.current = true;
    setError(null);
    try {
      const chat = await request<SavedChat>("/api/chats", "POST");
      setTabs((current) => [...current, chat]);
      setChats((current) => [chat, ...current]);
      activate(chat.id);
    } catch (e) { setError((e as Error).message); }
    finally { creating.current = false; }
  };
  const openChat = async (id: string) => {
    setError(null);
    if (tabs.some((t) => t.id === id)) { activate(id); return; }
    try {
      const chat = await request<SavedChat>(`/api/chats/${id}`);
      setTabs((current) => current.some((t) => t.id === id) ? current : [...current, chat]);
      if (chat.messages.length) setStarted((current) => new Set([...current, id]));
      activate(id);
    } catch (e) { setError((e as Error).message); }
  };
  const closeTab = (id: string) => {
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (id === activeId) {
      activate(remaining.at(-1)?.id ?? "");
    }
  };
  const onTitle = useCallback((id: string, title: string) => {
    setTabs((current) => current.map((t) => t.id === id && t.title !== title ? { ...t, title } : t));
    setChats((current) => current.map((t) => t.id === id && t.title !== title ? { ...t, title } : t));
  }, []);
  const onStarted = useCallback((id: string) => {
    setStarted((current) => current.has(id) ? current : new Set(current).add(id));
  }, []);
  const resetFile = async () => {
    try {
      await request("/api/profile", "DELETE");
      notifyProfileChanged();
      const chat = await request<SavedChat>("/api/chats", "POST");
      setTabs([chat]);
      setChats([chat]);
      activate(chat.id);
      setStarted(new Set());
    } catch (e) { setError((e as Error).message); }
  };

  const activeTitle = tabs.find((t) => t.id === activeId)?.title ?? null;

  return (
    <main className="flex h-[100dvh] gap-0 bg-canvas p-2.5 text-ink lg:pl-0">
      <SidebarNav
        fill
        className="hidden lg:flex"
        recents={chats.map((chat) => ({ id: chat.id, label: chat.title }))}
        activeTitle={activeTitle}
        activeChatId={activeId}
        onPick={(id) => void openChat(id)}
        onNewChat={() => newChat()}
        footerLabel={null}
      />

      <div className="flex min-w-0 flex-1 gap-2.5">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-page">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((t) => (
                <div
                  key={t.id}
                  className={`group/tab flex h-7 w-36 shrink-0 items-center gap-0.5 rounded-[7px] pl-2.5 pr-0.5 text-[12.5px] font-medium transition-colors duration-100 ${
                    t.id === activeId ? "bg-hover-2 text-ink" : "text-ink-2 hover:bg-hover hover:text-ink"
                  }`}
                >
                  <button type="button" aria-pressed={t.id === activeId} onClick={() => activate(t.id)} title={t.title ?? "New chat"} className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{t.title ?? "New chat"}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Close tab"
                    onClick={() => closeTab(t.id)}
                    className="-my-1 flex size-6 shrink-0 items-center justify-center rounded-[5px] text-ink-3 transition-[background-color,color] duration-100 hover:bg-hover-2 hover:text-ink"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-label="New chat"
                onClick={() => newChat()}
                className="ml-0.5 flex size-7 shrink-0 items-center justify-center rounded-[7px] text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            {activeStarted && !paneOpen && (
              <button
                type="button"
                onClick={() => setPaneOpen(true)}
                className="hidden h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink lg:flex"
              >
                <Glyph d={ICONS.folder} size={14} /> Your file
              </button>
            )}
          </div>

          {error && <div role="alert" className="px-4 py-3 text-sm text-red">{error}</div>}
          {loading && <div className="p-8 text-sm text-ink-3">Loading your chats…</div>}
          {!loading && tabs.length === 0 && <div className="p-8 text-sm text-ink-2">Select a conversation from the sidebar or <button className="underline" onClick={() => void newChat()}>start a new chat</button>.</div>}
          {tabs.map((t) => (
            <ChatThread
              key={t.id}
              chatId={t.id}
              initialMessages={t.messages}
              initiallyRunning={t.running}
              onSaved={refreshChats}
              hidden={t.id !== activeId}
              profile={profile}
              onTitle={onTitle}
              onStarted={onStarted}
            />
          ))}
        </section>

        {activeStarted && paneOpen && (
          <aside
            className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-line bg-page lg:flex"
            style={{ animation: "fade-in 300ms ease both" }}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:pl-4">
              <span className="text-[13px] font-semibold text-ink">Your file</span>
              <button
                type="button"
                aria-label="Close pane"
                onClick={() => setPaneOpen(false)}
                className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FilePane profile={profile} onReset={resetFile} />
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
