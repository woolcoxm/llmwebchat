import { useState } from "react";
import type { ChatMessage } from "@llmwebchat/shared";
import { Markdown } from "./Markdown.js";
import { useStore } from "../store.js";
import { speak, stopSpeaking, ttsSupported } from "../lib/speech.js";

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
  const regenerate = useStore((s) => s.regenerate);
  const editResubmit = useStore((s) => s.editResubmit);
  const siblingsOf = useStore((s) => s.siblingsOf);
  const setActiveChild = useStore((s) => s.setActiveChild);
  const activeId = useStore((s) => s.activeId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const [speaking, setSpeaking] = useState(false);

  const convId = activeId ?? "";
  const siblings = activeId ? siblingsOf(convId, msg.id) : [msg];
  const sibIndex = siblings.findIndex((s) => s.id === msg.id);
  const hasSiblings = siblings.length > 1;
  const parent = msg.parentId;
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
          {isUser && msg.attachments?.some((a) => a.type.startsWith("image/")) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {msg.attachments!.filter((a) => a.type.startsWith("image/")).map((a) => (
                <img key={a.id} src={a.url} alt={a.name} className="max-h-48 rounded-md border border-[var(--color-border)]" />
              ))}
            </div>
          )}
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

      {/* action row */}
      {!streaming && msg.content && (
        <div className="max-w-3xl mx-auto pl-10 -mt-1 mb-1 flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
          {hasSiblings && parent && (
            <span className="flex items-center gap-0.5 mr-1">
              <button
                disabled={sibIndex <= 0}
                onClick={() => siblings[sibIndex - 1] && setActiveChild(convId, parent, siblings[sibIndex - 1].id)}
                className="disabled:opacity-20 hover:text-[var(--color-fg)] px-1"
              >‹</button>
              <span>{sibIndex + 1}/{siblings.length}</span>
              <button
                disabled={sibIndex >= siblings.length - 1}
                onClick={() => siblings[sibIndex + 1] && setActiveChild(convId, parent, siblings[sibIndex + 1].id)}
                className="disabled:opacity-20 hover:text-[var(--color-fg)] px-1"
              >›</button>
            </span>
          )}
          {isUser ? (
            <button onClick={() => { setDraft(msg.content); setEditing(true); }} className="hover:text-[var(--color-fg)]">edit</button>
          ) : (
            <>
              <button
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="hover:text-[var(--color-fg)]"
              >copy</button>
              <button
                onClick={() => regenerate(msg.id)}
                className="hover:text-[var(--color-fg)]"
              >↻ regenerate</button>
              {ttsSupported() && (
                <button
                  onClick={() => {
                    if (window.speechSynthesis.speaking) { stopSpeaking(); setSpeaking(false); }
                    else { speak(msg.content); setSpeaking(true); }
                  }}
                  className="hover:text-[var(--color-fg)]"
                >{speaking ? "⏹ stop" : "🔊 speak"}</button>
              )}
            </>
          )}
        </div>
      )}

      {editing && isUser && (
        <div className="max-w-3xl mx-auto pl-10 mb-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(8, draft.split("\n").length + 1)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { setEditing(false); if (draft.trim() && draft !== msg.content) editResubmit(msg.id, draft.trim()); }}
              className="px-2 py-1 rounded text-xs bg-[var(--color-accent)] text-white"
            >Submit as new branch</button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-xs text-[var(--color-muted)]">cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
