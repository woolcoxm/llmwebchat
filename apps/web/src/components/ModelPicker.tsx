import { useEffect, useState } from "react";
import type { ModelInfo } from "@llmwebchat/shared";
import { useStore } from "../store.js";
import { listModels } from "../lib/api.js";

export function ModelPicker() {
  const settings = useStore((s) => s.settings);
  const saveSettings = useStore((s) => s.saveSettings);
  const activeProviderId = settings?.activeProviderId ?? "zai";
  const activeModel = settings?.activeModel ?? "glm-5.2";
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const provider = settings?.providers.find((p) => p.id === activeProviderId);
  const presetModels = provider?.models ?? [];

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listModels(activeProviderId)
      .then((m) => alive && setModels(m))
      .catch(() => alive && setModels(presetModels))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProviderId]);

  // de-dupe preset + live
  const seen = new Set<string>();
  const merged = [...models, ...presetModels].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const setProvider = (id: string) => {
    if (!settings) return;
    const p = settings.providers.find((x) => x.id === id);
    saveSettings({
      ...settings,
      activeProviderId: id,
      activeModel: p?.models?.[0]?.id ?? settings.activeModel,
    });
  };
  const setModel = (m: string) => settings && saveSettings({ ...settings, activeModel: m });

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={activeProviderId}
        onChange={(e) => setProvider(e.target.value)}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] max-w-[150px]"
      >
        {settings?.providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-[var(--color-muted)]">/</span>
      <select
        value={activeModel}
        onChange={(e) => setModel(e.target.value)}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] max-w-[180px]"
      >
        {loading && <option>loading…</option>}
        {merged.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.id}
            {m.reasoning ? " 🧠" : ""}
            {m.vision ? " 👁" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
