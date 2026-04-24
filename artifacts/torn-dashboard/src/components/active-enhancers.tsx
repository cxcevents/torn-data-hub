import { useMemo, useState, useEffect, useCallback } from "react";
import { ENHANCERS, ENHANCER_DURATION_SECONDS, ENHANCER_FLASH_THRESHOLD_SECONDS } from "@/lib/enhancers";
import { useEnhancerLog } from "@/hooks/use-enhancer-log";
import { useEnhancerActivations } from "@/hooks/use-enhancer-activations";
import { useApiKey } from "@/hooks/use-api-key";
import { useTick, formatTimeRemaining } from "@/hooks/use-tick";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronDown, RotateCw, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, useAnimationControls, AnimatePresence } from "framer-motion";

const COLLAPSE_KEY = "torn_enhancers_collapsed";

function formatRelativeTime(secondsAgo: number) {
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const mins = Math.floor(secondsAgo / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function EnhancerCard({
  enhancer,
  timeRemaining,
  percentage,
  secondsAgo,
  onActivate,
}: {
  enhancer: typeof ENHANCERS[number] & { active: boolean; lastUsed: number; expiresAt: number };
  timeRemaining: number;
  percentage: number;
  secondsAgo: number;
  onActivate: () => void;
}) {
  const isFlashing = enhancer.active && timeRemaining <= ENHANCER_FLASH_THRESHOLD_SECONDS;
  const controls = useAnimationControls();

  useEffect(() => {
    if (isFlashing) {
      controls.start({
        backgroundColor: [enhancer.activeBg, enhancer.flashBg, enhancer.activeBg],
        transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
      });
    } else if (enhancer.active) {
      controls.start({ backgroundColor: enhancer.activeBg, transition: { duration: 0.4 } });
    } else {
      controls.start({ backgroundColor: "transparent", transition: { duration: 0.4 } });
    }
  }, [isFlashing, enhancer.active, enhancer.activeBg, enhancer.flashBg, controls]);

  return (
    <motion.div
      animate={controls}
      initial={{ backgroundColor: "transparent" }}
      className={cn(
        "rounded-xl border overflow-hidden relative transition-[border-color,box-shadow] duration-300",
        enhancer.active ? "border-border/50 shadow-md" : "border-border/20 opacity-70"
      )}
      style={enhancer.active ? { boxShadow: `0 0 14px ${enhancer.activeBg.replace(/[\d.]+\)$/, "0.25)")}` } : undefined}
    >
      {enhancer.active && (
        <motion.div
          initial={{ opacity: 0.12 }}
          animate={{ opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: isFlashing ? 0.8 : 2.5, repeat: Infinity }}
          className={cn("absolute inset-0 pointer-events-none", enhancer.colorClass)}
        />
      )}

      <CardContent className="p-3 bg-transparent">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              {enhancer.active && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: isFlashing ? 0.6 : 1.5, repeat: Infinity }}
                  className={cn("w-1.5 h-1.5 rounded-full", enhancer.colorClass)}
                />
              )}
              <h4 className={cn("text-sm font-bold", enhancer.active ? "text-foreground" : "text-muted-foreground")}>
                {enhancer.name}
              </h4>
            </div>
            <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-0.5">
              {enhancer.boost}
            </div>
          </div>
          <div className="text-right">
            {enhancer.active ? (
              <motion.div
                animate={isFlashing ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
                transition={{ duration: 0.6, repeat: isFlashing ? Infinity : 0 }}
                className={cn("font-mono text-xl font-bold tracking-tight", enhancer.textClass)}
              >
                {formatTimeRemaining(timeRemaining)}
              </motion.div>
            ) : (
              <button
                onClick={onActivate}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border transition-colors",
                  "border-border/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                )}
              >
                Used
              </button>
            )}
          </div>
        </div>

        {enhancer.active ? (
          <div className="h-1.5 mt-3 w-full bg-secondary/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: `${percentage}%` }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className={cn("h-full rounded-full", enhancer.colorClass)}
            />
          </div>
        ) : (
          <div className="mt-3 text-[10px] text-muted-foreground">
            {enhancer.lastUsed > 0 ? `Last used: ${formatRelativeTime(secondsAgo)}` : "Tap 'Used' after you take it"}
          </div>
        )}
      </CardContent>
    </motion.div>
  );
}

export function ActiveEnhancers() {
  const { apiKey } = useApiKey();
  const { data: logData, isLoading, error, refetch } = useEnhancerLog(apiKey);
  const { activations, activate } = useEnhancerActivations();
  useTick();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const nowUnix = Math.floor(Date.now() / 1000);

  const enhancerStatus = useMemo(() => {
    return ENHANCERS.map(enhancer => {
      const lastUsed = activations[enhancer.id] ?? 0;
      const expiresAt = lastUsed > 0 ? lastUsed + ENHANCER_DURATION_SECONDS : 0;
      const active = lastUsed > 0 && expiresAt > nowUnix;
      return { ...enhancer, lastUsed, expiresAt, active };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activations, nowUnix]);

  const activeCount = enhancerStatus.filter(e => e.active).length;

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Enhancer log unavailable.</span>{" "}
              Check your API key permissions at torn.com → Preferences → API Key.
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-shrink-0 border-destructive/30 hover:bg-destructive/10 text-destructive">
            <RotateCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors rounded-t-xl group"
      >
        <div className="flex items-center gap-2.5">
          <Syringe className="w-3.5 h-3.5 text-primary scale-150 -rotate-90" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Active Enhancers <span className="text-muted-foreground/50">(WIP)</span>
          </span>
          {activeCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
              {activeCount} active
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="enhancer-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full bg-card" />
                  ))
                ) : (
                  enhancerStatus.map((enhancer) => {
                    const timeRemaining = Math.max(0, enhancer.expiresAt - nowUnix);
                    const percentage = enhancer.active ? (timeRemaining / ENHANCER_DURATION_SECONDS) * 100 : 0;
                    const secondsAgo = nowUnix - enhancer.lastUsed;
                    return (
                      <EnhancerCard
                        key={enhancer.id}
                        enhancer={enhancer}
                        timeRemaining={timeRemaining}
                        percentage={percentage}
                        secondsAgo={secondsAgo}
                        onActivate={() => activate(enhancer.id)}
                      />
                    );
                  })
                )}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
