import { useMemo, useState } from "react";
import { useStore, computePath } from "../store.js";
import type { ChatMessage } from "@llmwebchat/shared";
import { wordDiff, type DiffPart } from "../lib/diff.js";

/** Leaves = assistant messages with no children (candidate branch tips). */
function leaves(msgs: ChatMessage[]): ChatMessage[] {
  const parentIds = new Set(msgs.map((m) => m.parentId).filter(Boolean) as string[]);
  return msgs.filter((m) => m.role === "assistant" && !parentIds.has(m.id));
}

export function BranchCompare() {
  const open = useStore((s) => s.compareOpen);
  const setOpen = useStore((s) => s.setCompareOpen);
  const activeId = useStore((s) => s.activeId);
  const msgs = useStore((s) => (activeId ? s.messagesByConv[activeId] ?? [] : []));
  const activeChildMap = useStore((s) => (activeId ? s.activeChild[activeId] ?? {} : {}));

  const tips = useMemo(() => leaves(msgs), [msgs]);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  if (!open) return null;

  const msgA = msgs.find((m) => m.id === a);
  const msgB = msgs.find((m) => m.id === b);
  const diff = msgA && msgB ? wordDiff(msgA.content, msgB.content) : null;

  // label leaves by their index on the active path or ordinal
  const activePath = computePath(msgs, activeChildMap);
  const activeSet = new Set(activePath.map((m) => m.id));

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)]">
        <span className="font-medium">⇄ Branch compare</span>
        <span className="text-xs text-[var(--color-muted)]">Pick two branch tips to diff</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕ close</button>
      </header>

      <div className="flex gap-2 px-4 py-2 border-b border-[var(--color-border)] overflow-x-auto">
        <span className="text-[11px] text-[var(--color-muted)] self-center mr-1">A:</span>
        {tips.map((t) => (
          <button key={t.id} onClick={() => setA(t.id)} className={`shrink-0 text-xs px-2 py-1 rounded border ${a === t.id ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-fg)]" : "border-[var(--color-border)] text-[var(--color-muted)]"}`}>
            {(t.content || "(empty)").replace(/\s+/g, " ").slice(0, 28)}
            {activeSet.has(t.id) ? " ●" : ""}
          </button>
        ))}
      </div>
      <div className="flex gap-2 px-4 py-2 border-b border-[var(--color-border)] overflow-x-auto">
        <span className="text-[11px] text-[var(--color-muted)] self-center mr-1">B:</span>
        {tips.map((t) => (
          <button key={t.id} onClick={() => setB(t.id)} className={`shrink-0 text-xs px-2 py-1 rounded border ${b === t.id ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-fg)]" : "border-[var(--color-border)] text-[var(--color-muted)]"}`}>
            {(t.content || "(empty)").replace(/\s+/g, " ").slice(0, 28)}
            {activeSet.has(t.id) ? " ●" : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex gap-3 p-3">
        {!diff ? (
          <div className="m-auto text-sm text-[var(--color-muted)]">Select two branch tips above to see a word-level diff.</div>
        ) : (
          <>
            <DiffColumn title="A" parts={diff.left} />
            <DiffColumn title="B" parts={diff.right} />
          </>
        )}
      </div>
    </div>
  );
}

function DiffColumn({ title, parts }: { title: string; parts: DiffPart[] }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-medium">{title}</div>
      <div className="flex-1 overflow-y-auto p-3 text-sm leading-relaxed">
        {parts.map((p, i) => (
          <span
            key={i}
            className={
              p.type === "same"
                ? "text-[var(--color-fg)]"
                : p.type === "add"
                  ? "text-emerald-400 bg-emerald-500/10 rounded"
                  : "text-red-400 bg-red-500/10 line-through rounded"
            }
          >
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
}
