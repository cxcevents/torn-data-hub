import { useState, useEffect, useCallback } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { useEnhancerActivations } from "@/hooks/use-enhancer-activations";
import { useLevelingTargets, LIST_NAMES } from "@/hooks/use-leveling-targets";
import type { LevelingTarget, TargetStatus, ListName } from "@/hooks/use-leveling-targets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, AlertCircle, Search, X, Loader2,
  Swords, ExternalLink, ChevronUp, ChevronDown,
  Clock, RefreshCw, Lock, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "leveling_targets_lists_v2";

// Ratio thresholds: userEffTotal / targetTotal
const RATIO_LOCK = 5;   // >= 5× → block attack
const RATIO_WARN = 2.5; // >= 2.5× → yellow caution

const LAST_ACTION_PRIORITY: Record<string, number> = {
  Online: 0,
  Idle: 1,
  Offline: 2,
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

type SortKey = "name" | "level" | "status" | "life" | "stats";
type SortDir = "asc" | "desc";

function autoSort(targets: LevelingTarget[]): LevelingTarget[] {
  return [...targets].sort((a, b) => {
    const ap = STATUS_PRIORITY[a.statusState] ?? 6;
    const bp = STATUS_PRIORITY[b.statusState] ?? 6;
    if (ap !== bp) return ap - bp;
    if (a.statusState === "Okay" && b.statusState === "Okay") {
      const ala = LAST_ACTION_PRIORITY[a.lastActionStatus] ?? 3;
      const bla = LAST_ACTION_PRIORITY[b.lastActionStatus] ?? 3;
      return ala - bla;
    }
    if (a.statusState === "Hospital" && b.statusState === "Hospital") {
      return a.statusUntil - b.statusUntil;
    }
    return 0;
  });
}

function manualSort(targets: LevelingTarget[], key: SortKey, dir: SortDir): LevelingTarget[] {
  return [...targets].sort((a, b) => {
    let cmp = 0;
    if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "level") cmp = a.level - b.level;
    else if (key === "life") {
      const ap = a.lifeMax > 0 ? a.lifeCurrent / a.lifeMax : 0;
      const bp = b.lifeMax > 0 ? b.lifeCurrent / b.lifeMax : 0;
      cmp = ap - bp;
    }
    else if (key === "stats") cmp = a.targetTotal - b.targetTotal;
    else {
      const ap = STATUS_PRIORITY[a.statusState] ?? 6;
      const bp = STATUS_PRIORITY[b.statusState] ?? 6;
      cmp = ap - bp;
      if (cmp === 0 && a.statusState === "Okay") {
        cmp = (LAST_ACTION_PRIORITY[a.lastActionStatus] ?? 3) - (LAST_ACTION_PRIORITY[b.lastActionStatus] ?? 3);
      }
      if (cmp === 0 && a.statusState === "Hospital") cmp = a.statusUntil - b.statusUntil;
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

function formatCountdown(untilSeconds: number, nowMs: number): string {
  const diffMs = untilSeconds * 1000 - nowMs;
  if (diffMs <= 0) return "Out soon";
  const totalMins = Math.ceil(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusCell({ target, nowMs }: { target: LevelingTarget; nowMs: number }) {
  if (target.statusState === "loading") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground/40 text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking…
      </span>
    );
  }
  if (target.statusState === "error") return <span className="text-xs text-muted-foreground/30">—</span>;
  if (target.statusState === "Okay") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
        Attackable
      </span>
    );
  }
  if (target.statusState === "Hospital") {
    const label = target.statusUntil ? formatCountdown(target.statusUntil, nowMs) : "Hospital";
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3 flex-shrink-0" />
        {label}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground/50 capitalize">{target.statusState}</span>;
}

function LastActionCell({ target }: { target: LevelingTarget }) {
  if (!target.lastActionRelative) return <span className="text-xs text-muted-foreground/25">—</span>;
  const dotCls =
    target.lastActionStatus === "Online" ? "bg-green-400"
    : target.lastActionStatus === "Idle" ? "bg-amber-400"
    : "bg-muted-foreground/25";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotCls)} />
      {target.lastActionRelative}
    </span>
  );
}

