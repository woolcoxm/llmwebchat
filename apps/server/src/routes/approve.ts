/** POST /api/approve — resolve a pending human-in-the-loop tool approval. */
import { Hono } from "hono";
import { resolveApproval } from "../approvals.js";

export const approveRouter = new Hono();

approveRouter.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { id?: string; decision?: "approve" | "reject" };
  if (!body.id || !body.decision) return c.json({ error: "id and decision required" }, 400);
  const ok = resolveApproval(body.id, body.decision);
  return c.json({ ok });
});
