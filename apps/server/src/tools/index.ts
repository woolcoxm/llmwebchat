/**
 * Tool registry, built from Settings per request (no global mutable state).
 *
 * Capability gating is enforced here, not in the UI:
 *   - web_search / web_reader: on unless allowWeb === false
 *   - read_file: on when workspaceRoot set and allowFiles !== false
 *   - write_file: off unless allowWriteFiles === true
 *   - run_bash: off unless allowBash === true
 */
import type { Settings, ToolCall, ToolDef, ToolResult } from "@llmwebchat/shared";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  readFileDef,
  writeFileDef,
  makeReadFile,
  makeWriteFile,
} from "./files.js";
import { runBashDef, makeRunBash } from "./bash.js";
import { webReaderDef, webSearchDef, webReader, webSearch } from "./web.js";

type Runner = (args: unknown) => Promise<string>;
export interface ToolEntry {
  def: ToolDef;
  run: Runner;
  /** whether the tool is enabled under current settings */
  enabled: boolean;
  /** marks potentially-destructive tools for UI surfacing */
  destructive?: boolean;
}

export function buildTools(settings: Settings): ToolEntry[] {
  const t = settings.tools ?? {};
  const root =
    t.workspaceRoot && existsSync(t.workspaceRoot)
      ? resolve(t.workspaceRoot)
      : undefined;

  const entries: ToolEntry[] = [
    {
      def: webSearchDef,
      run: (a) => webSearch(a as { query: string; num?: number }),
      enabled: t.allowWeb !== false,
    },
    {
      def: webReaderDef,
      run: (a) => webReader(a as { url: string }),
      enabled: t.allowWeb !== false,
    },
    {
      def: readFileDef,
      run: root ? (makeReadFile(root) as Runner) : disabled("read_file", "no workspaceRoot"),
      enabled: !!root && t.allowFiles !== false,
    },
    {
      def: writeFileDef,
      run: root ? (makeWriteFile(root) as Runner) : disabled("write_file", "no workspaceRoot"),
      enabled: !!root && t.allowWriteFiles === true,
      destructive: true,
    },
    {
      def: runBashDef,
      run: root ? (makeRunBash(root) as Runner) : disabled("run_bash", "no workspaceRoot"),
      enabled: !!root && t.allowBash === true,
      destructive: true,
    },
  ];
  return entries;
}

function disabled(name: string, why: string): Runner {
  return async () => `Error: ${name} disabled (${why})`;
}

/** Tool defs to send to the model: either the requested allowlist or all enabled. */
export function enabledToolDefs(
  entries: ToolEntry[],
  requested?: string[],
): ToolDef[] {
  const byName = new Map(entries.map((e) => [e.def.name, e]));
  if (!requested?.length) return entries.filter((e) => e.enabled).map((e) => e.def);
  // Only allow enabled tools even if requested.
  return requested
    .map((n) => byName.get(n))
    .filter((e): e is ToolEntry => !!e && e.enabled)
    .map((e) => e.def);
}

/** Public description of tools (for the UI). Never includes runners. */
export function describeTools(entries: ToolEntry[]) {
  return entries.map((e) => ({
    name: e.def.name,
    description: e.def.description,
    enabled: e.enabled,
    destructive: e.destructive ?? false,
  }));
}

export async function executeTool(
  entries: ToolEntry[],
  tc: ToolCall,
): Promise<ToolResult> {
  const entry = entries.find((e) => e.def.name === tc.name);
  if (!entry || !entry.enabled) {
    return {
      toolCallId: tc.id,
      name: tc.name,
      isError: true,
      content: `Error: tool "${tc.name}" is not available or not enabled`,
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
