/**
 * POST /api/chat
 *
 * Stateless per request: the client sends the full message list. The proxy:
 *   1. resolves the provider (with secret) from settings
 *   2. streams the model response as NDJSON ChatEvents
 *   3. if the model emits tool_calls and allowTools is set, executes them,
 *      feeds results back, and loops (agentic). Each round is a fresh stream.
 *
 * Wire format: one JSON `ChatEvent` per line.
 */
import { Hono } from "hono";
import { chatStream } from "@llmwebchat/providers";
import type { ChatEvent, ChatMessage, ChatRequest, ToolCall } from "@llmwebchat/shared";
import { loadSettings } from "../store.js";
import { executeTool, listEnabledTools } from "../tools/index.js";

export const chat = new Hono();

chat.post("/", async (c) => {
  let body: ChatRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: "error", message: "Invalid JSON body" } satisfies ChatEvent, 400);
  }

  const settings = loadSettings();
  const provider = settings.providers.find((p) => p.id === body.providerId);
  if (!provider) {
    return c.json(
      { type: "error", message: `Unknown provider: ${body.providerId}` } satisfies ChatEvent,
      400,
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (ev: ChatEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));

      const messageId = crypto.randomUUID();
      send({ type: "start", messageId, model: body.model });

      // Agentic loop -----------------------------------------------------
      const maxRounds = body.maxRounds ?? 10;
      const enabledTools = body.allowTools ? listEnabledTools(body.enabledTools) : [];
      let rounds = 0;
      // Working copy of messages we mutate across tool rounds.
      const messages: ChatMessage[] = body.messages.map((m) => ({ ...m }));

      try {
        while (rounds++ <= maxRounds) {
          let content = "";
          let reasoning = "";
          const toolCalls: ToolCall[] = [];
          let finishReason: string | undefined;

          for await (const ev of chatStream({
            provider,
            model: body.model,
            messages,
            reasoningEffort: body.reasoningEffort ?? settings.defaultReasoningEffort,
            temperature: body.temperature,
            tools: enabledTools.length ? enabledTools : undefined,
          })) {
            if (ev.type === "delta") {
              content += ev.content;
              send({ type: "delta", content: ev.content });
            } else if (ev.type === "reasoning") {
              reasoning += ev.content;
              send({ type: "reasoning", content: ev.content });
            } else if (ev.type === "tool_call") {
              toolCalls.push(ev.toolCall);
              send({ type: "tool_call", toolCall: ev.toolCall });
            } else if (ev.type === "finish") {
              finishReason = ev.finishReason;
            } else if (ev.type === "error") {
              send(ev);
              controller.close();
              return;
            }
          }

          // No tool calls → done.
          if (!toolCalls.length || !body.allowTools || !enabledTools.length) {
            send({
              type: "finish",
              messageId,
              model: body.model,
              finishReason: finishReason ?? "stop",
            });
            controller.close();
            return;
          }

          // Append the assistant turn with its tool calls, then execute.
          messages.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            reasoning: reasoning || undefined,
            toolCalls,
            model: body.model,
            createdAt: Date.now(),
          });

          for (const tc of toolCalls) {
            const result = await executeTool(tc, c.req.raw.signal);
            send({ type: "tool_result", result });
            messages.push({
              id: crypto.randomUUID(),
              role: "tool",
              content: result.content,
              toolResults: [result],
              createdAt: Date.now(),
            });
          }
          // loop continues → model sees tool results
        }

        send({
          type: "error",
          message: `Reached max tool rounds (${maxRounds}).`,
        });
      } catch (err) {
        send({
          type: "error",
          message: (err as Error).message ?? "Unknown error",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
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
