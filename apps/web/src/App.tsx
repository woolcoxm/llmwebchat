import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { useStore } from "./store.js";

export default function App() {
  const loadSettings = useStore((s) => s.loadSettings);
  const settingsLoading = useStore((s) => s.settingsLoading);
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const newConversation = useStore((s) => s.newConversation);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Ensure there's always an active conversation.
  useEffect(() => {
    if (!settingsLoading && !activeId && conversations.length === 0) {
      newConversation();
    } else if (!settingsLoading && !activeId && conversations.length > 0) {
      useStore.getState().selectConversation(conversations[0].id);
    }
  }, [settingsLoading, activeId, conversations.length, newConversation]);

  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <ChatView />
      <SettingsModal />
    </div>
  );
}
