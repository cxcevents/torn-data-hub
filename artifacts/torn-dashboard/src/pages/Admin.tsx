import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { Shield, RefreshCw, ExternalLink, User, Clock, BookOpen, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminListPending, adminReview, type GuideDetail } from "@/lib/guides-api";
import { CATEGORIES, AUDIENCES } from "@/lib/guides";
import { useLevelingTargets, LIST_NAMES } from "@/hooks/use-leveling-targets";
import { GitPullRequest, Search, Loader2 } from "lucide-react";

const ADMIN_PLAYER_ID = 2032555;
const REFRESH_INTERVAL_MS = 30_000;

interface AdminSession {
  name?: string;
  playerId?: number;
  level?: number;
  lastSeenAgo: number;
  onlineForSeconds: number;
}

interface HistoricalPlayer {
  name: string;
  playerId: number;
  level?: number;
  lastSeenAgo: number;
  firstSeenAgo: number;
  visitCount: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function PlayerLink({ name, playerId, isAdmin }: { name: string; playerId: number; isAdmin?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://www.torn.com/profiles.php?XID=${playerId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
      >
        {name}
        <span className="text-muted-foreground font-normal">[{playerId}]</span>
        <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
      </a>
      {isAdmin && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
          You
        </span>
      )}
    </div>
  );
}

const BALDR_ACTIVE_DAYS = 150;

