import { useState } from "react";
import { useXanaxTracker } from "@/hooks/use-xanax-tracker";
import { useApiKey } from "@/hooks/use-api-key";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, ChevronDown, Plus, Minus, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatTimeRemaining } from "@/hooks/use-tick";

const XANAX_COOLDOWN_MAX = 6 * 3600; // 21600s

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DayDots({ count, goal }: { count: number; goal: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: goal }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full border",
            i < count ? "bg-primary border-primary" : "bg-transparent border-border/50"
          )}
        />
      ))}
      {count > goal && (
        <span className="text-[9px] text-amber-400 font-bold ml-0.5">+{count - goal}</span>
      )}
    </div>
  );
}

interface XanaxTrackerProps {
  xantakenTotal: number | undefined;
  drugCooldown?: number;
  tick: number;
  playerId?: number | null;
}

export function XanaxTracker({ xantakenTotal, drugCooldown, tick, playerId = null }: XanaxTrackerProps) {
  const { apiKey } = useApiKey();
  const { todayCount, sourceIsLog, sourceIsManual, adjustManual, monthData, today, goal, refetchLog, logFetching } =
    useXanaxTracker(apiKey, xantakenTotal, playerId);

  const [historyOpen, setHistoryOpen] = useState(false);

  // Cooldown from API — same pattern as the Cooldowns card
  const hasCooldown = (drugCooldown ?? 0) > 0;
  const remaining = hasCooldown ? Math.max(0, (drugCooldown ?? 0) - tick) : 0;
  const ready = hasCooldown && remaining === 0;
  // Bar fills from 0→100% as cooldown drains to 0 (counting up to ready)
  const cooldownPct = hasCooldown
    ? Math.min(100, ((XANAX_COOLDOWN_MAX - remaining) / XANAX_COOLDOWN_MAX) * 100)
    : null;

  const pct = Math.min(100, (todayCount / goal) * 100);
  const metGoal = todayCount >= goal;

  const barColor = metGoal
    ? "bg-green-500"
    : todayCount >= 2 ? "bg-amber-400"
    : todayCount >= 1 ? "bg-orange-500"
    : "bg-red-500/50";

  const countColor = metGoal
    ? "text-green-400"
    : todayCount >= 2 ? "text-amber-400"
    : todayCount >= 1 ? "text-orange-400"
    : "text-muted-foreground";

  const monthEntries = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDay = now.getDate();
    return Array.from({ length: todayDay }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry = monthData.find((e) => e.date === dateStr);
      const isToday = dateStr === today;
      return { dateStr, label: formatDate(dateStr), entry: entry ?? null, isToday };
    }).reverse();
  })();

  return (
    <motion.div
      animate={ready ? {
        boxShadow: [
          "0 0 0px 0px rgba(220,38,38,0)",
          "0 0 16px 4px rgba(220,38,38,0.55)",
          "0 0 0px 0px rgba(220,38,38,0)",
        ],
      } : { boxShadow: "0 0 0px 0px rgba(220,38,38,0)" }}
      transition={ready ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      className="rounded-lg"
    >
      <Card className={cn("bg-card shadow-sm transition-colors", ready && "border-primary/60")}>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Pill className="w-3.5 h-3.5 text-primary" />
              Xanax
            </div>
            {sourceIsLog && (
              <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider">Live</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2 space-y-3">

          {/* Today count + progress */}
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-3xl font-black font-mono leading-none", countColor)}>
                  {todayCount}
                </span>
                <span className="text-sm text-muted-foreground font-bold">/ {goal} today</span>
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                metGoal
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-muted-foreground border-border/30 bg-muted/20"
              )}>
                {metGoal ? "Goal Met" : `${goal - todayCount} to go`}
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", barColor)}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Drug cooldown bar */}
          {cooldownPct !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Cooldown
                </span>
                {ready ? (
                  <motion.span
                    className="text-[10px] font-black uppercase tracking-wider text-green-400"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Ready
                  </motion.span>
                ) : (
                  <span className="text-[11px] font-mono font-bold tabular-nums text-muted-foreground">
                    {formatTimeRemaining(remaining)}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    ready ? "bg-green-500" : cooldownPct > 75 ? "bg-amber-400" : "bg-primary/70"
                  )}
                  animate={{ width: `${cooldownPct}%` }}
                  transition={{ duration: 0.8, ease: "linear" }}
                />
              </div>
            </div>
          )}

          {/* Manual controls */}
          {sourceIsManual && (
            <div className="flex items-center justify-between rounded-md bg-muted/30 border border-border/40 px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground leading-tight">
                Log unavailable — enter manually.
              </span>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => adjustManual(-1)}
                  className="w-5 h-5 rounded flex items-center justify-center bg-muted/60 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => adjustManual(1)}
                  className="w-5 h-5 rounded flex items-center justify-center bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}

          {/* History toggle */}
          <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>This Month</span>
              <motion.div animate={{ rotate: historyOpen ? 0 : -90 }} transition={{ duration: 0.18 }}>
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </button>
            <button
              onClick={() => refetchLog()}
              disabled={logFetching}
              title="Refresh from Torn log"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <RefreshCw className={cn("w-3 h-3", logFetching && "animate-spin")} />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {historyOpen && (
              <motion.div
                key="history"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                  {monthEntries.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground text-center py-2">No data yet</div>
                  ) : (
                    monthEntries.map(({ dateStr, label, entry, isToday }) => (
                      <div
                        key={dateStr}
                        className={cn(
                          "flex items-center justify-between py-1 px-1.5 rounded text-[11px]",
                          isToday && "bg-primary/5 border border-primary/10"
                        )}
                      >
                        <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
                          <span className={cn("font-mono text-muted-foreground", isToday && "text-primary font-bold")}>
                            {isToday ? "Today" : label}
                          </span>
                        </div>
                        {entry !== null ? (
                          <>
                            <DayDots count={entry.count} goal={goal} />
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "font-mono font-bold w-4 text-right",
                                entry.count >= goal ? "text-green-400" : entry.count > 0 ? "text-amber-400" : "text-muted-foreground/50"
                              )}>
                                {entry.count}
                              </span>
                              <div
                                title={entry.source === "log" ? "From API log" : entry.source === "archive" ? "From saved history" : entry.source === "snapshot" ? "From snapshot" : "Manual"}
                                className={cn(
                                  "w-1 h-1 rounded-full flex-shrink-0",
                                  entry.source === "log" ? "bg-primary/60" : entry.source === "archive" ? "bg-sky-400/60" : entry.source === "snapshot" ? "bg-muted-foreground/40" : "bg-amber-400/50"
                                )}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 italic">no data</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-3 pt-2 mt-1 border-t border-border/30">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    <span className="text-[9px] text-muted-foreground/60">log</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
                    <span className="text-[9px] text-muted-foreground/60">saved</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="text-[9px] text-muted-foreground/60">snapshot</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                    <span className="text-[9px] text-muted-foreground/60">manual</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
