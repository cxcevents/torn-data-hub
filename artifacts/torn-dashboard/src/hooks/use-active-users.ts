import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "torn_session_id";
const HEARTBEAT_INTERVAL_MS = 30_000;

interface Profile {
  name?: string;
  playerId?: number;
  level?: number;
}

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

export function useActiveUsers(profile?: Profile) {
  const [count, setCount] = useState<number | null>(null);
  const sessionId = useRef(getOrCreateSessionId());
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
  });

  useEffect(() => {
    const id = sessionId.current;

    async function heartbeat() {
      try {
        const p = profileRef.current;
        const res = await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: id,
            name: p?.name,
            playerId: p?.playerId,
            level: p?.level,
          }),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { count };
}
