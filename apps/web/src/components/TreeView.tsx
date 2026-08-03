import { useMemo } from "react";
import { useStore, computePath } from "../store.js";
import { EMPTY_MSGS, EMPTY_CHILD } from "../lib/empty.js";
import type { ChatMessage } from "@llmwebchat/shared";

interface TreeNode {
  msg: ChatMessage;
  children: TreeNode[];
}

export function TreeView() {
  const open = useStore((s) => s.treeOpen);
  const setOpen = useStore((s) => s.setTreeOpen);
  const activeId = useStore((s) => s.activeId);
  const msgs = useStore((s) => (activeId ? s.messagesByConv[activeId] ?? EMPTY_MSGS : EMPTY_MSGS));
  const activeChildMap = useStore((s) => (activeId ? s.activeChild[activeId] ?? EMPTY_CHILD : EMPTY_CHILD));
  const activate = useStore((s) => s.activatePathTo);
  const fork = useStore((s) => s.forkConversation);
  const autoTitle = useStore((s) => s.autoTitle);

  const activePath = useMemo(() => computePath(msgs, activeChildMap), [msgs, activeChildMap]);
  const activeIds = useMemo(() => new Set(activePath.map((m) => m.id)), [activePath]);
  const tip = activePath[activePath.length - 1]?.id;

  const tree = useMemo(() => buildTree(msgs), [msgs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)]">
        <span className="font-medium">🌳 Conversation tree</span>
        <span className="text-xs text-[var(--color-muted)]">{msgs.length} messages · {countLeaves(tree)} branches</span>
        <button onClick={() => { if (activeId) autoTitle(activeId); }} className="ml-auto text-xs text-[var(--color-muted)] hover:text-[var(--color-accent-fg)]" title="Auto-title">✨ title</button>
        <button onClick={() => { if (activeId) { fork(activeId); setOpen(false); } }} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]" title="Fork active branch into a new conversation">⑂ fork</button>
        <button onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕ close</button>
      </header>
      <div className="flex-1 overflow-auto p-4">
        {tree.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-muted)] py-12">No messages yet.</div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {tree.map((n) => (
              <TreeRow
                key={n.msg.id}
                node={n}
                depth={0}
                activeIds={activeIds}
                tip={tip}
                onPick={(id) => activeId && activate(activeId, id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  activeIds,
  tip,
  onPick,
}: {
  node: TreeNode;
  depth: number;
  activeIds: Set<string>;
  tip: string | undefined;
  onPick: (id: string) => void;
}) {
  const m = node.msg;
  const isActive = activeIds.has(m.id);
  const isTip = m.id === tip;
  const isUser = m.role === "user";
  const preview = (m.content || "(empty)").replace(/\s+/g, " ").slice(0, 64);
  const childCount = node.children.length;

  return (
    <div>
      <button
        onClick={() => onPick(m.id)}
        className={`w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 mb-1 border ${
          isTip
            ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10"
            : isActive
              ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
              : "border-transparent hover:bg-[var(--color-surface-2)]"
        }`}
        style={{ marginLeft: depth * 18 }}
      >
        <span
          className={`shrink-0 w-2 h-2 rounded-full ${
            isUser ? "bg-[var(--color-accent)]" : "bg-[var(--color-accent-fg)]"
          } ${isTip ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]" : ""}`}
        />
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] w-12 shrink-0">
          {isUser ? "you" : m.role === "assistant" ? "ai" : m.role}
        </span>
        <span className="flex-1 truncate text-sm text-[var(--color-fg)]">{preview}</span>
        {childCount > 1 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-muted)]" title={`${childCount} branches here`}>
            ⑂ {childCount}
          </span>
        )}
        {isTip && <span className="text-[10px] text-[var(--color-accent-fg)]">current</span>}
      </button>
      {node.children.map((c) => (
        <TreeRow key={c.msg.id} node={c} depth={depth + 1} activeIds={activeIds} tip={tip} onPick={onPick} />
      ))}
    </div>
  );
}

function buildTree(msgs: ChatMessage[]): TreeNode[] {
  const byParent = new Map<string | null, ChatMessage[]>();
  for (const m of msgs) {
    const k = m.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(m);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.createdAt - b.createdAt);
  const make = (parent: string | null): TreeNode[] =>
    (byParent.get(parent) ?? []).map((msg) => ({ msg, children: make(msg.id) }));
  return make(null);
}

function countLeaves(roots: TreeNode[]): number {
  let n = 0;
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length === 0) n++;
      else walk(node.children);
    }
  };
  walk(roots);
  return n || 1;
}
