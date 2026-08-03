/** File-backed vector store for the knowledge base. Lives in data/kb.json. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cosine } from "./embed.js";

export interface KbItem {
  id: string;
  source: string;
  text: string;
  embedding: number[];
  createdAt: number;
}

export interface KbSearchHit {
  item: Omit<KbItem, "embedding">;
  score: number;
}

const FILE = join(process.env["LLMWEBCHAT_DATA_DIR"] ?? join(process.cwd(), "data"), "kb.json");

let items: KbItem[] | null = null;

function load(): KbItem[] {
  if (items) return items;
  try {
    if (existsSync(FILE)) items = JSON.parse(readFileSync(FILE, "utf-8")) as KbItem[];
    else items = [];
  } catch {
    items = [];
  }
  return items!;
}

function persist() {
  const dir = join(FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(FILE, JSON.stringify(items ?? [], null, 2), "utf-8");
}

export function listKb(): Omit<KbItem, "embedding">[] {
  return load().map(({ embedding: _e, ...rest }) => rest);
}

export function addKb(item: KbItem): void {
  load().push(item);
  persist();
}

export function removeKb(id: string): void {
  items = load().filter((x) => x.id !== id);
  persist();
}

export function clearKb(): void {
  items = [];
  persist();
}

export function searchKb(queryEmb: number[], k = 4): KbSearchHit[] {
  const all = load();
  return all
    .map((item) => ({ item, score: cosine(queryEmb, item.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ item, score }) => {
      const { embedding: _e, ...rest } = item;
      return { item: rest, score };
    });
}
