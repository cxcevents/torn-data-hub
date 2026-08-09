import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

// Server-side archive of daily xanax counts ("YYYY-MM-DD" TCT/UTC -> count).
// The Torn log API only covers a rolling window, so log-derived counts get
// synced to our own database and read back for older days.

export function useXanaxArchive(playerId: number | null) {
  return useQuery<Record<string, number>>({
    queryKey: ["xanax-archive", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/xanax/history?playerId=${playerId}`);
      if (!res.ok) throw new Error("Archive fetch failed");
      const data = await res.json();
      const map: Record<string, number> = {};
      for (const d of data.days ?? []) map[d.date] = d.count;
      return map;
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/** Push log-derived daily counts to the archive whenever they change. */
export function useXanaxArchiveSync(
  playerId: number | null,
  dailyCounts: Record<string, number> | undefined,
) {
  const lastSynced = useRef<string>("");

  useEffect(() => {
    if (!playerId || !dailyCounts) return;
    const days = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
    if (days.length === 0) return;
    const fingerprint = `${playerId}:${JSON.stringify(days)}`;
    if (fingerprint === lastSynced.current) return;
    lastSynced.current = fingerprint;

    fetch("/api/xanax/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, days }),
    }).catch(() => {
      lastSynced.current = ""; // retry on next change
    });
  }, [playerId, dailyCounts]);
}
