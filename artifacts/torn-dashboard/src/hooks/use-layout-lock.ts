import { useState, useEffect } from "react";

const LOCK_EVENT = "torn_layout_lock_changed";
const ORDER_KEY = "torn_layout_order_v6";

export type ColumnId = "left-a" | "left-b" | "right";

const DEFAULT_ORDER: Record<ColumnId, string[]> = {
  "left-a": ["vitals", "cooldowns", "assets"],
  "left-b": ["vitals-side", "stats", "education"],
  right: ["refills", "achievements", "selected-stats"],
};

function loadOrder(): Record<ColumnId, string[]> {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<ColumnId, string[]>;
      const allPresent = (Object.keys(DEFAULT_ORDER) as ColumnId[]).every(col =>
        DEFAULT_ORDER[col].every(id => parsed[col]?.includes(id))
      );
      if (allPresent) return parsed;
    }
  } catch {}
  return DEFAULT_ORDER;
}

function saveOrder(order: Record<ColumnId, string[]>) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

let _locked = true;

export function useLayoutLock() {
  const [locked, setLockedState] = useState(_locked);
  const [order, setOrderState] = useState<Record<ColumnId, string[]>>(loadOrder);

  useEffect(() => {
    const handler = () => {
      setLockedState(_locked);
    };
    window.addEventListener(LOCK_EVENT, handler);
    return () => window.removeEventListener(LOCK_EVENT, handler);
  }, []);

  const toggleLock = () => {
    _locked = !_locked;
    window.dispatchEvent(new Event(LOCK_EVENT));
  };

  const reorder = (column: ColumnId, newOrder: string[]) => {
    const updated = { ...order, [column]: newOrder };
    setOrderState(updated);
    saveOrder(updated);
  };

  const reorderMultiple = (updates: Partial<Record<ColumnId, string[]>>) => {
    const updated = { ...order, ...updates };
    setOrderState(updated);
    saveOrder(updated);
  };

  return { locked, toggleLock, order, reorder, reorderMultiple };
}
