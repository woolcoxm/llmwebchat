/**
 * User-defined HTTP webhook tools. The model calls them via function calling;
 * the proxy fetches the configured URL with the model's arguments as JSON body
 * and returns the (size-capped) response text. SSRF-guarded unless allowPrivate.
 */
import type { CustomTool, ToolDef } from "@llmwebchat/shared";
import { assertPublicUrl } from "./sandbox.js";

const UA = "LLMWebChat/0.1 (+https://github.com/woolcoxm/llmwebchat)";
const MAX = 50_000;

export function customToolDef(t: CustomTool): ToolDef {
  return {
    name: t.name,
    description: t.description || `Custom HTTP tool ${t.name}`,
    parameters: {
      type: "object",
      properties: { input: { type: "string", description: "Free-form input for the tool" } },
      additionalProperties: true,
    },
    serverSide: true,
  };
}

export function makeCustomRunner(t: CustomTool) {
  return async (args: unknown) => {
    const method = t.method ?? "POST";
    const url = await assertPublicUrl(t.url, { allowPrivate: t.allowPrivate === true });
    const init: RequestInit = {
      method,
      headers: { "User-Agent": UA, "Content-Type": "application/json", ...(t.headers ?? {}) },
    };
    if (method !== "GET") init.body = JSON.stringify({ arguments: args });
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) return `HTTP ${res.status}: ${text.slice(0, 500)}`;
    return text.slice(0, MAX) || "(empty response)";
  };
}
