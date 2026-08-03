/**
 * App store. Conversations + messages persist to localStorage; settings mirror
 * the server (secrets never leave the proxy). Streaming state is ephemeral.
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

  /* conversations (local) */
  conversations: Conversation[];
  activeId: string | null;
  messagesByConv: Record<string, ChatMessage[]>;
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (convId: string, msg: ChatMessage) => void;
  patchMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  setMessages: (convId: string, msgs: ChatMessage[]) => void;

  /* composer prefs */
  reasoningEffort: ReasoningEffort;
  setReasoningEffort: (e: ReasoningEffort) => void;
  allowTools: boolean;
  setAllowTools: (b: boolean) => void;

  /* streaming */
  stream: StreamState | null;
  send: (text: string, attachments?: ChatMessage["attachments"]) => Promise<void>;
  stop: () => void;

  /* ui */
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  artifactOpen: boolean;
  setArtifactOpen: (b: boolean) => void;
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
      newConversation() {
        const id = nanoid();
        const conv: Conversation = {
          id,
          title: "New chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
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
          const { [id]: _, ...rest } = st.messagesByConv;
          const conversations = st.conversations.filter((c) => c.id !== id);
          const activeId = st.activeId === id ? (conversations[0]?.id ?? null) : st.activeId;
          return { conversations, messagesByConv: rest, activeId };
        });
      },
      renameConversation(id, title) {
        set((st) => ({
          conversations: st.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
          ),
        }));
      },
      addMessage(convId, msg) {
        set((st) => ({
          messagesByConv: {
            ...st.messagesByConv,
            [convId]: [...(st.messagesByConv[convId] ?? []), msg],
          },
        }));
      },
      patchMessage(convId, msgId, patch) {
        set((st) => ({
          messagesByConv: {
            ...st.messagesByConv,
            [convId]: (st.messagesByConv[convId] ?? []).map((m) =>
              m.id === msgId ? { ...m, ...patch } : m,
            ),
          },
        }));
      },
      setMessages(convId, msgs) {
        set((st) => ({ messagesByConv: { ...st.messagesByConv, [convId]: msgs } }));
      },

      reasoningEffort: "high",
      setReasoningEffort(e) {
        set({ reasoningEffort: e });
      },
      allowTools: true,
      setAllowTools(b) {
        set({ allowTools: b });
      },

      stream: null,
      async send(text, attachments) {
        const st = get();
        const settings = st.settings;
        if (!settings) return;
        let convId = st.activeId;
        if (!convId) convId = get().newConversation();
        if (!convId) return;

        const userMsg: ChatMessage = {
          id: nanoid(),
          role: "user",
          content: text,
          attachments,
          createdAt: Date.now(),
        };
        get().addMessage(convId, userMsg);

        // Title the conversation from the first user message.
        const conv = get().conversations.find((c) => c.id === convId);
        if (conv && (conv.title === "New chat" || !conv.title)) {
          get().renameConversation(convId, text.slice(0, 48));
        }

        const history = get().messagesByConv[convId] ?? [];

        const assistantId = nanoid();
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          model: settings.activeModel,
        };
        get().addMessage(convId, assistantMsg);

        const controller = streamChat(
          {
            conversationId: convId,
            messages: history, // includes the user msg we just added
            providerId: settings.activeProviderId,
            model: settings.activeModel,
            reasoningEffort: st.reasoningEffort,
            temperature: settings.temperature,
            allowTools: st.allowTools,
            enabledTools: [],
          },
          (ev) => {
            const patch = get().patchMessage;
            if (ev.type === "delta") {
              patch(convId!, assistantId, {
                content: (get().messagesByConv[convId!].find((m) => m.id === assistantId)?.content ?? "") + ev.content,
              });
            } else if (ev.type === "reasoning") {
              patch(convId!, assistantId, {
                reasoning: (get().messagesByConv[convId!].find((m) => m.id === assistantId)?.reasoning ?? "") + ev.content,
              });
            } else if (ev.type === "tool_call") {
              patch(convId!, assistantId, {
                toolCalls: [
                  ...(get().messagesByConv[convId!].find((m) => m.id === assistantId)?.toolCalls ?? []),
                  ev.toolCall,
                ],
              });
            } else if (ev.type === "tool_result") {
              patch(convId!, assistantId, {
                toolResults: [
                  ...(get().messagesByConv[convId!].find((m) => m.id === assistantId)?.toolResults ?? []),
                  ev.result,
                ],
              });
            } else if (ev.type === "error") {
              patch(convId!, assistantId, {
                content: (get().messagesByConv[convId!].find((m) => m.id === assistantId)?.content ?? "") + `\n\n> ⚠️ ${ev.message}`,
              });
            }
          },
          (err) => {
            get().patchMessage(convId!, assistantId, {
              content: (get().messagesByConv[convId!].find((m) => m.id === assistantId)?.content ?? "") + `\n\n> ⚠️ ${err.message}`,
            });
          },
          () => set({ stream: null }),
        );
        set({ stream: { conversationId: convId, assistantMessageId: assistantId, controller } });
      },
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
        reasoningEffort: s.reasoningEffort,
        allowTools: s.allowTools,
        sidebarOpen: s.sidebarOpen,
      }),
    },
  ),
);
