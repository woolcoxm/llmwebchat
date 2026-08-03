/**
 * In-process pending-approval registry for human-in-the-loop tool execution.
 *
 * The agentic loop awaits requestApproval() before running a destructive tool;
 * the browser POSTs /api/approve to resolve it. Entries time out so abandoned
 * requests don't leak.
 */
interface Pending {
  resolve: (decision: "approve" | "reject") => void;
  timer: NodeJS.Timeout;
}
const pending = new Map<string, Pending>();
const TIMEOUT_MS = 5 * 60 * 1000;

export function requestApproval(id: string): Promise<"approve" | "reject"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve("reject"); // timeout → treat as rejected (safe default)
      }
    }, TIMEOUT_MS);
    pending.set(id, { resolve, timer });
  });
}

export function resolveApproval(id: string, decision: "approve" | "reject"): boolean {
  const p = pending.get(id);
  if (!p) return false;
  clearTimeout(p.timer);
  pending.delete(id);
  p.resolve(decision);
  return true;
}

/** Cancel all pending (e.g. on client disconnect / shutdown). */
export function cancelAllPending() {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.resolve("reject");
  }
  pending.clear();
}
