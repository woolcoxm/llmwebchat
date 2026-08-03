/**
 * POST /api/agent/chat — run a prompt through a real pi agent (pi --mode rpc).
 * Streams NDJSON ChatEvents (delta/reasoning/tool_call/tool_result/finish/error).
 *
 * Body: { sessionId, message, images?: [{data, mimeType}] }
 * Agent config (bin, cwd, provider, model, enabled) comes from settings.tools-less
 * settings.agent; the proxy spawns/keeps-alive one pi process per sessionId.
 *
 * SECURITY: pi executes real tools (read/write/edit/bash) in settings.agent.cwd.
 * This is powerful — gated behind settings.agent.enabled and an explicit cwd,
 * the same trust model as run_bash. The user opts in.
 */
import { Hono } from "hono";
import type { ChatEvent } from "@llmwebchat/shared";
import { loadSettings } from "../store.js";
import { abortSession, ensureSession } from "../pi/manager.js";

export const agentRouter = new Hono();

agentRouter.post("/chat", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    sessionId?: string;
    message?: string;
    images?: Array<{ data: string; mimeType: string }>;
  };

  const settings = loadSettings();
  const agent = settings.agent;
  if (!agent?.enabled) {
    return c.json(
      { type: "error", message: "Agent mode is disabled. Enable it in Settings → Agent and set a working directory." } satisfies ChatEvent,
      400,
    );
  }
  if (!agent.cwd) {
    return c.json(
      { type: "error", message: "Agent has no working directory set. Configure one in Settings → Agent." } satisfies ChatEvent,
      400,
    );
  }
  if (!body.sessionId || typeof body.message !== "string") {
    return c.json({ type: "error", message: "sessionId and message required" } satisfies ChatEvent, 400);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (ev: ChatEvent) => controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      try {
        const session = await ensureSession(body.sessionId!, {
          cwd: agent.cwd!,
          bin: agent.bin,
          provider: agent.provider,
          model: agent.model,
        });
        await session.prompt(body.message!, body.images ?? [], send, c.req.raw.signal);
      } catch (err) {
        send({ type: "error", message: `Agent error: ${(err as Error).message}` });
      } finally {
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});

agentRouter.post("/abort", async (c) => {
  const { sessionId } = (await c.req.json().catch(() => ({}))) as { sessionId?: string };
  if (sessionId) abortSession(sessionId);
  return c.json({ ok: true });
});

agentRouter.get("/sessions", (c) => c.json({ sessions: [] })); // placeholder; status via manager could be exposed
