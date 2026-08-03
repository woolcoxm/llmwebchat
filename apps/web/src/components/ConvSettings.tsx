import { useState } from "react";
import { useStore } from "../store.js";

/** Per-conversation overrides: system prompt, model, temperature. */
export function ConvSettings() {
  const open = useStore((s) => s.convSettingsOpen);
  const setOpen = useStore((s) => s.setConvSettingsOpen);
  const activeId = useStore((s) => s.activeId);
  const conv = useStore((s) => s.conversations.find((c) => c.id === s.activeId));
  const settings = useStore((s) => s.settings);
  const setConvSettings = useStore((s) => s.setConvSettings);

  const [systemPrompt, setSystemPrompt] = useState(conv?.systemPrompt ?? "");
  const [model, setModel] = useState(conv?.model ?? "");
  const [temperature, setTemperature] = useState<string>(conv?.temperature?.toString() ?? "");

  if (!open || !conv) return null;
  const defaultModel = settings?.activeModel ?? "";

  const save = () => {
    setConvSettings(conv.id, {
      systemPrompt: systemPrompt.trim() || undefined,
      model: model.trim() || undefined,
      temperature: temperature.trim() ? Number(temperature) : undefined,
    });
    setOpen(false);
  };

  const clear = () => {
    setSystemPrompt("");
    setModel("");
    setTemperature("");
    setConvSettings(conv.id, { systemPrompt: undefined, model: undefined, temperature: undefined });
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
          <span className="font-medium text-sm">Conversation settings</span>
          <span className="text-xs text-[var(--color-muted)] ml-2 truncate">{conv.title}</span>
          <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">System prompt (override)</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder={`Defaults to the global system prompt. Set a persona/instructions for just this chat…`}
              className="w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Model (override)</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={`default: ${defaultModel}`}
                className="w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Temperature (override)</label>
              <input
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                inputMode="decimal"
                placeholder="default: provider"
                className="w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            Overrides apply only to this conversation and take effect on the next message. Leave blank to use defaults.
          </p>
        </div>
        <div className="flex justify-between gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button onClick={clear} className="text-xs text-[var(--color-muted)] hover:text-red-400">reset to defaults</button>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-accent)] text-white">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
