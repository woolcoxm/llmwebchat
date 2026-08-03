/**
 * Dev runner: starts the proxy + vite together with no extra dependencies
 * (replaces `concurrently`, whose `tree-kill` dependency breaks on OneDrive-
 * synced folders and some Windows shells). Output is interleaved; Ctrl+C exits.
 */
import { spawn } from "node:child_process";

const children = [];
let exiting = false;

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* noop */
    }
  }
  process.exit(code);
}

function start(name, color, cmd, args) {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    shell: true,
  });
  children.push(p);
  p.on("exit", (code, signal) => {
    if (exiting) return;
    console.log(`\n[${name}] exited (code ${code}, signal ${signal})`);
    shutdown(code ?? 0);
  });
  p.on("error", (err) => {
    console.error(`[${name}] failed to start:`, err.message);
    shutdown(1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting proxy (:8787) + web (:5173)…\n");
start("server", "magenta", "pnpm", ["--filter", "@llmwebchat/server", "dev"]);
start("web", "cyan", "pnpm", ["--filter", "@llmwebchat/web", "dev"]);
