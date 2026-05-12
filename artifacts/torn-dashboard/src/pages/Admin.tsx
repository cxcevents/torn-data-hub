import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { Shield, RefreshCw, ExternalLink, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_PLAYER_ID = 2032555;
const REFRESH_INTERVAL_MS = 30_000;

interface AdminSession {
  name?: string;
  playerId?: number;
  level?: number;
  lastSeenAgo: number;
  onlineForSeconds: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Admin() {
  const { apiKey } = useApiKey();
  const { data, isLoading: userLoading } = useTornUser(apiKey);
  const [, navigate] = useLocation();

  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const isAdmin = data?.player_id === ADMIN_PLAYER_ID;

  useEffect(() => {
    if (!userLoading && data && !isAdmin) {
      navigate("/");
    }
  }, [data, userLoading, isAdmin, navigate]);

  const fetchSessions = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Failed to fetch sessions");
        return;
      }
      const body = (await res.json()) as { sessions: AdminSession[]; total: number };
      setSessions(body.sessions);
      setTotal(body.total);
      setLastFetched(new Date());
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!isAdmin || !apiKey) return;
    fetchSessions();
    const timer = setInterval(fetchSessions, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAdmin, apiKey, fetchSessions]);

  if (userLoading || !data) return null;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/15 text-primary px-2 py-1 rounded">
            Restricted
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-muted-foreground">
              Updated {lastFetched.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Active sessions from the last 90 seconds. Only public Torn profile data is
        shown — no API keys, stats, or private information.
      </p>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats row */}
      {total !== null && (
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-3xl font-bold tabular-nums text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Active now</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {sessions?.filter((s) => s.name).length ?? 0}
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Identified</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-3xl font-bold tabular-nums text-muted-foreground">
              {sessions?.filter((s) => !s.name).length ?? 0}
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Anonymous</span>
          </div>
        </div>
      )}

      {/* Sessions table */}
      {sessions !== null && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Player
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-20">
                  Level
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-28">
                  Online for
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-28">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No active sessions
                  </td>
                </tr>
              ) : (
                sessions.map((s, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {s.name && s.playerId ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://www.torn.com/profiles.php?XID=${s.playerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {s.name}
                            <span className="text-muted-foreground font-normal">[{s.playerId}]</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                          </a>
                          {s.playerId === ADMIN_PLAYER_ID && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="w-3.5 h-3.5" />
                          <span className="italic">Anonymous session</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {s.level ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatDuration(s.onlineForSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={cn(
                          s.lastSeenAgo <= 10
                            ? "text-green-500"
                            : s.lastSeenAgo <= 45
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {s.lastSeenAgo}s ago
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {sessions === null && !error && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading sessions...
        </div>
      )}
    </div>
  );
}
