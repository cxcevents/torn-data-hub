import { useQuery } from "@tanstack/react-query";
import type { LogEntry } from "./use-enhancer-log";

function dateStr(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function get30DaysAgoUnix(): number {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function isXanaxEntry(e: LogEntry): boolean {
  return !!e.title?.toLowerCase().includes("xanax");
}

export interface XanaxLogResult {
  todayCount: number;
  dailyCounts: Record<string, number>; // "YYYY-MM-DD" -> count
}

export function useXanaxLog(apiKey: string | null) {
  const from = get30DaysAgoUnix();

  return useQuery<XanaxLogResult>({
    queryKey: ["torn", "log", "xanax-history", apiKey ? String(apiKey).substring(0, 4) : "none"],
    queryFn: async () => {
      if (!apiKey) throw new Error("No key");
      const url = `https://api.torn.com/user/?selections=log&from=${from}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      if (data.error) throw new Error(data.error.error || "Log API error");

      const entries = Object.values(data.log ?? {}) as LogEntry[];
      const xanaxEntries = entries.filter(isXanaxEntry);

      const dailyCounts: Record<string, number> = {};
      for (const entry of xanaxEntries) {
        const day = dateStr(entry.timestamp);
        dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
      }

      const today = getTodayStr();
      const todayCount = dailyCounts[today] ?? 0;

      return { todayCount, dailyCounts };
    },
    enabled: !!apiKey,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false,
  });
}
