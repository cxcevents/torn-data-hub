import { useState, useEffect } from "react";

const LOCK_EVENT = "torn_layout_lock_changed";
const ORDER_KEY = "torn_layout_order_v7";

const DEFAULT_ORDER: string[] = [
  "vitals", "cooldowns", "assets",
  "vitals-side", "stats", "education",
  "refills", "achievements", "selected-stats",
];

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && DEFAULT_ORDER.every(id => parsed.includes(id))) return parsed;
    }
  } catch {}
  return DEFAULT_ORDER;
}

function saveOrder(order: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

let _locked = true;

export function useLayoutLock() {
  const [locked, setLockedState] = useState(_locked);
  const [order, setOrderState] = useState<string[]>(loadOrder);

  useEffect(() => {
    const handler = () => setLockedState(_locked);
    window.addEventListener(LOCK_EVENT, handler);
    return () => window.removeEventListener(LOCK_EVENT, handler);
  }, []);

  const toggleLock = () => {
    _locked = !_locked;
    window.dispatchEvent(new Event(LOCK_EVENT));
  };

  const reorder = (newOrder: string[]) => {
    setOrderState(() => {
      saveOrder(newOrder);
      return newOrder;
    });
  };

  return { locked, toggleLock, order, reorder };
}
