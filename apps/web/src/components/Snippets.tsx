import { useState } from "react";
import { useStore } from "../store.js";

export function Snippets() {
  const open = useStore((s) => s.snippetsOpen);
  const setOpen = useStore((s) => s.setSnippetsOpen);
  const templates = useStore((s) => s.promptTemplates);
  const add = useStore((s) => s.addPromptTemplate);
  const remove = useStore((s) => s.removePromptTemplate);
  const setPendingInsert = useStore((s) => s.setPendingInsert);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  if (!open) return null;

  const insert = (b: string) => {
    setPendingInsert(b);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
          <span className="font-medium text-sm">Prompt snippets</span>
          <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {templates.length === 0 && (
            <p className="text-xs text-[var(--color-muted)]">No snippets yet. Save reusable prompts below.</p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium flex-1 truncate">{t.title}</span>
                <button onClick={() => insert(t.body)} className="text-[11px] px-2 py-0.5 rounded bg-[var(--color-accent)] text-white">insert</button>
                <button onClick={() => remove(t.id)} className="text-[11px] text-red-400/70 hover:text-red-400">✕</button>
              </div>
              <pre className="text-[11px] text-[var(--color-muted)] whitespace-pre-wrap max-h-20 overflow-auto">{t.body}</pre>
            </div>
          ))}

          <div className="pt-2 border-t border-[var(--color-border)]">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Snippet title"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm mb-1.5 outline-none focus:border-[var(--color-accent)]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Prompt body…"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={() => {
                if (title.trim() && body.trim()) {
                  add(title.trim(), body.trim());
                  setTitle("");
                  setBody("");
                }
              }}
              className="mt-1.5 px-3 py-1 rounded text-xs bg-[var(--color-accent)] text-white"
            >
              + Save snippet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
