import { useQuery } from "@tanstack/react-query";
import type { LogEntry } from "./use-enhancer-log";

function getTodayStartUnix(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function isXanaxEntry(e: LogEntry): boolean {
  return e.title?.toLowerCase().includes("xanax");
}

export function useXanaxLog(apiKey: string | null) {
  const todayStart = getTodayStartUnix();

  return useQuery<number>({
    queryKey: ["torn", "log", "xanax-today", apiKey ? apiKey.substring(0, 4) : "none", todayStart],
    queryFn: async () => {
      if (!apiKey) throw new Error("No key");
      // from= restricts log entries to today only — far more efficient
      const url = `https://api.torn.com/user/?selections=log&from=${todayStart}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      if (data.error) throw new Error(data.error.error || "Log API error");
      const entries = Object.values(data.log ?? {}) as LogEntry[];
      return entries.filter(isXanaxEntry).length;
    },
    enabled: !!apiKey,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false,
  });
}
