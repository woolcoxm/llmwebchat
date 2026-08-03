import { useEffect, useState } from "react";
import type { AgentConfig, CustomTool, McpServerConfig, ProviderConfig, Settings, ToolsConfig } from "@llmwebchat/shared";
import { deleteKbItem, ingestKb, listKb, useLocalAgentForAgent } from "../lib/api.js";
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

  const patchTools = (patch: Partial<ToolsConfig>) =>
    setDraft({ ...draft, tools: { ...draft.tools, workspaceRoot: draft.tools?.workspaceRoot, ...patch } });

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
            <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Memory (global)</h3>
            <textarea
              value={(draft.memory ?? []).join("\n")}
              onChange={(e) => setDraft({ ...draft, memory: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              rows={4}
              placeholder={"One fact per line — injected into every chat's system context.\ne.g. Prefers concise answers\n     Works in TypeScript / React"}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <p className="text-[11px] text-[var(--color-muted)] mt-1">Recalled across all conversations (unless a chat sets its own system prompt).</p>
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

          <section>
            <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
              Tools (server-side)
            </h3>
            <input
              value={draft.tools?.workspaceRoot ?? ""}
              onChange={(e) => setDraft({ ...draft, tools: { ...draft.tools, workspaceRoot: e.target.value } })}
              placeholder="Workspace root (absolute path, e.g. /home/me/project)"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] mb-2"
            />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Toggle label="🌐 web_search / web_reader" checked={draft.tools?.allowWeb !== false} onChange={(v) => patchTools({ allowWeb: v })} />
              <Toggle label="📁 read_file" checked={!!draft.tools?.workspaceRoot && draft.tools?.allowFiles !== false} onChange={(v) => patchTools({ allowFiles: v })} disabled={!draft.tools?.workspaceRoot} />
              <Toggle label="✏️ write_file" checked={draft.tools?.allowWriteFiles === true} onChange={(v) => patchTools({ allowWriteFiles: v })} disabled={!draft.tools?.workspaceRoot} />
              <Toggle label="⚙️ run_bash" checked={draft.tools?.allowBash === true} onChange={(v) => patchTools({ allowBash: v })} disabled={!draft.tools?.workspaceRoot} />
            </div>
            <label className="flex items-center gap-2 mt-2 text-sm text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={draft.tools?.toolApproval !== "never"}
                onChange={(e) => patchTools({ toolApproval: e.target.checked ? "destructive" : "never" })}
                className="accent-[var(--color-accent)]"
              />
              <span>🛡️ Require approval for destructive tools (write_file, run_bash, MCP)</span>
            </label>
            <p className="text-[11px] text-[var(--color-muted)] mt-3">
              File & bash tools are sandboxed to the workspace root (path traversal blocked).
              <strong> run_bash</strong> and <strong>write_file</strong> are off by default — enable
              only in folders you trust. Web tools block SSRF (private/localhost/metadata IPs).
            </p>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                MCP servers (stdio)
              </h3>
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    tools: {
                      ...draft.tools,
                      mcpServers: [
                        ...(draft.tools?.mcpServers ?? []),
                        { name: "server-" + (draft.tools?.mcpServers?.length ?? 0), command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] },
                      ],
                    },
                  })
                }
                className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
              >
                + Server
              </button>
            </div>
            <div className="space-y-2">
              {(draft.tools?.mcpServers ?? []).map((s, i) => (
                <McpRow
                  key={i}
                  server={s}
                  onChange={(ns) =>
                    setDraft({
                      ...draft,
                      tools: {
                        ...draft.tools,
                        mcpServers: (draft.tools?.mcpServers ?? []).map((x, j) => (j === i ? ns : x)),
                      },
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      tools: {
                        ...draft.tools,
                        mcpServers: (draft.tools?.mcpServers ?? []).filter((_, j) => j !== i),
                      },
                    })
                  }
                />
              ))}
              {(draft.tools?.mcpServers?.length ?? 0) === 0 && (
                <p className="text-[11px] text-[var(--color-muted)]">
                  No MCP servers. Add e.g. the filesystem or fetch server; its tools become callable by the model.
                </p>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Custom HTTP tools</h3>
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    tools: {
                      ...draft.tools,
                      customTools: [
                        ...(draft.tools?.customTools ?? []),
                        { name: "tool-" + (draft.tools?.customTools?.length ?? 0), description: "", url: "https://", method: "POST" },
                      ],
                    },
                  })
                }
                className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
              >
                + Tool
              </button>
            </div>
            <div className="space-y-2">
              {(draft.tools?.customTools ?? []).map((ct, i) => (
                <CustomToolRow
                  key={i}
                  tool={ct}
                  onChange={(nt) =>
                    setDraft({
                      ...draft,
                      tools: {
                        ...draft.tools,
                        customTools: (draft.tools?.customTools ?? []).map((x, j) => (j === i ? nt : x)),
                      },
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      tools: { ...draft.tools, customTools: (draft.tools?.customTools ?? []).filter((_, j) => j !== i) },
                    })
                  }
                />
              ))}
              {(draft.tools?.customTools?.length ?? 0) === 0 && (
                <p className="text-[11px] text-[var(--color-muted)]">
                  Wire any HTTP endpoint as a model-callable tool. The model's arguments are POSTed as JSON <code>{`{arguments}`}</code>.
                </p>
              )}
            </div>
          </section>

          <KnowledgeBaseSection embeddingModel={draft.tools?.embeddingModel ?? "nomic-embed-text"} onModel={(m) => patchTools({ embeddingModel: m })} />

          <AgentSection
            agent={draft.agent ?? {}}
            onChange={(a) => setDraft({ ...draft, agent: { ...draft.agent, ...a } })}
            activeProviderId={settings?.activeProviderId}
            activeModel={settings?.activeModel}
            onUseLocal={async () => {
              if (!settings?.activeProviderId) return;
              const r = await useLocalAgentForAgent(settings.activeProviderId, settings.activeModel);
              if (r.ok) {
                setDraft({ ...draft, agent: { ...draft.agent, enabled: true, provider: r.provider, model: r.model } });
                await useStore.getState().loadSettings();
              } else {
                alert(r.error || "Could not configure local agent.");
              }
            }}
          />

          <section>
            <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Backup</h3>
            <div className="flex gap-2">
              <button onClick={() => useStore.getState().exportJSON()} className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:border-[var(--color-accent)]/50">⤓ Export all (JSON)</button>
              <label className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-center cursor-pointer hover:border-[var(--color-accent)]/50">
                ⤒ Import (JSON)
                <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    try { const ok = useStore.getState().importJSON(JSON.parse(String(r.result))); alert(ok ? "Imported." : "Invalid backup file."); }
                    catch { alert("Invalid backup file."); }
                  };
                  r.readAsText(f);
                  e.target.value = "";
                }} />
              </label>
            </div>
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

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
        disabled ? "opacity-40 cursor-not-allowed border-[var(--color-border)]" : checked ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[var(--color-accent)]/30"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--color-accent)]"
      />
      <span className="text-[var(--color-fg)]">{label}</span>
    </label>
  );
}

