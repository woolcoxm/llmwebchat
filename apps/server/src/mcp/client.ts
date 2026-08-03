/**
 * Minimal MCP (Model Context Protocol) client — stdio transport.
 *
 * Speaks newline-delimited JSON-RPC 2.0 to a locally-spawned MCP server, per
 * the MCP spec (initialize → notifications/initialized → tools/list, tools/call).
 *
 * Security: the command/args/env come from user-configured settings, so only
 * servers the operator explicitly registers are ever launched. The subprocess
 * inherits a sanitized environment (API keys stripped) plus the configured env.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ToolDef } from "@llmwebchat/shared";
import { sanitizedEnv } from "../tools/sandbox.js";

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Optional cwd for the server process. */
  cwd?: string;
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export class StdioMcpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buf = "";
  private toolsCache: ToolDef[] = [];
  readonly serverName: string;
  private cfg: McpServerConfig;
  status: "disconnected" | "connecting" | "ready" | "error" = "disconnected";
  lastError?: string;

  constructor(cfg: McpServerConfig) {
    this.cfg = cfg;
    this.serverName = cfg.name;
  }

  async connect(): Promise<void> {
    if (this.status === "ready" || this.status === "connecting") return;
    this.status = "connecting";
    try {
      this.proc = spawn(this.cfg.command, this.cfg.args ?? [], {
        cwd: this.cfg.cwd,
        env: { ...sanitizedEnv(), ...(this.cfg.env ?? {}) },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      this.proc.stdout.setEncoding("utf-8");
      this.proc.stdout.on("data", (d) => this.onStdout(d));
      this.proc.stderr.on("data", (d) => {
        // MCP servers log diagnostics to stderr; surface nothing by default.
        void d;
      });
      this.proc.on("exit", (code) => {
        this.status = "disconnected";
        if (code && code !== 0) this.lastError = `server exited with code ${code}`;
        // fail any in-flight requests
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(new Error(`MCP server ${this.serverName} exited`));
        }
        this.pending.clear();
      });
      this.proc.on("error", (e) => {
        this.status = "error";
        this.lastError = e.message;
      });

      await this.request(
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "llmwebchat", version: "0.1.0" },
        },
        15_000,
      );
      this.notify("notifications/initialized", {});
      await this.refreshTools();
      this.status = "ready";
    } catch (e) {
      this.status = "error";
      this.lastError = (e as Error).message;
      try {
        this.proc?.kill("SIGKILL");
      } catch {
        /* noop */
      }
      throw e;
    }
  }

  private onStdout(chunk: string) {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(msg.error.message ?? "MCP error"));
        else p.resolve(msg.result);
      }
      // notifications (no id) are ignored for now
    }
  }

  private write(obj: unknown) {
    if (!this.proc?.stdin.writable) throw new Error(`MCP ${this.serverName}: stdin closed`);
    this.proc.stdin.write(JSON.stringify(obj) + "\n");
  }

  private request(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} timed out (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.write({ jsonrpc: "2.0", id, method, params });
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e as Error);
      }
    });
  }

  private notify(method: string, params: unknown) {
    this.write({ jsonrpc: "2.0", method, params });
  }

  async refreshTools(): Promise<void> {
    const result = (await this.request("tools/list", {})) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: any }>;
    };
    this.toolsCache = (result.tools ?? []).map((t) => ({
      name: `${this.serverName}__${t.name}`,
      description: t.description ?? `MCP tool ${t.name}`,
      parameters: t.inputSchema ?? { type: "object", properties: {} },
      serverSide: true,
    }));
  }

  get tools(): ToolDef[] {
    return this.toolsCache;
  }

  async callTool(name: string, args: unknown): Promise<string> {
    const result = (await this.request("tools/call", { name, arguments: args ?? {} })) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    const text = (result.content ?? [])
      .map((c) => c.text ?? "")
      .join("\n")
      .trim();
    return text || JSON.stringify(result);
  }

  async shutdown() {
    try {
      this.notify("shutdown", {});
    } catch {
      /* noop */
    }
    try {
      this.proc?.kill();
    } catch {
      /* noop */
    }
    this.status = "disconnected";
  }
}
