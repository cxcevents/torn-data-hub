import { useState, useRef, useEffect, useCallback } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { usePiScout } from "@/hooks/use-pi-scout";
import type { ScoutResult } from "@/hooks/use-pi-scout";
import {
  readCache, readChecked, writeChecked, deleteFaction, clearAllCache, formatAge,
} from "@/lib/pi-scout-cache";
import type { CacheStore } from "@/lib/pi-scout-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, ExternalLink, ChevronUp, ChevronDown,
  AlertCircle, Search, X, Info, Loader2, CheckCircle2, XCircle,
  Download, Clipboard, ClipboardCheck, RefreshCw, Database, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type SortKey = "level" | "daysInFaction" | "name" | "lastAction";
type SortDir = "asc" | "desc";
type FieldStatus = "idle" | "loading" | "verified" | "error";

interface Field {
  uid: number;
  value: string;
  status: FieldStatus;
  factionName?: string;
  factionId?: number;
  errorMsg?: string;
}

function formatDays(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.floor(days / 30)}mo`;
  return `${days}d`;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="w-3 h-3 opacity-30" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-primary" />
    : <ChevronDown className="w-3 h-3 text-primary" />;
}

function sortResults(results: ScoutResult[], key: SortKey, dir: SortDir) {
  return [...results].sort((a, b) => {
    let cmp = 0;
    if (key === "level") cmp = a.level - b.level;
    else if (key === "daysInFaction") cmp = a.daysInFaction - b.daysInFaction;
    else if (key === "lastAction") cmp = a.lastActionTimestamp - b.lastActionTimestamp;
    else cmp = a.name.localeCompare(b.name);
    return dir === "asc" ? cmp : -cmp;
  });
}

const CSV_HEADERS = ["Player", "Player ID", "Level", "Days in Faction", "Faction", "Faction ID", "Last Action", "Torn Profile URL"];

function toRow(r: ScoutResult): (string | number)[] {
  return [
    r.name, r.id, r.level, r.daysInFaction,
    r.factionName, r.factionId, r.lastAction,
    `https://www.torn.com/profiles.php?XID=${r.id}`,
  ];
}

