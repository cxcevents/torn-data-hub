import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, guidesTable, guideVotesTable, guideCommentsTable } from "@workspace/db";
import { and, eq, sql, desc, inArray } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import { verifyTornKey, ADMIN_PLAYER_ID } from "../lib/torn-verify";

// Guide bodies are rich HTML from the dashboard editor (or pasted content).
// Allow basic formatting only; everything else (scripts, styles, images) is stripped.
function cleanGuideHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "hr", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href"], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https"],
    transformTags: { h1: "h2", h4: "h3", h5: "h3", h6: "h3" },
  });
}

function plainTextOf(html: string): string {
  // Insert spaces at tag boundaries so "…heading</h2><p>Text…" doesn't glue words together.
  return sanitizeHtml(html.replace(/></g, "> <"), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

const router: IRouter = Router();

const CATEGORIES = ["getting-started", "leveling", "faction", "money", "drugs-boosters", "combat", "misc"] as const;
const AUDIENCES = ["new", "established", "all"] as const;

const KeyBody = z.object({ apiKey: z.string().min(1).max(64) });

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "guide";
}

async function scoresFor(guideIds: number[]) {
  if (guideIds.length === 0) return new Map<number, { up: number; down: number }>();
  const rows = await db
    .select({
      guideId: guideVotesTable.guideId,
      up: sql<number>`count(*) filter (where ${guideVotesTable.value} > 0)`,
      down: sql<number>`count(*) filter (where ${guideVotesTable.value} < 0)`,
    })
    .from(guideVotesTable)
    .where(inArray(guideVotesTable.guideId, guideIds))
    .groupBy(guideVotesTable.guideId);
  return new Map(rows.map((r) => [r.guideId, { up: Number(r.up), down: Number(r.down) }]));
}

function excerpt(body: string): string {
  const text = plainTextOf(body).replace(/^#+\s*/gm, "").replace(/^-\s*/gm, "");
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

// ── List approved guides ──
router.get("/guides", async (_req, res) => {
  const guides = await db
    .select()
    .from(guidesTable)
    .where(eq(guidesTable.status, "approved"))
    .orderBy(desc(guidesTable.publishedAt));

  const ids = guides.map((g) => g.id);
  const scores = await scoresFor(ids);

  const counts = ids.length
    ? await db
        .select({ guideId: guideCommentsTable.guideId, n: sql<number>`count(*)` })
        .from(guideCommentsTable)
        .where(and(inArray(guideCommentsTable.guideId, ids), eq(guideCommentsTable.deleted, false)))
        .groupBy(guideCommentsTable.guideId)
    : [];
  const commentCounts = new Map(counts.map((c) => [c.guideId, Number(c.n)]));

  res.json({
    guides: guides.map(({ body, ...g }) => ({
      ...g,
      summary: g.summary || excerpt(body),
      score: (scores.get(g.id)?.up ?? 0) - (scores.get(g.id)?.down ?? 0),
      comments: commentCounts.get(g.id) ?? 0,
    })),
  });
});

// ── Guide detail (with comments; viewer's own vote if key provided) ──
router.get("/guides/:slug", async (req, res) => {
  const [guide] = await db.select().from(guidesTable).where(eq(guidesTable.slug, req.params.slug));
  if (!guide || guide.status !== "approved") {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  const scores = await scoresFor([guide.id]);
  const comments = await db
    .select()
    .from(guideCommentsTable)
    .where(and(eq(guideCommentsTable.guideId, guide.id), eq(guideCommentsTable.deleted, false)))
    .orderBy(guideCommentsTable.createdAt);

  let myVote = 0;
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (key) {
    const player = await verifyTornKey(key);
    if (player) {
      const [v] = await db
        .select()
        .from(guideVotesTable)
        .where(and(eq(guideVotesTable.guideId, guide.id), eq(guideVotesTable.playerId, player.playerId)));
      myVote = v?.value ?? 0;
    }
  }

  res.json({
    guide: {
      ...guide,
      score: (scores.get(guide.id)?.up ?? 0) - (scores.get(guide.id)?.down ?? 0),
    },
    comments,
    myVote,
  });
});

// ── Submit a guide (goes to pending queue) ──
const SubmitBody = KeyBody.extend({
  title: z.string().trim().min(8).max(120),
  summary: z.string().trim().max(300).optional().default(""),
  body: z
    .string()
    .trim()
    .max(200000)
    .transform(cleanGuideHtml)
    .refine((html) => plainTextOf(html).length >= 100, { message: "Guide text must be at least 100 characters" }),
  category: z.enum(CATEGORIES),
  audience: z.enum(AUDIENCES),
});

router.post("/guides", async (req, res) => {
  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid submission" });
    return;
  }
  const player = await verifyTornKey(parsed.data.apiKey);
  if (!player) {
    res.status(401).json({ error: "Could not verify your Torn API key" });
    return;
  }

  let slug = slugify(parsed.data.title);
  const existing = await db.select({ slug: guidesTable.slug }).from(guidesTable).where(eq(guidesTable.slug, slug));
  if (existing.length) slug = `${slug}-${Date.now().toString(36)}`;

  const [row] = await db
    .insert(guidesTable)
    .values({
      slug,
      title: parsed.data.title,
      summary: parsed.data.summary || null,
      body: parsed.data.body,
      category: parsed.data.category,
      audience: parsed.data.audience,
      authorId: player.playerId,
      authorName: player.name,
      status: "pending",
    })
    .returning();

  res.json({ ok: true, id: row.id, slug: row.slug });
});

// ── Edit own guide (author only; edited guides go back to the review queue) ──
router.post("/guides/:id/edit", async (req, res) => {
  const parsed = SubmitBody.safeParse(req.body);
  const guideId = Number(req.params.id);
  if (!parsed.success || !Number.isInteger(guideId)) {
    res.status(400).json({ error: parsed.success ? "Invalid guide" : parsed.error.issues[0]?.message ?? "Invalid submission" });
    return;
  }
  const player = await verifyTornKey(parsed.data.apiKey);
  if (!player) {
    res.status(401).json({ error: "Could not verify your Torn API key" });
    return;
  }
  const [guide] = await db.select().from(guidesTable).where(eq(guidesTable.id, guideId));
  if (!guide) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  if (guide.authorId !== player.playerId && player.playerId !== ADMIN_PLAYER_ID) {
    res.status(403).json({ error: "Only the author can edit this guide" });
    return;
  }
  // Admin edits stay live; author edits go back through review.
  const nextStatus = player.playerId === ADMIN_PLAYER_ID ? guide.status : "pending";
  const [row] = await db
    .update(guidesTable)
    .set({
      title: parsed.data.title,
      summary: parsed.data.summary || null,
      body: parsed.data.body,
      category: parsed.data.category,
      audience: parsed.data.audience,
      status: nextStatus,
    })
    .where(eq(guidesTable.id, guideId))
    .returning();
  res.json({ ok: true, slug: row.slug, status: row.status });
});

// ── Vote (value: 1, -1, or 0 to clear) ──
const VoteBody = KeyBody.extend({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

router.post("/guides/:id/vote", async (req, res) => {
  const parsed = VoteBody.safeParse(req.body);
  const guideId = Number(req.params.id);
  if (!parsed.success || !Number.isInteger(guideId)) {
    res.status(400).json({ error: "Invalid vote" });
    return;
  }
  const player = await verifyTornKey(parsed.data.apiKey);
  if (!player) {
    res.status(401).json({ error: "Could not verify your Torn API key" });
    return;
  }
  const [guide] = await db.select({ id: guidesTable.id, status: guidesTable.status }).from(guidesTable).where(eq(guidesTable.id, guideId));
  if (!guide || guide.status !== "approved") {
    res.status(404).json({ error: "Guide not found" });
    return;
  }

  if (parsed.data.value === 0) {
    await db
      .delete(guideVotesTable)
      .where(and(eq(guideVotesTable.guideId, guideId), eq(guideVotesTable.playerId, player.playerId)));
  } else {
    await db
      .insert(guideVotesTable)
      .values({ guideId, playerId: player.playerId, value: parsed.data.value })
      .onConflictDoUpdate({
        target: [guideVotesTable.guideId, guideVotesTable.playerId],
        set: { value: parsed.data.value, updatedAt: sql`now()` },
      });
  }

  const scores = await scoresFor([guideId]);
  res.json({ ok: true, score: (scores.get(guideId)?.up ?? 0) - (scores.get(guideId)?.down ?? 0), myVote: parsed.data.value });
});

// ── Comment (posts instantly) ──
const CommentBody = KeyBody.extend({ body: z.string().trim().min(2).max(2000) });

router.post("/guides/:id/comments", async (req, res) => {
  const parsed = CommentBody.safeParse(req.body);
  const guideId = Number(req.params.id);
  if (!parsed.success || !Number.isInteger(guideId)) {
    res.status(400).json({ error: "Invalid comment" });
    return;
  }
  const player = await verifyTornKey(parsed.data.apiKey);
  if (!player) {
    res.status(401).json({ error: "Could not verify your Torn API key" });
    return;
  }
  const [guide] = await db.select({ id: guidesTable.id, status: guidesTable.status }).from(guidesTable).where(eq(guidesTable.id, guideId));
  if (!guide || guide.status !== "approved") {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  const [row] = await db
    .insert(guideCommentsTable)
    .values({ guideId, playerId: player.playerId, playerName: player.name, body: parsed.data.body })
    .returning();
  res.json({ ok: true, comment: row });
});

// ── Admin: pending queue + review + comment deletion ──
async function requireAdmin(apiKey: string) {
  const player = await verifyTornKey(apiKey);
  return player && player.playerId === ADMIN_PLAYER_ID ? player : null;
}

router.post("/guides/admin/list", async (req, res) => {
  const parsed = KeyBody.safeParse(req.body);
  if (!parsed.success || !(await requireAdmin(parsed.data.apiKey))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const pending = await db.select().from(guidesTable).where(eq(guidesTable.status, "pending")).orderBy(guidesTable.createdAt);
  res.json({ pending });
});

const ReviewBody = KeyBody.extend({ action: z.enum(["approve", "reject"]) });

router.post("/guides/admin/:id/review", async (req, res) => {
  const parsed = ReviewBody.safeParse(req.body);
  const guideId = Number(req.params.id);
  if (!parsed.success || !Number.isInteger(guideId)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  if (!(await requireAdmin(parsed.data.apiKey))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [row] = await db
    .update(guidesTable)
    .set(
      parsed.data.action === "approve"
        ? { status: "approved", publishedAt: sql`now()` }
        : { status: "rejected" },
    )
    .where(eq(guidesTable.id, guideId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  res.json({ ok: true, status: row.status });
});

router.post("/guides/admin/comments/:id/delete", async (req, res) => {
  const parsed = KeyBody.safeParse(req.body);
  const commentId = Number(req.params.id);
  if (!parsed.success || !Number.isInteger(commentId)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  if (!(await requireAdmin(parsed.data.apiKey))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.update(guideCommentsTable).set({ deleted: true }).where(eq(guideCommentsTable.id, commentId));
  res.json({ ok: true });
});

export default router;
