/**
 * LLMWebChat proxy server.
 *
 * Responsibilities:
 *  - hold secrets (API keys) — never expose raw to the browser
 *  - proxy OpenAI-compatible streaming to z.ai / Ollama / etc.
 *  - host server-side tools (web_search, code_interpreter, MCP)  [Phase 3]
 *  - serve the built web app from /web-dist in production
 *
 * Dev: run with `pnpm dev` (tsx watch). CORS-open for the Vite dev origin.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chat } from "./routes/chat.js";
import { models } from "./routes/models.js";
import { settingsRouter } from "./routes/settings.js";

const app = new Hono();
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*", // dev: allow Vite origin
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/api/health", (c) =>
  c.json({ ok: true, name: "llmwebchat-server", version: "0.1.0" }),
);
app.route("/api/settings", settingsRouter);
app.route("/api/models", models);
app.route("/api/chat", chat);

// Production: serve built frontend (Phase 0 dev uses Vite separately).
import { existsSync } from "node:fs";
import { join } from "node:path";
const WEB_DIST = join(process.cwd(), "web-dist");
if (existsSync(WEB_DIST)) {
  const { serveStatic } = await import("@hono/node-server/serve-static");
  app.use("/*", serveStatic({ root: "./web-dist" }));
  app.get("/*", serveStatic({ path: "./web-dist/index.html" }));
}

const port = Number(process.env["PORT"] ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`▸ LLMWebChat proxy on http://localhost:${info.port}`);
  console.log(`  data dir: ${process.cwd()}/data`);
});
