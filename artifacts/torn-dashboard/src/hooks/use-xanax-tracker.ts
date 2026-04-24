import { useState, useEffect, useMemo, useCallback } from "react";
import { useXanaxLog } from "./use-xanax-log";

const XANAX_HISTORY_KEY = "torn_xanax_tracker_v1";
const XANAX_MANUAL_KEY = "torn_xanax_manual_v1";

type XanaxHistory = Record<string, number>; // "YYYY-MM-DD" -> latest cumulative total
type ManualCounts = Record<string, number>;

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
}

export function useXanaxTracker(apiKey: string | null, xantakenTotal: number | undefined) {
  const [history, setHistory] = useState<XanaxHistory>(loadHistory);
  const [manual, setManual] = useState<ManualCounts>(loadManual);

  // Log-based today count (most accurate — uses timestamp-filtered API log)
  const { data: logCount, isLoading: logLoading, isError: logError } = useXanaxLog(apiKey);

  // Snapshot for monthly history
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

  // Fallback delta count (from localStorage snapshots) for when log is unavailable
  const deltaCount = useMemo(() => {
    if (xantakenTotal === undefined) return null;
    const dates = Object.keys(history).sort();
    const prevDate = dates.filter((d) => d < today).pop();
    if (!prevDate) return null;
    return Math.max(0, xantakenTotal - history[prevDate]);
  }, [history, xantakenTotal, today]);

  const manualToday = manual[today] ?? 0;

  // Priority: log API (most accurate) > delta (good) > manual (last resort)
  const logReady = !logLoading && !logError && logCount !== undefined;
  const todayCount: number = logReady ? logCount : (deltaCount ?? manualToday);
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

  const monthData = useMemo((): XanaxDayEntry[] => {
    const dates = Object.keys(history).sort();
    const result: XanaxDayEntry[] = [];
    for (let i = 1; i < dates.length; i++) {
      const count = Math.max(0, history[dates[i]] - history[dates[i - 1]]);
      result.push({ date: dates[i], count });
    }
    return result.slice(-30);
  }, [history]);

  return { todayCount, sourceIsLog, sourceIsDelta, sourceIsManual, adjustManual, monthData, today, goal: 3 };
}
