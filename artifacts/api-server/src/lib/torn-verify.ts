// Verify a Torn API key and resolve the player behind it.
// Small in-memory cache so repeated actions don't hammer Torn's API.

interface VerifiedPlayer {
  playerId: number;
  name: string;
}

const cache = new Map<string, { player: VerifiedPlayer; expires: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function verifyTornKey(apiKey: string): Promise<VerifiedPlayer | null> {
  const hit = cache.get(apiKey);
  if (hit && hit.expires > Date.now()) return hit.player;

  let data: { player_id?: number; name?: string; error?: unknown };
  try {
    const res = await fetch(
      `https://api.torn.com/user/?selections=basic&key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return null;
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }
  if (data.error || typeof data.player_id !== "number") return null;

  const player = { playerId: data.player_id, name: data.name ?? `Player ${data.player_id}` };
  cache.set(apiKey, { player, expires: Date.now() + TTL_MS });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
  }
  return player;
}

export const ADMIN_PLAYER_ID = 2032555;
