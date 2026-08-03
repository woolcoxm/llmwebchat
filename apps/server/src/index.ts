/**
 * LLMWebChat proxy server (security-hardened).
 *
 * Responsibilities:
 *  - hold secrets (API keys) — never expose raw to the browser
 *  - proxy OpenAI-compatible streaming to Ollama / LM Studio / cloud APIs
 *  - host server-side tools (web_search, code_interpreter, MCP)  [Phase 3]
 *  - serve the built web app from web-dist in production
 *
 * Security posture (see middleware/security.ts):
 *  - binds to 127.0.0.1 only (set LLMWEBCHAT_HOST to override — at your risk)
 *  - CORS allowlist of local origins (CSRF defence)
 *  - optional bearer-token gate (LLMWEBCHAT_AUTH_TOKEN)
 *  - body-size cap + per-IP rate limit on /api/chat
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { chat } from "./routes/chat.js";
import { models } from "./routes/models.js";
import { settingsRouter } from "./routes/settings.js";
import { toolsRouter } from "./routes/tools.js";
import {
  authGate,
  bodySizeLimit,
  corsOptions,
  rateLimit,
} from "./middleware/security.js";

const app = new Hono();
app.use("*", logger());

// CORS allowlist applies to /api/* only.
app.use("/api/*", async (c, next) => {
  const { cors } = await import("hono/cors");
  return cors(corsOptions)(c, next);
});
// Optional bearer-token gate over all /api/* (no-op unless env token set).
app.use("/api/*", authGate);
// Reject oversized bodies early.
app.use("/api/*", bodySizeLimit(25 * 1024 * 1024));

app.get("/api/health", (c) =>
  c.json({ ok: true, name: "llmwebchat-server", version: "0.1.0" }),
);
app.route("/api/settings", settingsRouter);
app.route("/api/tools", toolsRouter);
app.route("/api/models", models);
// Rate-limit the (expensive, tool-capable) chat endpoint.
app.use("/api/chat/*", rateLimit({ windowMs: 60_000, max: 120 }));
app.route("/api/chat", chat);

// Production: serve built frontend (dev uses Vite separately on :5173).
import { existsSync } from "node:fs";
import { join } from "node:path";
const WEB_DIST = join(process.cwd(), "web-dist");
if (existsSync(WEB_DIST)) {
  const { serveStatic } = await import("@hono/node-server/serve-static");
  app.use("/*", serveStatic({ root: "./web-dist" }));
  app.get("/*", serveStatic({ path: "./web-dist/index.html" }));
}

const port = Number(process.env["PORT"] ?? 8787);
const hostname = process.env["LLMWEBCHAT_HOST"] ?? "127.0.0.1";
serve({ fetch: app.fetch, port, hostname }, (info) => {
  const addr = `http://${hostname}:${info.port}`;
  console.log(`▸ LLMWebChat proxy on ${addr}`);
  console.log(`  bind: ${hostname} (loopback only by default)`);
  console.log(`  auth: ${process.env["LLMWEBCHAT_AUTH_TOKEN"] ? "token required" : "open (localhost only)"}`);
  console.log(`  data dir: ${process.cwd()}/data`);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    console.log(
      `  ⚠️  bound beyond loopback — set LLMWEBCHAT_AUTH_TOKEN and use HTTPS/reverse proxy.`,
    );
  }
});
