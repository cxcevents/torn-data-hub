import { useState, useEffect, useCallback } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { useLevelingTargets, LIST_NAMES } from "@/hooks/use-leveling-targets";
import type { LevelingTarget, TargetStatus } from "@/hooks/use-leveling-targets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, AlertCircle, Search, X, Loader2,
  Swords, ExternalLink, ChevronUp, ChevronDown,
  Clock, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "leveling_targets_list";

const LIST_LABELS: Record<string, string> = {
  "Baldr's List 1": "List 1",
  "Baldr's List 2": "List 2",
  "Baldr's List 3": "List 3",
  "Baldr's Extra List 1": "Extra 1",
  "Baldr's Extra List 2": "Extra 2",
  "Baldr's Extra List 3": "Extra 3",
  "Baldr's DOMINO List": "DOMINO",
};

const STATUS_PRIORITY: Record<TargetStatus, number> = {
  Okay: 0,
  Hospital: 1,
  Traveling: 2,
  Abroad: 3,
  Fallen: 4,
  error: 5,
  loading: 6,
};

function formatBattleStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCountdown(untilSeconds: number, nowMs: number): string {
  const diffMs = untilSeconds * 1000 - nowMs;
  if (diffMs <= 0) return "Out soon";
  const totalMins = Math.ceil(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function autoSort(targets: LevelingTarget[], nowMs: number): LevelingTarget[] {
  return [...targets].sort((a, b) => {
    const ap = STATUS_PRIORITY[a.statusState] ?? 6;
    const bp = STATUS_PRIORITY[b.statusState] ?? 6;
    if (ap !== bp) return ap - bp;
    if (a.statusState === "Okay" && b.statusState === "Okay") {
      return a.totalStats - b.totalStats;
    }
    if (a.statusState === "Hospital" && b.statusState === "Hospital") {
      return a.statusUntil - b.statusUntil;
    }
    return 0;
  });
}

type SortKey = "level" | "totalStats" | "name" | "status";
type SortDir = "asc" | "desc";

function manualSort(
  targets: LevelingTarget[],
  key: SortKey,
  dir: SortDir,
  nowMs: number,
): LevelingTarget[] {
  return [...targets].sort((a, b) => {
    let cmp = 0;
    if (key === "level") cmp = a.level - b.level;
    else if (key === "totalStats") cmp = a.totalStats - b.totalStats;
    else if (key === "name") cmp = a.name.localeCompare(b.name);
    else {
      const ap = STATUS_PRIORITY[a.statusState] ?? 6;
      const bp = STATUS_PRIORITY[b.statusState] ?? 6;
      cmp = ap - bp;
      if (cmp === 0 && a.statusState === "Hospital") cmp = a.statusUntil - b.statusUntil;
      if (cmp === 0 && a.statusState === "Okay") cmp = a.totalStats - b.totalStats;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="w-3 h-3 opacity-25" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-primary" />
    : <ChevronDown className="w-3 h-3 text-primary" />;
}

function StatusBadge({ target, nowMs }: { target: LevelingTarget; nowMs: number }) {
  if (target.statusState === "loading") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground/40 text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking…
      </span>
    );
  }
  if (target.statusState === "error") {
    return <span className="text-xs text-muted-foreground/30">—</span>;
  }
  if (target.statusState === "Okay") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
        Attackable
      </span>
    );
  }
  if (target.statusState === "Hospital") {
    const label = target.statusUntil
      ? formatCountdown(target.statusUntil, nowMs)
      : "Hospital";
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3 flex-shrink-0" />
        {label}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground/50 capitalize">
      {target.statusState}
    </span>
  );
}

function LastActionDot({ status }: { status: string }) {
  const cls =
    status === "Online"
      ? "bg-green-400"
      : status === "Idle"
      ? "bg-amber-400"
      : "bg-muted-foreground/25";
  return <span className={cn("w-1.5 h-1.5 rounded-full inline-block flex-shrink-0", cls)} />;
}

export default function LevelingTargets() {
  const { apiKey } = useApiKey();
  const { state, fetchList, cancel, reset } = useLevelingTargets(apiKey);
  const { phase, total, checked, targets, error } = state;

  const [selectedList, setSelectedList] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? LIST_NAMES[0],
  );
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [userSorted, setUserSorted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isRunning = phase === "loading" || phase === "fetching";
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleSelectList = useCallback((name: string) => {
    setSelectedList(name);
    localStorage.setItem(STORAGE_KEY, name);
    reset();
    setUserSorted(false);
    setSortKey("status");
    setSortDir("asc");
  }, [reset]);

  const handleFetch = () => {
    if (!apiKey || isRunning) return;
    setUserSorted(false);
    setSortKey("status");
    setSortDir("asc");
    fetchList(selectedList);
  };

  const handleSort = (key: SortKey) => {
    setUserSorted(true);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const displayedTargets =
    targets.length === 0
      ? []
      : userSorted
      ? manualSort(targets, sortKey, sortDir, nowMs)
      : autoSort(targets, nowMs);

  const attackableCount = targets.filter((t) => t.statusState === "Okay").length;
  const hospitalCount = targets.filter((t) => t.statusState === "Hospital").length;
  const loadingCount = targets.filter((t) => t.statusState === "loading").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Leveling Targets</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
            N00b T00ls
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Curated low-stat inactive players from{" "}
          <a
            href="https://github.com/OranWeb/tc-baldrs-levelling-list"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/80 hover:text-primary underline underline-offset-2"
          >
            Baldr's levelling lists
          </a>
          . Live hospital status fetched via your API key.
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-card">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Select List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {!apiKey && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Connect your API key in Settings to check live status.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {LIST_NAMES.map((name) => (
              <button
                key={name}
                disabled={isRunning}
                onClick={() => handleSelectList(name)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors disabled:opacity-50",
                  selectedList === name
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {LIST_LABELS[name] ?? name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {!isRunning ? (
                <motion.div
                  key="fetch"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button onClick={handleFetch} disabled={!apiKey} className="gap-2">
                    {phase === "done" ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh Status
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        Fetch Targets
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="cancel"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    variant="outline"
                    onClick={cancel}
                    className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {isRunning && (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: phase === "loading" ? "4%" : `${pct}%` }}
                    transition={{ ease: "easeOut", duration: 0.3 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                  {phase === "loading" ? "Loading list…" : `${checked} / ${total}`}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary pills */}
      <AnimatePresence>
        {targets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-xs text-muted-foreground/50 font-medium uppercase tracking-wider">
              {targets.length} targets
            </span>
            {attackableCount > 0 && (
              <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                {attackableCount} attackable
              </span>
            )}
            {hospitalCount > 0 && (
              <span className="text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
                {hospitalCount} in hospital
              </span>
            )}
            {loadingCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/40">
                <Loader2 className="w-3 h-3 animate-spin" />
                {loadingCount} checking
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results table */}
      <AnimatePresence>
        {targets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="px-4 py-2.5 text-left w-[200px]">
                        <button
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Player
                          <SortIcon active={sortKey === "name"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left w-16">
                        <button
                          onClick={() => handleSort("level")}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Lvl
                          <SortIcon active={sortKey === "level"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <button
                          onClick={() => handleSort("totalStats")}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Stats
                          <SortIcon active={sortKey === "totalStats"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <button
                          onClick={() => handleSort("status")}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Status
                          <SortIcon active={sortKey === "status"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Last Action
                        </span>
                      </th>
                      <th className="px-4 py-2.5 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTargets.map((target, i) => (
                      <tr
                        key={target.id}
                        className={cn(
                          "border-b border-border/20 transition-colors hover:bg-muted/10",
                          i % 2 !== 0 && "bg-muted/[0.04]",
                          target.statusState === "Okay" && "bg-green-950/20 hover:bg-green-950/30",
                        )}
                      >
                        {/* Player */}
                        <td className="px-4 py-3">
                          <a
                            href={`https://www.torn.com/profiles.php?XID=${target.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 font-medium text-foreground/85 hover:text-primary transition-colors group max-w-[180px]"
                          >
                            <span className="truncate">{target.name}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                          </a>
                          <span className="text-[10px] text-muted-foreground/35 font-mono">
                            #{target.id}
                          </span>
                        </td>

                        {/* Level */}
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground/75 tabular-nums">
                            {target.level}
                          </span>
                        </td>

                        {/* Stats */}
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground/80 tabular-nums">
                            {formatBattleStat(target.totalStats)}
                          </span>
                          <div className="text-[10px] text-muted-foreground/35 font-mono mt-0.5 flex gap-1.5 tabular-nums">
                            <span title="Strength">S:{formatBattleStat(target.str)}</span>
                            <span title="Defense">D:{formatBattleStat(target.def)}</span>
                            <span title="Speed">Sp:{formatBattleStat(target.spd)}</span>
                            <span title="Dexterity">Dx:{formatBattleStat(target.dex)}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge target={target} nowMs={nowMs} />
                        </td>

                        {/* Last Action */}
                        <td className="px-4 py-3">
                          {target.lastActionRelative ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <LastActionDot status={target.lastActionStatus} />
                              {target.lastActionRelative}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/25">—</span>
                          )}
                        </td>

                        {/* Attack */}
                        <td className="px-4 py-3 text-right">
                          {target.statusState === "Okay" && (
                            <a
                              href={`https://www.torn.com/loader.php?sid=attack&user2ID=${target.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-3 text-xs gap-1.5 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25 hover:border-primary/45"
                              >
                                <Swords className="w-3 h-3" />
                                Attack
                              </Button>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {phase === "done" && (
                <div className="px-4 py-2 border-t border-border/20 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground/35">
                    Status loaded on fetch — use Refresh Status to update. Countdown ticks every 30s. Source:{" "}
                    <a
                      href="https://github.com/OranWeb/tc-baldrs-levelling-list"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-muted-foreground/60"
                    >
                      OranWeb/tc-baldrs-levelling-list
                    </a>
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle empty state */}
      {phase === "idle" && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-muted-foreground/35" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground/50">
              Select a list and fetch targets
            </p>
            <p className="text-xs text-muted-foreground/35 mt-0.5">
              Stats pre-loaded from Baldr's list. Live status fetched from the Torn API.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
