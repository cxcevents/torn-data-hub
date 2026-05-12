export interface Session {
  sessionId: string;
  firstSeen: number;
  lastSeen: number;
  name?: string;
  playerId?: number;
  level?: number;
}

const sessions = new Map<string, Session>();
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
  sessions.set(sessionId, {
    sessionId,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
    name: profile?.name ?? existing?.name,
    playerId: profile?.playerId ?? existing?.playerId,
    level: profile?.level ?? existing?.level,
  });
}

export function getCount(): number {
  return sessions.size;
}

export function getSessions(): Session[] {
  return Array.from(sessions.values());
}