function McpRow({
  server,
  onChange,
  onRemove,
}: {
  server: McpServerConfig;
  onChange: (s: McpServerConfig) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-2 space-y-1.5">
      <div className="flex gap-2">
        <input
          value={server.name}
          onChange={(e) => onChange({ ...server, name: e.target.value })}
          placeholder="name"
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
        />
        <button onClick={onRemove} className="text-[11px] text-red-400/70 hover:text-red-400 px-1">remove</button>
      </div>
      <input
        value={server.command}
        onChange={(e) => onChange({ ...server, command: e.target.value })}
        placeholder="command (e.g. npx)"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
      />
      <input
        value={(server.args ?? []).join(" ")}
        onChange={(e) => onChange({ ...server, args: e.target.value.split(" ").filter(Boolean) })}
        placeholder="args (space-separated)"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

function AgentSection({ agent, onChange, activeProviderId, activeModel, onUseLocal }: {
  agent: AgentConfig;
  onChange: (a: Partial<AgentConfig>) => void;
  activeProviderId?: string;
  activeModel?: string;
  onUseLocal: () => Promise<void>;
}) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Agent (pi)</h3>
      {activeProviderId && (
        <button
          onClick={onUseLocal}
          className="w-full mb-3 btn-primary rounded-xl px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-2"
          title="Register your current model with pi and run the agent on it"
        >
          ⚡ Use my current model ({activeModel ?? "?"}) for the agent
        </button>
      )}
      <label className="flex items-center gap-2 mb-2 text-sm text-[var(--color-fg)]">
        <input
          type="checkbox"
          checked={agent.enabled === true}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="accent-[var(--color-accent)]"
        />
        Enable agent mode — route prompts through a real <strong>pi</strong> agent (tools, skills, plans)
      </label>
      <input
        value={agent.cwd ?? ""}
        onChange={(e) => onChange({ cwd: e.target.value })}
        placeholder="Working directory (absolute path the agent operates in), e.g. C:\\Users\\Mark\\project"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] mb-2"
      />
      <div className="grid grid-cols-2 gap-2">
        <input value={agent.bin ?? ""} onChange={(e) => onChange({ bin: e.target.value })} placeholder="pi binary (default: pi)" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
        <input value={agent.provider ?? ""} onChange={(e) => onChange({ provider: e.target.value })} placeholder="provider override (optional)" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
      </div>
      <input value={agent.model ?? ""} onChange={(e) => onChange({ model: e.target.value })} placeholder="model override (optional, e.g. glm-5.2:high)" className="w-full mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
      <p className="text-[11px] text-[var(--color-muted)] mt-2">
        When agent mode is on, the composer routes through pi (<code>pi --mode rpc</code>). pi uses its own auth/config
        (your <code>/login</code> or env keys). The agent runs real tools in the working directory — point it at a folder you trust.
      </p>
    </section>
  );
}

