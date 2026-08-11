import { useQuery } from "@tanstack/react-query";
import { fetchTorn } from "@/lib/torn";
import { fetchAwardCatalog } from "@/lib/awards";
import type { AwardCatalog } from "@/lib/awards";
import type { PlayerSnapshot } from "@/lib/award-progress";

export interface MeritScoutPlayerData extends PlayerSnapshot {
  honorsAwarded: number[];
  medalsAwarded: number[];
  merits: Record<string, number>;
  name: string;
}

/** Full honors + medals catalog (localStorage-cached, mostly static). */
export function useAwardCatalog(apiKey: string | null) {
  return useQuery<AwardCatalog>({
    queryKey: ["award-catalog"],
    queryFn: () => fetchAwardCatalog(apiKey!),
    enabled: !!apiKey,
    staleTime: Infinity,
    retry: 1,
  });
}

/** Player's earned award IDs, merit allocation, and personal stats. */
export function useMeritScoutPlayer(apiKey: string | null) {
  return useQuery<MeritScoutPlayerData>({
    queryKey: ["merit-scout-player", apiKey],
    queryFn: async () => {
      const data = await fetchTorn(["profile", "honors", "medals", "merits", "personalstats"], apiKey!);
      return {
        honorsAwarded: (data.honors_awarded as number[] | undefined) ?? [],
        medalsAwarded: (data.medals_awarded as number[] | undefined) ?? [],
        merits: (data.merits as Record<string, number> | undefined) ?? {},
        personalstats: data.personalstats ?? {},
        level: data.level ?? 0,
        awards: data.awards ?? 0,
        name: data.name ?? "",
      };
    },
    enabled: !!apiKey,
    staleTime: 60_000,
    retry: false,
  });
}
