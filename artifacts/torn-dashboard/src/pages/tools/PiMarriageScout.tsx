import { useState, useRef, useCallback } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ExternalLink, ChevronUp, ChevronDown, AlertCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ScoutResult {
  id: number;
  name: string;
  level: number;
  daysInFaction: number;
  factionId: number;
  factionName: string;
}

type ScanPhase = "idle" | "fetching" | "scanning" | "done" | "error";
type SortKey = "level" | "daysInFaction" | "name";
type SortDir = "asc" | "desc";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseFactionIds(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

function formatDays(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.floor(days / 30)}mo`;
  return `${days}d`;
}

export default function PiMarriageScout() {
  const { apiKey } = useApiKey();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("level");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const cancelledRef = useRef(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "asc");
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "level") cmp = a.level - b.level;
    else if (sortKey === "daysInFaction") cmp = a.daysInFaction - b.daysInFaction;
    else cmp = a.name.localeCompare(b.name);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const cancelScan = () => { cancelledRef.current = true; };

  const startScan = useCallback(async () => {
    if (!apiKey) return;
    const ids = parseFactionIds(input);
    if (ids.length === 0) {
      setError("Enter at least one valid faction ID.");
      setPhase("error");
      return;
    }

    cancelledRef.current = false;
    setPhase("fetching");
    setResults([]);
    setChecked(0);
    setTotal(0);
    setError(null);

    try {
      // ── Step 1: fetch member lists for all factions ──
      type MemberStub = { id: string; name: string; level: number; daysInFaction: number; factionId: number; factionName: string };
      const allMembers: MemberStub[] = [];

      for (const factionId of ids) {
        if (cancelledRef.current) break;
        const res = await fetch(`https://api.torn.com/faction/${factionId}?selections=basic&key=${apiKey}`);
        const data = await res.json();
        if (data.error) throw new Error(`Faction ${factionId}: ${data.error.error}`);
        const memberEntries = Object.entries(data.members ?? {}) as [string, any][];
        for (const [uid, m] of memberEntries) {
          allMembers.push({
            id: uid,
            name: m.name,
            level: m.level,
            daysInFaction: m.days_in_faction,
            factionId,
            factionName: data.name,
          });
        }
      }

      if (cancelledRef.current) { setPhase("done"); return; }

      setTotal(allMembers.length);
      setPhase("scanning");

      // ── Step 2: profile-check each member ──
      const hits: ScoutResult[] = [];

      for (let i = 0; i < allMembers.length; i++) {
        if (cancelledRef.current) break;

        const member = allMembers[i];
        await sleep(300);
        if (cancelledRef.current) break;

        try {
          const res = await fetch(`https://api.torn.com/user/${member.id}?selections=profile&key=${apiKey}`);
          const profile = await res.json();

          if (!profile.error) {
            const isUnmarried = !profile.married?.spouse_id;
            const prop: string = (profile.property ?? "").toLowerCase();
            const isPI = prop.includes("private island");

            if (isUnmarried && isPI) {
              const hit: ScoutResult = {
                id: Number(member.id),
                name: member.name,
                level: member.level,
                daysInFaction: member.daysInFaction,
                factionId: member.factionId,
                factionName: member.factionName,
              };
              hits.push(hit);
              setResults([...hits]);
            }
          }
        } catch {
          // skip this member on network error
        }

        setChecked(i + 1);
      }

      setPhase("done");
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setPhase("error");
    }
  }, [apiKey, input]);

  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const isRunning = phase === "fetching" || phase === "scanning";

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">PI Marriage Scout</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">N00b T00ls</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Scans faction members and surfaces players who are <strong className="text-foreground">unmarried</strong> and live on a <strong className="text-foreground">Private Island</strong>.
        </p>
      </div>

      {/* Input card */}
      <Card className="bg-card">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Faction IDs to Scan</CardTitle>
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
              onKeyDown={e => { if (e.key === "Enter" && !isRunning && apiKey) startScan(); }}
              placeholder="e.g. 7024, 7893, 12345"
              disabled={isRunning}
              className={cn(
                "flex-1 bg-muted/40 border border-border/60 rounded-md px-3 py-2 text-sm font-mono",
                "placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
                "disabled:opacity-50"
              )}
            />
            {isRunning ? (
              <Button variant="outline" onClick={cancelScan} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                <X className="w-4 h-4" />
                Cancel
              </Button>
            ) : (
              <Button
                onClick={startScan}
                disabled={!apiKey || !input.trim()}
                className="gap-2"
              >
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
                        <div className="flex items-center gap-1">Player <SortIcon k="name" /></div>
                      </th>
                      <th
                        className="text-left px-4 py-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("level")}
                      >
                        <div className="flex items-center gap-1">Lvl <SortIcon k="level" /></div>
                      </th>
                      <th className="text-left px-4 py-2">Faction</th>
                      <th
                        className="text-left px-4 py-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("daysInFaction")}
                      >
                        <div className="flex items-center gap-1">In Faction <SortIcon k="daysInFaction" /></div>
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
