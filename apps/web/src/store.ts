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
  addMessage: (convId: string, msg: ChatMessage) => void;
  patchMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  /** Walk root → active tip for a conversation. */
  activePath: (convId: string) => ChatMessage[];
  /** Siblings (same parent) of a message, in creation order. */
  siblingsOf: (convId: string, msgId: string) => ChatMessage[];
  setActiveChild: (convId: string, parentId: string, childId: string) => void;

  /* composer prefs */
  reasoningEffort: ReasoningEffort;
  setReasoningEffort: (e: ReasoningEffort) => void;
  allowTools: boolean;
  setAllowTools: (b: boolean) => void;

  /* actions that produce new branches */
  send: (text: string) => Promise<void>;
  regenerate: (assistantMessageId: string) => Promise<void>;
  editResubmit: (userMessageId: string, newText: string) => Promise<void>;

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
  const controller = streamChat(
    {
      conversationId: convId,
      messages: context, // root..userMsg (no placeholder)
      providerId: settings.activeProviderId,
      model: settings.activeModel,
      reasoningEffort: get().reasoningEffort,
      temperature: settings.temperature,
      allowTools: get().allowTools,
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

      reasoningEffort: "high",
      setReasoningEffort(e) {
        set({ reasoningEffort: e });
      },
      allowTools: true,
      setAllowTools(b) {
        set({ allowTools: b });
      },

      async send(text) {
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
          parentId,
          createdAt: Date.now(),
        };
        get().addMessage(convId, userMsg);
        if (tip) get().setActiveChild(convId, tip.id, userMsg.id);

        const conv = get().conversations.find((c) => c.id === convId);
        if (conv && (conv.title === "New chat" || !conv.title)) {
          get().renameConversation(convId, text.slice(0, 48));
        }

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

        runStream(convId, [...path, userMsg], userMsg, assistantId, set, get);
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
      }),
    },
  ),
);
