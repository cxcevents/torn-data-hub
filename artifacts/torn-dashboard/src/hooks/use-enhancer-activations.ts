import { useState, useCallback } from "react";
import { ENHANCERS, ENHANCER_DURATION_SECONDS } from "@/lib/enhancers";
import type { StatKey } from "@/lib/enhancers";

const ACTIVATIONS_KEY = "torn_enhancer_activations_v1";

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
