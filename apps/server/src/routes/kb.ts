/** Knowledge base routes: ingest text, list, delete. */
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Settings } from "@llmwebchat/shared";
import { addKb, clearKb, listKb, removeKb } from "../kb/store.js";
import { chunkText } from "../kb/chunk.js";
import { embed } from "../kb/embed.js";
import { loadSettings } from "../store.js";

export const kbRouter = new Hono();

function embeddingProvider(s: Settings) {
  const id = s.tools?.embeddingProviderId ?? s.providers.find((p) => p.id === "ollama")?.id ?? s.activeProviderId;
  const provider = s.providers.find((p) => p.id === id) ?? s.providers[0];
  const model = s.tools?.embeddingModel ?? "nomic-embed-text";
  return { provider, model };
}

kbRouter.get("/", (c) => c.json({ items: listKb() }));

kbRouter.post("/ingest", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string; source?: string; url?: string };
  const text = (body.text ?? "").trim();
  if (!text) return c.json({ error: "text required" }, 400);
  const settings = loadSettings();
  const { provider, model } = embeddingProvider(settings);
  const source = body.source ?? `paste-${Date.now()}`;
  const chunks = chunkText(text);
  let ingested = 0;
  for (const ch of chunks) {
    try {
      const vec = await embed(provider, model, ch.text);
      addKb({ id: randomUUID(), source: `${source}#${ch.index}`, text: ch.text, embedding: vec, createdAt: Date.now() });
      ingested++;
    } catch (e) {
      return c.json({ error: `embedding failed: ${(e as Error).message}. Is '${model}' available on ${provider.name}?`, ingested }, 400);
    }
  }
  return c.json({ ingested, chunks: chunks.length, model, provider: provider.id });
});

kbRouter.delete("/:id", (c) => {
  removeKb(c.req.param("id"));
  return c.json({ ok: true });
});

kbRouter.delete("/", (c) => {
  clearKb();
  return c.json({ ok: true });
});
