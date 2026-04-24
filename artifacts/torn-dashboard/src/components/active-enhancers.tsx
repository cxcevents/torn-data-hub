import { useMemo } from "react";
import { ENHANCERS, ENHANCER_DURATION_SECONDS } from "@/lib/enhancers";
import { useEnhancerLog } from "@/hooks/use-enhancer-log";
import { useApiKey } from "@/hooks/use-api-key";
import { useTick, formatTimeRemaining } from "@/hooks/use-tick";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function formatRelativeTime(secondsAgo: number) {
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const mins = Math.floor(secondsAgo / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActiveEnhancers() {
  const { apiKey } = useApiKey();
  const { data: logs, isLoading, error, refetch } = useEnhancerLog(apiKey);
  const tick = useTick();

  const nowUnix = Math.floor(Date.now() / 1000);

  const enhancerStatus = useMemo(() => {
    if (!logs) return ENHANCERS.map(e => ({ ...e, active: false, lastUsed: 0, expiresAt: 0 }));

    const logArray = Object.values(logs);
    
    return ENHANCERS.map(enhancer => {
      const itemLogs = logArray.filter(l => l.data?.item === enhancer.id);
      
      let lastUsed = 0;
      if (itemLogs.length > 0) {
        lastUsed = Math.max(...itemLogs.map(l => l.timestamp));
      }

      const expiresAt = lastUsed + ENHANCER_DURATION_SECONDS;
      const active = expiresAt > nowUnix;

      return {
        ...enhancer,
        lastUsed,
        expiresAt,
        active
      };
    });
  }, [logs, nowUnix]);

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold">Active Enhancer detection requires log access.</span>{" "}
            Generate a Limited or Full key at torn.com → Preferences → API Key.
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-shrink-0 border-destructive/30 hover:bg-destructive/10 text-destructive">
          <RotateCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
          Active Enhancers
        </h3>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
          Detected from your item-use log · effects last 120s
        </p>
      </div>

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
              <Card 
                key={enhancer.id} 
                className={cn(
                  "relative overflow-hidden transition-colors duration-300",
                  enhancer.active ? "bg-card border-border/50 shadow-md" : "bg-card/50 border-border/20 opacity-70"
                )}
              >
                {enhancer.active && (
                  <motion.div 
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={cn("absolute inset-0 opacity-10 pointer-events-none", enhancer.colorClass)}
                  />
                )}
                
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {enhancer.active && (
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
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
                        <div className={cn("font-mono text-xl font-bold tracking-tight", enhancer.textClass)}>
                          {formatTimeRemaining(timeRemaining)}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          Inactive
                        </div>
                      )}
                    </div>
                  </div>

                  {enhancer.active ? (
                    <div className="h-1 mt-3 w-full bg-secondary rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: `${percentage}%` }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                        className={cn("h-full", enhancer.colorClass)} 
                      />
                    </div>
                  ) : (
                    <div className="mt-3 text-[10px] text-muted-foreground">
                      {enhancer.lastUsed > 0 ? `Last used: ${formatRelativeTime(secondsAgo)}` : "Never used"}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
