import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { admins } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { cleanup, getSessions, getHistory, getActivePlayerIds } from "../lib/session-store";
import { verifyTornKey } from "../lib/torn-verify";
import { isAdminPlayer, isPrimaryAdmin, invalidateAdminCache } from "../lib/admins";

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

  if (tornData.error || !tornData.player_id || !(await isAdminPlayer(tornData.player_id))) {
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

// ── Baldr list cleanup: open a PR on Oran's repo removing given player ids ──

const BALDR_OWNER = "OranWeb";
const BALDR_REPO = "tc-baldrs-levelling-list";
const BALDR_FILE = "data.json";

const BaldrPrBody = z.object({
  apiKey: z.string().min(1).max(64),
  removeIds: z.array(z.number().int().positive()).min(1).max(5000),
  activeDays: z.number().int().positive().max(3650).default(150),
});

async function verifyAdmin(apiKey: string): Promise<boolean> {
  const tornRes = await fetch(
    `https://api.torn.com/user/?selections=basic&key=${encodeURIComponent(apiKey)}`,
  );
  if (!tornRes.ok) return false;
  const data = (await tornRes.json()) as { player_id?: number; error?: unknown };
  return !data.error && !!data.player_id && (await isAdminPlayer(data.player_id));
}

// ── Admin management: check status, list, grant, revoke ──

router.post("/admin/check", async (req, res) => {
  const { apiKey } = AdminBody.parse(req.body);
  const player = await verifyTornKey(apiKey);
  if (!player) {
    res.json({ isAdmin: false, isPrimary: false });
    return;
  }
  res.json({
    isAdmin: await isAdminPlayer(player.playerId),
    isPrimary: isPrimaryAdmin(player.playerId),
  });
});

router.post("/admin/admins/list", async (req, res) => {
  const { apiKey } = AdminBody.parse(req.body);
  const player = await verifyTornKey(apiKey);
  if (!player || !(await isAdminPlayer(player.playerId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db.select().from(admins);
  res.json({
    admins: rows.map((r) => ({ playerId: r.playerId, name: r.name })),
    primary: ADMIN_PLAYER_ID,
  });
});

const GrantBody = z.object({
  apiKey: z.string().min(1).max(64),
  playerId: z.number().int().positive(),
  // Optional — when omitted (adding by raw ID), we resolve the name from Torn.
  name: z.string().min(1).max(100).optional(),
});

router.post("/admin/admins/add", async (req, res) => {
  const { apiKey, playerId, name: givenName } = GrantBody.parse(req.body);
  let name = givenName;
  const player = await verifyTornKey(apiKey);
  if (!player || !isPrimaryAdmin(player.playerId)) {
    res.status(403).json({ error: "Only the primary admin can grant admin access" });
    return;
  }
  if (isPrimaryAdmin(playerId)) {
    res.status(400).json({ error: "You are already the primary admin" });
    return;
  }
  if (!name) {
    // Resolve the player's name from Torn so raw-ID grants hit a real player.
    try {
      const tornRes = await fetch(
        `https://api.torn.com/user/${playerId}?selections=basic&key=${encodeURIComponent(apiKey)}`,
      );
      const data = (await tornRes.json()) as { name?: string; error?: unknown };
      if (!tornRes.ok || data.error || !data.name) {
        res.status(404).json({ error: `No Torn player found with ID ${playerId}` });
        return;
      }
      name = data.name;
    } catch {
      res.status(502).json({ error: "Could not reach Torn API to verify that player" });
      return;
    }
  }
  await db
    .insert(admins)
    .values({ playerId, name, addedBy: player.playerId })
    .onConflictDoNothing();
  invalidateAdminCache(playerId);
  res.json({ ok: true });
});

router.post("/admin/admins/remove", async (req, res) => {
  const { apiKey, playerId } = GrantBody.omit({ name: true }).parse(req.body);
  const player = await verifyTornKey(apiKey);
  if (!player || !isPrimaryAdmin(player.playerId)) {
    res.status(403).json({ error: "Only the primary admin can revoke admin access" });
    return;
  }
  if (isPrimaryAdmin(playerId)) {
    res.status(400).json({ error: "The primary admin cannot be removed" });
    return;
  }
  await db.delete(admins).where(eq(admins.playerId, playerId));
  invalidateAdminCache(playerId);
  res.json({ ok: true });
});

router.post("/admin/baldr-pr", async (req, res) => {
  const { apiKey, removeIds, activeDays } = BaldrPrBody.parse(req.body);

  try {
    if (!(await verifyAdmin(apiKey))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch {
    res.status(502).json({ error: "Could not reach Torn API" });
    return;
  }

  try {
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connectors = new ReplitConnectors();
    const gh = (path: string, init?: RequestInit) =>
      connectors.proxy("github", path, init as never);

    // Who are we? (fork owner + PR head)
    const userRes = await gh("/user");
    if (!userRes.ok) throw new Error(`GitHub auth failed (${userRes.status})`);
    const login = ((await userRes.json()) as { login: string }).login;

    // Base repo info + current data.json
    const baseRepoRes = await gh(`/repos/${BALDR_OWNER}/${BALDR_REPO}`);
    if (!baseRepoRes.ok) throw new Error("Could not read Oran's repo");
    const baseBranch = ((await baseRepoRes.json()) as { default_branch: string }).default_branch;

    const fileRes = await gh(
      `/repos/${BALDR_OWNER}/${BALDR_REPO}/contents/${BALDR_FILE}?ref=${baseBranch}`,
      { headers: { Accept: "application/vnd.github.raw+json" } },
    );
    if (!fileRes.ok) throw new Error("Could not read data.json from Oran's repo");
    const data = JSON.parse(await fileRes.text()) as Record<
      string,
      (number | { id: string | number; name?: string })[]
    >;

    // Strip the given ids from every list
    const removeSet = new Set(removeIds);
    const entryId = (e: number | { id: string | number }) =>
      typeof e === "number" ? e : parseInt(String(e.id), 10);
    let removedCount = 0;
    const removedNames: string[] = [];
    for (const list of Object.keys(data)) {
      data[list] = data[list].filter((e) => {
        const hit = removeSet.has(entryId(e));
        if (hit) {
          removedCount++;
          if (typeof e === "object" && e.name) removedNames.push(`${e.name} [${entryId(e)}]`);
          else removedNames.push(`[${entryId(e)}]`);
        }
        return !hit;
      });
    }
    if (removedCount === 0) {
      res.status(400).json({ error: "None of those ids are in the current list" });
      return;
    }

    // Ensure our fork exists (idempotent)
    const forkRes = await gh(`/repos/${BALDR_OWNER}/${BALDR_REPO}/forks`, { method: "POST" });
    if (!forkRes.ok && forkRes.status !== 202) throw new Error("Could not fork the repo");
    // Forking is async — poll until the fork is readable
    for (let i = 0; i < 10; i++) {
      const check = await gh(`/repos/${login}/${BALDR_REPO}`);
      if (check.ok) break;
      await new Promise((r) => setTimeout(r, 2000));
      if (i === 9) throw new Error("Fork did not become ready in time");
    }

    // Sync fork's base branch to upstream head, then branch from it
    const baseRefRes = await gh(
      `/repos/${BALDR_OWNER}/${BALDR_REPO}/git/ref/heads/${baseBranch}`,
    );
    if (!baseRefRes.ok) throw new Error("Could not read upstream branch");
    const baseSha = ((await baseRefRes.json()) as { object: { sha: string } }).object.sha;

    const branch = `remove-active-players-${Date.now()}`;
    const refRes = await gh(`/repos/${login}/${BALDR_REPO}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
    if (!refRes.ok) throw new Error("Could not create branch on fork");

    // Get the file's blob sha on our new branch, then commit the update
    const fileMetaRes = await gh(
      `/repos/${login}/${BALDR_REPO}/contents/${BALDR_FILE}?ref=${branch}`,
    );
    if (!fileMetaRes.ok) throw new Error("Could not read data.json on fork");
    const fileSha = ((await fileMetaRes.json()) as { sha: string }).sha;

    const newContent = Buffer.from(JSON.stringify(data, null, 4) + "\n").toString("base64");
    const putRes = await gh(`/repos/${login}/${BALDR_REPO}/contents/${BALDR_FILE}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Remove ${removedCount} players active within the last ${activeDays} days`,
        content: newContent,
        branch,
        sha: fileSha,
      }),
    });
    if (!putRes.ok) throw new Error("Could not commit updated data.json");

    // Open the PR against Oran's repo
    const namePreview = removedNames.slice(0, 50).join(", ");
    const prRes = await gh(`/repos/${BALDR_OWNER}/${BALDR_REPO}/pulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Remove ${removedCount} players active in the last ${activeDays} days`,
        head: `${login}:${branch}`,
        base: baseBranch,
        body:
          `Automated cleanup: these players showed Torn API last-action activity within ` +
          `the last ${activeDays} days, so their old spy reports are likely stale and they ` +
          `are no longer safe leveling targets.\n\nRemoved (${removedCount}):\n${namePreview}` +
          (removedNames.length > 50 ? `\n…and ${removedNames.length - 50} more.` : ""),
      }),
    });
    if (!prRes.ok) {
      const err = (await prRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || "Could not open the pull request");
    }
    const pr = (await prRes.json()) as { html_url: string; number: number };
    res.json({ prUrl: pr.html_url, prNumber: pr.number, removedCount });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "GitHub request failed" });
  }
});

export default router;
