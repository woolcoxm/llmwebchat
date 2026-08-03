/**
 * settings store — single-user, file-backed.
 * data/ is gitignored. Holds secrets (API keys) — never expose raw to client.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultSettings, type ProviderConfig, type Settings } from "@llmwebchat/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _envDataDir = process.env["LLMWEBCHAT_DATA_DIR"];
const DATA_DIR = _envDataDir ? resolveMaybeRel(_envDataDir) : join(process.cwd(), "data");
const SETTINGS_FILE = join(DATA_DIR, "settings.json");

function resolveMaybeRel(p: string): string {
  return p.startsWith("/") || /^[A-Za-z]:/.test(p) ? p : join(process.cwd(), p);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Seed built-in provider keys from env on first run. */
function seedFromEnv(base: Settings): Settings {
  const env: Record<string, string | undefined> = process.env;
  for (const p of base.providers) {
    if (!p.apiKey) {
      const envKey = ENV_KEYS[p.id];
      if (envKey && env[envKey]) p.apiKey = env[envKey];
    }
  }
  // ollama base url override
  if (env["OLLAMA_BASE_URL"]) {
    const o = base.providers.find((p) => p.id === "ollama");
    if (o) o.baseURL = env["OLLAMA_BASE_URL"].replace(/\/$/, "");
  }
  return base;
}

const ENV_KEYS: Record<string, string> = {
  openrouter: "OPENROUTER_API_KEY",
};

export function loadSettings(): Settings {
  ensureDataDir();
  if (existsSync(SETTINGS_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
      return normalize(raw);
    } catch {
      // fall through to defaults
    }
  }
  const seeded = seedFromEnv(defaultSettings());
  saveSettings(seeded);
  return seeded;
}

export function saveSettings(s: Settings): void {
  ensureDataDir();
  writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), "utf-8");
}

/**
 * Merge incoming settings, preserving secrets the client masked.
 * Client sends apiKey = MASKED sentinel when it wants to keep the stored key.
 */
const MASKED = "••••••••";

export function maskProvider(p: ProviderConfig): ProviderConfig & { hasKey: boolean } {
  return {
    ...p,
    apiKey: p.apiKey ? MASKED : "",
    hasKey: !!p.apiKey,
  };
}

export function applyClientSettings(
  stored: Settings,
  incoming: Settings,
): Settings {
  const merged: Settings = {
    ...incoming,
    providers: incoming.providers.map((p) => {
      const prev = stored.providers.find((s) => s.id === p.id);
      const keepKey = !p.apiKey || p.apiKey === MASKED;
      return {
        ...p,
        apiKey: keepKey ? prev?.apiKey : p.apiKey,
      };
    }),
  };
  saveSettings(merged);
  return merged;
}

/** Ensure required fields exist after a load (forward-compat). */
function normalize(raw: Partial<Settings>): Settings {
  const def = defaultSettings();
  const providers = Array.isArray(raw.providers) && raw.providers.length
    ? raw.providers.map((p) => ({ ...p }))
    : def.providers;
  return {
    ...def,
    ...raw,
    providers,
  };
}
