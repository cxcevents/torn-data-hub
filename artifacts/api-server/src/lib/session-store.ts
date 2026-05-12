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

  // Keep a permanent history record for identified users
  if (name && playerId) {
    const prev = history.get(playerId);
    history.set(playerId, {
      name,
      playerId,
      level: level ?? prev?.level,
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
      visitCount: (prev?.visitCount ?? 0) + (existing ? 0 : 1), // increment only on new session
    });
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
