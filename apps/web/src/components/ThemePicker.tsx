import { useState } from "react";
import { ACCENTS, loadAccent, saveAccent } from "../lib/theme.js";

export function ThemePicker() {
  const [cur, setCur] = useState(() => loadAccent());
  return (
    <div className="flex items-center gap-1.5">
      {Object.entries(ACCENTS).map(([name, { accent }]) => (
        <button
          key={name}
          onClick={() => { saveAccent(name); setCur(name); }}
          className={`w-4 h-4 rounded-full border ${cur === name ? "ring-2 ring-offset-2 ring-offset-[var(--color-surface)]" : "border-black/30"}`}
          style={{ backgroundColor: accent, boxShadow: cur === name ? `0 0 0 2px ${accent}` : undefined }}
          title={name}
        />
      ))}
    </div>
  );
}
