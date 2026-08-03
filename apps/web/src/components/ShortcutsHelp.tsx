import { useStore } from "../store.js";

const SHORTCUTS: Array<[string, string]> = [
  ["⌘ / Ctrl + K", "Command palette"],
  ["⌘ / Ctrl + N", "New chat"],
  ["⌘ / Ctrl + B", "Toggle sidebar"],
  ["⌘ / Ctrl + J", "Toggle Artifacts panel"],
  ["⌘ / Ctrl + ,", "Settings"],
  ["⌘ / Ctrl + .", "Stop generating"],
  ["Enter", "Send message"],
  ["Shift + Enter", "Newline in message"],
  ["Esc Esc", "(in tree) open conversation tree"],
  ["?", "This help"],
];

export function ShortcutsHelp() {
  const open = useStore((s) => s.helpOpen);
  const setOpen = useStore((s) => s.setHelpOpen);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
          <span className="font-medium text-sm">Keyboard shortcuts</span>
          <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
        </div>
        <div className="p-2">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex items-center gap-3 px-2 py-1.5 text-sm">
              <span className="text-[var(--color-muted)] flex-1">{label}</span>
              <kbd className="text-[11px] px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg)]">{keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
