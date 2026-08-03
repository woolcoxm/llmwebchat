import { useState } from "react";
import { useStore } from "../store.js";
import { ThemePicker } from "./ThemePicker.js";
import type { Conversation } from "@llmwebchat/shared";

export function Sidebar() {
  const open = useStore((s) => s.sidebarOpen);
  const conversations = useStore((s) => s.conversations);
  const messagesByConv = useStore((s) => s.messagesByConv);
  const activeId = useStore((s) => s.activeId);
  const select = useStore((s) => s.selectConversation);
  const del = useStore((s) => s.deleteConversation);
  const togglePin = useStore((s) => s.togglePin);
  const autoTitle = useStore((s) => s.autoTitle);
  const newConv = useStore((s) => s.newConversation);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const settings = useStore((s) => s.settings);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? conversations.filter((c) => {
        if (c.title.toLowerCase().includes(q)) return true;
        const msgs = messagesByConv[c.id] ?? [];
        return msgs.some((m) => (m.content ?? "").toLowerCase().includes(q));
      })
    : conversations;
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);

  if (!open) return null;

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] grid place-items-center text-white text-sm font-bold">
          L
        </div>
        <div className="font-semibold tracking-tight">LLMWebChat</div>
      </div>

      <div className="px-3">
        <button
          onClick={newConv}
          className="w-full mb-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)]/50 text-sm text-left flex items-center gap-2"
        >
          <span className="text-[var(--color-accent-fg)]">+</span> New chat
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          className="w-full mb-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
            {q ? "No matches" : "No conversations yet"}
          </div>
        )}
        {pinned.length > 0 && (
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] px-1 pt-1 pb-0.5">Pinned</div>
        )}
        {pinned.map((c) => (
          <ConvRow key={c.id} c={c} activeId={activeId} select={select} del={del} togglePin={togglePin} autoTitle={autoTitle} />
        ))}
        {pinned.length > 0 && rest.length > 0 && (
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] px-1 pt-2 pb-0.5">Recent</div>
        )}
        {rest.map((c) => (
          <ConvRow key={c.id} c={c} activeId={activeId} select={select} del={del} togglePin={togglePin} autoTitle={autoTitle} />
        ))}
      </div>

      <div className="p-3 border-t border-[var(--color-border)] flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex-1 px-3 py-2 rounded-lg text-sm text-left text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] flex items-center gap-2"
        >
          ⚙ Settings
          {settings?.providers.find((p) => p.id === settings.activeProviderId)?.hasKey ===
            false &&
            settings?.activeProviderId !== "ollama" &&
            settings?.activeProviderId !== "lmstudio" && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
              no key
            </span>
          )}
        </button>
        <ThemePicker />
      </div>
    </aside>
  );
}

function ConvRow({
  c,
  activeId,
  select,
  del,
  togglePin,
  autoTitle,
}: {
  c: Conversation;
  activeId: string | null;
  select: (id: string) => void;
  del: (id: string) => void;
  togglePin: (id: string) => void;
  autoTitle: (id: string) => Promise<void>;
}) {
  return (
    <div
      onClick={() => select(c.id)}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${
        c.id === activeId
          ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]/50"
      }`}
    >
      {c.pinned && <span className="text-[var(--color-accent-fg)] text-xs">📌</span>}
      <span className="flex-1 truncate">{c.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); autoTitle(c.id); }}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-accent-fg)]"
        title="Auto-title with AI"
      >
        ✨
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); togglePin(c.id); }}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-accent-fg)]"
        title={c.pinned ? "Unpin" : "Pin"}
      >
        {c.pinned ? "🏴" : "📍"}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); del(c.id); }}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-red-400"
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}
