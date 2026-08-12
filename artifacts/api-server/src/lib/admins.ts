import { db } from "@workspace/db";
import { admins } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ADMIN_PLAYER_ID } from "./torn-verify";

// Small cache so every admin-gated request doesn't hit the DB.
const cache = new Map<number, { isAdmin: boolean; expires: number }>();
const TTL_MS = 60 * 1000;

export function isPrimaryAdmin(playerId: number): boolean {
  return playerId === ADMIN_PLAYER_ID;
}

export async function isAdminPlayer(playerId: number): Promise<boolean> {
  if (isPrimaryAdmin(playerId)) return true;
  const hit = cache.get(playerId);
  if (hit && hit.expires > Date.now()) return hit.isAdmin;
  const [row] = await db.select().from(admins).where(eq(admins.playerId, playerId));
  const result = !!row;
  cache.set(playerId, { isAdmin: result, expires: Date.now() + TTL_MS });
  return result;
}

export function invalidateAdminCache(playerId: number) {
  cache.delete(playerId);
}