function BaldrCleanup({ apiKey }: { apiKey: string }) {
  const { state, fetchLists, cancel } = useLevelingTargets(apiKey);
  const { phase, total, checked, targets, error } = state;
  const isRunning = phase === "loading" || phase === "fetching";

  const [submitting, setSubmitting] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [prError, setPrError] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);

  const nowUnix = Math.floor(Date.now() / 1000);
  const activeTargets =
    phase === "done"
      ? targets.filter(
          (t) =>
            t.lastActionTimestamp > 0 &&
            nowUnix - t.lastActionTimestamp < BALDR_ACTIVE_DAYS * 86_400,
        )
      : [];

  const submitPr = async () => {
    if (activeTargets.length === 0 || submitting) return;
    setSubmitting(true);
    setPrError(null);
    try {
      const res = await fetch("/api/admin/baldr-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          removeIds: activeTargets.map((t) => t.id),
          activeDays: BALDR_ACTIVE_DAYS,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { prUrl?: string; error?: string };
      if (!res.ok || !body.prUrl) {
        setPrError(body.error ?? "Failed to open the pull request");
        return;
      }
      setPrUrl(body.prUrl);
    } catch {
      setPrError("Network error — could not reach the server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GitPullRequest className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">Baldr list cleanup</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Scans every player across all {LIST_NAMES.length} lists with your API key, finds anyone
        active in the last {BALDR_ACTIVE_DAYS} days, and opens a pull request on Oran's GitHub
        repo removing them. Oran/Baldr decides whether to merge it.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {!isRunning ? (
          <Button size="sm" onClick={() => fetchLists([...LIST_NAMES])} disabled={!apiKey} className="gap-2">
            <Search className="w-3.5 h-3.5" />
            {phase === "done" ? "Re-scan all lists" : "Scan all lists"}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={cancel} className="gap-2 border-destructive/40 text-destructive">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {phase === "loading" ? "Loading lists…" : `${checked} / ${total} checked`}
            </span>
          </>
        )}

        {phase === "done" && (
          <span className="text-xs text-muted-foreground">
            {targets.length} players scanned —{" "}
            <button
              onClick={() => setShowNames((s) => !s)}
              className={cn(
                "font-bold",
                activeTargets.length > 0 ? "text-amber-400 hover:underline" : "text-green-400",
              )}
            >
              {activeTargets.length} active &lt;{BALDR_ACTIVE_DAYS}d
            </button>
          </span>
        )}

        {phase === "done" && activeTargets.length > 0 && !prUrl && (
          <Button size="sm" variant="outline" onClick={submitPr} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
            {submitting ? "Opening PR…" : `Submit PR removing ${activeTargets.length}`}
          </Button>
        )}
      </div>

      {showNames && activeTargets.length > 0 && (
        <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground max-h-40 overflow-y-auto">
          {activeTargets.map((t) => (
            <span key={t.id} className="inline-block mr-3">
              {t.name} [{t.id}] — {t.lastActionRelative || "recently"}
            </span>
          ))}
        </div>
      )}

      {prUrl && (
        <div className="rounded-md border border-green-400/30 bg-green-400/10 px-3 py-2 text-sm text-green-400">
          Pull request opened —{" "}
          <a href={prUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold">
            view it on GitHub <ExternalLink className="w-3 h-3 inline" />
          </a>
        </div>
      )}
      {(error || prError) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error || prError}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { apiKey } = useApiKey();
  const { data, isLoading: userLoading } = useTornUser(apiKey);
  const [, navigate] = useLocation();

  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [history, setHistory] = useState<HistoricalPlayer[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const isAdmin = data?.player_id === ADMIN_PLAYER_ID;

  useEffect(() => {
    if (!userLoading && data && !isAdmin) navigate("/");
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
      const body = (await res.json()) as {
        sessions: AdminSession[];
        total: number;
        history: HistoricalPlayer[];
      };
      setSessions(body.sessions);
      setTotal(body.total);
      setHistory(body.history);
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

  // ── Pending guide submissions ──
  const [pendingGuides, setPendingGuides] = useState<(GuideDetail & { status: string })[]>([]);
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!apiKey) return;
    try {
      setPendingGuides(await adminListPending(apiKey));
      setGuideError(null);
    } catch (e) {
      setGuideError((e as Error).message);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!isAdmin || !apiKey) return;
    fetchPending();
  }, [isAdmin, apiKey, fetchPending]);

  const review = async (id: number, action: "approve" | "reject") => {
    if (!apiKey) return;
    try {
      await adminReview(id, apiKey, action);
      setPendingGuides((g) => g.filter((x) => x.id !== id));
    } catch (e) {
      setGuideError((e as Error).message);
    }
  };

  if (userLoading || !data) return null;
  if (!isAdmin) return null;

  return (
    <div className="space-y-8 max-w-4xl">

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
          <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Only public Torn profile data is shown — no API keys, stats, or private information.
      </p>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Baldr list cleanup */}
      {apiKey && <BaldrCleanup apiKey={apiKey} />}

      {/* Pending guide submissions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Guide submissions</h2>
          <span className="text-xs text-muted-foreground">{pendingGuides.length} pending</span>
        </div>
        {guideError && <p className="text-sm text-destructive">{guideError}</p>}
        {pendingGuides.length === 0 && !guideError && (
          <p className="text-sm text-muted-foreground">No guides waiting for review.</p>
        )}
        {pendingGuides.map((g) => (
          <div key={g.id} className="rounded-md border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-medium">{g.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {CATEGORIES.find((c) => c.id === g.category)?.label} ·{" "}
                  {AUDIENCES.find((a) => a.id === g.audience)?.label} · by{" "}
                  <a href={`https://www.torn.com/profiles.php?XID=${g.authorId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {g.authorName} [{g.authorId}]
                  </a>{" "}
                  · {new Date(g.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => review(g.id, "approve")} data-testid={`button-approve-${g.id}`}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => review(g.id, "reject")} data-testid={`button-reject-${g.id}`}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{g.summary}</p>
            <button
              onClick={() => setExpandedGuide(expandedGuide === g.id ? null : g.id)}
              className="text-xs text-primary hover:underline"
              data-testid={`button-expand-${g.id}`}
            >
              {expandedGuide === g.id ? "Hide full guide" : "Read full guide"}
            </button>
            {expandedGuide === g.id && (
              <div
                className="guide-prose text-xs bg-background rounded-md border border-border/60 p-3 max-h-96 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: g.body }}
              />
            )}
          </div>
        ))}
      </div>

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
          {history !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold tabular-nums text-muted-foreground">{history.length}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Historical</span>
            </div>
          )}
        </div>
      )}

      {/* Active sessions table */}
      {sessions !== null ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Active now
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Player</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-20">Level</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-28">Online for</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-28">Last seen</th>
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
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        {s.name && s.playerId ? (
                          <PlayerLink name={s.name} playerId={s.playerId} isAdmin={s.playerId === ADMIN_PLAYER_ID} />
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
                        <span className={cn(
                          s.lastSeenAgo <= 10 ? "text-green-500"
                          : s.lastSeenAgo <= 45 ? "text-foreground"
                          : "text-muted-foreground",
                        )}>
                          {s.lastSeenAgo}s ago
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : !error ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading sessions...
        </div>
      ) : null}

      {/* Historical players table */}
      {history !== null && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Historical players
            </h2>
            <span className="text-xs text-muted-foreground/60">— identified users seen since last server restart</span>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Player</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-20">Level</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-20">Visits</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-36">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">
                      No historical data yet — check back after some users have visited and left
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.playerId} className="border-b border-border/20 hover:bg-muted/10 transition-colors opacity-80">
                      <td className="px-4 py-3">
                        <PlayerLink name={h.name} playerId={h.playerId} isAdmin={h.playerId === ADMIN_PLAYER_ID} />
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {h.level ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {h.visitCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatDuration(h.lastSeenAgo)} ago
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
