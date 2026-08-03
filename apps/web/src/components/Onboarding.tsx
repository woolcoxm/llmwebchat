import { useState } from "react";
import { useStore } from "../store.js";
import type { ProviderConfig, Settings } from "@llmwebchat/shared";

type Engine = "llamacpp" | "ollama" | "openrouter" | "skip";

const ENGINES: { id: Engine; title: string; icon: string; desc: string }[] = [
  { id: "llamacpp", title: "llama.cpp", icon: "🦙", desc: "Your local llama.cpp server (OpenAI-compatible)" },
  { id: "ollama", title: "Ollama", icon: "🐪", desc: "Run models locally with Ollama" },
  { id: "openrouter", title: "Cloud (OpenRouter)", icon: "☁️", desc: "Use a cloud model with an API key" },
  { id: "skip", title: "Just look around", icon: "👀", desc: "Skip — I'll set up in Settings later" },
];

/** First-run wizard: pick an engine, connect, never see a blank dropdown. */
export function Onboarding() {
  const settings = useStore((s) => s.settings);
  const save = useStore((s) => s.saveSettings);
  const done = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [baseURL, setBaseURL] = useState("http://localhost:8080/v1");
  const [model, setModel] = useState("llama");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  if (!settings) return null;

  const finish = async (next: Settings) => {
    setBusy(true);
    await save(next);
    setBusy(false);
    done();
  };

  const choose = (e: Engine) => {
    setEngine(e);
    if (e === "llamacpp") { setBaseURL("http://localhost:8080/v1"); setModel("llama"); setStep(1); }
    else if (e === "ollama") { setBaseURL("http://localhost:11434/v1"); setModel("llama3.2"); setStep(1); }
    else if (e === "openrouter") { setBaseURL("https://openrouter.ai/api/v1"); setModel(""); setStep(1); }
    else { void finish(settings); } // skip
  };

  const apply = async () => {
    if (engine === "skip" || !engine) return void finish(settings);
    const id = engine;
    const provider: ProviderConfig = {
      id,
      name: ENGINES.find((x) => x.id === engine)!.title,
      kind: "openai-compatible",
      baseURL: baseURL.replace(/\/$/, ""),
      apiKey: engine === "openrouter" ? key : engine === "ollama" ? "ollama" : "none",
      headers: {},
    };
    // replace or add the provider, set active
    const providers = [...settings.providers.filter((p) => p.id !== id), provider];
    const next: Settings = { ...settings, providers, activeProviderId: id, activeModel: model || "local" };
    await finish(next);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" style={{ background: "rgba(5,4,10,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-lg rounded-2xl glass-strong shadow-2xl overflow-hidden">
        <div className="p-6 text-center border-b border-[var(--color-border)]">
          <div className="logo-mark w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white text-2xl font-extrabold mb-3 animate-float">π</div>
          <h1 className="text-2xl font-extrabold tracking-tight"><span className="gradient-text">Pi Studio</span></h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {step === 0 ? "Let's get you running in 10 seconds." : "Connect your model"}
          </p>
        </div>

        {step === 0 && (
          <div className="p-5 grid gap-2">
            {ENGINES.map((e) => (
              <button
                key={e.id}
                onClick={() => choose(e.id)}
                className="flex items-center gap-3 p-3 rounded-xl glass hover:ring-accent transition-all text-left"
              >
                <span className="text-2xl">{e.icon}</span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-[var(--color-fg)]">{e.title}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{e.desc}</span>
                </span>
                <span className="text-[var(--color-muted)]">→</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && engine !== "skip" && (
          <div className="p-5 space-y-3">
            <label className="block">
              <span className="text-xs text-[var(--color-muted)]">Server URL</span>
              <input value={baseURL} onChange={(ev) => setBaseURL(ev.target.value)} className="w-full mt-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-accent" />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted)]">Model name {engine === "llamacpp" && "(your --alias)"}</span>
              <input value={model} onChange={(ev) => setModel(ev.target.value)} placeholder="e.g. llama3.2" className="w-full mt-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-accent" />
            </label>
            {engine === "openrouter" && (
              <label className="block">
                <span className="text-xs text-[var(--color-muted)]">API key</span>
                <input type="password" value={key} onChange={(ev) => setKey(ev.target.value)} placeholder="sk-or-..." className="w-full mt-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-accent" />
              </label>
            )}
            {(engine === "llamacpp" || engine === "ollama") && (
              <p className="text-[11px] text-[var(--color-muted)]">
                {engine === "llamacpp" ? "Start it with: llama-server -m model.gguf --port 8080 --alias llama" : "Start Ollama and run: ollama pull llama3.2"}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(0)} className="px-3 py-2 rounded-lg glass text-sm text-[var(--color-muted)]">Back</button>
              <button onClick={apply} disabled={busy} className="flex-1 btn-primary rounded-lg py-2 text-sm font-medium">
                {busy ? "Saving…" : "Connect & start →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
