import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, computePath } from "../store.js";
import { EMPTY_MSGS, EMPTY_CHILD } from "../lib/empty.js";
import { Message } from "./Message.js";
import { Composer } from "./Composer.js";
import { listModels } from "../lib/api.js";

export function ChatView() {
  const activeId = useStore((s) => s.activeId);
  const rawMsgs = useStore((s) => (s.activeId ? s.messagesByConv[s.activeId] ?? EMPTY_MSGS : EMPTY_MSGS));
  const activeChildMap = useStore((s) => (s.activeId ? s.activeChild[s.activeId] ?? EMPTY_CHILD : EMPTY_CHILD));
  const messages = useMemo(() => computePath(rawMsgs, activeChildMap), [rawMsgs, activeChildMap]);
  const stream = useStore((s) => s.stream);
  const settings = useStore((s) => s.settings);
  const newConversation = useStore((s) => s.newConversation);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const artifactOpen = useStore((s) => s.artifactOpen);
  const setArtifactOpen = useStore((s) => s.setArtifactOpen);
  const setArenaOpen = useStore((s) => s.setArenaOpen);
  const setConvSettingsOpen = useStore((s) => s.setConvSettingsOpen);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const activeProvider = settings?.providers.find((p) => p.id === settings.activeProviderId);
  const needsKey = activeProvider?.id !== "ollama" && activeProvider?.id !== "lmstudio" && activeProvider?.hasKey === false;

  // First-run reachability check: if the active provider can't be contacted
  // (e.g. Ollama isn't running), surface a helpful banner instead of cryptic errors.
  const [providerWarning, setProviderWarning] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setProviderWarning(null);
    if (!settings?.activeProviderId) return;
    listModels(settings.activeProviderId)
      .then((m) => {
        if (!alive) return;
        if ((!m || m.length === 0) && (activeProvider?.id === "ollama" || activeProvider?.id === "lmstudio")) {
          setProviderWarning(
            activeProvider.id === "ollama"
              ? "Ollama isn't reachable. Start it (ollama serve) and pull a model (ollama pull llama3.2), or switch provider in Settings."
              : "LM Studio isn't reachable. Start its local server, or switch provider in Settings.",
          );
        }
      })
      .catch(() => { if (alive) setProviderWarning(`Couldn't reach ${activeProvider?.name ?? "the provider"}. Check the base URL / key in Settings.`); });
    return () => { alive = false; };
  }, [settings?.activeProviderId, activeProvider?.id, activeProvider?.name]);

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] glass">
        <button
          onClick={() => useStore.getState().toggleSidebar()}
          className="text-[var(--color-muted)] hover:text-[var(--color-fg)] lg:hidden"
        >
          ☰
        </button>
        <div className="text-sm text-[var(--color-muted)] truncate">
          {activeProvider?.name} · {settings?.activeModel}
        </div>
        <button
          onClick={() => setConvSettingsOpen(true)}
          className="px-2 py-1 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          title="Conversation settings (system prompt, model, temperature)"
        >
          ⚙
        </button>
        <button
          onClick={() => useStore.getState().setTreeOpen(true)}
          className="px-2 py-1 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          title="Conversation tree"
        >
          🌳
        </button>
        <button
          onClick={() => useStore.getState().setCompareOpen(true)}
          className="px-2 py-1 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          title="Compare two branches (diff)"
        >
          ⇄
        </button>
        <button
          onClick={() => setArtifactOpen(!artifactOpen)}
          className={`ml-auto px-2 py-1 rounded-md text-xs border ${artifactOpen ? "border-[var(--color-accent)]/50 text-[var(--color-accent-fg)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
          title="Toggle Artifacts panel (⌘J)"
        >
          ◧ Artifacts
        </button>
        <button
          onClick={() => setArenaOpen(true)}
          className="px-2 py-1 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          title="Multi-model Arena"
        >
          ⚔ Arena
        </button>
        <button
          onClick={() => useStore.getState().setPaletteOpen(true)}
          className="px-2 py-1 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          title="Command palette (⌘K)"
        >
          ⌘K
        </button>
        {activeId && (
          <button
            onClick={() => useStore.getState().exportMarkdown(activeId)}
            className="px-2 py-1 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            title="Export conversation as Markdown"
          >
            ⤓
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center p-8 overflow-y-auto">
            <div className="text-center max-w-lg w-full">
              <div className="logo-mark w-16 h-16 mx-auto rounded-2xl grid place-items-center text-white text-3xl font-extrabold mb-5 animate-float">
                π
              </div>
              <h1 className="text-3xl font-extrabold mb-2 tracking-tight">
                <span className="gradient-text">Pi Studio</span>
              </h1>
              <p className="text-[var(--color-muted)] mb-6">
                Your local-first agent studio.{" "}
                {settings?.activeModel && activeProvider?.name
                  ? <>Talking to <span className="text-[var(--color-fg-dim)]">{settings.activeModel}</span> via <span className="text-[var(--color-fg-dim)]">{activeProvider.name}</span>.</>
                  : <span className="text-[var(--color-warn)]">No model selected yet — set one up below.</span>}
              </p>

              {providerWarning && (
                <div className="mb-3 p-3 rounded-xl glass text-sm text-[var(--color-warn)] text-left flex items-start gap-2">
                  <span>⚠️</span>
                  <span className="flex-1">{providerWarning}</span>
                  <button onClick={() => setSettingsOpen(true)} className="btn-primary text-xs px-2.5 py-1 rounded-lg shrink-0">Fix</button>
                </div>
              )}
              {needsKey && (
                <div className="mb-3 p-3 rounded-xl glass text-sm text-[var(--color-warn)] text-left flex items-center gap-2">
                  <span>🔑 This provider needs an API key.</span>
                  <button onClick={() => setSettingsOpen(true)} className="btn-primary text-xs px-2.5 py-1 rounded-lg ml-auto">Open Settings</button>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-2 text-left">
                {[
                  { t: "Explain a concept", s: "Explain transformers like I'm five" },
                  { t: "Write code", s: "Write a Python script to dedupe files in a folder" },
                  { t: "Design something", s: "Design a REST API for a todo app" },
                  { t: "Compare options", s: "Compare RAG vs fine-tuning, briefly" },
                ].map(({ t, s }) => (
                  <button
                    key={s}
                    onClick={() => useStore.getState().send(s)}
                    className="glass rounded-xl p-3 hover:ring-accent transition-all text-left group"
                  >
                    <div className="text-xs text-[var(--color-accent-fg)] mb-0.5">{t}</div>
                    <div className="text-sm text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)]">{s}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-6">
                Tip: enable <span className="text-[var(--color-accent-fg)]">🤖 agent</span> in the composer and point it at a project folder to give live instructions.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((m) => (
              <Message
                key={m.id}
                msg={m}
                streaming={stream?.assistantMessageId === m.id}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <Composer />
    </div>
  );
}
