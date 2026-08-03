/**
 * GET /api/tools — list available tools + their enabled state (for the UI).
 */
import { Hono } from "hono";
import { buildTools, describeTools } from "../tools/index.js";
import { loadSettings } from "../store.js";

export const toolsRouter = new Hono();

toolsRouter.get("/", (c) => {
  const settings = loadSettings();
  const entries = buildTools(settings);
  return c.json({ tools: describeTools(entries) });
});
