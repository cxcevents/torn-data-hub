import { useState, useEffect, useMemo, useCallback } from "react";

const XANAX_HISTORY_KEY = "torn_xanax_tracker_v1";
const XANAX_MANUAL_KEY = "torn_xanax_manual_v1";

type XanaxHistory = Record<string, number>; // "YYYY-MM-DD" -> latest cumulative total that day
type ManualCounts = Record<string, number>;  // "YYYY-MM-DD" -> manual count for that day

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadHistory(): XanaxHistory {
  try {
    const raw = localStorage.getItem(XANAX_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadManual(): ManualCounts {
  try {
    const raw = localStorage.getItem(XANAX_MANUAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface XanaxDayEntry {
  date: string;
  count: number;
}

export function useXanaxTracker(xantakenTotal: number | undefined) {
  const [history, setHistory] = useState<XanaxHistory>(loadHistory);
  const [manual, setManual] = useState<ManualCounts>(loadManual);

  // Save API snapshot each refresh
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

  // API-derived count: delta from yesterday's snapshot to today's latest
  const apiCount = useMemo(() => {
    if (xantakenTotal === undefined) return null;
    const dates = Object.keys(history).sort();
    const prevDate = dates.filter((d) => d < today).pop();
    if (!prevDate) return null;
    return Math.max(0, xantakenTotal - history[prevDate]);
  }, [history, xantakenTotal, today]);

  const manualToday = manual[today] ?? 0;
  const hasBaseline = apiCount !== null;

  // What we actually display: API count if baseline exists, else manual
  const todayCount = hasBaseline ? apiCount : manualToday;

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

  return { todayCount, hasBaseline, adjustManual, monthData, today, goal: 3 };
}
