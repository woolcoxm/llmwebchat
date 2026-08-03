import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { listFiles, readFile, type FsEntry } from "../lib/api.js";

/** Right-hand Workspace pane: browse the agent's project folder (read-only). */
export function Workspace() {
  const open = useStore((s) => s.workspaceOpen);
  const setOpen = useStore((s) => s.setWorkspaceOpen);
  const cwd = useStore((s) => s.settings?.agent?.cwd);

  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);

  const refresh = (p: string) => {
    setPath(p);
    setFile(null);
    setError(null);
    listFiles(p).then((r) => {
      if (r.error) setError(r.error);
      else setEntries(r.entries);
    });
  };

  useEffect(() => {
    if (open && cwd) refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cwd]);

  if (!open) return null;

  const openEntry = (e: FsEntry) => {
    const child = path ? `${path}/${e.name}` : e.name;
    if (e.dir) refresh(child);
    else {
      readFile(child).then((r) => r.error ? setError(r.error) : setFile({ name: r.name, content: r.content }));
    }
  };

  const up = () => {
    if (file) { setFile(null); return; }
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    refresh(parts.join("/"));
  };

  const crumbs = path ? path.split("/").filter(Boolean) : [];

  return (
    <aside className="w-[30%] min-w-[280px] max-w-[420px] h-full flex flex-col border-l border-[var(--color-border)] glass">
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold">📁 Workspace</span>
        <span className="text-[10px] text-[var(--color-muted)] truncate" title={cwd}>{cwd ?? "no agent cwd"}</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
      </header>

      {!cwd ? (
        <div className="flex-1 grid place-items-center p-6 text-center text-sm text-[var(--color-muted)]">
          <div>
            <div className="text-3xl mb-2">🗂️</div>
            Enable the agent and set a working directory in Settings → Agent to browse the project here.
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 px-3 py-1.5 text-xs border-b border-[var(--color-border)]">
            <button onClick={up} className="px-1.5 py-0.5 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-30" disabled={!path && !file}>↑</button>
            <button onClick={() => refresh("")} className="px-1.5 py-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-accent-fg)]">root</button>
            {crumbs.map((c, i) => (
              <span key={i} className="text-[var(--color-muted)]">
                / <button className="hover:text-[var(--color-fg)]" onClick={() => refresh(crumbs.slice(0, i + 1).join("/"))}>{c}</button>
              </span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {error && <div className="p-3 text-xs text-[var(--color-danger)]">{error}</div>}
            {file ? (
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed">{file.content}</pre>
            ) : (
              entries.map((e) => (
                <button
                  key={e.name}
                  onClick={() => openEntry(e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] text-left"
                >
                  <span className="w-4 text-center">{e.dir ? "📁" : "📄"}</span>
                  <span className="flex-1 truncate text-[var(--color-fg-dim)]">{e.name}</span>
                  {!e.dir && <span className="text-[10px] text-[var(--color-muted)]">{fmtSize(e.size)}</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}
