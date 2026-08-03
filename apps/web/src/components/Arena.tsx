import { useEffect, useRef, useState } from "react";
import { useStore } from "../store.js";
import { listModels } from "../lib/api.js";
import { Markdown } from "./Markdown.js";
import type { ModelInfo, ProviderConfig } from "@llmwebchat/shared";

export function Arena() {
  const open = useStore((s) => s.arenaOpen);
  const setOpen = useStore((s) => s.setArenaOpen);
  const settings = useStore((s) => s.settings);
  const models = useStore((s) => s.arenaModels);
  const setArenaModel = useStore((s) => s.setArenaModel);
  const addColumn = useStore((s) => s.addArenaColumn);
  const removeColumn = useStore((s) => s.removeArenaColumn);
  const cols = useStore((s) => s.arenaCols);
  const running = useStore((s) => s.arenaRunning);
  const runArena = useStore((s) => s.runArena);
  const stopArena = useStore((s) => s.stopArena);
  const pickWinner = useStore((s) => s.pickWinner);
  const winner = useStore((s) => s.arenaWinner);
  const [prompt, setPrompt] = useState("");

  // Seed two columns the first time the arena opens.
  useEffect(() => {
    if (open && settings && models.length === 0) {
      const ps = settings.providers;
      useStore.setState((s) => ({
        arenaModels: [
          { providerId: ps[0]?.id ?? "ollama", model: ps[0]?.models?.[0]?.id ?? settings.activeModel },
          { providerId: ps[1]?.id ?? ps[0]?.id ?? "ollama", model: ps[1]?.models?.[0]?.id ?? settings.activeModel },
        ],
      }));
    }
  }, [open, settings, models.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)]">
        <span className="font-medium">⚔ Arena</span>
        <span className="text-xs text-[var(--color-muted)]">
          Compare {models.length} model{models.length !== 1 ? "s" : ""} on one prompt
        </span>
        <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          ✕ close
        </button>
      </header>

      {/* column model pickers */}
      <div className="flex gap-3 px-4 py-2 border-b border-[var(--color-border)] overflow-x-auto">
        {models.map((m, i) => (
          <ColumnPicker
            key={i}
            index={i}
            value={m}
            providers={settings?.providers ?? []}
            onChange={(nv) => setArenaModel(i, nv)}
            onRemove={models.length > 1 ? () => removeColumn(i) : undefined}
          />
        ))}
        {models.length < 4 && (
          <button
            onClick={addColumn}
            className="shrink-0 px-3 rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-accent)]/40"
          >
            + model
          </button>
        )}
      </div>

      {/* prompt bar */}
      <div className="px-4 py-2 border-b border-[var(--color-border)] flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && runArena(prompt)}
          placeholder="Ask all models the same question…"
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        {running ? (
          <button onClick={stopArena} className="px-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm">
            Stop
          </button>
        ) : (
          <button
            onClick={() => runArena(prompt)}
            disabled={!prompt.trim() || models.length === 0}
            className="px-4 rounded-lg bg-[var(--color-accent)] text-white text-sm disabled:opacity-30"
          >
            Run all
          </button>
        )}
      </div>

      {/* streaming columns */}
      <div className="flex-1 overflow-hidden flex gap-3 p-3">
        {cols.length === 0 ? (
          <div className="m-auto text-sm text-[var(--color-muted)] text-center">
            Pick your models above, type a prompt, and hit <strong>Run all</strong> to stream side-by-side answers.
          </div>
        ) : (
          cols.map((c, i) => (
            <div
              key={i}
              className={`flex-1 min-w-0 flex flex-col rounded-xl border bg-[var(--color-surface)] overflow-hidden ${
                winner === i ? "border-[var(--color-accent)]/60 ring-1 ring-[var(--color-accent)]/40" : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <span className="text-xs font-medium truncate">
                  {settings?.providers.find((p) => p.id === c.providerId)?.name ?? c.providerId} / {c.model}
                </span>
                <span className="text-[10px] text-[var(--color-muted)] ml-auto">
                  {c.status === "streaming" ? "● streaming" : c.status}
                </span>
                <button
                  onClick={() => pickWinner(i)}
                  className={`text-xs ${winner === i ? "opacity-100" : "opacity-30 hover:opacity-100"}`}
                  title="Pick winner"
                >
                  🏆
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 text-sm">
                {c.content ? (
                  <Markdown content={c.content} />
                ) : c.status === "streaming" ? (
                  <span className="stream-caret text-[var(--color-muted)]">…</span>
                ) : (
                  <span className="text-[var(--color-muted)] text-xs">No output</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ColumnPicker({
  index,
  value,
  providers,
  onChange,
  onRemove,
}: {
  index: number;
  value: { providerId: string; model: string };
  providers: ProviderConfig[];
  onChange: (m: { providerId: string; model: string }) => void;
  onRemove?: () => void;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const ref = useRef<{ providerId: string; done: boolean }>({ providerId: value.providerId, done: false });

  useEffect(() => {
    let alive = true;
    ref.current = { providerId: value.providerId, done: false };
    listModels(value.providerId)
      .then((m) => alive && (ref.current.done = true) && setModels(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value.providerId]);

  const provider = providers.find((p) => p.id === value.providerId);
  const options = models.length ? models : provider?.models ?? [];

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <span className="text-[10px] text-[var(--color-muted)]">#{index + 1}</span>
      <select
        value={value.providerId}
        onChange={(e) => {
          const p = providers.find((x) => x.id === e.target.value);
          onChange({ providerId: e.target.value, model: p?.models?.[0]?.id ?? value.model });
        }}
        className="bg-transparent text-xs outline-none max-w-[120px]"
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <span className="text-[var(--color-muted)] text-xs">/</span>
      <select
        value={value.model}
        onChange={(e) => onChange({ providerId: value.providerId, model: e.target.value })}
        className="bg-transparent text-xs outline-none max-w-[150px]"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>{m.name ?? m.id}</option>
        ))}
      </select>
      {onRemove && (
        <button onClick={onRemove} className="text-[var(--color-muted)] hover:text-red-400 text-xs ml-1">✕</button>
      )}
    </div>
  );
}
