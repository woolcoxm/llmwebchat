/** Manages PiSession instances keyed by sessionId, with idle reaping. */
import { PiSession, type PiSessionOptions } from "./bridge.js";

const sessions = new Map<string, PiSession>();
const IDLE_TTL_MS = 15 * 60 * 1000;

let reaper: NodeJS.Timeout | null = null;
function ensureReaper() {
  if (reaper) return;
  reaper = setInterval(async () => {
    for (const [id, s] of sessions) {
      if (s.idleMs > IDLE_TTL_MS && s.status !== "starting") {
        await s.close();
        sessions.delete(id);
      }
    }
  }, 60_000);
  reaper.unref?.();
}

export function getSession(id: string): PiSession | undefined {
  return sessions.get(id);
}

export async function ensureSession(id: string, opts: PiSessionOptions): Promise<PiSession> {
  ensureReaper();
  let s = sessions.get(id);
  if (!s || s.status === "closed" || s.status === "error") {
    s = new PiSession(id, opts);
    sessions.set(id, s);
    await s.start();
  }
  return s;
}

export function abortSession(id: string) {
  sessions.get(id)?.abort();
}

export async function shutdownAll() {
  for (const s of sessions.values()) await s.close();
  sessions.clear();
}

export function listSessions() {
  return [...sessions.values()].map((s) => ({
    sessionId: s.sessionId,
    status: s.status,
    idleMs: s.idleMs,
    lastError: s.lastError,
  }));
}
