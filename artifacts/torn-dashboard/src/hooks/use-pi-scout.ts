import { useState, useRef, useCallback } from "react";
import { writeFaction } from "@/lib/pi-scout-cache";

export interface ScoutResult {
  id: number;
  name: string;
  level: number;
  daysInFaction: number;
  factionId: number;
  factionName: string;
  lastAction: string;
  lastActionStatus: string;
  lastActionTimestamp: number;
}

export type ScanPhase = "idle" | "fetching" | "scanning" | "done" | "error";

export interface ScanState {
  phase: ScanPhase;
  total: number;
  checked: number;
  results: ScoutResult[];
  error: string | null;
  cacheVersion: number;
}

interface FactionMember {
  id: string;
  name: string;
  level: number;
  daysInFaction: number;
  factionId: number;
  factionName: string;
}

interface FactionGroup {
  factionId: number;
  factionName: string;
  members: FactionMember[];
}

interface FactionResponse {
  error?: { code: number; error: string };
  name?: string;
  members?: Record<string, { name: string; level: number; days_in_faction: number; position: string }>;
}

interface ProfileResponse {
  error?: { code: number; error: string };
  married?: { spouse_id: number; spouse_name: string; duration: number };
  property?: string;
  last_action?: { relative: string; status: string; timestamp: number };
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

export function parseFactionIds(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

async function fetchFactionRoster(factionId: number, apiKey: string): Promise<FactionGroup> {
  const res = await fetch(`https://api.torn.com/faction/${factionId}?selections=basic&key=${apiKey}`);
  const data: FactionResponse = await res.json();
  if (data.error) throw new Error(`Faction ${factionId}: ${data.error.error}`);
  const members: FactionMember[] = Object.entries(data.members ?? {}).map(([uid, m]) => ({
    id: uid,
    name: m.name,
    level: m.level,
    daysInFaction: m.days_in_faction,
    factionId,
    factionName: data.name ?? String(factionId),
  }));
  return { factionId, factionName: data.name ?? String(factionId), members };
}

async function fetchMemberProfile(userId: string, apiKey: string): Promise<ProfileResponse> {
  const res = await fetch(`https://api.torn.com/user/${userId}?selections=profile&key=${apiKey}`);
  return res.json();
}

function isUnmarriedPI(profile: ProfileResponse): boolean {
  const isUnmarried = !profile.married?.spouse_id;
  const isPI = (profile.property ?? "").toLowerCase().includes("private island");
  return isUnmarried && isPI;
}

const INITIAL_STATE: ScanState = {
  phase: "idle", total: 0, checked: 0, results: [], error: null, cacheVersion: 0,
};

export function usePiScout(apiKey: string | null) {
  const [state, setState] = useState<ScanState>(INITIAL_STATE);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => { cancelledRef.current = true; }, []);

  const reset = useCallback(() => { setState(INITIAL_STATE); }, []);

  const scan = useCallback(async (factionIdsInput: string) => {
    if (!apiKey) return;

    const ids = parseFactionIds(factionIdsInput);
    if (ids.length === 0) {
      setState({ ...INITIAL_STATE, phase: "error", error: "Enter at least one valid faction ID.", cacheVersion: 0 });
      return;
    }

    cancelledRef.current = false;
    setState({ phase: "fetching", total: 0, checked: 0, results: [], error: null, cacheVersion: 0 });

    try {
      // ── Phase 1: fetch all rosters to get total member count ──
      const groups: FactionGroup[] = [];
      for (const id of ids) {
        if (cancelledRef.current) break;
        const group = await fetchFactionRoster(id, apiKey);
        groups.push(group);
      }

      if (cancelledRef.current) { setState(s => ({ ...s, phase: "done" })); return; }

      const total = groups.reduce((acc, g) => acc + g.members.length, 0);
      setState(s => ({ ...s, phase: "scanning", total }));

      // ── Phase 2: scan faction by faction, cache each on completion ──
      const allHits: ScoutResult[] = [];
      let checkedCount = 0;

      for (const group of groups) {
        if (cancelledRef.current) break;

        const factionHits: ScoutResult[] = [];

        for (const member of group.members) {
          if (cancelledRef.current) break;

          await sleep(300);
          if (cancelledRef.current) break;

          try {
            const profile = await fetchMemberProfile(member.id, apiKey);
            if (!profile.error && isUnmarriedPI(profile)) {
              const hit: ScoutResult = {
                id: Number(member.id),
                name: member.name,
                level: member.level,
                daysInFaction: member.daysInFaction,
                factionId: member.factionId,
                factionName: member.factionName,
                lastAction: profile.last_action?.relative ?? "Unknown",
                lastActionStatus: profile.last_action?.status ?? "unknown",
                lastActionTimestamp: profile.last_action?.timestamp ?? 0,
              };
              factionHits.push(hit);
              allHits.push(hit);
            }
          } catch {
            // skip member on network error
          }

          checkedCount++;
          setState(s => ({ ...s, checked: checkedCount, results: [...allHits] }));
        }

        // Save this faction's results to cache when its members are all done
        if (!cancelledRef.current) {
          writeFaction({
            factionId: group.factionId,
            factionName: group.factionName,
            scannedAt: Date.now(),
            results: factionHits,
          });
          setState(s => ({ ...s, cacheVersion: s.cacheVersion + 1 }));
        }
      }

      setState(s => ({ ...s, phase: "done" }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setState(s => ({ ...s, phase: "error", error: msg }));
    }
  }, [apiKey]);

  return { state, scan, cancel, reset };
}