function LifeCell({ target }: { target: LevelingTarget }) {
  if (target.statusState === "loading") {
    return <span className="text-xs text-muted-foreground/25">—</span>;
  }
  if (!target.lifeMax) {
    return <span className="text-xs text-muted-foreground/25">—</span>;
  }
  const pct = Math.min(100, Math.round((target.lifeCurrent / target.lifeMax) * 100));
  const barColor = pct > 60 ? "bg-blue-500" : pct > 30 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1 min-w-[80px]">
      <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums block">
        {target.lifeCurrent.toLocaleString()} / {target.lifeMax.toLocaleString()}
      </span>
    </div>
  );
}

function StatsCell({
  target,
  userEffTotal,
}: {
  target: LevelingTarget;
  userEffTotal: number;
}) {
  if (target.statusState === "loading") {
    return <span className="text-xs text-muted-foreground/25">—</span>;
  }
  if (!target.targetTotal) {
    return <span className="text-xs text-muted-foreground/30">No spy data</span>;
  }

  const ratio = userEffTotal > 0 ? userEffTotal / target.targetTotal : null;

  let ratioLabel = "";
  let ratioCls = "";
  if (ratio !== null) {
    if (ratio >= RATIO_LOCK) {
      ratioLabel = `${ratio.toFixed(1)}× yours`;
      ratioCls = "text-red-400";
    } else if (ratio >= RATIO_WARN) {
      ratioLabel = `${ratio.toFixed(1)}× yours`;
      ratioCls = "text-amber-400";
    } else if (ratio >= 1) {
      ratioLabel = `${ratio.toFixed(1)}× yours`;
      ratioCls = "text-yellow-300/70";
    } else {
      ratioLabel = `${(1 / ratio).toFixed(1)}× stronger`;
      ratioCls = "text-green-400";
    }
  }

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono font-bold text-sm text-foreground/75 tabular-nums">
          {fmtStat(target.targetTotal)}
        </span>
        <span className="text-[10px] text-muted-foreground/40">total</span>
      </div>
      {target.targetStr > 0 && (
        <div className="text-[10px] font-mono text-muted-foreground/35 mt-0.5 flex gap-1.5 tabular-nums">
          <span title="Strength">S:{fmtStat(target.targetStr)}</span>
          <span title="Defense">D:{fmtStat(target.targetDef)}</span>
          <span title="Speed">Sp:{fmtStat(target.targetSpd)}</span>
          <span title="Dexterity">Dx:{fmtStat(target.targetDex)}</span>
        </div>
      )}
      {ratio !== null && (
        <span className={cn("text-[10px] font-bold block mt-0.5", ratioCls)}>
          {ratioLabel}
        </span>
      )}
    </div>
  );
}

function AttackCell({
  target,
  userEffTotal,
}: {
  target: LevelingTarget;
  userEffTotal: number;
}) {
  if (target.statusState === "Hospital" || target.statusState === "loading" || target.statusState === "error") {
    return null;
  }

  const ratio = userEffTotal > 0 && target.targetTotal > 0
    ? userEffTotal / target.targetTotal
    : null;
  const tooStrong = ratio !== null && ratio >= RATIO_LOCK;

  if (tooStrong) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-muted/40 text-muted-foreground/40">
          <Lock className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Too Weak</span>
        </div>
        <span className="text-[10px] text-muted-foreground/35 text-right leading-tight max-w-[110px]">
          They're {ratio.toFixed(0)}× weaker — little XP gain
        </span>
      </div>
    );
  }

  return (
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
  );
}

// ── Main component ───────────────────────────────────────────────────────────

function loadSavedLists(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    }
  } catch {}
  return [LIST_NAMES[0]];
}

