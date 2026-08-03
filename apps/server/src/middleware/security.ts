/**
 * Security middleware for the proxy.
 *
 * Threat model: the proxy holds API-key secrets and will execute tools
 * (bash, file ops, web fetch). It is a single-user local service.
 *
 * Defences (defence in depth):
 *   1. Bind to 127.0.0.1 only (enforced in index.ts) — no network exposure.
 *   2. CORS allowlist of local origins — blocks cross-origin CSRF from browsers.
 *   3. Optional bearer-token auth (LLMWEBCHAT_AUTH_TOKEN) for when it must be
 *      exposed beyond localhost.
 *   4. Request body size cap — limits memory abuse.
 *   5. Tool execution runs with a sanitized env (keys stripped) — see tools/sandbox.
 */
import type { Context, MiddlewareHandler } from "hono";

const LOCAL_ORIGINS = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8787",
    "http://127.0.0.1:8787",
  ].concat(
    (process.env["LLMWEBCHAT_WEB_ORIGIN"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
);

/** CORS: allow only known local origins. `null` origin (file://) is rejected. */
export const corsOptions = {
  origin: (origin: string | null | undefined): string | null => {
    if (origin && LOCAL_ORIGINS.has(origin)) return origin;
    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  maxAge: 600,
};

/**
 * Optional bearer-token gate. Active only when LLMWEBCHAT_AUTH_TOKEN is set.
 * /api/health is always public so liveness checks work.
 */
export const authGate: MiddlewareHandler = async (c, next) => {
  const expected = process.env["LLMWEBCHAT_AUTH_TOKEN"];
  if (!expected) return next();
  if (c.req.path === "/api/health") return next();
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // constant-time-ish compare
  if (token.length !== expected.length || token !== expected) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
};

/** Reject bodies larger than `bytes`. Reads Content-Length (cheap, pre-body). */
export function bodySizeLimit(bytes: number): MiddlewareHandler {
  return async (c, next) => {
    const len = Number(c.req.header("Content-Length") ?? "0");
    if (len && len > bytes) {
      return c.json({ error: `Request body too large (>${bytes} bytes)` }, 413);
    }
    return next();
  };
}

/** Tiny per-IP rate limiter for the chat route (memory, per-process). */
const windows = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(opts: {
  windowMs: number;
  max: number;
}): MiddlewareHandler {
  return async (c: Context, next) => {
    const ip =
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
      c.env?.remoteAddr?.address ||
      "local";
    const now = Date.now();
    let w = windows.get(ip);
    if (!w || now > w.resetAt) {
      w = { count: 0, resetAt: now + opts.windowMs };
      windows.set(ip, w);
    }
    w.count++;
    if (w.count > opts.max) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }
    return next();
  };
}
