import { useState } from "react";
import type { ChatMessage } from "@llmwebchat/shared";
import { Markdown } from "./Markdown.js";

function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
      >
        <span className={open ? "rotate-90 transition-transform" : "transition-transform"}>▸</span>
        <span>Reasoning</span>
        <span className="text-[var(--color-muted)]/60">{text.length} chars</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-[0.85rem] text-[var(--color-muted)] whitespace-pre-wrap border-t border-[var(--color-border)]">
          {text}
        </div>
      )}
    </div>
  );
}

function ToolBlocks({ msg }: { msg: ChatMessage }) {
  if (!msg.toolCalls?.length) return null;
  return (
    <div className="mb-3 space-y-2">
      {msg.toolCalls.map((tc) => {
        const result = msg.toolResults?.find((r) => r.toolCallId === tc.id);
        return (
          <div
            key={tc.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden text-[0.8rem]"
          >
            <div className="px-3 py-1.5 bg-[var(--color-surface-2)] flex items-center gap-2">
              <span className="text-[var(--color-accent-fg)]">🔧 {tc.name}</span>
              <span className="text-[var(--color-muted)] truncate">{tc.arguments}</span>
            </div>
            {result && (
              <pre className="px-3 py-2 whitespace-pre-wrap text-[var(--color-muted)] max-h-40 overflow-auto">
                {result.content}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Message({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className="px-4 py-5 md:px-0">
      <div className="max-w-3xl mx-auto flex gap-3 md:gap-4">
        <div
          className={`shrink-0 w-7 h-7 rounded-md grid place-items-center text-xs font-medium ${
            isUser
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-surface-2)] text-[var(--color-accent-fg)] border border-[var(--color-border)]"
          }`}
        >
          {isUser ? "You" : "AI"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-[var(--color-muted)] mb-1">
            {isUser ? "You" : msg.model ?? "assistant"}
          </div>
          {msg.reasoning && <ReasoningBlock text={msg.reasoning} />}
          <ToolBlocks msg={msg} />
          {msg.content || !streaming ? (
            isUser ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <Markdown content={msg.content} />
            )
          ) : (
            <div className="stream-caret text-[var(--color-muted)]">thinking…</div>
          )}
        </div>
      </div>
    </div>
  );
}
