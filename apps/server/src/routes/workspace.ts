/**
 * Workspace endpoints — browse the agent's working directory (read-only),
 * sandboxed to settings.agent.cwd via safeJoin. Lets the UI show the project
 * the agent is operating on.
 */
import { Hono } from "hono";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { safeJoin } from "../tools/sandbox.js";
import { loadSettings } from "../store.js";

export const workspaceRouter = new Hono();

function root(): string | null {
  const cwd = loadSettings().agent?.cwd;
  return cwd && existsSync(cwd) ? cwd : null;
}

workspaceRouter.get("/files", (c) => {
  const r = root();
  if (!r) return c.json({ error: "Agent working directory not configured." }, 400);
  const rel = c.req.query("path") ?? "";
  let dir: string;
  try {
    dir = rel ? safeJoin(r, rel) : r;
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  let entries: Array<{ name: string; dir: boolean; size: number }> = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((d) => !d.name.startsWith("."))
      .map((d) => {
        let size = 0;
        try {
          if (!d.isDirectory()) size = statSync(`${dir}/${d.name}`).size;
        } catch {
          /* noop */
        }
        return { name: d.name, dir: d.isDirectory(), size };
      })
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  return c.json({ cwd: r, path: rel, entries });
});

workspaceRouter.get("/file", (c) => {
  const r = root();
  if (!r) return c.json({ error: "Agent working directory not configured." }, 400);
  const rel = c.req.query("path") ?? "";
  let abs: string;
  try {
    abs = safeJoin(r, rel);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  if (!existsSync(abs) || statSync(abs).isDirectory()) return c.json({ error: "Not a file" }, 400);
  let content = "";
  try {
    content = readFileSync(abs, "utf-8").slice(0, 200_000);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  return c.json({ path: rel, name: basename(abs), content });
});
