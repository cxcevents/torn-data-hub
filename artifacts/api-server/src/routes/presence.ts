import { Router, type IRouter } from "express";
import { z } from "zod";
import { cleanup, upsertSession, getCount } from "../lib/session-store";

const router: IRouter = Router();

const HeartbeatBody = z.object({
  sessionId: z.string().min(1).max(128),
  name: z.string().max(64).optional(),
  playerId: z.number().int().positive().optional(),
  level: z.number().int().positive().optional(),
});

router.post("/presence/heartbeat", (req, res) => {
  const { sessionId, name, playerId, level } = HeartbeatBody.parse(req.body);
  cleanup();
  upsertSession(sessionId, { name, playerId, level });
  res.json({ count: getCount() });
});

export default router;
