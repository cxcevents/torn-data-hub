import { useState, useRef, useCallback } from "react";

export interface ScoutResult {
  id: number;
  name: string;
  level: number;
  daysInFaction: number;
  factionId: number;
  factionName: string;
}

export type ScanPhase = "idle" | "fetching" | "scanning" | "done" | "error";

export interface ScanState {
  phase: ScanPhase;
  total: number;
  checked: number;
  results: ScoutResult[];
  error: string | null;
}

interface FactionMember {
  id: string;
  name: string;
  level: number;
  daysInFaction: number;
  factionId: number;
  factionName: string;
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
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

export function parseFactionIds(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

async function fetchFactionRoster(factionId: number, apiKey: string): Promise<{ name: string; members: FactionMember[] }> {
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
  return { name: data.name ?? String(factionId), members };
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

const INITIAL_STATE: ScanState = { phase: "idle", total: 0, checked: 0, results: [], error: null };

export function usePiScout(apiKey: string | null) {
  const [state, setState] = useState<ScanState>(INITIAL_STATE);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => { cancelledRef.current = true; }, []);

  const reset = useCallback(() => { setState(INITIAL_STATE); }, []);

  const scan = useCallback(async (factionIdsInput: string) => {
    if (!apiKey) return;

    const ids = parseFactionIds(factionIdsInput);
    if (ids.length === 0) {
      setState({ ...INITIAL_STATE, phase: "error", error: "Enter at least one valid faction ID." });
      return;
    }

    cancelledRef.current = false;
    setState({ phase: "fetching", total: 0, checked: 0, results: [], error: null });

    try {
      // ── Step 1: collect all faction members ──
      const allMembers: FactionMember[] = [];
      for (const id of ids) {
        if (cancelledRef.current) break;
        const { members } = await fetchFactionRoster(id, apiKey);
        allMembers.push(...members);
      }

      if (cancelledRef.current) { setState(s => ({ ...s, phase: "done" })); return; }

      setState(s => ({ ...s, phase: "scanning", total: allMembers.length }));

      // ── Step 2: profile-check each member ──
      const hits: ScoutResult[] = [];
      for (let i = 0; i < allMembers.length; i++) {
        if (cancelledRef.current) break;

        await sleep(300);
        if (cancelledRef.current) break;

        const member = allMembers[i];
        try {
          const profile = await fetchMemberProfile(member.id, apiKey);
          if (!profile.error && isUnmarriedPI(profile)) {
            hits.push({
              id: Number(member.id),
              name: member.name,
              level: member.level,
              daysInFaction: member.daysInFaction,
              factionId: member.factionId,
              factionName: member.factionName,
            });
          }
        } catch {
          // skip member on network error
        }

        setState(s => ({ ...s, checked: i + 1, results: [...hits] }));
      }

      setState(s => ({ ...s, phase: "done" }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setState(s => ({ ...s, phase: "error", error: msg }));
    }
  }, [apiKey]);

  return { state, scan, cancel, reset };
}
