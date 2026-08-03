import { useEffect, useState } from "react";
import type { ProviderConfig, Settings } from "@llmwebchat/shared";
import { useStore } from "../store.js";

const MASKED = "••••••••";

function ProviderRow({
  provider,
  hasKey,
  active,
  onChange,
}: {
  provider: ProviderConfig & { hasKey?: boolean };
  hasKey: boolean;
  active: boolean;
  onChange: (patch: Partial<ProviderConfig>) => void;
}) {
  const [keyInput, setKeyInput] = useState(hasKey ? MASKED : "");
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={provider.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="bg-transparent font-medium text-sm flex-1 outline-none focus:bg-[var(--color-surface-2)] px-1 rounded"
        />
        {hasKey && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
            key set
          </span>
        )}
        {active && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent-fg)]">
            active
          </span>
        )}
      </div>
      <input
        value={provider.baseURL}
        onChange={(e) => onChange({ baseURL: e.target.value })}
        placeholder="Base URL"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
      />
      <input
        type="password"
        value={keyInput}
        onChange={(e) => {
          const v = e.target.value;
          setKeyInput(v);
          if (v !== MASKED) onChange({ apiKey: v });
        }}
        placeholder="API key (stored in proxy, never in browser)"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const settings = useStore((s) => s.settings);
  const save = useStore((s) => s.saveSettings);
  const [draft, setDraft] = useState<Settings | null>(null);

  useEffect(() => {
    if (open && settings) setDraft(JSON.parse(JSON.stringify(settings)));
  }, [open, settings]);

  if (!open || !draft) return null;

  const patchProvider = (id: string, patch: Partial<ProviderConfig>) => {
    setDraft({
      ...draft,
      providers: draft.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const addProvider = () => {
    const id = "custom-" + Math.random().toString(36).slice(2, 7);
    setDraft({
      ...draft,
      providers: [
        ...draft.providers,
        {
          id,
          name: "Custom Provider",
          kind: "openai-compatible",
          baseURL: "https://",
          headers: {},
        },
      ],
    });
  };

  const removeProvider = (id: string) => {
    if (draft.providers.find((p) => p.id === id)?.builtin) return;
    setDraft({ ...draft, providers: draft.providers.filter((p) => p.id !== id) });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          <h2 className="font-semibold">Settings</h2>
          <button onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
              Default
            </h3>
            <textarea
              value={draft.defaultSystemPrompt ?? ""}
              onChange={(e) => setDraft({ ...draft, defaultSystemPrompt: e.target.value })}
              rows={3}
              placeholder="System prompt"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                Providers
              </h3>
              <button
                onClick={addProvider}
                className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {draft.providers.map((p) => {
                const stored = settings?.providers.find((s) => s.id === p.id);
                return (
                  <div key={p.id}>
                    <ProviderRow
                      provider={p}
                      hasKey={!!(stored?.apiKey)}
                      active={draft.activeProviderId === p.id}
                      onChange={(patch) => patchProvider(p.id, patch)}
                    />
                    <div className="flex gap-2 mt-1">
                      {!p.builtin && (
                        <button
                          onClick={() => removeProvider(p.id)}
                          className="text-[11px] text-red-400/70 hover:text-red-400"
                        >
                          remove
                        </button>
                      )}
                      <button
                        onClick={() => setDraft({ ...draft, activeProviderId: p.id })}
                        className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] ml-auto"
                      >
                        {draft.activeProviderId === p.id ? "✓ active" : "set active"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--color-muted)] mt-3">
              Add any OpenAI-compatible endpoint (local runners like Ollama/LM Studio,
              or cloud APIs). All providers speak the same protocol, so you can switch
              freely. Keys are stored in the proxy only — never in the browser.
            </p>
          </section>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-lg text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void save(draft);
              setOpen(false);
            }}
            className="px-4 py-2 rounded-lg text-sm bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
