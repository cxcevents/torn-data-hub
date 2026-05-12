import { useState, useRef, useCallback } from "react";
import FALLBACK_DATA from "@/lib/baldr-data.json";

const DATA_URL =
  "https://raw.githubusercontent.com/OranWeb/tc-baldrs-levelling-list/master/data.json";

interface BaldrEntry {
  name: string;
  id: string;
  lvl: string;
  total: string;
  str: string;
  def: string;
  spd: string;
  dex: string;
}

type BaldrData = Record<string, BaldrEntry[]>;

export const LIST_NAMES = Object.keys(FALLBACK_DATA) as string[];

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
  totalStats: number;
  str: number;
  def: number;
  spd: number;
  dex: number;
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

function parseStatNum(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function entryToTarget(e: BaldrEntry): LevelingTarget {
  return {
    id: parseInt(e.id, 10),
    name: e.name,
    level: parseInt(e.lvl, 10) || 0,
    totalStats: parseStatNum(e.total),
    str: parseStatNum(e.str),
    def: parseStatNum(e.def),
    spd: parseStatNum(e.spd),
    dex: parseStatNum(e.dex),
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
            } else {
              data = FALLBACK_DATA as unknown as BaldrData;
            }
          } catch {
            data = FALLBACK_DATA as unknown as BaldrData;
          }
          dataRef.current = data;
        }

        if (cancelledRef.current) {
          setState((s) => ({ ...s, phase: "done" }));
          return;
        }

        const entries: BaldrEntry[] = data[listName] ?? [];
        if (entries.length === 0) {
          setState((s) => ({
            ...s,
            phase: "error",
            error: `No players found in "${listName}".`,
          }));
          return;
        }

        const targets: LevelingTarget[] = entries.map(entryToTarget);
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
              `https://api.torn.com/user/${targets[i].id}?selections=profile&key=${apiKey}`
            );
            const profile = await res.json();

            if (!profile.error) {
              targets[i] = {
                ...targets[i],
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
    [apiKey]
  );

  return { state, fetchList, cancel, reset };
}
