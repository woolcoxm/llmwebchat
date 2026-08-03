import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store.js";
import { EMPTY_MSGS } from "../lib/empty.js";
import { extractArtifacts, isRunnable, type Artifact } from "../lib/artifacts.js";
import { ArtifactPreview } from "./ArtifactPreview.js";
import { runPython, type RunResult } from "../lib/pyodide.js";

type Tab = "preview" | "source" | "run";

export function ArtifactPanel() {
  const open = useStore((s) => s.artifactOpen);
  const setOpen = useStore((s) => s.setArtifactOpen);
  const activeId = useStore((s) => s.activeId);
  const messages = useStore((s) => (activeId ? s.messagesByConv[activeId] : undefined) ?? EMPTY_MSGS);

  // Artifacts come from the latest assistant message with content.
  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant" && m.content),
    [messages],
  );
  const artifacts = useMemo(
    () => (lastAssistant ? extractArtifacts(lastAssistant.content) : []),
    [lastAssistant],
  );

  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>("preview");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const lastAutoMsg = useRef<string | null>(null);

  // Auto-open the panel when a previewable artifact (html/svg/mermaid) lands,
  // once per assistant message. Doesn't auto-open for plain code.
  useEffect(() => {
    const msgId = lastAssistant?.id;
    if (!msgId || msgId === lastAutoMsg.current) return;
    if (artifacts.some((a) => a.previewable) && !open) {
      lastAutoMsg.current = msgId;
      useStore.getState().setArtifactOpen(true);
    }
  }, [lastAssistant?.id, artifacts, open]);

  if (!open) return null;
  const current: Artifact | undefined = artifacts[selected];

  const pick = (i: number) => {
    setSelected(i);
    setRunResult(null);
    setTab(currentTabFor(artifacts[i]));
  };

  const run = async () => {
    if (!current) return;
    setRunning(true);
    setRunResult(null);
    const r = await runPython(current.code);
    setRunResult(r);
    setRunning(false);
  };

  return (
    <aside className="w-[42%] min-w-[360px] max-w-[640px] h-full flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-sm font-medium">Artifacts</span>
        <span className="text-xs text-[var(--color-muted)]">{artifacts.length || "none"}</span>
        <div className="ml-auto flex items-center gap-1">
          {current && (
            <>
              {current.previewable && (
                <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>Preview</TabBtn>
              )}
              {isRunnable(current.language) && (
                <TabBtn active={tab === "run"} onClick={() => setTab("run")}>▶ Run</TabBtn>
              )}
              <TabBtn active={tab === "source"} onClick={() => setTab("source")}>Source</TabBtn>
            </>
          )}
          <button
            onClick={() => setOpen(false)}
            className="ml-2 text-[var(--color-muted)] hover:text-[var(--color-fg)] px-1.5"
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </header>

      {artifacts.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-[var(--color-border)] overflow-x-auto">
          {artifacts.map((a, i) => (
            <button
              key={a.id}
              onClick={() => pick(i)}
              className={`shrink-0 text-xs px-2 py-1 rounded border ${
                i === selected
                  ? "border-[var(--color-accent)]/50 text-[var(--color-accent-fg)] bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {a.filename}
              {a.previewable ? " 👁" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {!current ? (
          <div className="flex-1 grid place-items-center p-8 text-center text-sm text-[var(--color-muted)]">
            <div>
              <div className="text-3xl mb-2">🖼️</div>
              Code, HTML, SVG, or Mermaid blocks from the latest reply appear here for live preview & execution.
            </div>
          </div>
        ) : tab === "source" ? (
          <pre className="flex-1 overflow-auto p-4 text-xs bg-[#0d1117]">
            <code>{current.code}</code>
          </pre>
        ) : tab === "run" ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-2 border-b border-[var(--color-border)]">
              <button
                onClick={run}
                disabled={running}
                className="px-3 py-1.5 rounded-md text-xs bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40"
              >
                {running ? "Running…" : "▶ Run Python (Pyodide)"}
              </button>
              {runResult && (
                <span className="ml-2 text-[11px] text-[var(--color-muted)]">
                  {runResult.durationMs}ms · {runResult.ok ? "ok" : "error"}
                </span>
              )}
            </div>
            <pre className={`flex-1 overflow-auto p-3 text-xs whitespace-pre-wrap ${runResult?.ok ? "" : "text-red-400"}`}>
              {runResult ? runResult.output : "// click Run to execute in an in-browser WASM sandbox"}
            </pre>
          </div>
        ) : (
          <ArtifactPreview artifact={current} />
        )}
      </div>
    </aside>
  );
}

function currentTabFor(a: Artifact | undefined): Tab {
  if (!a) return "source";
  if (a.previewable) return "preview";
  if (isRunnable(a.language)) return "run";
  return "source";
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded ${active ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
    >
      {children}
    </button>
  );
}
