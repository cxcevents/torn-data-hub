import { useState } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { usePiScout, parseFactionIds } from "@/hooks/use-pi-scout";
import type { ScoutResult } from "@/hooks/use-pi-scout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ExternalLink, ChevronUp, ChevronDown, AlertCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type SortKey = "level" | "daysInFaction" | "name";
type SortDir = "asc" | "desc";

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
  const [input, setInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("level");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { state, scan, cancel } = usePiScout(apiKey);

  const { phase, total, checked, results, error } = state;
  const isRunning = phase === "fetching" || phase === "scanning";
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortedResults = sortResults(results, sortKey, sortDir);

  const handleScan = () => {
    if (parseFactionIds(input).length === 0) return;
    scan(input);
  };

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
            Faction IDs to Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {!apiKey && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Connect your API key in Settings before scanning.
            </div>
          )}
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !isRunning && apiKey) handleScan(); }}
              placeholder="e.g. 7024, 7893, 12345"
              disabled={isRunning}
              className={cn(
                "flex-1 bg-muted/40 border border-border/60 rounded-md px-3 py-2 text-sm font-mono",
                "placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
                "disabled:opacity-50"
              )}
            />
            {isRunning ? (
              <Button
                variant="outline"
                onClick={cancel}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            ) : (
              <Button onClick={handleScan} disabled={!apiKey || !input.trim()} className="gap-2">
                <Search className="w-4 h-4" />
                Scan
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Separate multiple faction IDs with commas or spaces. Scanning respects API rate limits (~300ms per member).
          </p>
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
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
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
