/**
 * @llmwebchat/providers — a single streaming client that speaks the
 * OpenAI-compatible Chat Completions API and normalises provider quirks
 * (notably providers that emit `reasoning_content` for a reasoning stream).
 *
 * No SDK dependency — just fetch + SSE parsing. Runs in Node (proxy) and
 * could run in the browser too.
 */
import type {
  ChatMessage,
  ModelInfo,
  ProviderConfig,
  ReasoningEffort,
  ToolCall,
  ToolDef,
  Usage,
} from "@llmwebchat/shared";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ChatParams {
  provider: ProviderConfig;
  model: string;
  messages: ChatMessage[];
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  tools?: ToolDef[];
  /** Abort the in-flight stream. */
  signal?: AbortSignal;
}

/** Normalised event stream yielded by chatStream(). */
export type ChatStreamEvent =
  | { type: "delta"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "finish"; finishReason?: string; usage?: Usage }
  | { type: "error"; message: string; status?: number };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildHeaders(provider: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(provider.headers ?? {}),
  };
  if (provider.apiKey) {
    const authHeader = provider.authHeader ?? "Authorization";
    if (authHeader.toLowerCase() === "authorization") {
      h["Authorization"] = `Bearer ${provider.apiKey}`;
    } else {
      h[authHeader] = provider.apiKey;
    }
  }
  return h;
}

/**
 * Convert our internal ChatMessage[] into the OpenAI wire format, fusing
 * reasoning back in only where a provider round-trips it (most don't accept
 * reasoning on input, so we drop it). Attachments with image data URLs become
 * multimodal content parts.
 */
function toWireMessages(
  messages: ChatMessage[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: m.toolResults?.[0]?.toolCallId ?? m.id,
        content: m.toolResults?.map((r) => r.content).join("\n") ?? m.content,
      });
      continue;
    }

    const images = m.attachments?.filter((a) => a.type.startsWith("image/"));
    const hasContent = m.content && m.content.length > 0;

    if ((m.role === "user" || m.role === "assistant") && images?.length) {
      out.push({
        role: m.role,
        content: [
          ...(hasContent ? [{ type: "text", text: m.content }] : []),
          ...images.map((img) => ({
            type: "image_url",
            image_url: { url: img.url ?? "" },
          })),
        ],
        ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map(toWireToolCall) } : {}),
      });
      continue;
    }

    out.push({
      role: m.role,
      content: m.content,
      ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map(toWireToolCall) } : {}),
    });

    // Reconstruct tool results so follow-up turns stay valid: an assistant
    // turn that issued tool calls must be followed by role:tool result messages.
    if (m.role === "assistant" && m.toolCalls?.length && m.toolResults?.length) {
      for (const r of m.toolResults) {
        out.push({ role: "tool", tool_call_id: r.toolCallId, content: r.content });
      }
    }
  }
  return out;
}

function toWireToolCall(tc: ToolCall) {
  return {
    id: tc.id,
    type: "function",
    function: { name: tc.name, arguments: tc.arguments },
  };
}

function toWireTools(tools?: ToolDef[]) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Provider-specific request body tweaks. Reasoning-capable providers map reasoning_effort natively;
 * other OpenAI-compatible servers ignore unknown keys safely in practice,
 * but we only add it for providers that support it.
 */
function buildBody(params: ChatParams): Record<string, unknown> {
  const { provider, model, messages, reasoningEffort, temperature, tools } = params;
  const body: Record<string, unknown> = {
    model,
    messages: toWireMessages(messages),
    stream: true,
  };
  if (typeof temperature === "number") body.temperature = temperature;
  const wireTools = toWireTools(tools);
  if (wireTools) {
    body.tools = wireTools;
    body.tool_choice = "auto";
  }

  // Reasoning effort: only sent when the provider opts in (e.g. reasoning-capable
  // models). Other servers ignore unknown fields, but we gate it to be safe.
  if (provider.reasoning === true && reasoningEffort && reasoningEffort !== "none") {
    body.thinking = { type: "enabled" };
    body.reasoning_effort = reasoningEffort;
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* Core streaming                                                      */
/* ------------------------------------------------------------------ */

/**
 * Streams a chat completion. Yields ChatStreamEvent objects.
 * Throws on non-2xx with a useful message.
 */
export async function* chatStream(params: ChatParams): AsyncGenerator<ChatStreamEvent> {
  const { provider, signal } = params;
  const url = `${provider.baseURL.replace(/\/$/, "")}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(provider),
      body: JSON.stringify(buildBody(params)),
      signal,
    });
  } catch (err) {
    yield {
      type: "error",
      message: `Network error contacting ${provider.name}: ${(err as Error).message}`,
    };
    return;
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    yield {
      type: "error",
      status: res.status,
      message: `${provider.name} returned ${res.status}: ${text.slice(0, 500)}`,
    };
    return;
  }

  // Parse SSE: lines starting with "data: "
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Usage | undefined;
  let finishReason: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (!line || line.startsWith(":")) continue; // heartbeat/comment
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          yield { type: "finish", finishReason, usage };
          return;
        }
        try {
          const json = JSON.parse(data);
          const choice = json.choices?.[0];
          const delta = choice?.delta ?? {};

          if (typeof delta.content === "string" && delta.content.length > 0) {
            yield { type: "delta", content: delta.content };
          }
          // some providers surface reasoning in reasoning_content
          if (
            typeof delta.reasoning_content === "string" &&
            delta.reasoning_content.length > 0
          ) {
            yield { type: "reasoning", content: delta.reasoning_content };
          }
          // OpenAI o-series style
          if (
            typeof delta.reasoning === "string" &&
            delta.reasoning.length > 0
          ) {
            yield { type: "reasoning", content: delta.reasoning };
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const merged = mergeToolCall(undefined, tc);
              if (merged?.name && merged.arguments !== undefined) {
                yield { type: "tool_call", toolCall: merged };
              }
            }
          }
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (json.usage) usage = json.usage;
        } catch {
          // ignore malformed keepalive lines
        }
      }
    }
    yield { type: "finish", finishReason, usage };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

/**
 * The streaming deltas for tool_calls arrive in fragments across SSE chunks
 * (index + function.name + function.arguments appended piece by piece).
 * This merges one fragment into a partial ToolCall.
 */
function mergeToolCall(
  acc: ToolCall | undefined,
  frag: {
    id?: string;
    index?: number;
    function?: { name?: string; arguments?: string };
  },
): ToolCall | undefined {
  // Note: we collapse fragments by name; full multi-tool reassembly across
  // indices is handled at the proxy aggregation layer. For the streaming UI
  // we emit a tool_call when both name & arguments are present.
  const name = frag.function?.name ?? acc?.name;
  const args = frag.function?.arguments ?? "";
  if (!name) return acc;
  return {
    id: frag.id ?? acc?.id ?? name,
    name,
    arguments: (acc?.arguments ?? "") + args,
  };
}

/* ------------------------------------------------------------------ */
/* Model listing                                                       */
/* ------------------------------------------------------------------ */

export async function listModels(provider: ProviderConfig): Promise<ModelInfo[]> {
  const url = `${provider.baseURL.replace(/\/$/, "")}/models`;
  const res = await fetch(url, { headers: buildHeaders(provider) });
  if (!res.ok) {
    throw new Error(`${provider.name} /models returned ${res.status}`);
  }
  const json = (await res.json()) as { data?: Array<{ id: string }>; models?: Array<{ id: string }> };
  const data = json.data ?? json.models ?? [];
  return data.map((m) => ({ id: m.id }));
}
