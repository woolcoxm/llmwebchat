/**
 * GET /api/models?provider=<id>
 * Lists models from a provider's /models endpoint. Falls back to preset hints.
 */
import { Hono } from "hono";
import { listModels } from "@llmwebchat/providers";
import { loadSettings } from "../store.js";

export const models = new Hono();

models.get("/", async (c) => {
  const providerId = c.req.query("provider");
  const settings = loadSettings();
  const provider = settings.providers.find((p) => p.id === providerId);
  if (!provider) return c.json({ error: "Unknown provider" }, 400);

  try {
    const live = await listModels(provider);
    // Merge preset metadata (reasoning/vision flags) onto live ids.
    const preset = new Map((provider.models ?? []).map((m) => [m.id, m]));
    const merged = live.map((m) => ({ ...preset.get(m.id), ...m }));
    // Include any preset models not reported live.
    for (const [id, info] of preset) {
      if (!merged.some((m) => m.id === id)) merged.push(info);
    }
    return c.json({ models: merged });
  } catch (err) {
    // Offline local runner etc. — return preset hints.
    return c.json(
      {
        models: provider.models ?? [],
        warning: (err as Error).message,
      },
      200,
    );
  }
});
