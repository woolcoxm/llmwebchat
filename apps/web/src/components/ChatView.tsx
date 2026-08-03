import { useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { Message } from "./Message.js";
import { Composer } from "./Composer.js";

export function ChatView() {
  const activeId = useStore((s) => s.activeId);
  const messages = useStore((s) => (activeId ? s.messagesByConv[activeId] : undefined) ?? []);
  const stream = useStore((s) => s.stream);
  const settings = useStore((s) => s.settings);
  const newConversation = useStore((s) => s.newConversation);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const activeProvider = settings?.providers.find((p) => p.id === settings.activeProviderId);
  const needsKey = activeProvider?.hasKey === false && activeProvider?.id !== "ollama";

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
                An advanced, provider-agnostic chat. Talking to{" "}
                <span className="text-[var(--color-fg)]">{settings?.activeModel}</span> via{" "}
                <span className="text-[var(--color-fg)]">{activeProvider?.name}</span>.
              </p>
              {needsKey && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-300">
                  This provider has no API key set.
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="underline ml-1"
                  >
                    Add key →
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
