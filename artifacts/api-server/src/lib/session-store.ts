import { db, visitorHistoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface Session {
  sessionId: string;
  firstSeen: number;
  lastSeen: number;
  name?: string;
  playerId?: number;
  level?: number;
}

export interface HistoryEntry {
  name: string;
  playerId: number;
  level?: number;
  firstSeen: number;
  lastSeen: number;
  visitCount: number;
}

const sessions = new Map<string, Session>();
const history = new Map<number, HistoryEntry>(); // keyed by playerId
const TTL_MS = 90_000;

/** Load persisted history from DB into memory on server start. */
export async function initSessionStore() {
  try {
    const rows = await db.select().from(visitorHistoryTable);
    for (const row of rows) {
      history.set(row.playerId, {
        name: row.name,
        playerId: row.playerId,
        level: row.level ?? undefined,
        firstSeen: row.firstSeen.getTime(),
        lastSeen: row.lastSeen.getTime(),
        visitCount: row.visitCount,
      });
    }
    logger.info({ count: rows.length }, "Loaded visitor history from DB");
  } catch (err) {
    logger.error({ err }, "Failed to load visitor history from DB");
  }
}

/** Persist a history entry to DB (fire-and-forget). */
function persistHistoryEntry(entry: HistoryEntry) {
  db.insert(visitorHistoryTable)
    .values({
      playerId: entry.playerId,
      name: entry.name,
      level: entry.level ?? null,
      firstSeen: new Date(entry.firstSeen),
      lastSeen: new Date(entry.lastSeen),
      visitCount: entry.visitCount,
    })
    .onConflictDoUpdate({
      target: visitorHistoryTable.playerId,
      set: {
        name: entry.name,
        level: entry.level ?? null,
        lastSeen: new Date(entry.lastSeen),
        visitCount: entry.visitCount,
      },
    })
    .catch((err: unknown) => logger.error({ err }, "Failed to persist visitor history"));
}

export function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, session] of sessions) {
    if (session.lastSeen < cutoff) sessions.delete(id);
  }
}

export function upsertSession(
  sessionId: string,
  profile?: { name?: string; playerId?: number; level?: number },
) {
  const now = Date.now();
  const existing = sessions.get(sessionId);
  const name = profile?.name ?? existing?.name;
  const playerId = profile?.playerId ?? existing?.playerId;
  const level = profile?.level ?? existing?.level;

  sessions.set(sessionId, {
    sessionId,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
    name,
    playerId,
    level,
  });

  // Persist identified users to DB
  if (name && playerId) {
    const prev = history.get(playerId);
    const updated: HistoryEntry = {
      name,
      playerId,
      level: level ?? prev?.level,
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
      visitCount: (prev?.visitCount ?? 0) + (existing ? 0 : 1),
    };
    history.set(playerId, updated);
    persistHistoryEntry(updated);
  }
}

export function getCount(): number {
  return sessions.size;
}

export function getSessions(): Session[] {
  return Array.from(sessions.values());
}

export function getHistory(): HistoryEntry[] {
  return Array.from(history.values());
}

export function getActivePlayerIds(): Set<number> {
  const ids = new Set<number>();
  for (const s of sessions.values()) {
    if (s.playerId) ids.add(s.playerId);
  }
  return ids;
}
