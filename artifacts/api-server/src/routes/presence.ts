import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

const HeartbeatBody = z.object({ sessionId: z.string().min(1).max(128) });
const sessions = new Map<string, number>();
const TTL_MS = 90_000;

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, ts] of sessions) {
    if (ts < cutoff) sessions.delete(id);
  }
}

router.post("/presence/heartbeat", (req, res) => {
  const { sessionId } = HeartbeatBody.parse(req.body);
  cleanup();
  sessions.set(sessionId, Date.now());
  res.json({ count: sessions.size });
});

export default router;
