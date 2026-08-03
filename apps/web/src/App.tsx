import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { ArtifactPanel } from "./components/ArtifactPanel.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { Arena } from "./components/Arena.js";
import { Snippets } from "./components/Snippets.js";
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
    if (settingsLoading) return;
    if (!activeId && conversations.length === 0) {
      newConversation();
    } else if (!activeId && conversations.length > 0) {
      useStore.getState().selectConversation(conversations[0].id);
    }
  }, [settingsLoading, activeId, conversations.length, newConversation]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const s = useStore.getState();
      // Don't hijack typing in fields unless it's a palette/stop combo.
      const inField =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); s.setPaletteOpen(!s.paletteOpen); return; }
      if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); s.toggleSidebar(); return; }
      if (mod && e.key.toLowerCase() === "j") { e.preventDefault(); s.setArtifactOpen(!s.artifactOpen); return; }
      if (mod && e.key === ",") { e.preventDefault(); s.setSettingsOpen(true); return; }
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); s.newConversation(); return; }
      if (mod && e.key === ".") { e.preventDefault(); s.stop(); return; }
      if (e.key === "Escape" && !inField) { s.setPaletteOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <ChatView />
      <ArtifactPanel />
      <SettingsModal />
      <CommandPalette />
      <Arena />
      <Snippets />
    </div>
  );
}
