/**
 * MCP server registry: keeps stdio MCP clients in sync with the configured
 * servers (connect new, drop removed). Connections are cached across requests.
 * A failing server never blocks chat — it's reported via status and skipped.
 */
import type { McpServerConfig } from "@llmwebchat/shared";
import { StdioMcpClient } from "./client.js";

const clients = new Map<string, StdioMcpClient>();

function key(cfg: McpServerConfig): string {
  return cfg.name;
}

/** Connect/disconnect clients to match `configs`. Best-effort; never throws. */
export async function syncMcp(configs: McpServerConfig[]): Promise<void> {
  const wanted = new Map(configs.map((c) => [key(c), c]));

  // Drop clients no longer configured.
  for (const [k, client] of [...clients]) {
    if (!wanted.has(k)) {
      await client.shutdown().catch(() => {});
      clients.delete(k);
    }
  }

  // Connect new clients (or retry errored ones).
  await Promise.all(
    [...wanted.values()].map(async (cfg) => {
      let client = clients.get(key(cfg));
      if (!client) {
        client = new StdioMcpClient(cfg);
        clients.set(key(cfg), client);
      }
      if (client.status === "disconnected" || client.status === "error") {
        await client.connect().catch(() => {
          // error recorded on the client; chat continues without this server's tools
        });
      }
    }),
  );
}

/** Currently ready MCP clients. Sync, cheap. */
export function mcpClients(): StdioMcpClient[] {
  return [...clients.values()].filter((c) => c.status === "ready");
}

export function mcpStatus(): Array<{ name: string; status: string; tools: number; error?: string }> {
  return [...clients.values()].map((c) => ({
    name: c.serverName,
    status: c.status,
    tools: c.tools.length,
    error: c.lastError,
  }));
}

export async function shutdownAllMcp(): Promise<void> {
  await Promise.all([...clients.values()].map((c) => c.shutdown().catch(() => {})));
  clients.clear();
}
