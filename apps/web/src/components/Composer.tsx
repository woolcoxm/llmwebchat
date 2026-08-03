import { useRef, useState, useEffect } from "react";
import { useStore } from "../store.js";
import { ModelPicker } from "./ModelPicker.js";

const REASONING_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export function Composer() {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const send = useStore((s) => s.send);
  const stop = useStore((s) => s.stop);
  const streaming = useStore((s) => !!s.stream);
  const reasoningEffort = useStore((s) => s.reasoningEffort);
  const setReasoningEffort = useStore((s) => s.setReasoningEffort);
  const allowTools = useStore((s) => s.allowTools);
  const setAllowTools = useStore((s) => s.setAllowTools);

  // autosize
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || streaming) return;
    setText("");
    void send(t);
  };

  return (
    <div className="px-4 pb-4 md:px-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
          <ModelPicker />
          <select
            value={reasoningEffort}
            onChange={(e) => setReasoningEffort(e.target.value as typeof REASONING_LEVELS[number])}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            title="Reasoning effort"
          >
            {REASONING_LEVELS.map((l) => (
              <option key={l} value={l}>
                🧠 {l}
              </option>
            ))}
          </select>
          <button
            onClick={() => setAllowTools(!allowTools)}
            className={`px-2 py-1 rounded-md border transition-colors ${
              allowTools
                ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-[var(--color-accent-fg)]"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]"
            }`}
            title="Allow tool use (agentic)"
          >
            🔧 tools {allowTools ? "on" : "off"}
          </button>
        </div>

        <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:border-[var(--color-accent)]/60 transition-colors">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message the model…  (Enter to send, Shift+Enter for newline)"
            className="w-full resize-none bg-transparent px-4 py-3 pr-14 outline-none text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
          />
          <div className="absolute right-2 bottom-2">
            {streaming ? (
              <button
                onClick={stop}
                className="w-9 h-9 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-red-500/50 text-[var(--color-fg)] grid place-items-center"
                title="Stop"
              >
                ■
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim()}
                className="w-9 h-9 rounded-lg bg-[var(--color-accent)] text-white grid place-items-center disabled:opacity-30 hover:opacity-90"
                title="Send"
              >
                ↑
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-[var(--color-muted)]/70 mt-2">
          Provider-agnostic · z.ai GLM + local models · secrets stay in the proxy
        </p>
      </div>
    </div>
  );
}
