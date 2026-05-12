import { Router, type IRouter } from "express";
import { z } from "zod";
import { cleanup, getSessions, getHistory, getActivePlayerIds } from "../lib/session-store";

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
  const activeIds = getActivePlayerIds();

  // Deduplicate by playerId — keep the most recently seen session per identified player
  const seenPlayerIds = new Set<number>();
  const sessions = getSessions()
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .filter((s) => {
      if (!s.playerId) return true; // always include anonymous sessions
      if (seenPlayerIds.has(s.playerId)) return false;
      seenPlayerIds.add(s.playerId);
      return true;
    })
    .map((s) => ({
      name: s.name,
      playerId: s.playerId,
      level: s.level,
      lastSeenAgo: Math.round((now - s.lastSeen) / 1000),
      onlineForSeconds: Math.round((now - s.firstSeen) / 1000),
    }));

  const historicalPlayers = getHistory()
    .filter((h) => !activeIds.has(h.playerId))
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((h) => ({
      name: h.name,
      playerId: h.playerId,
      level: h.level,
      lastSeenAgo: Math.round((now - h.lastSeen) / 1000),
      firstSeenAgo: Math.round((now - h.firstSeen) / 1000),
      visitCount: h.visitCount,
    }));

  res.json({ sessions, total: sessions.length, history: historicalPlayers });
});

export default router;
