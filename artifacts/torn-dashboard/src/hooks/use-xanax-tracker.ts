import { useState, useEffect, useMemo, useCallback } from "react";
import { useXanaxLog } from "./use-xanax-log";

const XANAX_HISTORY_KEY = "torn_xanax_tracker_v1";
const XANAX_MANUAL_KEY = "torn_xanax_manual_v1";

type XanaxHistory = Record<string, number>; // "YYYY-MM-DD" -> cumulative total
type ManualCounts = Record<string, number>;

// Day buckets use TCT (Torn City Time = UTC) to match Torn's daily reset.
export function getTodayStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function loadHistory(): XanaxHistory {
  try {
    const raw = localStorage.getItem(XANAX_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function loadManual(): ManualCounts {
  try {
    const raw = localStorage.getItem(XANAX_MANUAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export interface XanaxDayEntry {
  date: string;
  count: number;
  source: "log" | "snapshot" | "manual" | "unknown";
}

export function useXanaxTracker(apiKey: string | null, xantakenTotal: number | undefined) {
  const [history, setHistory] = useState<XanaxHistory>(loadHistory);
  const [manual, setManual] = useState<ManualCounts>(loadManual);

  const { data: logData, isLoading: logLoading, isError: logError } = useXanaxLog(apiKey);

  // Save API cumulative snapshot for future delta calculations
  useEffect(() => {
    if (xantakenTotal === undefined) return;
    const today = getTodayStr();
    setHistory((prev) => {
      const existing = prev[today];
      if (existing !== undefined && xantakenTotal <= existing) return prev;
      const updated = { ...prev, [today]: xantakenTotal };
      localStorage.setItem(XANAX_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [xantakenTotal]);

  const today = getTodayStr();
  const logReady = !logLoading && !logError && logData !== undefined;

  // Fallback delta from localStorage snapshots
  const deltaCount = useMemo(() => {
    if (xantakenTotal === undefined) return null;
    const dates = Object.keys(history).sort();
    const prevDate = dates.filter((d) => d < today).pop();
    if (!prevDate) return null;
    return Math.max(0, xantakenTotal - history[prevDate]);
  }, [history, xantakenTotal, today]);

  const manualToday = manual[today] ?? 0;

  const todayCount: number = logReady
    ? logData.todayCount
    : (deltaCount ?? manualToday);

  const sourceIsLog = logReady;
  const sourceIsDelta = !logReady && deltaCount !== null;
  const sourceIsManual = !logReady && deltaCount === null;

  const adjustManual = useCallback((delta: number) => {
    setManual((prev) => {
      const current = prev[today] ?? 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev, [today]: next };
      localStorage.setItem(XANAX_MANUAL_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [today]);

  // Monthly history: log data takes priority; fall back to snapshot deltas; fall back to manual
  const monthData = useMemo((): XanaxDayEntry[] => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const daysInMonth = now.getUTCDate();
    const result: XanaxDayEntry[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isToday = dateStr === today;

      if (isToday) {
        result.push({ date: dateStr, count: todayCount, source: sourceIsLog ? "log" : sourceIsDelta ? "snapshot" : "manual" });
        continue;
      }

      // Log-derived count for past days
      if (logReady && logData.dailyCounts[dateStr] !== undefined) {
        result.push({ date: dateStr, count: logData.dailyCounts[dateStr], source: "log" });
        continue;
      }

      // Snapshot delta for past days
      const snapDates = Object.keys(history).sort();
      const idx = snapDates.indexOf(dateStr);
      if (idx > 0) {
        const prevSnap = history[snapDates[idx - 1]];
        const thisSnap = history[dateStr];
        if (prevSnap !== undefined && thisSnap !== undefined) {
          result.push({ date: dateStr, count: Math.max(0, thisSnap - prevSnap), source: "snapshot" });
          continue;
        }
      }

      // Manual fallback
      if (manual[dateStr] !== undefined) {
        result.push({ date: dateStr, count: manual[dateStr], source: "manual" });
        continue;
      }

      // No data available for this day
    }

    return result;
  }, [logReady, logData, history, manual, today, todayCount, sourceIsLog, sourceIsDelta]);

  const lastUsedTimestamp = logReady ? logData.lastUsedTimestamp : null;

  return { todayCount, sourceIsLog, sourceIsDelta, sourceIsManual, adjustManual, monthData, today, goal: 3, lastUsedTimestamp };
}