function CustomToolRow({
  tool,
  onChange,
  onRemove,
}: {
  tool: CustomTool;
  onChange: (t: CustomTool) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-2 space-y-1.5">
      <div className="flex gap-2">
        <input value={tool.name} onChange={(e) => onChange({ ...tool, name: e.target.value })} placeholder="name" className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
        <select value={tool.method ?? "POST"} onChange={(e) => onChange({ ...tool, method: e.target.value as "POST" | "GET" })} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-1 text-xs">
          <option>POST</option>
          <option>GET</option>
        </select>
        <button onClick={onRemove} className="text-[11px] text-red-400/70 hover:text-red-400 px-1">remove</button>
      </div>
      <input value={tool.url} onChange={(e) => onChange({ ...tool, url: e.target.value })} placeholder="https://endpoint" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
      <input value={tool.description} onChange={(e) => onChange({ ...tool, description: e.target.value })} placeholder="description (what the model should use it for)" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
      <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
        <input type="checkbox" checked={tool.allowPrivate === true} onChange={(e) => onChange({ ...tool, allowPrivate: e.target.checked })} className="accent-[var(--color-accent)]" />
        allow private/localhost targets (SSRF risk — only for trusted local endpoints)
      </label>
    </div>
  );
}

function KnowledgeBaseSection({
  embeddingModel,
  onModel,
}: {
  embeddingModel: string;
  onModel: (m: string) => void;
}) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listKb>>>([]);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const refresh = () => listKb().then(setItems).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);
  const ingest = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setStatus("embedding…");
    const r = await ingestKb(text, source || undefined);
    setBusy(false);
    if (r.error) setStatus(`⚠️ ${r.error}`);
    else { setStatus(`✓ ingested ${r.ingested} chunk(s) via ${r.model}`); setText(""); setSource(""); refresh(); }
  };
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Knowledge base (RAG)</h3>
        <input
          value={embeddingModel}
          onChange={(e) => onModel(e.target.value)}
          placeholder="embedding model"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] w-40 outline-none focus:border-[var(--color-accent)]"
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Paste document text to ingest (chunked + embedded, then retrievable via the knowledge_search tool)…"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <div className="flex items-center gap-2 mt-1">
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="source label (optional)"
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
        />
        <button
          onClick={ingest}
          disabled={busy || !text.trim()}
          className="px-3 py-1 rounded text-xs bg-[var(--color-accent)] text-white disabled:opacity-30"
        >
          {busy ? "…" : "Ingest"}
        </button>
        <button onClick={refresh} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">refresh</button>
      </div>
      {status && <p className="text-[11px] text-[var(--color-muted)] mt-1">{status}</p>}
      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
            <span className="truncate flex-1">📄 {it.source}</span>
            <button onClick={() => { deleteKbItem(it.id).then(refresh); }} className="hover:text-red-400">✕</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-[11px] text-[var(--color-muted)]">Empty — ingest text above (needs the embedding model on a provider).</p>}
      </div>
    </section>
  );
}
