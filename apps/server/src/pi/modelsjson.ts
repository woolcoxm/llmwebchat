/**
 * Manage pi's ~/.pi/agent/models.json so Pi Studio can register a local
 * OpenAI-compatible server (llama.cpp / Ollama / LM Studio) as a pi provider
 * with the correct compat flags — no hand-editing JSON.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const FILE = join(homedir(), ".pi", "agent", "models.json");

export interface PiProviderCfg {
  baseUrl: string;
  api: "openai-completions";
  apiKey: string;
  compat: { supportsDeveloperRole: boolean; supportsReasoningEffort: boolean };
  models: Array<{ id: string; name?: string }>;
}

/** Read the current models.json (or empty), merge one provider, write back. */
export function upsertPiProvider(id: string, cfg: PiProviderCfg): void {
  let doc: { providers?: Record<string, PiProviderCfg> } = {};
  try {
    if (existsSync(FILE)) doc = JSON.parse(readFileSync(FILE, "utf-8"));
  } catch {
    doc = {};
  }
  doc.providers = { ...(doc.providers ?? {}), [id]: cfg };
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(doc, null, 2), "utf-8");
}