function escapeCSV(val: string | number): string {
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(results: ScoutResult[]) {
  const rows = [CSV_HEADERS, ...results.map(toRow)];
  const csv = rows.map(row => row.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pi-scout-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyForSheets(results: ScoutResult[]): Promise<void> {
  const rows = [CSV_HEADERS, ...results.map(toRow)];
  const tsv = rows.map(row => row.join("\t")).join("\n");
  await navigator.clipboard.writeText(tsv);
}

function mergeResults(ids: Set<number>, store: CacheStore): ScoutResult[] {
  const seen = new Set<number>();
  const out: ScoutResult[] = [];
  for (const id of ids) {
    for (const r of store[id]?.results ?? []) {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
    }
  }
  return out;
}

export default function PiMarriageScout() {
  const { apiKey } = useApiKey();
  const uidRef = useRef(1);
  const lookupTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [fields, setFields] = useState<Field[]>([{ uid: 0, value: "", status: "idle" }]);
  const [sortKey, setSortKey] = useState<SortKey>("level");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [copied, setCopied] = useState(false);

  // ── Cache state ──────────────────────────────────────────────────
  const [cacheStore, setCacheStore] = useState<CacheStore>(() => readCache());
  const [checkedIds, setCheckedIds] = useState<Set<number>>(() => new Set(readChecked()));

  const refreshCache = useCallback(() => {
    setCacheStore(readCache());
  }, []);

  const { state, scan, cancel } = usePiScout(apiKey);
  const { phase, total, checked, results, error, cacheVersion } = state;
  const isRunning = phase === "fetching" || phase === "scanning";
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Refresh cache store and auto-check newly scanned factions
  useEffect(() => {
    if (cacheVersion === 0) return;
    const freshStore = readCache();
    setCacheStore(freshStore);
    // Auto-check any factions that just got cached
    setCheckedIds(prev => {
      const next = new Set(prev);
      for (const id of Object.keys(freshStore).map(Number)) {
        next.add(id);
      }
      writeChecked(Array.from(next));
      return next;
    });
  }, [cacheVersion]);

  const cachedFactions = Object.values(cacheStore).sort((a, b) => b.scannedAt - a.scannedAt);
  const hasCached = cachedFactions.length > 0;

  const toggleChecked = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeChecked(Array.from(next));
      return next;
    });
  };

  const checkAll = () => {
    const next = new Set(cachedFactions.map(f => f.factionId));
    setCheckedIds(next);
    writeChecked(Array.from(next));
  };

  const uncheckAll = () => {
    setCheckedIds(new Set());
    writeChecked([]);
  };

  const handleDeleteFaction = (id: number) => {
    deleteFaction(id);
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      writeChecked(Array.from(next));
      return next;
    });
    refreshCache();
  };

  const handleClearAll = () => {
    clearAllCache();
    setCacheStore({});
    setCheckedIds(new Set());
  };

  // ── Displayed results ────────────────────────────────────────────
  // During a live scan: show live hits. Otherwise: merge from checked cache entries.
  const displayedResults = isRunning
    ? results
    : mergeResults(checkedIds, cacheStore);

  const verifiedFields = fields.filter(f => f.status === "verified" && f.factionId);
  const canScan = verifiedFields.length > 0;

  // ── Faction lookup ───────────────────────────────────────────────
  const lookupFaction = async (uid: number, factionId: number) => {
    if (!apiKey) return;
    setFields(prev => prev.map(f => f.uid === uid ? { ...f, status: "loading" } : f));
    try {
      const res = await fetch(
        `https://api.torn.com/faction/${factionId}?selections=basic&key=${apiKey}`
      );
      const data = await res.json();
      if (data.error) {
        const hint = data.error.error?.toLowerCase().includes("incorrect")
          ? "Faction not found — check the ID from the faction profile URL."
          : data.error.error;
        setFields(prev => prev.map(f =>
          f.uid === uid ? { ...f, status: "error", errorMsg: hint } : f
        ));
      } else {
        setFields(prev => {
          const updated = prev.map(f =>
            f.uid === uid
              ? { ...f, status: "verified" as const, factionName: data.name, factionId }
              : f
          );
          const idx = updated.findIndex(f => f.uid === uid);
          if (idx === updated.length - 1) {
            updated.push({ uid: uidRef.current++, value: "", status: "idle" });
          }
          return updated;
        });
      }
    } catch {
      setFields(prev => prev.map(f =>
        f.uid === uid ? { ...f, status: "error", errorMsg: "Network error — try again." } : f
      ));
    }
  };

  const updateField = (uid: number, value: string) => {
    const existing = lookupTimers.current.get(uid);
    if (existing) clearTimeout(existing);
    setFields(prev => prev.map(f =>
      f.uid === uid
        ? { ...f, value, status: "idle", factionName: undefined, factionId: undefined, errorMsg: undefined }
        : f
    ));
    if (value.trim() && /^\d+$/.test(value.trim())) {
      const timer = setTimeout(() => {
        lookupFaction(uid, parseInt(value.trim(), 10));
      }, 600);
      lookupTimers.current.set(uid, timer);
    }
  };

  const removeField = (uid: number) => {
    const timer = lookupTimers.current.get(uid);
    if (timer) clearTimeout(timer);
    lookupTimers.current.delete(uid);
    setFields(prev => {
      if (prev.length === 1) return [{ uid: uidRef.current++, value: "", status: "idle" }];
      return prev.filter(f => f.uid !== uid);
    });
  };

  const handleScan = () => {
    if (!canScan) return;
    scan(verifiedFields.map(f => f.factionId!).join(","));
  };

  const handleRescanFaction = (factionId: number) => {
    scan(String(factionId));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortedResults = sortResults(displayedResults, sortKey, sortDir);
  const showResults = displayedResults.length > 0 || phase === "done";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">PI Marriage Scout</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
            N00b T00ls
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Scans faction members and surfaces players who are{" "}
          <strong className="text-foreground">unmarried</strong> and live on a{" "}
          <strong className="text-foreground">Private Island</strong>.
        </p>
      </div>

      {/* Input card */}
      <Card className="bg-card">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Factions to Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {!apiKey && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Connect your API key in Settings before scanning.
            </div>
          )}

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {fields.map((field, i) => {
                const isOnly = fields.length === 1;
                const isLastEmpty = i === fields.length - 1 && !field.value.trim();
                const showRemove = !isOnly && !isLastEmpty;
                const label = i === 0 ? "Faction ID" : "Next ID (optional)";
                const cachedEntry = field.factionId ? cacheStore[field.factionId] : null;

                return (
                  <motion.div
                    key={field.uid}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {label}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={field.value}
                            onChange={e => updateField(field.uid, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && !isRunning && canScan) handleScan();
                            }}
                            placeholder={i === 0 ? "e.g. 7024" : "Another faction ID…"}
                            disabled={isRunning}
                            className={cn(
                              "w-full bg-muted/40 border rounded-md px-3 py-2 text-sm font-mono pr-9",
                              "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 transition-colors",
                              "disabled:opacity-50",
                              field.status === "verified"
                                ? "border-green-500/50 focus:border-green-500/70 focus:ring-green-500/20"
                                : field.status === "error"
                                  ? "border-destructive/50 focus:border-destructive/60 focus:ring-destructive/20"
                                  : "border-border/60 focus:border-primary/50 focus:ring-primary/30"
                            )}
                          />
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            {field.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                            {field.status === "verified" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {field.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                          </div>
                        </div>
                        {showRemove && (
                          <button
                            onClick={() => removeField(field.uid)}
                            disabled={isRunning}
                            title="Remove"
                            className="w-9 h-9 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors disabled:opacity-40 flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {field.status === "verified" && field.factionName && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2 pl-1"
                          >
                            <span className="flex items-center gap-1.5 text-xs text-green-500">
                              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                              <span className="font-medium">{field.factionName}</span>
                              <span className="text-green-500/50">[{field.factionId}]</span>
                            </span>
                            {cachedEntry && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                <Database className="w-2.5 h-2.5" />
                                cached {formatAge(cachedEntry.scannedAt)}
                              </span>
                            )}
                          </motion.div>
                        )}
                        {field.status === "error" && field.errorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-1.5 pl-1 text-xs text-destructive"
                          >
                            <XCircle className="w-3 h-3 flex-shrink-0" />
                            {field.errorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <Info className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
              Faction ID is found in the URL:{" "}
              <span className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                factions.php?step=profile&amp;<strong className="text-primary/70">ID=7024</strong>
              </span>
              {" "}— not your player ID.
            </p>
          </div>

          <AnimatePresence>
            {canScan && !isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-between rounded-md bg-green-500/5 border border-green-500/20 px-3 py-2.5"
              >
                <div className="text-xs text-green-400">
                  <span className="font-bold">{verifiedFields.length}</span>{" "}
                  {verifiedFields.length === 1 ? "faction" : "factions"} ready —{" "}
                  <span className="text-green-400/70">
                    {verifiedFields.map(f => f.factionName).join(", ")}
                  </span>
                </div>
                <Button onClick={handleScan} className="ml-4 flex-shrink-0 gap-2 h-8 text-xs">
                  <Search className="w-3.5 h-3.5" />
                  Scan Members
                </Button>
              </motion.div>
            )}
            {isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-end"
              >
                <Button
                  variant="outline"
                  onClick={cancel}
                  className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                  Cancel Scan
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Saved Scans */}
      <AnimatePresence>
        {hasCached && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="bg-card">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Database className="w-3.5 h-3.5" />
                    Saved Scans
                    <span className="px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-black text-[10px]">
                      {cachedFactions.length}
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={checkAll}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      All
                    </button>
                    <button
                      onClick={uncheckAll}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      None
                    </button>
                    <button
                      onClick={handleClearAll}
                      title="Clear all saved scans"
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-1">
                  {cachedFactions.map(faction => {
                    const isChecked = checkedIds.has(faction.factionId);
                    const isRescanning = isRunning;
                    return (
                      <div
                        key={faction.factionId}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors group",
                          isChecked ? "bg-primary/5 border border-primary/15" : "border border-transparent hover:bg-muted/20"
                        )}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleChecked(faction.factionId)}
                          className={cn(
                            "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                            isChecked
                              ? "bg-primary border-primary"
                              : "border-border/60 hover:border-primary/50"
                          )}
                          aria-label={isChecked ? "Deselect" : "Select"}
                        >
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-medium truncate">{faction.factionName}</span>
                            <span className="text-[11px] text-muted-foreground/50 font-mono flex-shrink-0">
                              [{faction.factionId}]
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/50">
                              {faction.results.length} match{faction.results.length !== 1 ? "es" : ""}
                            </span>
                            <span className="text-[10px] text-muted-foreground/30">·</span>
                            <span className="text-[10px] text-muted-foreground/50">
                              scanned {formatAge(faction.scannedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleRescanFaction(faction.factionId)}
                            disabled={isRescanning}
                            title="Rescan this faction"
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Rescan
                          </button>
                          <button
                            onClick={() => handleDeleteFaction(faction.factionId)}
                            title="Remove from saved scans"
                            className="w-7 h-7 flex items-center justify-center rounded border border-transparent text-muted-foreground/40 hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground/40 mt-3">
                  Check factions to include their results below. Hover a row to rescan or remove it.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      <AnimatePresence>
        {(isRunning || phase === "done") && total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">
                {phase === "fetching" && "Fetching faction rosters…"}
                {phase === "scanning" && `Scanning members — ${checked} / ${total} checked`}
                {phase === "done" && `Scan complete — ${checked} members checked`}
              </span>
              <span className="font-mono font-bold tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", phase === "done" ? "bg-green-500" : "bg-primary")}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {phase === "error" && error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <Card className="bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Results
                {displayedResults.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-black text-xs">
                    {displayedResults.length}
                  </span>
                )}
                {!isRunning && checkedIds.size > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground/50 ml-1">
                    {checkedIds.size} faction{checkedIds.size !== 1 ? "s" : ""} selected
                  </span>
                )}
              </CardTitle>
              {displayedResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await copyForSheets(sortedResults);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    title="Copy as tab-separated — paste directly into Google Sheets or Excel"
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors"
                  >
                    {copied
                      ? <><ClipboardCheck className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied</span></>
                      : <><Clipboard className="w-3 h-3" />Copy for Sheets</>
                    }
                  </button>
                  <button
                    onClick={() => downloadCSV(sortedResults)}
                    title="Download as CSV"
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download CSV
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {displayedResults.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {isRunning
                  ? "Scanning…"
                  : checkedIds.size === 0
                    ? "Select factions above to view their saved results."
                    : "No matching members found in selected factions."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                      <th
                        className="text-left px-4 py-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Player <SortIcon active={sortKey === "name"} dir={sortDir} />
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("level")}
                      >
                        <div className="flex items-center gap-1">
                          Lvl <SortIcon active={sortKey === "level"} dir={sortDir} />
                        </div>
                      </th>
                      <th className="text-left px-4 py-2">Faction</th>
                      <th
                        className="text-left px-4 py-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("daysInFaction")}
                      >
                        <div className="flex items-center gap-1">
                          In Faction <SortIcon active={sortKey === "daysInFaction"} dir={sortDir} />
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("lastAction")}
                      >
                        <div className="flex items-center gap-1">
                          Last Action <SortIcon active={sortKey === "lastAction"} dir={sortDir} />
                        </div>
                      </th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r, i) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b border-border/30 hover:bg-muted/20 transition-colors",
                          i % 2 === 0 && "bg-muted/5"
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-400">{r.level}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {r.factionName}
                          <span className="ml-1 opacity-50">[{r.factionId}]</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {formatDays(r.daysInFaction)}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={cn(
                            "font-medium",
                            r.lastActionStatus === "Online" && "text-green-500",
                            r.lastActionStatus === "Idle" && "text-amber-400",
                            r.lastActionStatus === "Offline" && "text-muted-foreground",
                          )}>
                            {r.lastAction}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <a
                            href={`https://www.torn.com/profiles.php?XID=${r.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            Profile <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
