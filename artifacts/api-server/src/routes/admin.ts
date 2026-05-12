import { Router, type IRouter } from "express";
import { z } from "zod";
import { cleanup, getSessions } from "../lib/session-store";

const router: IRouter = Router();

const ADMIN_PLAYER_ID = 2032555;

const AdminBody = z.object({ apiKey: z.string().min(1).max(64) });

router.post("/admin/sessions", async (req, res) => {
  const { apiKey } = AdminBody.parse(req.body);

  let tornData: { player_id?: number; error?: { code: number } };
  try {
    const tornRes = await fetch(
      `https://api.torn.com/user/?selections=basic&key=${encodeURIComponent(apiKey)}`,
    );
    if (!tornRes.ok) {
      res.status(401).json({ error: "Failed to verify identity with Torn" });
      return;
    }
    tornData = (await tornRes.json()) as typeof tornData;
  } catch {
    res.status(502).json({ error: "Could not reach Torn API" });
    return;
  }

  if (tornData.error || tornData.player_id !== ADMIN_PLAYER_ID) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  cleanup();
  const now = Date.now();
  const sessions = getSessions()
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((s) => ({
      name: s.name,
      playerId: s.playerId,
      level: s.level,
      lastSeenAgo: Math.round((now - s.lastSeen) / 1000),
      onlineForSeconds: Math.round((now - s.firstSeen) / 1000),
    }));

  res.json({ sessions, total: sessions.length });
});

export default router;
