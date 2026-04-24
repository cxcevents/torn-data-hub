import { useQuery } from "@tanstack/react-query";

export interface RankedWarFaction {
  name: string;
  score: number;
  chain: number;
}

export interface RankedWar {
  war: { start: number; end: number; target: number; winner: number };
  factions: Record<string, RankedWarFaction>;
}

export interface FactionData {
  ID?: number;
  name?: string;
  tag?: string;
  tag_image?: string;
  respect?: number;
  age?: number;
  capacity?: number;
  members?: Record<string, any>;
  ranked_wars?: Record<string, RankedWar>;
  error?: { code: number; error: string };
}

export function useFaction(apiKey: string | null, factionId: number | null | undefined) {
  return useQuery<FactionData>({
    queryKey: ["torn-faction", apiKey, factionId],
    queryFn: async () => {
      if (!apiKey || !factionId) throw new Error("No key or faction ID");
      const url = `https://api.torn.com/faction/${factionId}?selections=basic,ranked_wars&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network error");
      const json = await res.json();
      if (json.error) throw new Error(json.error.error || "Faction API error");
      return json;
    },
    enabled: !!apiKey && !!factionId,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: false,
  });
}
