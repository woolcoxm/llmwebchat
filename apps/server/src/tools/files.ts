/**
 * File tools, constrained to a configurable workspace root.
 * safeJoin() blocks path traversal outside the root.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { ToolDef } from "@llmwebchat/shared";
import { safeJoin } from "./sandbox.js";

export const readFileDef: ToolDef = {
  name: "read_file",
  description:
    "Read a text file from the workspace root and return its contents. Paths are sandboxed; traversal outside the workspace is blocked.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relative to workspace root" },
    },
    required: ["path"],
    additionalProperties: false,
  },
};

export const writeFileDef: ToolDef = {
  name: "write_file",
  description:
    "Write (create or overwrite) a text file within the workspace root. Creates parent dirs. Disabled unless explicitly enabled in settings.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relative to workspace root" },
      content: { type: "string", description: "Full file content to write" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
};

const MAX_READ = 500_000;

export function makeReadFile(root: string) {
  return async (args: { path: string }) => {
    const abs = safeJoin(root, args.path);
    const stat = statSync(abs);
    if (stat.size > MAX_READ) return `Error: file too large (${stat.size} bytes > ${MAX_READ})`;
    return readFileSync(abs, "utf-8");
  };
}

export function makeWriteFile(root: string) {
  return async (args: { path: string; content: string }) => {
    const abs = safeJoin(root, args.path);
    mkdirSync(dirname(abs), { recursive: true });
    const content = String(args.content ?? "");
    if (content.length > 2_000_000) return "Error: content exceeds 2MB limit";
    writeFileSync(abs, content, "utf-8");
    return `Wrote ${content.length} chars to ${args.path}`;
  };
}
