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
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)]">
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
          <div className="h-full grid place-items-center p-8">
            <div className="text-center max-w-md">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-accent)] grid place-items-center text-white text-2xl font-bold mb-4">
                L
              </div>
              <h1 className="text-2xl font-semibold mb-2">LLMWebChat</h1>
              <p className="text-[var(--color-muted)] mb-6">
                A provider-agnostic chat, talking to{" "}
                <span className="text-[var(--color-fg)]">{settings?.activeModel}</span> via{" "}
                <span className="text-[var(--color-fg)]">{activeProvider?.name}</span>.
              </p>
              {providerWarning && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-300">
                  {providerWarning}
                </div>
              )}
              {needsKey && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-300">
                  This provider needs configuration (API key or a running local server).
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="underline ml-1"
                  >
                    Open Settings →
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Explain transformers like I'm five",
                  "Write a Python script to dedupe files",
                  "Design a REST API for a todo app",
                  "Compare RAG vs fine-tuning",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => useStore.getState().send(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
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
