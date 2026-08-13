import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

// Server-side archive of daily xanax counts ("YYYY-MM-DD" TCT/UTC -> count).
// The Torn log API only covers a rolling window, so log-derived counts get
// synced to our own database and read back for older days.

export function useXanaxArchive(apiKey: string | null, playerId: number | null) {
  return useQuery<Record<string, number>>({
    queryKey: ["xanax-archive", playerId],
    queryFn: async () => {
      const res = await fetch("/api/xanax/history/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) throw new Error("Archive fetch failed");
      const data = await res.json();
      const map: Record<string, number> = {};
      for (const d of data.days ?? []) map[d.date] = d.count;
      return map;
    },
    enabled: !!playerId && !!apiKey,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * One-time lifetime backfill, run in the browser so the user's API key never
 * touches our server. Paginates the full Torn log (log=2290 = xanax use) and
 * pushes daily counts (numbers only, no key) to the archive.
 */
export function useXanaxLifetimeBackfill(
  apiKey: string | null,
  playerId: number | null,
  archive: Record<string, number> | undefined,
  onDone: () => void,
) {
  const running = useRef(false);

  useEffect(() => {
    if (!apiKey || !playerId || archive === undefined || running.current) return;
    const flagKey = `torn_xanax_backfill_v1_${playerId}`;
    if (localStorage.getItem(flagKey)) return;
    // Archive already has substantial history (e.g. seeded elsewhere)? Skip.
    if (Object.keys(archive).length > 60) {
      localStorage.setItem(flagKey, "done");
      return;
    }
    running.current = true;

    (async () => {
      const dayCounts = new Map<string, number>();
      const seen = new Set<string>();
      let to: number | null = null;
      let prevOldest = Infinity;

      for (let page = 0; page < 300; page++) {
        const url =
          `https://api.torn.com/user/?selections=log&log=2290&from=0` +
          (to !== null ? `&to=${to}` : "") +
          `&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        if (data.error) throw new Error(data.error.error || "Log API error");

        const entries = Object.entries(data.log ?? {}) as [string, { timestamp: number }][];
        if (entries.length === 0) break;
        let added = 0;
        for (const [id, e] of entries) {
          if (seen.has(id)) continue;
          seen.add(id);
          added++;
          const d = new Date(e.timestamp * 1000);
          const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
        }
        const oldest = Math.min(...entries.map(([, e]) => e.timestamp));
        if (entries.length < 100) break;
        to = added === 0 || oldest >= prevOldest ? oldest - 1 : oldest;
        prevOldest = oldest;
        await new Promise((r) => setTimeout(r, 700)); // stay well under Torn's rate limit
      }

      const days = [...dayCounts.entries()].map(([date, count]) => ({ date, count }));
      for (let i = 0; i < days.length; i += 400) {
        const chunk = days.slice(i, i + 400);
        const res = await fetch("/api/xanax/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, days: chunk }),
        });
        if (!res.ok) throw new Error("Archive save failed");
      }
      localStorage.setItem(flagKey, "done");
      onDone();
    })()
      .catch(() => {
        // Leave the flag unset so it retries on a future visit
      })
      .finally(() => {
        running.current = false;
      });
  }, [apiKey, playerId, archive, onDone]);
}

/** Push log-derived daily counts to the archive whenever they change. */
export function useXanaxArchiveSync(
  apiKey: string | null,
  playerId: number | null,
  dailyCounts: Record<string, number> | undefined,
) {
  const lastSynced = useRef<string>("");

  useEffect(() => {
    if (!apiKey || !playerId || !dailyCounts) return;
    const days = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
    if (days.length === 0) return;
    const fingerprint = `${playerId}:${JSON.stringify(days)}`;
    if (fingerprint === lastSynced.current) return;
    lastSynced.current = fingerprint;

    fetch("/api/xanax/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, days }),
    }).catch(() => {
      lastSynced.current = ""; // retry on next change
    });
  }, [apiKey, playerId, dailyCounts]);
}
