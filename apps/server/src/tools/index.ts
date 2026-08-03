/**
 * Tool registry + executor. Phase 0 ships no built-in tools, but the
 * contract is in place: the chat route's agentic loop calls executeTool()
 * for any tool_call the model emits.
 *
 * Phase 3 will register: web_search, web_reader, file ops, code_interpreter,
 * and dynamically-connected MCP servers.
 */
import type { ToolCall, ToolDef, ToolResult } from "@llmwebchat/shared";

const REGISTRY: Record<string, { def: ToolDef; run: (args: unknown) => Promise<string> }> = {};

export function registerTool(def: ToolDef, run: (args: unknown) => Promise<string>) {
  REGISTRY[def.name] = { def, run };
}

export function listEnabledTools(names?: string[]): ToolDef[] {
  const all = Object.values(REGISTRY).map((t) => t.def);
  if (!names?.length) return all;
  return all.filter((t) => names.includes(t.name));
}

export async function executeTool(tc: ToolCall, _signal: AbortSignal): Promise<ToolResult> {
  const entry = REGISTRY[tc.name];
  if (!entry) {
    return {
      toolCallId: tc.id,
      name: tc.name,
      isError: true,
      content: `Error: unknown tool "${tc.name}"`,
    };
  }
  let args: unknown;
  try {
    args = tc.arguments ? JSON.parse(tc.arguments) : {};
  } catch {
    return {
      toolCallId: tc.id,
      name: tc.name,
      isError: true,
      content: "Error: invalid JSON arguments",
    };
  }
  try {
    const content = await entry.run(args);
    return { toolCallId: tc.id, name: tc.name, content };
  } catch (err) {
    return {
      toolCallId: tc.id,
      name: tc.name,
      isError: true,
      content: `Error: ${(err as Error).message}`,
    };
  }
}
