import { Router, type IRouter } from "express";
import { z } from "zod";
import { sql, eq, and, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { xanaxHistoryTable } from "@workspace/db/schema";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SyncBody = z.object({
  playerId: z.number().int().positive(),
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
router.post("/xanax/history", async (req, res) => {
  const { playerId, days } = SyncBody.parse(req.body);
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

// Full archive for a player (optionally only days before a given date).
router.get("/xanax/history", async (req, res) => {
  const playerId = z.coerce.number().int().positive().parse(req.query.playerId);
  const before = typeof req.query.before === "string" && DATE_RE.test(req.query.before) ? req.query.before : null;

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

export default router;
