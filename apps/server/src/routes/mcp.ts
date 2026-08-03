/** GET /api/mcp/status — connection state of configured MCP servers. */
import { Hono } from "hono";
import { mcpStatus, syncMcp } from "../mcp/registry.js";
import { loadSettings } from "../store.js";

export const mcpRouter = new Hono();

mcpRouter.get("/", async (c) => {
  const settings = loadSettings();
  if (settings.tools?.mcpServers?.length) {
    await syncMcp(settings.tools.mcpServers).catch(() => {});
  }
  return c.json({ servers: mcpStatus() });
});
