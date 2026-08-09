import { useQuery } from "@tanstack/react-query";
import type { LogEntry } from "./use-enhancer-log";

// Torn's daily reset runs on TCT (Torn City Time = UTC), so all day
// bucketing uses UTC dates, not the user's local timezone.
function dateStr(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  return dateStr(Math.floor(Date.now() / 1000));
}

function get30DaysAgoUnix(): number {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function isXanaxEntry(e: LogEntry): boolean {
  return !!e.title?.toLowerCase().includes("xanax");
}

export interface XanaxLogResult {
  todayCount: number;
  dailyCounts: Record<string, number>;
  lastUsedTimestamp: number | null; // unix seconds of most recent xanax use
}

export function useXanaxLog(apiKey: string | null) {
  const from = get30DaysAgoUnix();

  return useQuery<XanaxLogResult>({
    queryKey: ["torn", "log", "xanax-history", apiKey ? String(apiKey).substring(0, 4) : "none"],
    queryFn: async () => {
      if (!apiKey) throw new Error("No key");

      // Torn's log API returns at most ~100 entries per call (all log types),
      // so paginate backwards with `to=` until the whole window is covered.
      // Log record IDs (object keys) uniquely identify entries; timestamps can
      // repeat within the same second, so we use `to=oldest` (inclusive) to
      // catch same-second entries at page boundaries and dedupe by record ID.
      const byId = new Map<string, LogEntry>();
      let to: number | null = null;
      let prevOldest = Infinity;
      for (let page = 0; page < 25; page++) {
        // log=2290 = "Item use xanax": server-side filter so the ~100-entry
        // cap applies to xanax entries only, not the whole activity log.
        const url =
          `https://api.torn.com/user/?selections=log&log=2290&from=${from}` +
          (to !== null ? `&to=${to}` : "") +
          `&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        if (data.error) throw new Error(data.error.error || "Log API error");

        const entries = Object.entries(data.log ?? {}) as [string, LogEntry][];
        if (entries.length === 0) break;
        let newCount = 0;
        for (const [id, e] of entries) {
          if (!byId.has(id)) { byId.set(id, e); newCount++; }
        }

        const oldest = Math.min(...entries.map(([, e]) => e.timestamp));
        if (entries.length < 100 || oldest <= from) break;
        if (newCount === 0 || oldest >= prevOldest) {
          // No progress at this timestamp (pathological same-second page): step past it.
          to = oldest - 1;
        } else {
          to = oldest; // inclusive, so same-second siblings aren't skipped
        }
        prevOldest = oldest;
      }

      const xanaxEntries = [...byId.values()]
        .filter(isXanaxEntry)
        .sort((a, b) => b.timestamp - a.timestamp); // newest first

      const dailyCounts: Record<string, number> = {};
      for (const entry of xanaxEntries) {
        const day = dateStr(entry.timestamp);
        dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
      }

      const today = getTodayStr();
      const todayCount = dailyCounts[today] ?? 0;
      const lastUsedTimestamp = xanaxEntries[0]?.timestamp ?? null;

      return { todayCount, dailyCounts, lastUsedTimestamp };
    },
    enabled: !!apiKey,
    // Full-history fetch can take many API calls; keep it infrequent to
    // preserve rate-limit headroom (Torn allows 100 req/min per key).
    refetchInterval: 120000,
    staleTime: 60000,
    retry: false,
  });
}
