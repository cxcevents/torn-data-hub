import { useState, useEffect, useMemo } from "react";

const XANAX_HISTORY_KEY = "torn_xanax_tracker_v1";

type XanaxHistory = Record<string, number>; // "YYYY-MM-DD" -> latest cumulative total that day

function getTodayStr(): string {
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

export interface XanaxDayEntry {
  date: string;
  count: number;
}

export function useXanaxTracker(xantakenTotal: number | undefined) {
  const [history, setHistory] = useState<XanaxHistory>(loadHistory);

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

  const todayCount = useMemo(() => {
    if (xantakenTotal === undefined) return null;
    const dates = Object.keys(history).sort();
    const prevDate = dates.filter((d) => d < today).pop();
    if (!prevDate) return null; // first ever day — can't compute delta
    return Math.max(0, xantakenTotal - history[prevDate]);
  }, [history, xantakenTotal, today]);

  const monthData = useMemo((): XanaxDayEntry[] => {
    const dates = Object.keys(history).sort();
    const result: XanaxDayEntry[] = [];
    for (let i = 1; i < dates.length; i++) {
      const count = Math.max(0, history[dates[i]] - history[dates[i - 1]]);
      result.push({ date: dates[i], count });
    }
    // Keep only last 30 days
    return result.slice(-30);
  }, [history]);

  return { todayCount, monthData, today, goal: 3 };
}
