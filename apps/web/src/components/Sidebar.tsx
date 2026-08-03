import { useMemo, useState } from "react";
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
  const renameConversation = useStore((s) => s.renameConversation);
  const newConv = useStore((s) => s.newConversation);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const settings = useStore((s) => s.settings);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const toggleTag = useStore((s) => s.toggleTag);

  const q = query.trim().toLowerCase();
  const allTags = useMemo(() => Array.from(new Set(conversations.flatMap((c) => c.tags ?? []))).sort(), [conversations]);
  let filtered = q
    ? conversations.filter((c) => {
        if (c.title.toLowerCase().includes(q)) return true;
        const msgs = messagesByConv[c.id] ?? [];
        return msgs.some((m) => (m.content ?? "").toLowerCase().includes(q));
      })
    : conversations;
  if (activeTag) filtered = filtered.filter((c) => (c.tags ?? []).includes(activeTag));
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
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className="text-[10px] px-2 py-0.5 rounded-full border"
                style={tagStyle(t, activeTag === t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
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
          <ConvRow key={c.id} c={c} activeId={activeId} select={select} del={del} togglePin={togglePin} autoTitle={autoTitle} rename={renameConversation} toggleTag={toggleTag} activeTag={activeTag} />
        ))}
        {pinned.length > 0 && rest.length > 0 && (
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] px-1 pt-2 pb-0.5">Recent</div>
        )}
        {rest.map((c) => (
          <ConvRow key={c.id} c={c} activeId={activeId} select={select} del={del} togglePin={togglePin} autoTitle={autoTitle} rename={renameConversation} toggleTag={toggleTag} activeTag={activeTag} />
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

const TAG_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#ec4899"];
function tagStyle(tag: string, active: boolean): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const c = TAG_COLORS[h % TAG_COLORS.length];
  return active ? { background: c, color: "#fff", borderColor: c } : { background: `${c}22`, color: c, borderColor: `${c}55` };
}
function tagDot(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function ConvRow({
  c,
  activeId,
  select,
  del,
  togglePin,
  autoTitle,
  rename,
  toggleTag,
  activeTag,
}: {
  c: Conversation;
  activeId: string | null;
  select: (id: string) => void;
  del: (id: string) => void;
  togglePin: (id: string) => void;
  autoTitle: (id: string) => Promise<void>;
  rename: (id: string, title: string) => void;
  toggleTag: (id: string, tag: string) => void;
  activeTag: string | null;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.title);
  const commit = () => {
    const t = name.trim();
    if (t && t !== c.title) rename(c.id, t);
    setRenaming(false);
  };
  return (
    <div
      onClick={() => select(c.id)}
      onDoubleClick={(e) => { e.stopPropagation(); setName(c.title); setRenaming(true); }}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${
        c.id === activeId
          ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]/50"
      }`}
    >
      {c.pinned && <span className="text-[var(--color-accent-fg)] text-xs">📌</span>}
      {(c.tags ?? []).map((t) => (
        <span key={t} className="w-2 h-2 rounded-full shrink-0" style={{ background: tagDot(t) }} title={`#${t}`} />
      ))}
      {renaming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setRenaming(false); }}
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-accent)] rounded px-1 py-0.5 text-sm outline-none"
        />
      ) : (
        <span className="flex-1 truncate" title="Double-click to rename">{c.title}</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); const t = window.prompt("Add tag (or remove by entering an existing one):", (c.tags ?? [])[0] ?? ""); if (t && t.trim()) toggleTag(c.id, t.trim().toLowerCase()); }}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-accent-fg)]"
        title="Add/remove tag"
      >
        #
      </button>
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
