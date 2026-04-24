import { useState, useCallback, useEffect } from "react";
import { ENHANCERS, ENHANCER_DURATION_SECONDS } from "@/lib/enhancers";
import type { StatKey } from "@/lib/enhancers";

const ACTIVATIONS_KEY = "torn_enhancer_activations_v1";

/**
 * Custom event the Torn browser extension dispatches when a battle enhancer
 * is used on torn.com. The dashboard listens for this and starts the countdown
 * automatically — no manual "Used" click required when the extension is active.
 *
 * Extension usage (content script injected into the dashboard page):
 *   window.dispatchEvent(
 *     new CustomEvent("torn:enhancer:used", { detail: { enhancerId: 463 } })
 *   );
 */
export const ENHANCER_EVENT = "torn:enhancer:used";

type Activations = Record<number, number>; // enhancerId -> unix timestamp of last use

function loadActivations(): Activations {
  try {
    return JSON.parse(localStorage.getItem(ACTIVATIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function useEnhancerActivations() {
  const [activations, setActivations] = useState<Activations>(loadActivations);

  const activate = useCallback((enhancerId: number) => {
    const now = Math.floor(Date.now() / 1000);
    setActivations(prev => {
      const next = { ...prev, [enhancerId]: now };
      try { localStorage.setItem(ACTIVATIONS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Listen for activations dispatched by the browser extension content script.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ enhancerId: number }>).detail;
      if (typeof detail?.enhancerId === "number") {
        activate(detail.enhancerId);
      }
    };
    window.addEventListener(ENHANCER_EVENT, handler);
    return () => window.removeEventListener(ENHANCER_EVENT, handler);
  }, [activate]);

  const computeBonus = (nowUnix: number): Record<StatKey, number> => {
    const bonus: Record<StatKey, number> = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
    for (const enh of ENHANCERS) {
      const ts = activations[enh.id] ?? 0;
      if (ts > 0 && nowUnix - ts < ENHANCER_DURATION_SECONDS) {
        bonus[enh.stat] += enh.bonusPct;
      }
    }
    return bonus;
  };

  return { activations, activate, computeBonus };
}
