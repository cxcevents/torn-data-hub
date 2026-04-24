import { useState } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { useEnhancerLog } from "@/hooks/use-enhancer-log";
import { ActiveEnhancers } from "@/components/active-enhancers";
import { ENHANCERS, ENHANCER_DURATION_SECONDS, type StatKey } from "@/lib/enhancers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Onboarding } from "@/components/onboarding";
import { Link } from "wouter";
import { 
  AlertCircle, Terminal, Activity, Shield, Swords, Clock, Plane, 
  GraduationCap, Banknote, Coins, Bell, Mail, Calendar, Target, Award,
  BatteryCharging, Briefcase, Medal, Star, Move
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTick, formatTimeRemaining } from "@/hooks/use-tick";
import { formatNumber, formatLargeNumber, stripHtml, cn } from "@/lib/utils";
import { useLayoutLock, type ColumnId } from "@/hooks/use-layout-lock";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function EffectiveStatBox({ label, base, modifierPct, activeBonusPct }: { label: string, base: number, modifierPct: number, activeBonusPct: number }) {
  const totalPct = (modifierPct || 0) + (activeBonusPct || 0);
  const effective = Math.round(base * (1 + totalPct / 100));
  const affected = totalPct !== 0;
  const buffed = totalPct > 0;
  return (
    <div className="bg-muted/30 rounded-md p-2.5 border border-border/50 flex flex-col justify-between">
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        {activeBonusPct > 0 && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider animate-pulse">BUFFED</span>}
      </div>
      <div className={cn("grid gap-2 items-end", affected ? "grid-cols-2" : "grid-cols-1")}>
        <div className="flex flex-col">
          {affected && <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Base</span>}
          <span className="text-base font-bold font-mono tracking-tight text-foreground">{formatLargeNumber(base)}</span>
        </div>
        {affected && (
          <div className="flex flex-col items-end">
            <span className={cn("text-[9px] uppercase tracking-wider", buffed ? "text-emerald-500" : "text-destructive")}>
              Effective {totalPct > 0 ? "+" : ""}{totalPct}%
            </span>
            <span className={cn("text-base font-bold font-mono tracking-tight", buffed ? "text-emerald-400" : "text-destructive")}>
              {formatLargeNumber(effective)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MeritUpgrades({ merits }: { merits: Record<string, number> | undefined }) {
  const [onlySet, setOnlySet] = useState(true);
  const all = merits ? Object.entries(merits) : [];
  const sorted = [...all].sort((a, b) => (b[1] as number) - (a[1] as number));
  const filtered = onlySet ? sorted.filter(([, v]) => (v as number) > 0) : sorted;
  return (
    <div className="bg-muted/20 border border-border/50 rounded-md p-3">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Merit Upgrades</h4>
        </div>
        <button
          type="button"
          onClick={() => setOnlySet((v) => !v)}
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors",
            onlySet
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-muted/40 border-border text-muted-foreground hover-elevate"
          )}
          title={onlySet ? "Showing only merits you've spent on" : "Showing all merits"}
        >
          {onlySet ? "Only Set" : "Show All"}
        </button>
      </div>
      <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
        {filtered.map(([k, v]) => (
          <div key={k} className="flex justify-between items-center text-[11px]">
            <span className={cn("truncate mr-2", (v as number) > 0 ? "text-foreground" : "text-muted-foreground/60")}>{k}</span>
            <span className={cn("font-mono font-medium", (v as number) > 0 ? "text-primary" : "text-muted-foreground/60")}>{v as number}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-2">
            {onlySet ? "No merits with points spent" : "None"}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, subValue }: { label: string, value: React.ReactNode, icon?: any, subValue?: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-md p-2.5 border border-border/50 flex flex-col justify-between">
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 opacity-50" />}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-base font-bold font-mono tracking-tight text-foreground">{value}</span>
        {subValue && <span className="text-[10px] text-muted-foreground">{subValue}</span>}
      </div>
    </div>
  );
}

function ProgressBar({
  label, current, max, colorClass, timeRemainingSeconds, tick,
  flashWhenFull, actionHref, actionLabel, actionInline,
}: {
  label: string; current: number; max: number; colorClass: string;
  timeRemainingSeconds?: number; tick: number;
  flashWhenFull?: boolean; actionHref?: string; actionLabel?: string;
  actionInline?: boolean;
}) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  let displayTime = "";
  let isFull = current >= max;

  if (timeRemainingSeconds && timeRemainingSeconds > 0 && !isFull) {
    const adjustedTime = Math.max(0, timeRemainingSeconds - tick);
    displayTime = formatTimeRemaining(adjustedTime);
    if (adjustedTime <= 0) isFull = true;
  }

  const textColorClass = colorClass.replace("bg-", "text-");
  const showAction = isFull && actionHref;

  const actionBtn = showAction ? (
    <a
      href={actionHref}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
        "animate-pulse cursor-pointer transition-opacity hover:opacity-80 text-black",
        colorClass
      )}
    >
      {actionLabel ?? "Go"}
    </a>
  ) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-medium">
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
          {actionInline && actionBtn}
        </div>
        <div className="flex gap-2 items-center">
          <span className="font-mono text-foreground">{current} / {max}</span>
          {!isFull && displayTime && <span className="text-muted-foreground font-mono">{displayTime}</span>}
          {isFull && <span className={cn("font-bold text-[10px] uppercase tracking-wider", textColorClass, flashWhenFull && "animate-pulse")}>FULL</span>}
        </div>
      </div>

      <div className="relative">
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-1000 ease-linear",
              colorClass,
              isFull && flashWhenFull && "animate-pulse"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {!actionInline && showAction && (
          <div className="absolute inset-x-0 -top-0.5 flex justify-center pointer-events-none">
            <div className="pointer-events-auto" style={{ marginTop: "0.75rem" }}>
              {actionBtn}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const COMPACT_PANELS = new Set(["vitals-side", "cooldowns", "stats", "assets", "education"]);

function SortablePanel({ id, locked, children, className }: { id: string; locked: boolean; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined };
  return (
    <div ref={setNodeRef} style={style} className={cn("relative group rounded-xl transition-shadow", isDragging && "opacity-60", !locked && "hover:ring-1 hover:ring-primary/30 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_0_12px_hsl(var(--primary)/0.08)]", className)}>
      {!locked && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 z-20 p-1.5 rounded bg-muted/80 border border-border/60 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          title="Drag to reorder"
        >
          <Move className="w-3 h-3" />
        </div>
      )}
      {children}
    </div>
  );
}

function CompactList({ title, items, icon: Icon }: { title: string, items: {label: string, value: any}[], icon: any }) {
  return (
    <div className="bg-muted/20 border border-border/50 rounded-md p-3">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
        <Icon className="w-4 h-4 text-primary" />
        <h4 className="text-xs font-bold uppercase tracking-wider">{title}</h4>
      </div>
      <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground truncate mr-2">{item.label}</span>
            <span className="font-mono font-medium">{item.value}</span>
          </div>
        ))}
        {items.length === 0 && <div className="text-[11px] text-muted-foreground text-center py-2">None</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { apiKey } = useApiKey();
  const { data, isLoading, error, isFetching } = useTornUser(apiKey);
  const { data: itemUseLog } = useEnhancerLog(apiKey);
  const tick = useTick();
  const { locked, order, reorder } = useLayoutLock();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (column: ColumnId) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const items = order[column];
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      reorder(column, arrayMove(items, oldIndex, newIndex));
    }
  };

  void tick;
  const activeEnhancerBonus: Record<StatKey, number> = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
  if (itemUseLog) {
    const latestByItem = new Map<number, number>();
    for (const e of Object.values(itemUseLog)) {
      const itemId = e?.data?.item;
      if (typeof itemId !== "number") continue;
      const prev = latestByItem.get(itemId) ?? 0;
      if (e.timestamp > prev) latestByItem.set(itemId, e.timestamp);
    }
    for (const enh of ENHANCERS) {
      const ts = latestByItem.get(enh.id);
      if (!ts) continue;
      if (Math.floor(Date.now() / 1000) - ts < ENHANCER_DURATION_SECONDS) {
        activeEnhancerBonus[enh.stat] += enh.bonusPct;
      }
    }
  }

  if (!apiKey) {
    return <Onboarding />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader className="text-center text-destructive pb-2">
            <AlertCircle className="w-12 h-12 mx-auto mb-4" />
            <CardTitle>API Connection Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground text-sm">
              {error.message || "Failed to fetch data from Torn API."}
            </p>
            <Link href="/settings">
              <Button variant="outline" className="w-full">Update API Key</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-primary animate-pulse">
        <Terminal className="w-12 h-12 opacity-80" />
        <div className="space-y-1 text-center">
          <p className="font-mono text-sm tracking-widest font-bold">ESTABLISHING UPLINK...</p>
          <p className="font-mono text-[10px] opacity-50 tracking-widest">DECRYPTING PACKETS</p>
        </div>
      </div>
    );
  }

  // Derived Data
  const meritCount = data.merits ? Object.keys(data.merits).length : 0;
  const perksCount = data.perks ? Object.values(data.perks).reduce((acc: number, curr: any) => acc + (curr ? curr.length : 0), 0) : 0;
  const medalsCount = data.medals?.medals_awarded?.length || 0;
  
  const meritsList = data.merits ? Object.entries(data.merits).map(([k, v]) => ({ label: k, value: v })) : [];
  
  let jobPointsList: {label: string, value: any}[] = [];
  if (data.jobpoints?.companies) {
    jobPointsList = Object.values(data.jobpoints.companies).map((c: any) => ({ label: c.name, value: c.jobpoints }));
  }

  return (
    <div className={cn("space-y-4 pb-20 transition-opacity duration-500", isFetching ? "opacity-70" : "opacity-100")}>
      
      {/* 1. HEADER SECTION - HUD STYLE */}
      <div className="bg-card border border-border rounded-lg overflow-hidden relative shadow-sm">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        <div className="p-4 flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight text-foreground">{data.name}</h2>
              <span className="font-mono text-[10px] text-muted-foreground">[{data.player_id}]</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                LVL {data.level}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                {data.faction?.faction_name ? (
                  <span>{data.faction.position} of <strong className="text-foreground">{data.faction.faction_name}</strong> <span className="opacity-50">({data.faction.days_in_faction}d)</span></span>
                ) : (
                  <span>No Faction</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Age: {data.age}d</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end justify-center space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
              <span className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border",
                data.status?.state === "Okay" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                data.status?.state === "Hospital" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
              )}>
                {data.status?.description || data.status?.state}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase">
              Last seen: {data.last_action?.relative}
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE ENHANCERS */}
      <ActiveEnhancers />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT COLUMN (WIDER) */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-8">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd("left")}>
            <SortableContext items={order.left} strategy={verticalListSortingStrategy}>
              {order.left.map((panelId) => (
                <SortablePanel key={panelId} id={panelId} locked={locked} className={COMPACT_PANELS.has(panelId) ? "col-span-1" : "col-span-2"}>

                  {/* VITALS CARD */}
                  {panelId === "vitals" && (
                    <Card className="bg-card shadow-sm">
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-primary" />
                          Vitals
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-3 space-y-3">
                        {data.life && <ProgressBar label="Life" current={data.life.current} max={data.life.maximum} timeRemainingSeconds={data.life.fulltime} tick={tick} colorClass="bg-blue-500" />}
                        {data.energy && (
                          <ProgressBar
                            label="Energy" current={data.energy.current} max={data.energy.maximum}
                            timeRemainingSeconds={data.energy.fulltime} tick={tick} colorClass="bg-green-500"
                            flashWhenFull actionHref="https://www.torn.com/gym.php" actionLabel="Train"
                            actionInline
                          />
                        )}
                        {data.nerve && (
                          <ProgressBar
                            label="Nerve" current={data.nerve.current} max={data.nerve.maximum}
                            timeRemainingSeconds={data.nerve.fulltime} tick={tick} colorClass="bg-red-500"
                            flashWhenFull actionHref="https://www.torn.com/crimes.php" actionLabel="Commit Crime"
                            actionInline
                          />
                        )}
                        {data.happy && <ProgressBar label="Happy" current={data.happy.current} max={data.happy.maximum} timeRemainingSeconds={data.happy.fulltime} tick={tick} colorClass="bg-yellow-500" />}
                      </CardContent>
                    </Card>
                  )}

                  {/* WALLET, CHAIN & TRAVEL */}
                  {panelId === "vitals-side" && (
                    <div className="space-y-4">
                      {data.chain && data.chain.current > 0 && (
                        <Card className="bg-purple-500/5 border-purple-500/20">
                          <CardContent className="p-3">
                            <ProgressBar label={`Chain (x${data.chain.modifier})`} current={data.chain.current} max={data.chain.maximum} timeRemainingSeconds={data.chain.timeout} tick={tick} colorClass="bg-purple-500" />
                          </CardContent>
                        </Card>
                      )}
                      {data.travel && data.travel.time_left > 0 && (
                        <Card className="bg-blue-500/5 border-blue-500/20">
                          <CardContent className="p-3 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Plane className="w-4 h-4 text-blue-400" />
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">To {data.travel.destination}</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-blue-400">
                              {formatTimeRemaining(Math.max(0, data.travel.time_left - tick))}
                            </span>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* COOLDOWNS */}
                  {panelId === "cooldowns" && (
                    <Card className="bg-card shadow-sm">
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          Cooldowns
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-2 text-[11px] space-y-1">
                        {[
                          { label: "Drug", val: data.cooldowns?.drug, readyHref: "https://www.torn.com/item.php#drugs-items", readyLabel: "Use Drug" },
                          { label: "Medical", val: data.cooldowns?.medical },
                          { label: "Booster", val: data.cooldowns?.booster }
                        ].map(cd => {
                          const remaining = Math.max(0, (cd.val || 0) - tick);
                          const isReady = remaining <= 0;
                          return (
                            <div key={cd.label} className="flex justify-between items-center">
                              <span className="text-muted-foreground font-bold uppercase tracking-wider">{cd.label}</span>
                              {isReady && cd.readyHref ? (
                                <a
                                  href={cd.readyHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 animate-pulse hover:opacity-80 transition-opacity"
                                >
                                  {cd.readyLabel}
                                </a>
                              ) : (
                                <span className={cn("font-mono font-bold", isReady ? "text-muted-foreground opacity-50" : "text-yellow-500")}>
                                  {isReady ? "RDY" : formatTimeRemaining(remaining)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* BATTLE STATS & WORK STATS */}
                  {panelId === "stats" && (
                    <Card className="bg-card shadow-sm">
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Swords className="w-3.5 h-3.5 text-primary" />
                          Stats
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-2">
                        <div className="grid grid-cols-1 gap-2 mb-3">
                          <EffectiveStatBox label="Strength" base={data.strength || 0} modifierPct={data.strength_modifier || 0} activeBonusPct={activeEnhancerBonus.strength} />
                          <EffectiveStatBox label="Defense" base={data.defense || 0} modifierPct={data.defense_modifier || 0} activeBonusPct={activeEnhancerBonus.defense} />
                          <EffectiveStatBox label="Speed" base={data.speed || 0} modifierPct={data.speed_modifier || 0} activeBonusPct={activeEnhancerBonus.speed} />
                          <EffectiveStatBox label="Dexterity" base={data.dexterity || 0} modifierPct={data.dexterity_modifier || 0} activeBonusPct={activeEnhancerBonus.dexterity} />
                        </div>
                        {(() => {
                          const baseTotal = data.total || 0;
                          const effTotal =
                            Math.round((data.strength || 0) * (1 + ((data.strength_modifier || 0) + activeEnhancerBonus.strength) / 100)) +
                            Math.round((data.defense || 0) * (1 + ((data.defense_modifier || 0) + activeEnhancerBonus.defense) / 100)) +
                            Math.round((data.speed || 0) * (1 + ((data.speed_modifier || 0) + activeEnhancerBonus.speed) / 100)) +
                            Math.round((data.dexterity || 0) * (1 + ((data.dexterity_modifier || 0) + activeEnhancerBonus.dexterity) / 100));
                          const totalAffected = effTotal !== baseTotal;
                          return (
                            <div className="bg-primary/5 rounded-md p-2 border border-primary/10 flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Total</span>
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono font-bold text-sm text-primary">{formatLargeNumber(baseTotal)}</span>
                                {totalAffected && (
                                  <>
                                    <span className="text-muted-foreground text-[10px]">/</span>
                                    <span className="font-mono font-bold text-sm text-emerald-400">{formatLargeNumber(effTotal)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <div className="flex justify-between text-[11px]"><span className="text-muted-foreground font-bold uppercase tracking-wider">MANUAL</span><span className="font-mono">{formatNumber(data.manual_labor || 0)}</span></div>
                          <div className="flex justify-between text-[11px]"><span className="text-muted-foreground font-bold uppercase tracking-wider">INTEL</span><span className="font-mono">{formatNumber(data.intelligence || 0)}</span></div>
                          <div className="flex justify-between text-[11px]"><span className="text-muted-foreground font-bold uppercase tracking-wider">ENDUR</span><span className="font-mono">{formatNumber(data.endurance || 0)}</span></div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* FINANCIALS & NETWORTH */}
                  {panelId === "assets" && (
                    <Card className="bg-card shadow-sm">
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Banknote className="w-3.5 h-3.5 text-green-500" />
                          Assets
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-2">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Cash</div>
                            <div className="font-mono text-sm font-bold text-green-400">{formatNumber(data.money_onhand || 0, true)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Points</div>
                            <div className="font-mono text-sm font-bold text-primary">{formatNumber(data.points || 0)}</div>
                          </div>
                        </div>
                        <div className="bg-card border border-border/40 rounded-md overflow-hidden mb-3">
                          <div className="flex justify-between items-center p-2 border-b border-border/50 bg-muted/20">
                            <span className="text-[11px] text-muted-foreground font-bold uppercase">Networth</span>
                            <span className="font-mono text-sm font-bold">{formatLargeNumber(data.networth?.total || 0, true)}</span>
                          </div>
                          <div className="flex h-1.5 w-full bg-secondary">
                            <div style={{ width: `${((data.networth?.wallet || 0) / (data.networth?.total || 1)) * 100}%` }} className="bg-green-500" title="Wallet" />
                            <div style={{ width: `${((data.networth?.bank || 0) / (data.networth?.total || 1)) * 100}%` }} className="bg-blue-500" title="Bank" />
                            <div style={{ width: `${((data.networth?.items || 0) / (data.networth?.total || 1)) * 100}%` }} className="bg-purple-500" title="Items" />
                            <div style={{ width: `${((data.networth?.properties || 0) / (data.networth?.total || 1)) * 100}%` }} className="bg-orange-500" title="Properties" />
                            <div style={{ width: `${((data.networth?.stockmarket || 0) / (data.networth?.total || 1)) * 100}%` }} className="bg-yellow-500" title="Stocks" />
                          </div>
                        </div>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground uppercase font-bold tracking-wider">Property Vault</span>
                            <span className="font-mono">{formatNumber(data.vault_amount || 0, true)}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-t border-border/30">
                            <span className="text-muted-foreground uppercase font-bold tracking-wider">City Bank</span>
                            <div className="text-right">
                              <div className="font-mono">{formatNumber(data.city_bank?.amount || 0, true)}</div>
                              {data.city_bank?.time_left > 0 && (
                                <div className="text-[9px] text-muted-foreground">in {formatTimeRemaining(Math.max(0, data.city_bank.time_left - tick))}</div>
                              )}
                            </div>
                          </div>
                          {data.networth?.items > 0 && (
                            <div className="flex justify-between items-center py-1 border-t border-border/30">
                              <span className="text-muted-foreground uppercase font-bold tracking-wider">Items NW</span>
                              <span className="font-mono">{formatLargeNumber(data.networth.items, true)}</span>
                            </div>
                          )}
                          {data.networth?.stockmarket > 0 && (
                            <div className="flex justify-between items-center py-1 border-t border-border/30">
                              <span className="text-muted-foreground uppercase font-bold tracking-wider">Stocks</span>
                              <span className="font-mono">{formatLargeNumber(data.networth.stockmarket, true)}</span>
                            </div>
                          )}
                          {(data.networth as any)?.displaycase > 0 && (
                            <div className="flex justify-between items-center py-1 border-t border-border/30">
                              <span className="text-muted-foreground uppercase font-bold tracking-wider">Display Case</span>
                              <span className="font-mono">{formatLargeNumber((data.networth as any).displaycase, true)}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* EDUCATION */}
                  {panelId === "education" && (
                    <Card className="bg-card shadow-sm">
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-primary" />
                          Education
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-2 text-[11px]">
                        {data.education_current !== 0 ? (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground truncate">In Progress</span>
                            <span className="font-mono font-bold text-primary">
                              {formatTimeRemaining(Math.max(0, (data.education_timeleft || 0) - tick))}
                            </span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No active course</div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* EVENTS & MESSAGES */}
                  {panelId === "events-messages" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card shadow-sm">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  Events
                </CardTitle>
                {data.newevents > 0 && <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded font-bold">{data.newevents} NEW</span>}
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <div className="divide-y divide-border/30 max-h-[200px] overflow-y-auto custom-scrollbar border-t border-border/50">
                  {data.events && Object.values(data.events).slice(0, 10).map((ev: any, i: number) => (
                    <div key={i} className="p-2.5 text-[11px] hover:bg-muted/30 transition-colors">
                      <div className="text-[9px] text-muted-foreground font-mono mb-0.5">
                        {new Date(ev.timestamp * 1000).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                      </div>
                      <div className="leading-tight text-foreground/90">{stripHtml(ev.event)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-sm">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  Messages
                </CardTitle>
                {data.newmessages > 0 && <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded font-bold">{data.newmessages} NEW</span>}
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <div className="divide-y divide-border/30 max-h-[200px] overflow-y-auto custom-scrollbar border-t border-border/50">
                  {data.messages && Object.values(data.messages).slice(0, 10).map((msg: any, i: number) => (
                    <div key={i} className={cn("p-2.5 text-[11px] hover:bg-muted/30 transition-colors", msg.read === 0 && "bg-primary/5 border-l-2 border-primary")}>
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-bold text-foreground">{msg.name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(msg.timestamp * 1000).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="text-muted-foreground truncate">{stripHtml(msg.title)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>}

                </SortablePanel>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* RIGHT COLUMN (NARROWER) */}
        <div className="space-y-4 lg:col-span-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd("right")}>
            <SortableContext items={order.right} strategy={verticalListSortingStrategy}>
              {order.right.map((panelId) => (
                <SortablePanel key={panelId} id={panelId} locked={locked}>

                  {/* NOTIFICATIONS */}
                  {panelId === "alerts" && <Card className="bg-card shadow-sm border-primary/20">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-primary" />
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <a href="https://www.torn.com/messages.php" target="_blank" rel="noreferrer" className="bg-muted/50 rounded py-1.5 border border-border/50 hover-elevate">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase">Messages</div>
                  <div className={cn("font-mono text-sm font-bold", data.notifications?.messages > 0 ? "text-primary" : "text-foreground")}>{data.notifications?.messages || 0}</div>
                </a>
                <a href="https://www.torn.com/events.php" target="_blank" rel="noreferrer" className="bg-muted/50 rounded py-1.5 border border-border/50 hover-elevate">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase">Events</div>
                  <div className={cn("font-mono text-sm font-bold", data.notifications?.events > 0 ? "text-primary" : "text-foreground")}>{data.notifications?.events || 0}</div>
                </a>
                <a href="https://www.torn.com/awards.php" target="_blank" rel="noreferrer" className="bg-muted/50 rounded py-1.5 border border-border/50 hover-elevate">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase">Awards</div>
                  <div className={cn("font-mono text-sm font-bold", data.notifications?.awards > 0 ? "text-yellow-500" : "text-foreground")}>{data.notifications?.awards || 0}</div>
                </a>
                <a href="https://www.torn.com/competition.php" target="_blank" rel="noreferrer" className="bg-muted/50 rounded py-1.5 border border-border/50 hover-elevate">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase">Comps</div>
                  <div className="font-mono text-sm font-bold text-foreground">{data.notifications?.competition || 0}</div>
                </a>
              </div>
            </CardContent>
          </Card>}

                  {/* REFILLS & USAGE */}
                  {panelId === "refills" && <Card className="bg-card shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <BatteryCharging className="w-3.5 h-3.5 text-primary" />
                Refills Available Today
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex gap-2">
                {/* Energy — green + flashing when available (not yet used) */}
                <a
                  href="https://www.torn.com/points.php"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex-1 text-center py-2 rounded text-[10px] font-bold uppercase border cursor-pointer transition-colors",
                    !data.refills?.energy_refill_used
                      ? "bg-green-500/20 text-green-400 border-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.25)] animate-pulse"
                      : "bg-muted/20 text-muted-foreground/40 border-border/30 line-through"
                  )}
                >
                  Energy
                </a>
                {/* Nerve — red + flashing when available */}
                <a
                  href="https://www.torn.com/points.php"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex-1 text-center py-2 rounded text-[10px] font-bold uppercase border cursor-pointer transition-colors",
                    !data.refills?.nerve_refill_used
                      ? "bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.25)] animate-pulse"
                      : "bg-muted/20 text-muted-foreground/40 border-border/30 line-through"
                  )}
                >
                  Nerve
                </a>
                {/* Casino token — gray, no flash */}
                <a
                  href="https://www.torn.com/points.php"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex-1 text-center py-2 rounded text-[10px] font-bold uppercase border cursor-pointer transition-colors",
                    !data.refills?.token_refill_used
                      ? "bg-zinc-500/20 text-zinc-300 border-zinc-500/40"
                      : "bg-muted/20 text-muted-foreground/40 border-border/30 line-through"
                  )}
                >
                  Casino
                </a>
              </div>
            </CardContent>
          </Card>}

                  {/* PERKS, MERITS, MEDALS SUMMARY */}
                  {panelId === "achievements" && <Card className="bg-card shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-primary" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div className="flex justify-between text-center gap-2">
                <div className="flex-1 bg-muted/30 rounded p-1.5 border border-border/50">
                  <div className="text-sm font-mono font-bold text-foreground">{medalsCount}</div>
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Medals</div>
                </div>
                <div className="flex-1 bg-muted/30 rounded p-1.5 border border-border/50">
                  <div className="text-sm font-mono font-bold text-foreground">{meritCount}</div>
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Merits</div>
                </div>
                <div className="flex-1 bg-muted/30 rounded p-1.5 border border-border/50">
                  <div className="text-sm font-mono font-bold text-foreground">{perksCount}</div>
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Perks</div>
                </div>
              </div>

              {jobPointsList.length > 0 && <CompactList title="Job Points" items={jobPointsList} icon={Briefcase} />}
              <MeritUpgrades merits={data.merits} />

            </CardContent>
          </Card>}

                  {/* PERSONAL STATS MINI */}
                  {panelId === "selected-stats" && <Card className="bg-card shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Selected Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between py-0.5 border-b border-border/30">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider">Xanax</span>
                  <span className="font-mono">{formatNumber(data.personalstats?.xantaken || 0)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/30">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider">Attacks Won</span>
                  <span className="font-mono">{formatNumber(data.personalstats?.attackswon || 0)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/30">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider">Busts</span>
                  <span className="font-mono">{formatNumber(data.personalstats?.peoplebusted || 0)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider">Donator Days</span>
                  <span className="font-mono">{formatNumber(data.personalstats?.daysbeendonator || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>}

                </SortablePanel>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
