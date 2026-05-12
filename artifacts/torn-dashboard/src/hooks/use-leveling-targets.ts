import { useState, useRef, useCallback } from "react";
import { LIST_1_FALLBACK_IDS } from "@/lib/baldr-lists";

const DATA_URL =
  "https://raw.githubusercontent.com/OranWeb/tc-baldrs-levelling-list/master/data.json";

export const LIST_NAMES = [
  "Baldr's List 1",
  "Baldr's List 2",
  "Baldr's List 3",
] as const;

export type ListName = (typeof LIST_NAMES)[number];

interface BaldrEntry {
  name?: string;
  id: string | number;
  lvl?: string;
  total?: string;
  str?: string;
  def?: string;
  spd?: string;
  dex?: string;
}

type BaldrData = Record<string, (number | BaldrEntry)[]>;

export type TargetStatus =
  | "loading"
  | "error"
  | "Okay"
  | "Hospital"
  | "Traveling"
  | "Abroad"
  | "Fallen";

export interface LevelingTarget {
  id: number;
  name: string;
  level: number;
  // Life (from Torn API)
  lifeCurrent: number;
  lifeMax: number;
  // Battle stats (from data.json spy data)
  targetTotal: number;
  targetStr: number;
  targetDef: number;
  targetSpd: number;
  targetDex: number;
  // Live status (from Torn API)
  statusState: TargetStatus;
  statusUntil: number;
  statusDescription: string;
  lastActionRelative: string;
  lastActionStatus: string;
}

export type FetchPhase = "idle" | "loading" | "fetching" | "done" | "error";

export interface LevelingState {
  phase: FetchPhase;
  total: number;
  checked: number;
  targets: LevelingTarget[];
  error: string | null;
}

const INITIAL: LevelingState = {
  phase: "idle",
  total: 0,
  checked: 0,
  targets: [],
  error: null,
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function parseStatStr(s: string | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}

function extractId(entry: number | BaldrEntry): number {
  if (typeof entry === "number") return entry;
  return parseInt(String(entry.id), 10);
}

function makeLoadingTarget(entry: number | BaldrEntry): LevelingTarget {
  const id = extractId(entry);
  const isObj = typeof entry === "object" && entry !== null;
  const e = isObj ? (entry as BaldrEntry) : null;
  return {
    id,
    name: String(id),
    level: e?.lvl ? parseInt(e.lvl, 10) || 0 : 0,
    lifeCurrent: 0,
    lifeMax: 0,
    targetTotal: parseStatStr(e?.total),
    targetStr: parseStatStr(e?.str),
    targetDef: parseStatStr(e?.def),
    targetSpd: parseStatStr(e?.spd),
    targetDex: parseStatStr(e?.dex),
    statusState: "loading",
    statusUntil: 0,
    statusDescription: "",
    lastActionRelative: "",
    lastActionStatus: "",
  };
}

export function useLevelingTargets(apiKey: string | null) {
  const [state, setState] = useState<LevelingState>(INITIAL);
  const cancelledRef = useRef(false);
  const dataRef = useRef<BaldrData | null>(null);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setState(INITIAL);
  }, []);

  const fetchList = useCallback(
    async (listName: string) => {
      if (!apiKey) return;

      cancelledRef.current = false;
      setState({ phase: "loading", total: 0, checked: 0, targets: [], error: null });

      try {
        let data = dataRef.current;
        if (!data) {
          try {
            const res = await fetch(DATA_URL);
            if (res.ok) {
              data = (await res.json()) as BaldrData;
            }
          } catch {
            // network error — use fallback below
          }
          dataRef.current = data;
        }

        if (cancelledRef.current) {
          setState((s) => ({ ...s, phase: "done" }));
          return;
        }

        let rawEntries: (number | BaldrEntry)[];
        if (data && data[listName] && data[listName].length > 0) {
          rawEntries = data[listName];
        } else if (listName === "Baldr's List 1") {
          rawEntries = LIST_1_FALLBACK_IDS;
        } else {
          setState((s) => ({
            ...s,
            phase: "error",
            error: `Could not load "${listName}" — try again or check your connection.`,
          }));
          return;
        }

        const validEntries = rawEntries.filter((e) => {
          const id = extractId(e);
          return id > 0 && isFinite(id);
        });

        if (validEntries.length === 0) {
          setState((s) => ({ ...s, phase: "error", error: "No valid player IDs found." }));
          return;
        }

        const targets: LevelingTarget[] = validEntries.map(makeLoadingTarget);
        setState({
          phase: "fetching",
          total: targets.length,
          checked: 0,
          targets: [...targets],
          error: null,
        });

        for (let i = 0; i < targets.length; i++) {
          if (cancelledRef.current) break;

          await sleep(300);
          if (cancelledRef.current) break;

          try {
            const res = await fetch(
              `https://api.torn.com/user/${targets[i].id}?selections=profile&key=${apiKey}`,
            );
            const profile = await res.json();

            if (!profile.error) {
              targets[i] = {
                ...targets[i],
                name: profile.name ?? String(targets[i].id),
                level: profile.level ?? targets[i].level,
                lifeCurrent: profile.life?.current ?? 0,
                lifeMax: profile.life?.maximum ?? 0,
                statusState: (profile.status?.state as TargetStatus) ?? "Okay",
                statusUntil: profile.status?.until ?? 0,
                statusDescription: profile.status?.description ?? "",
                lastActionRelative: profile.last_action?.relative ?? "",
                lastActionStatus: profile.last_action?.status ?? "",
              };
            } else {
              targets[i] = { ...targets[i], statusState: "error" };
            }
          } catch {
            targets[i] = { ...targets[i], statusState: "error" };
          }

          setState((s) => ({ ...s, checked: i + 1, targets: [...targets] }));
        }

        setState((s) => ({ ...s, phase: "done" }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState((s) => ({ ...s, phase: "error", error: msg }));
      }
    },
    [apiKey],
  );

  return { state, fetchList, cancel, reset };
}