export default function LevelingTargets() {
  const { apiKey } = useApiKey();
  const { data: userData } = useTornUser(apiKey);
  const { computeBonus } = useEnhancerActivations();
  const { state, fetchLists, cancel, reset } = useLevelingTargets(apiKey);
  const { phase, total, checked, targets, error } = state;

  const [selectedLists, setSelectedLists] = useState<string[]>(loadSavedLists);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [userSorted, setUserSorted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isRunning = phase === "loading" || phase === "fetching";
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Refresh countdowns every 30s
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // User effective stats (base × modifier × active enhancers)
  const nowUnix = Math.floor(nowMs / 1000);
  const enhBonus = computeBonus(nowUnix);
  const userHasStats = !!(userData?.strength || userData?.defense || userData?.speed || userData?.dexterity);
  const userEffStr = Math.round((userData?.strength ?? 0) * (1 + ((userData?.strength_modifier ?? 0) + enhBonus.strength) / 100));
  const userEffDef = Math.round((userData?.defense ?? 0) * (1 + ((userData?.defense_modifier ?? 0) + enhBonus.defense) / 100));
  const userEffSpd = Math.round((userData?.speed ?? 0) * (1 + ((userData?.speed_modifier ?? 0) + enhBonus.speed) / 100));
  const userEffDex = Math.round((userData?.dexterity ?? 0) * (1 + ((userData?.dexterity_modifier ?? 0) + enhBonus.dexterity) / 100));
  const userEffTotal = userEffStr + userEffDef + userEffSpd + userEffDex;

  const toggleList = useCallback(
    (name: string) => {
      if (isRunning) return;
      setSelectedLists((prev) => {
        const next = prev.includes(name)
          ? prev.length > 1 ? prev.filter((n) => n !== name) : prev // keep at least one
          : [...prev, name];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      reset();
      setUserSorted(false);
      setSortKey("status");
      setSortDir("asc");
    },
    [isRunning, reset],
  );

  const selectAll = useCallback(() => {
    if (isRunning) return;
    const all = [...LIST_NAMES];
    setSelectedLists(all);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
    reset();
    setUserSorted(false);
    setSortKey("status");
    setSortDir("asc");
  }, [isRunning, reset]);

  const clearAll = useCallback(() => {
    if (isRunning) return;
    const first = [LIST_NAMES[0]];
    setSelectedLists(first);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(first)); } catch {}
    reset();
    setUserSorted(false);
    setSortKey("status");
    setSortDir("asc");
  }, [isRunning, reset]);

  const handleFetch = () => {
    if (!apiKey || isRunning || selectedLists.length === 0) return;
    setUserSorted(false);
    setSortKey("status");
    setSortDir("asc");
    fetchLists(selectedLists);
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
      ? manualSort(targets, sortKey, sortDir)
      : autoSort(targets);

  const attackableCount = targets.filter((t) => t.statusState === "Okay").length;
  const hospitalCount = targets.filter((t) => t.statusState === "Hospital").length;
  const loadingCount = targets.filter((t) => t.statusState === "loading").length;
  const lockedCount = targets.filter((t) => {
    if (!userEffTotal || !t.targetTotal) return false;
    return userEffTotal / t.targetTotal >= RATIO_LOCK;
  }).length;

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
          . Live status fetched via your API key — attackable targets surface to the top.
        </p>
      </div>

      {/* Your stats strip */}
      {userHasStats && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-md bg-muted/20 border border-border/30 text-xs">
          <span className="text-muted-foreground/60 font-bold uppercase tracking-wider">Your effective stats</span>
          <span className="font-mono font-bold text-foreground/70 tabular-nums">
            {fmtStat(userEffTotal)} total
          </span>
          <span className="text-muted-foreground/40 hidden sm:block">
            S:{fmtStat(userEffStr)} · D:{fmtStat(userEffDef)} · Sp:{fmtStat(userEffSpd)} · Dx:{fmtStat(userEffDex)}
          </span>
          {lockedCount > 0 && (
            <span className="flex items-center gap-1 text-red-400/80 font-medium ml-auto">
              <Lock className="w-3 h-3" />
              {lockedCount} {lockedCount === 1 ? "target" : "targets"} too weak to fight
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <Card className="bg-card">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Lists
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                disabled={isRunning || selectedLists.length === LIST_NAMES.length}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-30"
              >
                All
              </button>
              <span className="text-muted-foreground/30 text-[10px]">/</span>
              <button
                onClick={clearAll}
                disabled={isRunning || selectedLists.length === 1}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-30"
              >
                Reset
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {!apiKey && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Connect your API key in Settings before fetching targets.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {LIST_NAMES.map((name) => {
              const active = selectedLists.includes(name);
              const shortName = name
                .replace("Baldr's ", "")
                .replace("List ", "L")
                .replace("Extra List ", "X")
                .replace("DOMINO List", "DOMINO");
              return (
                <button
                  key={name}
                  disabled={isRunning || (active && selectedLists.length === 1)}
                  onClick={() => toggleList(name)}
                  title={name}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold border transition-colors disabled:cursor-not-allowed",
                    active
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    active && selectedLists.length === 1 && "opacity-60",
                  )}
                >
                  {shortName}
                </button>
              );
            })}
          </div>
          {selectedLists.length > 1 && (
            <p className="text-[10px] text-muted-foreground/40">
              {selectedLists.length} lists selected — duplicate players will be fetched once.
            </p>
          )}

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
                      <><RefreshCw className="w-3.5 h-3.5" />Refresh Status</>
                    ) : (
                      <><Search className="w-3.5 h-3.5" />Fetch Targets</>
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
            {lockedCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-400/70 bg-red-400/5 border border-red-400/15 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                {lockedCount} too weak
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
                      <th className="px-4 py-2.5 text-left">
                        <button onClick={() => handleSort("name")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                          Player <SortIcon active={sortKey === "name"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left w-12">
                        <button onClick={() => handleSort("level")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                          Lvl <SortIcon active={sortKey === "level"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left w-32">
                        <button onClick={() => handleSort("life")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                          Life <SortIcon active={sortKey === "life"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <button onClick={() => handleSort("stats")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                          Stats vs Yours <SortIcon active={sortKey === "stats"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <button onClick={() => handleSort("status")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                          Status <SortIcon active={sortKey === "status"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Action</span>
                      </th>
                      <th className="px-4 py-2.5 w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTargets.map((target, i) => {
                      const ratio = userEffTotal > 0 && target.targetTotal > 0
                        ? userEffTotal / target.targetTotal
                        : null;
                      const tooStrong = ratio !== null && ratio >= RATIO_LOCK;
                      const cautionWarn = ratio !== null && ratio >= RATIO_WARN && !tooStrong;

                      return (
                        <tr
                          key={target.id}
                          className={cn(
                            "border-b border-border/20 transition-colors hover:bg-muted/10",
                            i % 2 !== 0 && "bg-muted/[0.04]",
                            target.statusState === "Okay" && !tooStrong &&
                              "border-l-2 border-l-green-500/40 bg-green-950/15 hover:bg-green-950/25",
                            tooStrong && "opacity-50",
                          )}
                        >
                          {/* Player */}
                          <td className="px-4 py-3">
                            <a
                              href={`https://www.torn.com/profiles.php?XID=${target.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 font-medium text-foreground/85 hover:text-primary transition-colors group"
                            >
                              <span className="truncate max-w-[140px]">
                                {target.name === String(target.id) ? (
                                  <span className="font-mono text-muted-foreground/50">#{target.id}</span>
                                ) : target.name}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                            </a>
                            {target.name !== String(target.id) && (
                              <span className="text-[10px] text-muted-foreground/35 font-mono">#{target.id}</span>
                            )}
                          </td>

                          {/* Level */}
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-foreground/75 tabular-nums">
                              {target.level > 0 ? target.level : <span className="text-muted-foreground/30">—</span>}
                            </span>
                          </td>

                          {/* Life */}
                          <td className="px-4 py-3">
                            <LifeCell target={target} />
                          </td>

                          {/* Stats vs Yours */}
                          <td className="px-4 py-3">
                            <StatsCell target={target} userEffTotal={userEffTotal} />
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusCell target={target} nowMs={nowMs} />
                          </td>

                          {/* Last Action */}
                          <td className="px-4 py-3">
                            <LastActionCell target={target} />
                          </td>

                          {/* Attack */}
                          <td className="px-4 py-3 text-right">
                            <AttackCell target={target} userEffTotal={userEffTotal} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {phase === "done" && (
                <div className="px-4 py-2 border-t border-border/20 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground/35">
                    Fetch again to refresh status. Countdowns update every 30s.
                    Attack is blocked when your stats are {RATIO_LOCK}× higher than the target — little XP gain for you.
                    Stats source:{" "}
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
            <p className="text-sm font-semibold text-foreground/50">Select a list and fetch targets</p>
            <p className="text-xs text-muted-foreground/35 mt-0.5">
              Attackable players sort to the top. Attack is blocked if you're too strong for XP gain.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
