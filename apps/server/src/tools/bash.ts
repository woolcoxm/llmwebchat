/**
 * run_bash tool — the most dangerous tool. OFF by default.
 * When enabled: runs in a sanitized env (keys stripped), with a hard timeout,
 * working directory locked to the workspace root, and output capped.
 */
import { spawn } from "node:child_process";
import type { ToolDef } from "@llmwebchat/shared";
import { sanitizedEnv } from "./sandbox.js";

export const runBashDef: ToolDef = {
  name: "run_bash",
  description:
    "Execute a shell command in the workspace root and return combined stdout/stderr. Use for builds, tests, git, etc. Disabled unless explicitly enabled in settings. Runs with a 60s timeout and a sanitized environment.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
    },
    required: ["command"],
    additionalProperties: false,
  },
};

const MAX_OUTPUT = 100_000;
const TIMEOUT_MS = 60_000;

export function makeRunBash(root: string) {
  return (args: { command: string }) =>
    new Promise<string>((resolve) => {
      const cmd = String(args.command ?? "");
      if (!cmd.trim()) return resolve("Error: empty command");
      const child = spawn(cmd, {
        cwd: root,
        env: sanitizedEnv(),
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
        timeout: TIMEOUT_MS,
        windowsHide: true,
      });
      let out = "";
      const push = (b: Buffer | string) => {
        out += b.toString();
        if (out.length > MAX_OUTPUT) {
          out = out.slice(0, MAX_OUTPUT) + "\n…[truncated]";
          try {
            child.kill("SIGKILL");
          } catch {
            /* noop */
          }
        }
      };
      child.stdout.on("data", push);
      child.stderr.on("data", push);
      child.on("error", (e) => resolve(`Error: ${e.message}`));
      child.on("close", (code) => {
        resolve(
          (out || "(no output)") +
            (code != null && code !== 0 ? `\n[exit code ${code}]` : ""),
        );
      });
    });
}
