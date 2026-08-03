/**
 * Settings routes. Secrets live server-side; the client only ever sees masked keys.
 */
import { Hono } from "hono";
import type { Settings } from "@llmwebchat/shared";
import {
  applyClientSettings,
  loadSettings,
  maskProvider,
} from "../store.js";

export const settingsRouter = new Hono();

settingsRouter.get("/", (c) => {
  const s = loadSettings();
  return c.json({ ...s, providers: s.providers.map(maskProvider) });
});

settingsRouter.put("/", async (c) => {
  const incoming = (await c.req.json()) as Settings;
  const stored = loadSettings();
  const merged = applyClientSettings(stored, incoming);
  return c.json({ ...merged, providers: merged.providers.map(maskProvider) });
});
