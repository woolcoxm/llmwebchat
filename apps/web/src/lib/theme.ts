/** Accent theming. Pure client-side; persisted in localStorage. */

export const ACCENTS: Record<string, { accent: string; fg: string }> = {
  indigo: { accent: "#6366f1", fg: "#c7d2fe" },
  emerald: { accent: "#10b981", fg: "#a7f3d0" },
  rose: { accent: "#f43f5e", fg: "#fecdd3" },
  amber: { accent: "#f59e0b", fg: "#fde68a" },
  cyan: { accent: "#06b6d4", fg: "#a5f3fc" },
  violet: { accent: "#8b5cf6", fg: "#ddd6fe" },
  orange: { accent: "#f97316", fg: "#fed7aa" },
};

const KEY = "llmwebchat-accent";

export function applyAccent(name: string) {
  const a = ACCENTS[name] ?? ACCENTS.indigo;
  const root = document.documentElement;
  root.style.setProperty("--color-accent", a.accent);
  root.style.setProperty("--color-accent-fg", a.fg);
}

export function loadAccent(): string {
  const name = localStorage.getItem(KEY) ?? "indigo";
  applyAccent(name);
  return name;
}

export function saveAccent(name: string) {
  localStorage.setItem(KEY, name);
  applyAccent(name);
}
