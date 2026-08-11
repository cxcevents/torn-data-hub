// Award catalog (honors + medals) fetching & localStorage caching.

export interface AwardCatalogEntry {
  id: number;
  kind: "honor" | "medal";
  name: string;
  description: string;
  /** Category title, e.g. "crimes", "attacking", "rank", "combat" */
  category: string;
  circulation: number;
  rarity: string;
  /** True for legacy Crimes 1.0 honors — their counters don't map to current personal stats */
  legacyCrimes?: boolean;
}

export interface AwardCatalog {
  honors: AwardCatalogEntry[];
  medals: AwardCatalogEntry[];
  fetchedAt: number;
}

const CACHE_KEY = "torn_award_catalog_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // catalogs are mostly static — 7 days

export function readCatalogCache(): AwardCatalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AwardCatalog;
    if (!parsed?.honors?.length || !parsed?.medals?.length) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCatalogCache(catalog: AwardCatalog): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(catalog));
  } catch {}
}

export function clearCatalogCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

// ── Fetchers ────────────────────────────────────────────────────────────────

async function fetchV2Catalog(key: string): Promise<AwardCatalog> {
  const [hRes, mRes] = await Promise.all([
    fetch(`https://api.torn.com/v2/torn/honors?key=${key}&limit=1000`),
    fetch(`https://api.torn.com/v2/torn/medals?key=${key}`),
  ]);
  const [hData, mData] = await Promise.all([hRes.json(), mRes.json()]);
  if (hData.error) throw new Error(hData.error.error || "Torn API error (honors)");
  if (mData.error) throw new Error(mData.error.error || "Torn API error (medals)");
  if (!Array.isArray(hData.honors) || !Array.isArray(mData.medals)) {
    throw new Error("Unexpected v2 catalog shape");
  }

  const honors: AwardCatalogEntry[] = hData.honors.map((h: any) => ({
    id: h.id,
    kind: "honor" as const,
    name: h.name,
    description: h.description,
    category: h.type?.title ?? "misc",
    circulation: h.circulation ?? 0,
    rarity: h.rarity ?? "Unknown",
    ...(h.crimes_version === "v1" ? { legacyCrimes: true } : {}),
  }));
  const medals: AwardCatalogEntry[] = mData.medals.map((m: any) => ({
    id: m.id,
    kind: "medal" as const,
    name: m.name,
    description: m.description,
    category: m.type?.title ?? "miscellaneous",
    circulation: m.circulation ?? 0,
    rarity: m.rarity ?? "Unknown",
    ...(m.crimes_version === "v1" ? { legacyCrimes: true } : {}),
  }));
  return { honors, medals, fetchedAt: Date.now() };
}

// v1 fallback: type comes back as a numeric/short code, so category granularity is reduced.
async function fetchV1Catalog(key: string): Promise<AwardCatalog> {
  const res = await fetch(`https://api.torn.com/torn/?selections=honors,medals&key=${key}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.error || "Torn API error (catalog)");

  const honors: AwardCatalogEntry[] = Object.entries(data.honors ?? {}).map(([id, h]: [string, any]) => ({
    id: Number(id),
    kind: "honor" as const,
    name: h.name,
    description: h.description,
    category: "misc",
    circulation: h.circulation ?? 0,
    rarity: h.rarity ?? "Unknown",
  }));
  const medals: AwardCatalogEntry[] = Object.entries(data.medals ?? {}).map(([id, m]: [string, any]) => ({
    id: Number(id),
    kind: "medal" as const,
    name: m.name,
    description: m.description,
    category: "miscellaneous",
    circulation: m.circulation ?? 0,
    rarity: m.rarity ?? "Unknown",
  }));
  if (!honors.length || !medals.length) throw new Error("Empty catalog from Torn API");
  return { honors, medals, fetchedAt: Date.now() };
}

/** Fetch the full honors + medals catalog, using localStorage cache when fresh. */
export async function fetchAwardCatalog(key: string, force = false): Promise<AwardCatalog> {
  if (!force) {
    const cached = readCatalogCache();
    if (cached) return cached;
  }
  let catalog: AwardCatalog;
  try {
    catalog = await fetchV2Catalog(key);
  } catch {
    catalog = await fetchV1Catalog(key);
  }
  writeCatalogCache(catalog);
  return catalog;
}
