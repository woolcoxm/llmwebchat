/**
 * App store. Conversations are stored as a tree (each message has parentId);
 * an `activeChild` map selects which branch is shown. The displayed "active
 * path" walks root → active tip. Branching = adding a sibling + repointing.
 *
 * Conversations + messages + activeChild persist to localStorage; settings
 * mirror the server (secrets never leave the proxy). Streaming state is ephemeral.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  ChatMessage,
  Conversation,
  ReasoningEffort,
  Settings,
} from "@llmwebchat/shared";
import { getSettings, saveSettings, streamChat } from "./lib/api.js";

interface StreamState {
  conversationId: string;
  assistantMessageId: string;
  controller: AbortController;
}

interface ArenaModel {
  providerId: string;
  model: string;
}
interface ArenaCol {
  providerId: string;
  model: string;
  content: string;
  reasoning: string;
  status: "streaming" | "done" | "error" | "stopped";
  controller?: AbortController;
}

interface PromptTemplate {
  id: string;
  title: string;
  body: string;
}

interface AppState {
  /* settings (server-backed) */
  settings: Settings | null;
  settingsLoading: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;

  /* conversations (local, tree-structured) */
  conversations: Conversation[];
  activeId: string | null;
  messagesByConv: Record<string, ChatMessage[]>;
  /** convId -> (parentId -> chosen childId) for branch selection */
  activeChild: Record<string, Record<string, string>>;
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  setConvSettings: (id: string, patch: { systemPrompt?: string; model?: string; temperature?: number }) => void;
  /** Duplicate the active branch of a conversation into a new conversation. */
  forkConversation: (convId: string) => string | null;
  /** Auto-generate a short title for a conversation via the model. */
  autoTitle: (convId: string) => Promise<void>;
  /** Download all conversations + trees as a JSON backup. */
  exportJSON: () => void;
  /** Merge a JSON backup into the store. */
  importJSON: (data: unknown) => boolean;
  addMessage: (convId: string, msg: ChatMessage) => void;
  patchMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  /** Walk root → active tip for a conversation. */
  activePath: (convId: string) => ChatMessage[];
  /** Siblings (same parent) of a message, in creation order. */
  siblingsOf: (convId: string, msgId: string) => ChatMessage[];
  setActiveChild: (convId: string, parentId: string, childId: string) => void;
  /** Download the active conversation (active path) as Markdown. */
  exportMarkdown: (convId: string) => void;

  /* composer prefs */
  reasoningEffort: ReasoningEffort;
  setReasoningEffort: (e: ReasoningEffort) => void;
  allowTools: boolean;
  setAllowTools: (b: boolean) => void;

  /* actions that produce new branches */
  send: (text: string, attachments?: ChatMessage["attachments"]) => Promise<void>;
  regenerate: (assistantMessageId: string) => Promise<void>;
  editResubmit: (userMessageId: string, newText: string) => Promise<void>;
  continueFrom: (assistantMessageId: string) => Promise<void>;

  /* streaming */
  stream: StreamState | null;
  stop: () => void;

  /* ui */
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  artifactOpen: boolean;
  setArtifactOpen: (b: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (b: boolean) => void;

  /* prompt snippets */
  snippetsOpen: boolean;
  setSnippetsOpen: (b: boolean) => void;
  promptTemplates: PromptTemplate[];
  addPromptTemplate: (title: string, body: string) => void;
  removePromptTemplate: (id: string) => void;
  pendingInsert: string | null;
  setPendingInsert: (s: string | null) => void;

  /* tree view */
  treeOpen: boolean;
  setTreeOpen: (b: boolean) => void;
  convSettingsOpen: boolean;
  setConvSettingsOpen: (b: boolean) => void;
  compareOpen: boolean;
  setCompareOpen: (b: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (b: boolean) => void;
  /** Make `msgId` the active tip by repointing activeChild along its path from root. */
  activatePathTo: (convId: string, msgId: string) => void;

  /* arena (multi-model compare) */
  arenaOpen: boolean;
  setArenaOpen: (b: boolean) => void;
  arenaModels: ArenaModel[];
  setArenaModel: (index: number, m: ArenaModel) => void;
  addArenaColumn: () => void;
  removeArenaColumn: (index: number) => void;
  arenaCols: ArenaCol[];
  arenaRunning: boolean;
  runArena: (prompt: string) => void;
  stopArena: () => void;
  pickWinner: (index: number) => void;
  arenaWinner: number | null;
}

/** Pure path-walk used both inside the store and by selectors. */
export function computePath(
  msgs: ChatMessage[],
  ac: Record<string, string>,
): ChatMessage[] {
  if (!msgs.length) return [];
  const byParent = new Map<string | null, ChatMessage[]>();
  for (const m of msgs) {
    const k = m.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(m);
  }
  const roots = (byParent.get(null) ?? []).sort((a, b) => a.createdAt - b.createdAt);
  if (!roots.length) return [];
  const path: ChatMessage[] = [];
  let cur: ChatMessage | undefined = roots[0];
  while (cur) {
    path.push(cur);
    const children = (byParent.get(cur.id) ?? []).sort((a, b) => a.createdAt - b.createdAt);
    if (!children.length) break;
    const activeChildId: string | undefined = ac[cur.id];
    cur = activeChildId ? children.find((c) => c.id === activeChildId) ?? children[0] : children[0];
  }
  return path;
}

/** Start a streaming run for an existing context (root..userMsg). */
function runStream(
  convId: string,
  context: ChatMessage[],
  userMsg: ChatMessage,
  assistantId: string,
  set: (fn: (s: AppState) => Partial<AppState>) => void,
  get: () => AppState,
) {
  const settings = get().settings;
  if (!settings) return;
  const conv = get().conversations.find((c) => c.id === convId);
  const model = conv?.model ?? settings.activeModel;
  const temperature = conv?.temperature ?? settings.temperature;
  const messages =
    conv?.systemPrompt && context[0]?.role !== "system"
      ? ([{ id: "sys", role: "system", content: conv.systemPrompt, createdAt: 0 } as ChatMessage, ...context])
      : context;
  const controller = streamChat(
    {
      conversationId: convId,
      messages,
      providerId: settings.activeProviderId,
      model,
      reasoningEffort: get().reasoningEffort,
      temperature,
      allowTools: get().allowTools,
      approvalPolicy: settings.tools?.toolApproval ?? "destructive",
      enabledTools: [],
    },
    (ev) => {
      const cur = () =>
        get().messagesByConv[convId]?.find((m) => m.id === assistantId);
      if (ev.type === "delta") {
        get().patchMessage(convId, assistantId, { content: (cur()?.content ?? "") + ev.content });
      } else if (ev.type === "reasoning") {
        get().patchMessage(convId, assistantId, { reasoning: (cur()?.reasoning ?? "") + ev.content });
      } else if (ev.type === "tool_call") {
        get().patchMessage(convId, assistantId, { toolCalls: [...(cur()?.toolCalls ?? []), ev.toolCall] });
      } else if (ev.type === "tool_result") {
        get().patchMessage(convId, assistantId, { toolResults: [...(cur()?.toolResults ?? []), ev.result] });
      } else if (ev.type === "approval_request") {
        get().patchMessage(convId, assistantId, {
          pendingApprovals: [
            ...(cur()?.pendingApprovals ?? []),
            { toolCallId: ev.toolCall.id, approvalId: ev.id },
          ],
        });
      } else if (ev.type === "finish") {
        if (ev.usage) get().patchMessage(convId, assistantId, { usage: ev.usage });
      } else if (ev.type === "error") {
        get().patchMessage(convId, assistantId, {
          content: (cur()?.content ?? "") + `\n\n> ⚠️ ${ev.message}`,
        });
      }
    },
    (err) => {
      const cur = () => get().messagesByConv[convId]?.find((m) => m.id === assistantId);
      get().patchMessage(convId, assistantId, {
        content: (cur()?.content ?? "") + `\n\n> ⚠️ ${err.message}`,
      });
    },
    () => set(() => ({ stream: null })),
  );
  set(() => ({ stream: { conversationId: convId, assistantMessageId: assistantId, controller } }));
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: null,
      settingsLoading: false,
      async loadSettings() {
        set({ settingsLoading: true });
        const s = await getSettings();
        set({ settings: s, settingsLoading: false });
      },
      async saveSettings(s) {
        const saved = await saveSettings(s);
        set({ settings: saved });
      },

      conversations: [],
      activeId: null,
      messagesByConv: {},
      activeChild: {},
      newConversation() {
        const id = nanoid();
        const conv: Conversation = { id, title: "New chat", createdAt: Date.now(), updatedAt: Date.now() };
        set((st) => ({
          conversations: [conv, ...st.conversations],
          activeId: id,
          messagesByConv: { ...st.messagesByConv, [id]: [] },
        }));
        return id;
      },
      selectConversation(id) {
        set({ activeId: id });
      },
      deleteConversation(id) {
        set((st) => {
          const { [id]: _m, ...rest } = st.messagesByConv;
          const { [id]: _a, ...restChild } = st.activeChild;
          const conversations = st.conversations.filter((c) => c.id !== id);
          const activeId = st.activeId === id ? conversations[0]?.id ?? null : st.activeId;
          return { conversations, messagesByConv: rest, activeChild: restChild, activeId };
        });
      },
      renameConversation(id, title) {
        set((st) => ({
          conversations: st.conversations.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c)),
        }));
      },
      togglePin(id) {
        set((st) => ({ conversations: st.conversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) }));
      },
      setConvSettings(id, patch) {
        set((st) => ({
          conversations: st.conversations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },
      forkConversation(convId) {
        const st = get();
        const src = st.conversations.find((c) => c.id === convId);
        const path = st.activePath(convId);
        if (!src || !path.length) return null;
        const newId = nanoid();
        const idMap = new Map<string, string>();
        for (const m of path) idMap.set(m.id, nanoid());
        const copied: ChatMessage[] = path.map((m) => ({
          ...m,
          id: idMap.get(m.id)!,
          parentId: m.parentId ? idMap.get(m.parentId) ?? null : null,
        }));
        const conv: Conversation = {
          id: newId,
          title: `Fork: ${src.title}`.slice(0, 60),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          systemPrompt: src.systemPrompt,
          model: src.model,
          temperature: src.temperature,
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: newId,
          messagesByConv: { ...s.messagesByConv, [newId]: copied },
          activeChild: { ...s.activeChild, [newId]: {} },
        }));
        return newId;
      },
      async autoTitle(convId) {
        const st = get();
        const settings = st.settings;
        const conv = st.conversations.find((c) => c.id === convId);
        const msgs = st.messagesByConv[convId] ?? [];
        const firstUser = msgs.find((m) => m.role === "user");
        if (!settings || !conv || !firstUser) return;
        let title = "";
        const controller = streamChat(
          {
            messages: [
              { id: "t1", role: "user", content: `Reply with ONLY a concise 3-6 word title (no quotes, no punctuation at end) for a conversation that starts with: "${firstUser.content.slice(0, 300)}"`, createdAt: 1 },
            ],
            providerId: settings.activeProviderId,
            model: conv.model ?? settings.activeModel,
            reasoningEffort: "none",
            allowTools: false,
          },
          (ev) => { if (ev.type === "delta") title += ev.content; },
          () => {},
          () => {
            const clean = title.replace(/["'<>*#\n]/g, "").trim().slice(0, 60);
            if (clean) get().renameConversation(convId, clean);
          },
        );
        void controller;
      },
      exportJSON() {
        const st = get();
        const data = {
          app: "llmwebchat",
          version: 1,
          exportedAt: Date.now(),
          conversations: st.conversations,
          messagesByConv: st.messagesByConv,
          activeChild: st.activeChild,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `llmwebchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      importJSON(data) {
        const d = data as { app?: string; conversations?: Conversation[]; messagesByConv?: Record<string, ChatMessage[]>; activeChild?: Record<string, Record<string, string>> };
        if (!d || d.app !== "llmwebchat" || !Array.isArray(d.conversations) || !d.messagesByConv) return false;
        const existing = new Set(get().conversations.map((c) => c.id));
        const convs = (d.conversations).filter((c) => !existing.has(c.id));
        const newMsgs: Record<string, ChatMessage[]> = {};
        const newChild: Record<string, Record<string, string>> = {};
        for (const c of convs) {
          newMsgs[c.id] = d.messagesByConv[c.id] ?? [];
          newChild[c.id] = d.activeChild?.[c.id] ?? {};
        }
        set((st) => ({
          conversations: [...convs, ...st.conversations],
          messagesByConv: { ...st.messagesByConv, ...newMsgs },
          activeChild: { ...st.activeChild, ...newChild },
        }));
        return true;
      },
      addMessage(convId, msg) {
        set((st) => ({
          messagesByConv: { ...st.messagesByConv, [convId]: [...(st.messagesByConv[convId] ?? []), msg] },
        }));
      },
      patchMessage(convId, msgId, patch) {
        set((st) => ({
          messagesByConv: {
            ...st.messagesByConv,
            [convId]: (st.messagesByConv[convId] ?? []).map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
          },
        }));
      },
      activePath(convId) {
        return computePath(get().messagesByConv[convId] ?? [], get().activeChild[convId] ?? {});
      },
      siblingsOf(convId, msgId) {
        const msgs = get().messagesByConv[convId] ?? [];
        const target = msgs.find((m) => m.id === msgId);
        if (!target) return [];
        const parent = target.parentId ?? null;
        return msgs
          .filter((m) => (m.parentId ?? null) === parent)
          .sort((a, b) => a.createdAt - b.createdAt);
      },
      setActiveChild(convId, parentId, childId) {
        set((st) => ({
          activeChild: { ...st.activeChild, [convId]: { ...(st.activeChild[convId] ?? {}), [parentId]: childId } },
        }));
      },
      exportMarkdown(convId) {
        const path = get().activePath(convId);
        const conv = get().conversations.find((c) => c.id === convId);
        const md = path
          .map((m) => {
            const head = m.role === "user" ? "## 🧑 You" : m.role === "assistant" ? `## 🤖 Assistant${m.model ? ` (${m.model})` : ""}` : `## ${m.role}`;
            return `${head}\n\n${m.content || "_(empty)_"}${m.reasoning ? `\n\n<details><summary>Reasoning</summary>\n\n${m.reasoning}\n\n</details>` : ""}`;
          })
          .join("\n\n---\n\n");
        const blob = new Blob([`# ${conv?.title ?? "Conversation"}\n\n${md}\n`], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(conv?.title ?? "chat").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      },

      reasoningEffort: "high",
      setReasoningEffort(e) {
        set({ reasoningEffort: e });
      },
      allowTools: true,
      setAllowTools(b) {
        set({ allowTools: b });
      },

      async send(text, attachments) {
        const st = get();
        if (!st.settings) return;
        const convId = st.activeId ?? get().newConversation();
        if (!convId) return;
        const path = get().activePath(convId);
        const tip = path[path.length - 1];
        const parentId = tip?.id ?? null;

        const userMsg: ChatMessage = {
          id: nanoid(),
          role: "user",
          content: text,
          attachments,
          parentId,
          createdAt: Date.now(),
        };
        get().addMessage(convId, userMsg);
        if (tip) get().setActiveChild(convId, tip.id, userMsg.id);

        const conv = get().conversations.find((c) => c.id === convId);
        if (conv && (conv.title === "New chat" || !conv.title)) {
          get().renameConversation(convId, text.slice(0, 48));
        }

        // Compose wire context: fold document text into content; images stay as attachments.
        const docs = (attachments ?? []).filter((a) => a.text);
        const docBlock = docs.length
          ? docs.map((a) => `--- ${a.name} ---\n\`\`\`\n${a.text}\n\`\`\``).join("\n\n")
          : "";
        const imageAttachments = (attachments ?? []).filter((a) => a.url);
        const wireUserMsg: ChatMessage = {
          ...userMsg,
          content: docBlock ? `${text}\n\n${docBlock}` : text,
          attachments: imageAttachments.length ? imageAttachments : undefined,
        };

        const assistantId = nanoid();
        get().addMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: "",
          parentId: userMsg.id,
          createdAt: Date.now(),
          model: st.settings.activeModel,
        });
        get().setActiveChild(convId, userMsg.id, assistantId);

        runStream(convId, [...path, wireUserMsg], userMsg, assistantId, set, get);
      },

      async regenerate(assistantMessageId) {
        const st = get();
        const convId = st.activeId;
        if (!convId || !st.settings) return;
        const old = (st.messagesByConv[convId] ?? []).find((m) => m.id === assistantMessageId);
        if (!old || old.role !== "assistant" || !old.parentId) return;
        const parentId = old.parentId;
        // context = active path up to the parent (exclusive of `old`)
        const fullPath = get().activePath(convId);
        const cutAt = fullPath.findIndex((m) => m.id === parentId);
        const context = cutAt >= 0 ? fullPath.slice(0, cutAt + 1) : fullPath;

        const assistantId = nanoid();
        get().addMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: "",
          parentId,
          createdAt: Date.now(),
          model: st.settings.activeModel,
        });
        get().setActiveChild(convId, parentId, assistantId);
        runStream(convId, context, old, assistantId, set, get);
      },

      async editResubmit(userMessageId, newText) {
        const st = get();
        const convId = st.activeId;
        if (!convId || !st.settings) return;
        const old = (st.messagesByConv[convId] ?? []).find((m) => m.id === userMessageId);
        if (!old || old.role !== "user") return;
        const parentId = old.parentId ?? null;
        const fullPath = get().activePath(convId);
        const context =
          parentId == null ? [] : fullPath.slice(0, fullPath.findIndex((m) => m.id === parentId) + 1);

        const userMsg: ChatMessage = {
          id: nanoid(),
          role: "user",
          content: newText,
          parentId,
          createdAt: Date.now(),
        };
        get().addMessage(convId, userMsg);
        if (parentId) get().setActiveChild(convId, parentId, userMsg.id);

        const assistantId = nanoid();
        get().addMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: "",
          parentId: userMsg.id,
          createdAt: Date.now(),
          model: st.settings.activeModel,
        });
        get().setActiveChild(convId, userMsg.id, assistantId);
        runStream(convId, [...context, userMsg], userMsg, assistantId, set, get);
      },

      async continueFrom(assistantMessageId) {
        const st = get();
        const convId = st.activeId;
        const settings = st.settings;
        if (!convId || !settings) return;
        const assistant = (st.messagesByConv[convId] ?? []).find((m) => m.id === assistantMessageId);
        if (!assistant || assistant.role !== "assistant") return;
        const fullPath = get().activePath(convId);
        const idx = fullPath.findIndex((m) => m.id === assistantMessageId);
        if (idx < 0) return;
        const conv = get().conversations.find((c) => c.id === convId);
        const model = conv?.model ?? settings.activeModel;
        // Prefill: context ends with the assistant's existing content; the model appends.
        const context = fullPath.slice(0, idx + 1);
        const controller = streamChat(
          {
            conversationId: convId,
            messages: context,
            providerId: settings.activeProviderId,
            model,
            reasoningEffort: st.reasoningEffort,
            temperature: conv?.temperature ?? settings.temperature,
            allowTools: false,
            approvalPolicy: "destructive",
          },
          (ev) => {
            const cur = () => get().messagesByConv[convId]?.find((m) => m.id === assistantMessageId);
            if (ev.type === "delta") get().patchMessage(convId, assistantMessageId, { content: (cur()?.content ?? "") + ev.content });
            else if (ev.type === "reasoning") get().patchMessage(convId, assistantMessageId, { reasoning: ((cur()?.reasoning ?? "") + ev.content) || undefined });
            else if (ev.type === "error") get().patchMessage(convId, assistantMessageId, { content: (cur()?.content ?? "") + `\n\n> ⚠️ ${ev.message}` });
          },
          (err) => {
            const cur = () => get().messagesByConv[convId]?.find((m) => m.id === assistantMessageId);
            get().patchMessage(convId, assistantMessageId, { content: (cur()?.content ?? "") + `\n\n> ⚠️ ${err.message}` });
          },
          () => set({ stream: null }),
        );
        set({ stream: { conversationId: convId, assistantMessageId, controller } });
      },

      stream: null,
      stop() {
        const s = get().stream;
        if (s) {
          s.controller.abort();
          set({ stream: null });
        }
      },

      settingsOpen: false,
      setSettingsOpen(b) {
        set({ settingsOpen: b });
      },
      sidebarOpen: true,
      toggleSidebar() {
        set((s) => ({ sidebarOpen: !s.sidebarOpen }));
      },
      artifactOpen: false,
      setArtifactOpen(b) {
        set({ artifactOpen: b });
      },
      paletteOpen: false,
      setPaletteOpen(b) {
        set({ paletteOpen: b });
      },
      snippetsOpen: false,
      setSnippetsOpen(b) {
        set({ snippetsOpen: b });
      },
      promptTemplates: [],
      addPromptTemplate(title, body) {
        set((st) => ({ promptTemplates: [...st.promptTemplates, { id: nanoid(), title, body }] }));
      },
      removePromptTemplate(id) {
        set((st) => ({ promptTemplates: st.promptTemplates.filter((p) => p.id !== id) }));
      },
      pendingInsert: null,
      setPendingInsert(s) {
        set({ pendingInsert: s });
      },
      treeOpen: false,
      setTreeOpen(b) {
        set({ treeOpen: b });
      },
      convSettingsOpen: false,
      setConvSettingsOpen(b) {
        set({ convSettingsOpen: b });
      },
      compareOpen: false,
      setCompareOpen(b) {
        set({ compareOpen: b });
      },
      helpOpen: false,
      setHelpOpen(b) {
        set({ helpOpen: b });
      },
      activatePathTo(convId, msgId) {
        const msgs = get().messagesByConv[convId] ?? [];
        const byId = new Map(msgs.map((m) => [m.id, m]));
        // walk from msgId up to root
        const chain: string[] = [];
        let cur: string | undefined = msgId;
        const guard = new Set<string>();
        while (cur && byId.has(cur) && !guard.has(cur)) {
          guard.add(cur);
          chain.unshift(cur);
          cur = byId.get(cur)!.parentId ?? undefined;
        }
        // repoint activeChild for each parent -> child on the chain
        set((st) => {
          const ac = { ...(st.activeChild[convId] ?? {}) };
          for (let i = 0; i < chain.length - 1; i++) {
            ac[chain[i]!] = chain[i + 1]!;
          }
          return { activeChild: { ...st.activeChild, [convId]: ac } };
        });
      },

      arenaOpen: false,
      setArenaOpen(b) {
        set({ arenaOpen: b });
      },
      arenaModels: [],
      setArenaModel(index, m) {
        set((st) => ({ arenaModels: st.arenaModels.map((x, i) => (i === index ? m : x)) }));
      },
      addArenaColumn() {
        set((st) => ({ arenaModels: [...st.arenaModels, { providerId: st.settings?.activeProviderId ?? "ollama", model: st.settings?.activeModel ?? "llama3.2" }] }));
      },
      removeArenaColumn(index) {
        set((st) => ({ arenaModels: st.arenaModels.filter((_, i) => i !== index) }));
      },
      arenaCols: [],
      arenaRunning: false,
      arenaWinner: null,
      pickWinner(index) {
        set((st) => ({ arenaWinner: st.arenaWinner === index ? null : index }));
      },
      runArena(prompt) {
        const st = get();
        const settings = st.settings;
        if (!settings || !prompt.trim() || st.arenaModels.length === 0) return;
        const models = st.arenaModels;
        // stop any previous run
        st.arenaCols.forEach((c) => c.controller?.abort());
        const cols: ArenaCol[] = models.map((m) => ({
          providerId: m.providerId,
          model: m.model,
          content: "",
          reasoning: "",
          status: "streaming" as const,
          controller: undefined,
        }));
        set({ arenaCols: cols, arenaRunning: true, arenaWinner: null });
        const msgs = [{ id: "1", role: "user" as const, content: prompt, createdAt: Date.now() }];
        let pending = cols.length;
        cols.forEach((col, i) => {
          const controller = streamChat(
            { messages: msgs, providerId: col.providerId, model: col.model, reasoningEffort: st.reasoningEffort, allowTools: false },
            (ev) => {
              set((s) => {
                const next = [...s.arenaCols];
                const c = { ...next[i] };
                if (ev.type === "delta") c.content += ev.content;
                else if (ev.type === "reasoning") c.reasoning += ev.content;
                else if (ev.type === "error") { c.content += `\n\n> ⚠️ ${ev.message}`; c.status = "error"; }
                next[i] = c;
                return { arenaCols: next };
              });
            },
            () => {},
            () => {
              set((s) => {
                const next = [...s.arenaCols];
                if (next[i]) next[i] = { ...next[i], status: next[i].status === "error" ? "error" : "done", controller: undefined };
                return { arenaCols: next };
              });
              pending--;
              if (pending <= 0) set({ arenaRunning: false });
            },
          );
          set((s) => {
            const next = [...s.arenaCols];
            next[i] = { ...next[i], controller };
            return { arenaCols: next };
          });
        });
      },
      stopArena() {
        get().arenaCols.forEach((c) => c.controller?.abort());
        set((s) => ({ arenaCols: s.arenaCols.map((c) => ({ ...c, status: c.status === "streaming" ? "stopped" : c.status })), arenaRunning: false }));
      },
    }),
    {
      name: "llmwebchat-store",
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        messagesByConv: s.messagesByConv,
        activeChild: s.activeChild,
        reasoningEffort: s.reasoningEffort,
        allowTools: s.allowTools,
        sidebarOpen: s.sidebarOpen,
        promptTemplates: s.promptTemplates,
      }),
    },
  ),
);
