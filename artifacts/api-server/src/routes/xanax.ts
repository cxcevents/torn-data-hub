import { Router, type IRouter } from "express";
import { z } from "zod";
import { sql, eq, and, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { xanaxHistoryTable } from "@workspace/db/schema";
import { verifyTornKey } from "../lib/torn-verify";
import { isAdminPlayer } from "../lib/admins";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SyncBody = z.object({
  apiKey: z.string().min(1).max(64),
  days: z
    .array(
      z.object({
        date: z.string().regex(DATE_RE),
        count: z.number().int().min(0).max(100),
      }),
    )
    .min(1)
    .max(400),
});

// Upsert log-derived daily counts into the permanent archive.
// The player is derived from the verified API key — you can only write your own history.
router.post("/xanax/history", async (req, res) => {
  const { apiKey, days } = SyncBody.parse(req.body);
  const player = await verifyTornKey(apiKey);
  if (!player) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  const playerId = player.playerId;
  await db
    .insert(xanaxHistoryTable)
    .values(days.map((d) => ({ playerId, date: d.date, count: d.count })))
    .onConflictDoUpdate({
      target: [xanaxHistoryTable.playerId, xanaxHistoryTable.date],
      set: {
        count: sql`excluded.count`,
        updatedAt: sql`now()`,
      },
    });
  res.json({ ok: true, saved: days.length });
});

// Full archive for the key's own player (optionally only days before a given date).
// POST so the API key travels in the body, never in a URL.
router.post("/xanax/history/read", async (req, res) => {
  const { apiKey, before: rawBefore } = z
    .object({ apiKey: z.string().min(1).max(64), before: z.string().optional() })
    .parse(req.body);
  const player = await verifyTornKey(apiKey);
  if (!player) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  const playerId = player.playerId;
  const before = rawBefore && DATE_RE.test(rawBefore) ? rawBefore : null;

  const rows = await db
    .select({ date: xanaxHistoryTable.date, count: xanaxHistoryTable.count })
    .from(xanaxHistoryTable)
    .where(
      before
        ? and(eq(xanaxHistoryTable.playerId, playerId), lt(xanaxHistoryTable.date, before))
        : eq(xanaxHistoryTable.playerId, playerId),
    )
    .orderBy(xanaxHistoryTable.date);

  res.json({ days: rows });
});

// Backfill the archive from the full lifetime Torn log (server-side key).
// Paginates selections=log&log=2290 backwards 100 entries at a time.
router.post("/xanax/backfill", async (req, res) => {
  const caller = await verifyTornKey(
    z.object({ apiKey: z.string().min(1).max(64) }).parse(req.body).apiKey,
  );
  if (!caller || !(await isAdminPlayer(caller.playerId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const key = process.env.TORN_API_KEY;
  if (!key) {
    res.status(503).json({ error: "TORN_API_KEY not configured" });
    return;
  }

  const basicRes = await fetch(`https://api.torn.com/user/?selections=basic&key=${key}`);
  const basic = (await basicRes.json()) as { player_id?: number; error?: { error: string } };
  if (basic.error || !basic.player_id) {
    res.status(502).json({ error: basic.error?.error ?? "Could not resolve player id" });
    return;
  }
  const playerId = basic.player_id;

  type Entry = { timestamp: number };
  const dayCounts = new Map<string, number>();
  const seen = new Set<string>();
  let to: number | null = null;
  let prevOldest = Infinity;
  let pages = 0;

  for (; pages < 300; pages++) {
    const url =
      `https://api.torn.com/user/?selections=log&log=2290&from=0` +
      (to !== null ? `&to=${to}` : "") +
      `&key=${key}`;
    const r = await fetch(url);
    const data = (await r.json()) as { log?: Record<string, Entry>; error?: { error: string } };
    if (data.error) {
      res.status(502).json({ error: data.error.error, pagesFetched: pages });
      return;
    }
    const entries = Object.entries(data.log ?? {});
    if (entries.length === 0) break;

    let added = 0;
    for (const [id, e] of entries) {
      if (seen.has(id)) continue;
      seen.add(id);
      added++;
      const d = new Date(e.timestamp * 1000);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
    }

    const oldest = Math.min(...entries.map(([, e]) => e.timestamp));
    if (entries.length < 100) break;
    to = added === 0 || oldest >= prevOldest ? oldest - 1 : oldest;
    prevOldest = oldest;
    await new Promise((r2) => setTimeout(r2, 700)); // stay well under 100 req/min
  }

  const days = [...dayCounts.entries()].map(([date, count]) => ({ playerId, date, count }));
  // Chunked upsert
  for (let i = 0; i < days.length; i += 500) {
    const chunk = days.slice(i, i + 500);
    await db
      .insert(xanaxHistoryTable)
      .values(chunk)
      .onConflictDoUpdate({
        target: [xanaxHistoryTable.playerId, xanaxHistoryTable.date],
        set: { count: sql`excluded.count`, updatedAt: sql`now()` },
      });
  }

  const dates = days.map((d) => d.date).sort();
  res.json({
    ok: true,
    playerId,
    pagesFetched: pages + 1,
    totalXanax: [...dayCounts.values()].reduce((a, b) => a + b, 0),
    daysWithUse: days.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  });
});

export default router;
