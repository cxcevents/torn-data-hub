import { useState, useRef } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { usePiScout } from "@/hooks/use-pi-scout";
import type { ScoutResult } from "@/hooks/use-pi-scout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, ExternalLink, ChevronUp, ChevronDown,
  AlertCircle, Search, X, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type SortKey = "level" | "daysInFaction" | "name";
type SortDir = "asc" | "desc";

interface Field { uid: number; value: string }

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
    else cmp = a.name.localeCompare(b.name);
    return dir === "asc" ? cmp : -cmp;
  });
}

export default function PiMarriageScout() {
  const { apiKey } = useApiKey();
  const uidRef = useRef(1);
  const [fields, setFields] = useState<Field[]>([{ uid: 0, value: "" }]);
  const [sortKey, setSortKey] = useState<SortKey>("level");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { state, scan, cancel } = usePiScout(apiKey);

  const { phase, total, checked, results, error } = state;
  const isRunning = phase === "fetching" || phase === "scanning";
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const filledIds = fields.map(f => f.value.trim()).filter(v => /^\d+$/.test(v));
  const canScan = filledIds.length > 0;

  const updateField = (uid: number, value: string) => {
    setFields(prev => {
      const next = prev.map(f => f.uid === uid ? { ...f, value } : f);
      const idx = next.findIndex(f => f.uid === uid);
      const isLast = idx === next.length - 1;
      if (isLast && value.trim() && /^\d+$/.test(value.trim())) {
        next.push({ uid: uidRef.current++, value: "" });
      }
      return next;
    });
  };

  const removeField = (uid: number) => {
    setFields(prev => {
      if (prev.length === 1) return [{ uid: uidRef.current++, value: "" }];
      return prev.filter(f => f.uid !== uid);
    });
  };

  const handleScan = () => {
    if (!canScan) return;
    scan(filledIds.join(","));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortedResults = sortResults(results, sortKey, sortDir);

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

          {/* Dynamic ID fields */}
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {fields.map((field, i) => {
                const isOnly = fields.length === 1;
                const isEmpty = !field.value.trim();
                const showRemove = !isOnly && !(i === fields.length - 1 && isEmpty);
                const label = i === 0 ? "Faction ID" : "Next ID (optional)";

                return (
                  <motion.div
                    key={field.uid}
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: i > 0 ? 8 : 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {label}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={field.value}
                          onChange={e => updateField(field.uid, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !isRunning && apiKey && canScan) handleScan(); }}
                          placeholder={i === 0 ? "e.g. 7024" : "Another faction ID…"}
                          disabled={isRunning}
                          className={cn(
                            "flex-1 bg-muted/40 border border-border/60 rounded-md px-3 py-2 text-sm font-mono",
                            "placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
                            "disabled:opacity-50 transition-colors"
                          )}
                        />
                        {showRemove && (
                          <button
                            onClick={() => removeField(field.uid)}
                            disabled={isRunning}
                            title="Remove"
                            className="w-9 h-9 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors disabled:opacity-40"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Scan / Cancel */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                Faction ID is in the URL:{" "}
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">
                  factions.php?step=profile&amp;<strong className="text-primary/80">ID=7024</strong>
                </span>
                {" "}— not your player ID.
              </p>
            </div>
            {isRunning ? (
              <Button
                variant="outline"
                onClick={cancel}
                className="ml-4 flex-shrink-0 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleScan}
                disabled={!apiKey || !canScan}
                className="ml-4 flex-shrink-0 gap-2"
              >
                <Search className="w-4 h-4" />
                Scan{filledIds.length > 1 ? ` (${filledIds.length})` : ""}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
          <div>
            <p>{error}</p>
            {error.toLowerCase().includes("incorrect id") && (
              <p className="mt-1 text-xs text-destructive/70">
                Make sure you're using the faction ID (from the faction profile URL), not a player ID.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {(results.length > 0 || phase === "done") && (
        <Card className="bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Results
                {results.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-black text-xs">
                    {results.length}
                  </span>
                )}
              </CardTitle>
              {results.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60">Unmarried + Private Island</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {results.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {phase === "done" ? "No matching members found." : "Scanning…"}
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
