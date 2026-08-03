import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store.js";

interface Command {
  id: string;
  label: string;
  hint?: string;
  keys?: string;
  run: () => void;
  danger?: boolean;
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const st = useStore();
  const streaming = !!st.stream;
  const activeId = st.activeId;

  const commands = useMemo<Command[]>(() => {
    const close = () => setOpen(false);
    return [
      { id: "new", label: "New chat", keys: "⌘N", run: () => { st.newConversation(); close(); } },
      ...(activeId
        ? [
            { id: "fork", label: "Fork conversation (active branch → new chat)", run: () => { st.forkConversation(activeId); close(); } },
            { id: "autotitle", label: "✨ Auto-title this conversation", run: () => { void st.autoTitle(activeId); close(); } },
            { id: "compact", label: "📝 Compact & continue (summarize → new chat)", run: () => { void st.compactAndContinue(activeId); close(); } },
            { id: "clear", label: "🗑 Clear conversation (keep the chat)", run: () => { if (confirm("Clear all messages in this conversation?")) { st.clearConversation(activeId); } close(); } },
          ]
        : []),
      { id: "sidebar", label: st.sidebarOpen ? "Hide sidebar" : "Show sidebar", keys: "⌘B", run: () => { st.toggleSidebar(); close(); } },
      { id: "artifacts", label: st.artifactOpen ? "Hide Artifacts panel" : "Show Artifacts panel", keys: "⌘J", run: () => { st.setArtifactOpen(!st.artifactOpen); close(); } },
      { id: "settings", label: "Open settings", keys: "⌘,", run: () => { st.setSettingsOpen(true); close(); } },
      ...(streaming
        ? [{ id: "stop", label: "Stop generating", keys: "⌘.", run: () => { st.stop(); close(); }, danger: true }]
        : []),
      { id: "tools-on", label: st.allowTools ? "Disable tools" : "Enable tools", run: () => { st.setAllowTools(!st.allowTools); close(); } },
      {
        id: "eff-high",
        label: "Reasoning effort: high",
        run: () => { st.setReasoningEffort("high"); close(); },
        hint: st.reasoningEffort === "high" ? "current" : undefined,
      },
      {
        id: "eff-low",
        label: "Reasoning effort: low",
        run: () => { st.setReasoningEffort("low"); close(); },
        hint: st.reasoningEffort === "low" ? "current" : undefined,
      },
      {
        id: "eff-none",
        label: "Reasoning effort: none",
        run: () => { st.setReasoningEffort("none"); close(); },
        hint: st.reasoningEffort === "none" ? "current" : undefined,
      },
    ];
  }, [st, streaming, setOpen, activeId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(s));
  }, [q, commands]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setIdx(0), [q]);

  if (!open) return null;

  const exec = (c?: Command) => {
    if (c) c.run();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); exec(filtered[idx]); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          placeholder="Type a command…"
          className="w-full bg-transparent px-4 py-3 text-sm outline-none border-b border-[var(--color-border)]"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">No matching commands</div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => exec(c)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left ${
                i === idx ? "bg-[var(--color-surface-2)]" : ""
              } ${c.danger ? "text-red-400" : "text-[var(--color-fg)]"}`}
            >
              <span className="flex-1">{c.label}</span>
              {c.hint && <span className="text-[10px] text-[var(--color-accent-fg)]">{c.hint}</span>}
              {c.keys && (
                <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-muted)]">
                  {c.keys}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
