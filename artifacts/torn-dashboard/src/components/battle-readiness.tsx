import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, Zap, Swords, Lightbulb } from "lucide-react";

const ATTACK_ENERGY = 25;

interface EquipmentItem {
  ID: number;
  name: string;
  type: string; // Primary | Secondary | Melee | Temporary | Defensive | Clothing
  equipped: number;
}

interface AmmoEntry {
  ammoID: number;
  size: string;
  type: string;
  quantity: number;
  equipped: number;
}

interface WeaponDetail {
  id: number;
  ammoId: number | null;
  ammoName: string | null;
  magazineRounds: number | null;
}

interface ReadinessData {
  equipment: EquipmentItem[];
  ammo: AmmoEntry[];
  energy: { current: number; maximum: number; fulltime: number };
  weaponDetails: Record<number, WeaponDetail>;
}

const itemImg = (id: number) => `https://www.torn.com/images/items/${id}/large.png`;

// Slots we display, in order
const WEAPON_TYPES = ["Primary", "Secondary", "Melee", "Temporary"] as const;
const ARMOR_SLOTS = 5; // helmet, body, pants, gloves, boots

export function BattleReadiness({ apiKey }: { apiKey: string | null }) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.torn.com/user/?selections=equipment,ammo,bars&key=${apiKey}`,
        );
        const j = await res.json();
        if (j.error) throw new Error(j.error.error);

        const equipment: EquipmentItem[] = j.equipment ?? [];
        const guns = equipment.filter(
          (e) => e.type === "Primary" || e.type === "Secondary",
        );
        const weaponDetails: Record<number, WeaponDetail> = {};
        if (guns.length > 0) {
          try {
            const dres = await fetch(
              `https://api.torn.com/v2/torn/items?ids=${guns.map((g) => g.ID).join(",")}&key=${apiKey}`,
            );
            const dj = await dres.json();
            for (const it of dj.items ?? []) {
              weaponDetails[it.id] = {
                id: it.id,
                ammoId: it.details?.ammo?.id ?? null,
                ammoName: it.details?.ammo?.name ?? null,
                magazineRounds: it.details?.ammo?.magazine_rounds ?? null,
              };
            }
          } catch {
            // ammo mapping unavailable — skip ammo warnings rather than guess
          }
        }
        if (!cancelled) {
          setData({
            equipment,
            ammo: j.ammo ?? [],
            energy: {
              current: j.energy?.current ?? 0,
              maximum: j.energy?.maximum ?? 150,
              fulltime: j.energy?.fulltime ?? 0,
            },
            weaponDetails,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load loadout");
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey]);

  if (!apiKey) return null;
  if (error) {
    return (
      <Card className="bg-card p-3 text-xs text-muted-foreground/60">
        Couldn't load your loadout: {error}
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="bg-card p-3 text-xs text-muted-foreground/40 animate-pulse">
        Checking your battle readiness…
      </Card>
    );
  }

  const { equipment, ammo, energy, weaponDetails } = data;

  const bySlot = (t: string) => equipment.find((e) => e.type === t) ?? null;
  const armor = equipment.filter((e) => e.type === "Defensive");
  const hasAnyWeapon = !!(bySlot("Primary") || bySlot("Secondary") || bySlot("Melee"));

  const ammoFor = (weaponId: number) => {
    const d = weaponDetails[weaponId];
    if (!d || d.ammoId === null) return null;
    const rows = ammo.filter((a) => a.ammoID === d.ammoId);
    return {
      name: d.ammoName,
      total: rows.reduce((s, a) => s + a.quantity, 0),
      loaded: rows.some((a) => a.equipped === 1),
    };
  };

  // ── Warnings ──
  const warnings: string[] = [];
  if (!hasAnyWeapon) warnings.push("No weapon equipped — you'd be fighting with your fists.");
  for (const slot of ["Primary", "Secondary"] as const) {
    const gun = bySlot(slot);
    if (!gun) continue;
    const a = ammoFor(gun.ID);
    if (a && a.total === 0) warnings.push(`${gun.name} has no ${a.name} ammo — it can't fire.`);
    else if (a && a.total > 0 && a.total < 50)
      warnings.push(`Low ammo for ${gun.name}: only ${a.total} × ${a.name} left.`);
  }
  if (!bySlot("Temporary")) warnings.push("No temporary weapon equipped (grenade/flash) — free extra damage each fight.");
  if (armor.length < ARMOR_SLOTS)
    warnings.push(`Only ${armor.length}/${ARMOR_SLOTS} armor slots filled — you'll take extra damage.`);
  if (energy.current < ATTACK_ENERGY)
    warnings.push(`Not enough energy to attack (${energy.current}E / ${ATTACK_ENERGY}E needed).`);

  const attacks = Math.floor(energy.current / ATTACK_ENERGY);
  const ePct = Math.min(100, Math.round((energy.current / energy.maximum) * 100));
  const ready = warnings.length === 0;

  const slotBox = (label: string, item: EquipmentItem | null, sub?: string | null, subBad?: boolean) => (
    <div key={label} className="flex flex-col items-center gap-1 min-w-[64px]">
      <div
        className={cn(
          "w-14 h-14 rounded-md border flex items-center justify-center overflow-hidden bg-black/30",
          item ? "border-border/50" : "border-dashed border-red-400/40",
        )}
      >
        {item ? (
          <img src={itemImg(item.ID)} alt={item.name} title={item.name} className="max-w-full max-h-full object-contain" loading="lazy" />
        ) : (
          <span className="text-red-400/60 text-base font-black">?</span>
        )}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">{label}</span>
      {sub !== undefined && sub !== null && (
        <span className={cn("text-[9px] font-mono tabular-nums leading-none", subBad ? "text-red-400" : "text-muted-foreground/60")}>
          {sub}
        </span>
      )}
    </div>
  );

  return (
    <Card className="bg-card p-4 space-y-3">
      {/* Header + verdict */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Battle Readiness</span>
        </div>
        {ready ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" /> Ready to fight
          </span>
        ) : (
          <motion.span
            className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            <ShieldAlert className="w-3 h-3" /> {warnings.length} {warnings.length === 1 ? "issue" : "issues"}
          </motion.span>
        )}
      </div>

      {/* Loadout with real Torn item graphics */}
      <div className="flex flex-wrap gap-3">
        {WEAPON_TYPES.map((t) => {
          const item = bySlot(t);
          if ((t === "Primary" || t === "Secondary") && item) {
            const a = ammoFor(item.ID);
            return slotBox(t, item, a ? `${a.total.toLocaleString()} rnds` : null, a ? a.total === 0 : false);
          }
          return slotBox(t, item);
        })}
        <div className="w-px bg-border/40 self-stretch hidden sm:block" />
        {armor.map((it) => slotBox("Armor", it))}
        {Array.from({ length: Math.max(0, ARMOR_SLOTS - armor.length) }).map((_, i) => slotBox("Armor", null))}
      </div>

      {/* Energy + attack count */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground/60 font-bold uppercase tracking-wider">
            <Zap className="w-3 h-3 text-green-400" /> Energy
          </span>
          <span className="font-mono font-bold tabular-nums text-foreground/80">
            {energy.current} / {energy.maximum}
            <span className={cn("ml-2", attacks > 0 ? "text-emerald-400" : "text-red-400")}>
              = {attacks} {attacks === 1 ? "attack" : "attacks"}
            </span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", ePct >= 50 ? "bg-green-500" : ePct >= 25 ? "bg-amber-400" : "bg-red-500")}
            style={{ width: `${ePct}%` }}
          />
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-xs text-red-400/90">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* Tips */}
      <details className="text-xs">
        <summary className="flex items-center gap-1.5 cursor-pointer text-muted-foreground/50 hover:text-muted-foreground/80 font-bold uppercase tracking-wider text-[10px]">
          <Lightbulb className="w-3 h-3" /> Tips for successful attacks
        </summary>
        <ul className="mt-2 space-y-1 text-muted-foreground/70 list-disc pl-5">
          <li>Each attack costs 25E — leaving with a win ("Leave") gives the most XP for leveling.</li>
          <li>Keep your gun loaded with the ammo type it takes; special ammo (Hollow Point etc.) hits harder than Standard.</li>
          <li>Always equip a temporary weapon — a grenade tossed at the start is free damage.</li>
          <li>Fill every armor slot, even cheap pieces — empty slots take full damage.</li>
          <li>Check the target's ratio badge: green means safely weaker than you.</li>
          <li>Attack targets who are Okay (not in hospital) and offline/idle when possible.</li>
        </ul>
      </details>
    </Card>
  );
}
