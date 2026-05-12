import type { ScoutResult } from "@/hooks/use-pi-scout";

const CACHE_KEY = "torn_pi_scout_cache";
const CHECKED_KEY = "torn_pi_scout_checked";

export interface CachedFaction {
  factionId: number;
  factionName: string;
  scannedAt: number;
  results: ScoutResult[];
}

export type CacheStore = Record<number, CachedFaction>;

export function readCache(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheStore) : {};
  } catch {
    return {};
  }
}

export function writeFaction(entry: CachedFaction): void {
  try {
    const store = readCache();
    store[entry.factionId] = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

export function deleteFaction(factionId: number): void {
  try {
    const store = readCache();
    delete store[factionId];
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

export function clearAllCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CHECKED_KEY);
  } catch {}
}

export function readChecked(): number[] {
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function writeChecked(ids: number[]): void {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify(ids));
  } catch {}
}

export function formatAge(timestamp: number): string {
  const ms = Date.now() - timestamp;
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}
