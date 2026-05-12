import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "torn_session_id";
const HEARTBEAT_INTERVAL_MS = 30_000;

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function useActiveUsers() {
  const [count, setCount] = useState<number | null>(null);
  const sessionId = useRef(getOrCreateSessionId());

  useEffect(() => {
    const id = sessionId.current;

    async function heartbeat() {
      try {
        const res = await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id }),
        });
        if (res.ok) {
          const data = (await res.json()) as { count: number };
          setCount(data.count);
        }
      } catch {
      }
    }

    heartbeat();
    const timer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return { count };
}
