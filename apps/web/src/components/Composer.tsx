import { useRef, useState, useEffect } from "react";
import { useStore } from "../store.js";
import { ModelPicker } from "./ModelPicker.js";
import type { Attachment } from "@llmwebchat/shared";
import { nanoid } from "nanoid";
import { recognitionSupported, startDictation, type Dictation } from "../lib/speech.js";

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "json", "csv", "tsv", "yaml", "yml", "js", "mjs", "cjs",
  "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp", "cs",
  "php", "sh", "bash", "zsh", "sql", "html", "htm", "css", "scss", "xml", "toml", "ini", "log", "env",
]);

const REASONING_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export function Composer() {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const dictRef = useRef<Dictation | null>(null);
  const micSupported = recognitionSupported();
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

  // consume snippet inserts
  const pendingInsert = useStore((s) => s.pendingInsert);
  const setPendingInsert = useStore((s) => s.setPendingInsert);
  useEffect(() => {
    if (pendingInsert != null) {
      setText((cur) => (cur ? cur + "\n\n" : "") + pendingInsert);
      setPendingInsert(null);
      setTimeout(() => taRef.current?.focus(), 0);
    }
  }, [pendingInsert, setPendingInsert]);
  const setSnippetsOpen = useStore((s) => s.setSnippetsOpen);

  const submit = () => {
    const t = text.trim();
    if ((!t && attachments.length === 0) || streaming) return;
    setText("");
    const atts = attachments.length ? attachments : undefined;
    setAttachments([]);
    void send(t, atts);
  };

  const toggleMic = () => {
    if (listening) {
      dictRef.current?.stop();
      dictRef.current = null;
      setListening(false);
      return;
    }
    dictRef.current = startDictation(
      (t) => setText((cur) => (cur ? cur + " " : "") + t),
      () => setListening(false),
    );
    setListening(!!dictRef.current);
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isImage = file.type.startsWith("image/");
      const isText =
        file.type.startsWith("text/") ||
        file.type === "application/json" ||
        TEXT_EXT.has(ext);
      if (isImage) {
        if (file.size > 8 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = () =>
          setAttachments((a) => [...a, { id: nanoid(), type: file.type, name: file.name, url: reader.result as string }]);
        reader.readAsDataURL(file);
      } else if (isText && file.size < 200_000) {
        const reader = new FileReader();
        reader.onload = () =>
          setAttachments((a) => [
            ...a,
            { id: nanoid(), type: file.type || "text/plain", name: file.name, text: String(reader.result).slice(0, 100_000) },
          ]);
        reader.readAsText(file);
      }
    });
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
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 pb-0">
              {attachments.map((a) => (
                <div key={a.id} className="relative group">
                  {a.url ? (
                    <img src={a.url} alt={a.name} className="h-16 w-16 object-cover rounded-md border border-[var(--color-border)]" />
                  ) : (
                    <div className="h-16 min-w-[64px] max-w-[140px] px-2 grid place-items-center text-center text-[10px] text-[var(--color-muted)] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]" title={a.name}>
                      📄<div className="truncate w-full">{a.name}</div>
                    </div>
                  )}
                  <button
                    onClick={() => setAttachments((arr) => arr.filter((x) => x.id !== a.id))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs grid place-items-center opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.txt,.md,.markdown,.json,.csv,.tsv,.yaml,.yml,.js,.mjs,.cjs,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.php,.sh,.bash,.zsh,.sql,.html,.htm,.css,.scss,.xml,.toml,.ini,.log,.env"
            multiple
            className="hidden"
            onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
          />
          <div className="flex items-end">
            <button
              onClick={() => fileRef.current?.click()}
              className="ml-1 mb-2.5 w-8 h-8 grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              title="Attach images"
            >
              📎
            </button>
            {micSupported && (
              <button
                onClick={toggleMic}
                className={`ml-0.5 mb-2.5 w-8 h-8 grid place-items-center ${listening ? "text-red-400 animate-pulse" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
                title={listening ? "Stop dictation" : "Dictate (voice)"}
              >
                🎤
              </button>
            )}
            <button
              onClick={() => setSnippetsOpen(true)}
              className="ml-0.5 mb-2.5 w-8 h-8 grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              title="Prompt snippets"
            >
              ✨
            </button>
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
            className="flex-1 resize-none bg-transparent px-3 py-3 pr-2 outline-none text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
          />
          <div className="flex items-center mr-1 mb-1.5">
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
                disabled={!text.trim() && attachments.length === 0}
                className="w-9 h-9 rounded-lg bg-[var(--color-accent)] text-white grid place-items-center disabled:opacity-30 hover:opacity-90"
                title="Send"
              >
                ↑
              </button>
            )}
          </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[var(--color-muted)]/70 mt-2">
          Provider-agnostic · local & cloud models · secrets stay in the proxy
        </p>
      </div>
    </div>
  );
}
