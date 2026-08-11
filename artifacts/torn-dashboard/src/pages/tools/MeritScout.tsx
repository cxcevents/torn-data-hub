import { useMemo, useState } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { useAwardCatalog, useMeritScoutPlayer } from "@/hooks/use-merit-scout";
import { clearCatalogCache } from "@/lib/awards";
import type { AwardCatalogEntry } from "@/lib/awards";
import { computeAwardProgress } from "@/lib/award-progress";
import type { AwardProgress, PlayerSnapshot } from "@/lib/award-progress";
import { getAwardTip } from "@/lib/award-tips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Award, Medal, AlertCircle, Loader2, Search, ChevronDown, ChevronUp,
  Lightbulb, Trophy, Star, RefreshCw, HelpCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "next" | "earned";
type KindFilter = "all" | "honor" | "medal";
type EarnedSortKey = "name" | "rarity" | "circulation";

interface ScoredAward {
  award: AwardCatalogEntry;
  progress: AwardProgress;
  tip: string | null;
}

const RARITY_ORDER: Record<string, number> = {
  "Very Common": 0, Common: 1, Uncommon: 2, Limited: 3, Rare: 4,
  "Very Rare": 5, "Extremely Rare": 6, Legendary: 7, Unknown: 8,
};

function rarityColor(rarity: string): string {
  const r = RARITY_ORDER[rarity] ?? 8;
  if (r <= 1) return "text-muted-foreground/60 border-border/40 bg-muted/20";
  if (r <= 3) return "text-blue-400 border-blue-400/25 bg-blue-400/10";
  if (r <= 5) return "text-purple-400 border-purple-400/25 bg-purple-400/10";
  return "text-amber-400 border-amber-400/25 bg-amber-400/10";
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function KindBadge({ kind }: { kind: "honor" | "medal" }) {
  return kind === "honor" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 border border-primary/25 px-1.5 py-px rounded">
      <Award className="w-3 h-3" /> Honor
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 bg-emerald-400/10 border border-emerald-400/25 px-1.5 py-px rounded">
      <Medal className="w-3 h-3" /> Medal
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? "bg-emerald-500" : percent >= 50 ? "bg-primary" : "bg-amber-500";
  return (
    <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function AwardRow({ item }: { item: ScoredAward }) {
  const [open, setOpen] = useState(false);
  const { award, progress, tip } = item;
  const hasProgress = progress.percent !== null;

  return (
    <div className="border border-border/40 rounded-md bg-muted/10 hover:bg-muted/20 transition-colors">
      <button
        onClick={() => tip && setOpen(o => !o)}
        className={cn("w-full text-left p-3", tip && "cursor-pointer")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-bold text-sm text-foreground">{award.name}</span>
              <KindBadge kind={award.kind} />
              <span className={cn("text-[10px] font-medium px-1.5 py-px rounded border", rarityColor(award.rarity))}>
                {award.rarity}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {fmt(award.circulation)} in circulation
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{award.description}</p>
          </div>
          {tip && (
            <span className="flex-shrink-0 text-muted-foreground/50 mt-0.5">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          )}
        </div>

        {hasProgress && (
          <div className="mt-2 space-y-1">
            <ProgressBar percent={progress.percent!} />
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono tabular-nums text-muted-foreground">
                {fmt(progress.current!)} / {fmt(progress.target!)}
                {progress.statLabel && <span className="text-muted-foreground/50"> ({progress.statLabel})</span>}
              </span>
              <span className={cn(
                "font-bold font-mono tabular-nums",
                progress.percent! >= 90 ? "text-emerald-400" : progress.percent! >= 50 ? "text-primary" : "text-amber-400",
              )}>
                {progress.percent!.toFixed(progress.percent! >= 99 ? 1 : 0)}%
              </span>
            </div>
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && tip && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3">
              <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/15 px-3 py-2.5">
                <Lightbulb className="w-3.5 h-3.5 text-primary/70 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-primary/80 uppercase tracking-wider text-[10px] block mb-1">
                    How to earn this
                  </span>
                  {tip}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MeritScout() {
  const { apiKey } = useApiKey();
  const catalogQ = useAwardCatalog(apiKey);
  const playerQ = useMeritScoutPlayer(apiKey);

  const [tab, setTab] = useState<Tab>("next");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [showUnknown, setShowUnknown] = useState(false);
  const [earnedSort, setEarnedSort] = useState<EarnedSortKey>("rarity");
  const [visibleCount, setVisibleCount] = useState(30);

  const catalog = catalogQ.data;
  const player = playerQ.data;

  const { ranked, unknown, earned, honorsEarnedCount, medalsEarnedCount } = useMemo(() => {
    if (!catalog || !player) {
      return { ranked: [] as ScoredAward[], unknown: [] as ScoredAward[], earned: [] as AwardCatalogEntry[], honorsEarnedCount: 0, medalsEarnedCount: 0 };
    }
    const earnedH = new Set(player.honorsAwarded);
    const earnedM = new Set(player.medalsAwarded);
    const snapshot: PlayerSnapshot = player;

    const all = [...catalog.honors, ...catalog.medals];
    const earnedList: AwardCatalogEntry[] = [];
    const rankedList: ScoredAward[] = [];
    const unknownList: ScoredAward[] = [];

    for (const a of all) {
      const isEarned = a.kind === "honor" ? earnedH.has(a.id) : earnedM.has(a.id);
      if (isEarned) {
        earnedList.push(a);
        continue;
      }
      const progress = computeAwardProgress(a, snapshot);
      const item: ScoredAward = { award: a, progress, tip: getAwardTip(a) };
      if (progress.percent !== null) rankedList.push(item);
      else unknownList.push(item);
    }
    rankedList.sort((a, b) => (b.progress.percent ?? 0) - (a.progress.percent ?? 0));
    unknownList.sort((a, b) => a.award.name.localeCompare(b.award.name));

    return {
      ranked: rankedList,
      unknown: unknownList,
      earned: earnedList,
      honorsEarnedCount: earnedH.size,
      medalsEarnedCount: earnedM.size,
    };
  }, [catalog, player]);

  const filterFn = (a: AwardCatalogEntry) => {
    if (kindFilter !== "all" && a.kind !== kindFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
    }
    return true;
  };

  const filteredRanked = ranked.filter(i => filterFn(i.award));
  const filteredUnknown = unknown.filter(i => filterFn(i.award));
  const filteredEarned = useMemo(() => {
    const list = earned.filter(filterFn);
    list.sort((a, b) => {
      if (earnedSort === "name") return a.name.localeCompare(b.name);
      if (earnedSort === "circulation") return a.circulation - b.circulation;
      return (RARITY_ORDER[b.rarity] ?? 8) - (RARITY_ORDER[a.rarity] ?? 8);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, kindFilter, search, earnedSort]);

  const meritEntries = player ? Object.entries(player.merits).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const meritsSpent = meritEntries.reduce((s, [, v]) => s + v, 0);

  const isLoading = catalogQ.isLoading || playerQ.isLoading;
  const error = catalogQ.error || playerQ.error;

  const handleRefreshCatalog = () => {
    clearCatalogCache();
    catalogQ.refetch();
    playerQ.refetch();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Merit Scout</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
            N00b T00ls
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          See which honors and medals you're <strong className="text-foreground">closest to earning</strong> — ranked by
          your actual progress — with practical tips on how to get each one.
        </p>
      </div>

      {/* No key */}
      {!apiKey && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Connect your API key in Settings to see your awards.
        </div>
      )}

      {/* Error */}
      {apiKey && error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {(error as Error).message || "Failed to load award data."}
        </div>
      )}

      {/* Loading */}
      {apiKey && isLoading && !error && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading award catalog & your stats…</span>
        </div>
      )}

      {apiKey && catalog && player && (
        <>
          {/* Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Honors</span>
                </div>
                <div className="text-2xl font-black tabular-nums">
                  {honorsEarnedCount}
                  <span className="text-sm font-bold text-muted-foreground/50"> / {catalog.honors.length}</span>
                </div>
                <ProgressBar percent={(honorsEarnedCount / Math.max(1, catalog.honors.length)) * 100} />
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Medal className="w-3.5 h-3.5 text-emerald-400/80" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Medals</span>
                </div>
                <div className="text-2xl font-black tabular-nums">
                  {medalsEarnedCount}
                  <span className="text-sm font-bold text-muted-foreground/50"> / {catalog.medals.length}</span>
                </div>
                <ProgressBar percent={(medalsEarnedCount / Math.max(1, catalog.medals.length)) * 100} />
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-3.5 h-3.5 text-amber-400/80" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Merits Spent</span>
                </div>
                <div className="text-2xl font-black tabular-nums">{meritsSpent}</div>
                <p className="text-[11px] text-muted-foreground/60">across {meritEntries.length} upgrades</p>
              </CardContent>
            </Card>
          </div>

          {/* Merit allocation */}
          {meritEntries.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Merit Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {meritEntries.map(([name, pts]) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted/30 border border-border/40"
                    >
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-bold font-mono tabular-nums text-primary">{pts}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border/50 overflow-hidden">
              {([["next", "What to work on next"], ["earned", `Earned (${earned.length})`]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold transition-colors",
                    tab === key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex rounded-md border border-border/50 overflow-hidden">
              {([["all", "All"], ["honor", "Honors"], ["medal", "Medals"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setKindFilter(key)}
                  className={cn(
                    "px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                    kindFilter === key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search awards…"
                className="w-full bg-muted/40 border border-border/60 rounded-md pl-8 pr-8 py-1.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={handleRefreshCatalog}
              title="Refresh catalog & stats"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", (catalogQ.isFetching || playerQ.isFetching) && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Next tab */}
          {tab === "next" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {filteredRanked.length === 0 && (
                  <p className="text-sm text-muted-foreground/60 text-center py-8">
                    No trackable awards match your filters.
                  </p>
                )}
                {filteredRanked.slice(0, visibleCount).map(item => (
                  <AwardRow key={`${item.award.kind}-${item.award.id}`} item={item} />
                ))}
                {filteredRanked.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount(c => c + 30)}
                    className="w-full py-2 text-xs font-bold text-muted-foreground hover:text-primary border border-border/40 rounded-md hover:bg-muted/20 transition-colors"
                  >
                    Show more ({filteredRanked.length - visibleCount} remaining)
                  </button>
                )}
              </div>

              {/* Unknown progress group */}
              {filteredUnknown.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowUnknown(s => !s)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Unknown progress ({filteredUnknown.length})
                      <span className="font-normal text-muted-foreground/50 hidden sm:inline">
                        — awards we can't measure from your personal stats
                      </span>
                    </span>
                    {showUnknown ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {showUnknown && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="space-y-2 mt-2">
                          {filteredUnknown.map(item => (
                            <AwardRow key={`${item.award.kind}-${item.award.id}`} item={item} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Earned tab */}
          {tab === "earned" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-bold uppercase tracking-wider text-muted-foreground/60">Sort:</span>
                {([["rarity", "Rarity"], ["name", "Name"], ["circulation", "Circulation"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setEarnedSort(key)}
                    className={cn(
                      "px-2 py-0.5 rounded border transition-colors font-bold",
                      earnedSort === key
                        ? "text-primary border-primary/30 bg-primary/10"
                        : "text-muted-foreground/60 border-border/40 hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filteredEarned.length === 0 && (
                <p className="text-sm text-muted-foreground/60 text-center py-8">No earned awards match your filters.</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredEarned.map(a => (
                  <div key={`${a.kind}-${a.id}`} className="border border-border/40 rounded-md bg-muted/10 p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-sm">{a.name}</span>
                      <KindBadge kind={a.kind} />
                      <span className={cn("text-[10px] font-medium px-1.5 py-px rounded border", rarityColor(a.rarity))}>
                        {a.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">{fmt(a.circulation)} in circulation</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
