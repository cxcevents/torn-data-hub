import { useState, useEffect } from "react";

export function useTick() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return tick;
}

export function formatTimeRemaining(secondsTotal: number) {
  if (!secondsTotal || secondsTotal <= 0) return "Ready";
  const h = Math.floor(secondsTotal / 3600);
  const m = Math.floor((secondsTotal % 3600) / 60);
  const s = secondsTotal % 60;
  
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
