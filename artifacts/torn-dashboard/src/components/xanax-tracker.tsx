import { useState } from "react";
import { useXanaxTracker } from "@/hooks/use-xanax-tracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
            i < count
              ? "bg-primary border-primary"
              : "bg-transparent border-border/50"
          )}
        />
      ))}
      {count > goal && (
        <span className="text-[9px] text-amber-400 font-bold ml-0.5">+{count - goal}</span>
      )}
    </div>
  );
}

export function XanaxTracker({ xantakenTotal }: { xantakenTotal: number | undefined }) {
  const { todayCount, monthData, today, goal } = useXanaxTracker(xantakenTotal);
  const [historyOpen, setHistoryOpen] = useState(false);

  const count = todayCount ?? 0;
  const pct = Math.min(100, (count / goal) * 100);
  const metGoal = count >= goal;
  const unknown = todayCount === null;

  const barColor = metGoal
    ? "bg-green-500"
    : count >= 2
    ? "bg-amber-400"
    : count >= 1
    ? "bg-orange-500"
    : "bg-red-500/50";

  const countColor = metGoal
    ? "text-green-400"
    : count >= 2
    ? "text-amber-400"
    : count >= 1
    ? "text-orange-400"
    : "text-muted-foreground";

  // Get days in current month with data, show blanks for days without data
  const monthEntries = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDay = now.getDate();

    return Array.from({ length: todayDay }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry = monthData.find((e) => e.date === dateStr);
      const isToday = dateStr === today;
      return {
        dateStr,
        label: formatDate(dateStr),
        count: isToday ? count : entry?.count ?? null,
        isToday,
      };
    }).reverse();
  })();

  return (
    <Card className="bg-card shadow-sm">
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Pill className="w-3.5 h-3.5 text-primary" />
          Xanax
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-3">

        {/* Today */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-3xl font-black font-mono leading-none", countColor)}>
                {unknown ? "—" : count}
              </span>
              <span className="text-sm text-muted-foreground font-bold">/ {goal} today</span>
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
              metGoal
                ? "text-green-400 border-green-500/30 bg-green-500/10"
                : unknown
                ? "text-muted-foreground/50 border-border/30 bg-muted/20"
                : "text-muted-foreground border-border/30 bg-muted/20"
            )}>
              {metGoal ? "Goal Met" : unknown ? "No baseline" : `${goal - count} to go`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {unknown && (
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              Open the dashboard on two consecutive days to establish your baseline.
            </p>
          )}
        </div>

        {/* History toggle */}
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group pt-1 border-t border-border/40"
        >
          <span>This Month</span>
          <motion.div animate={{ rotate: historyOpen ? 0 : -90 }} transition={{ duration: 0.18 }}>
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </button>

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
                  monthEntries.map(({ dateStr, label, count: dayCount, isToday }) => (
                    <div
                      key={dateStr}
                      className={cn(
                        "flex items-center justify-between py-1 px-1.5 rounded text-[11px]",
                        isToday && "bg-primary/5 border border-primary/10"
                      )}
                    >
                      <span className={cn("font-mono text-muted-foreground w-16", isToday && "text-primary font-bold")}>
                        {isToday ? "Today" : label}
                      </span>
                      {dayCount !== null ? (
                        <>
                          <DayDots count={dayCount} goal={goal} />
                          <span className={cn(
                            "font-mono font-bold w-6 text-right",
                            dayCount >= goal ? "text-green-400" : dayCount > 0 ? "text-amber-400" : "text-muted-foreground/50"
                          )}>
                            {dayCount}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic">no data</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
