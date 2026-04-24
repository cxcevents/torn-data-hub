import { useQuery } from "@tanstack/react-query";
import { fetchTorn } from "@/lib/torn";

export const TORN_SELECTIONS = [
  "profile",
  "bars",
  "cooldowns",
  "money",
  "travel",
  "education",
  "perks",
  "events",
  "messages",
  "notifications",
  "personalstats",
  "networth",
  "battlestats",
  "workstats",
  "jobpoints",
  "medals",
  "merits",
  "refills",
  "newevents",
  "newmessages",
];

const FALLBACK_SELECTIONS = [
  "profile",
  "bars",
  "cooldowns",
  "travel",
  "education",
  "events",
  "messages",
  "notifications",
  "personalstats",
  "merits",
  "refills",
  "newevents",
  "newmessages",
];

export function useTornUser(apiKey: string | null) {
  return useQuery({
    queryKey: ["torn-user", apiKey],
    queryFn: async () => {
      if (!apiKey) throw new Error("No API key provided");
      try {
        return await fetchTorn(TORN_SELECTIONS, apiKey);
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes("wrong") || err?.message?.toLowerCase().includes("field")) {
          return await fetchTorn(FALLBACK_SELECTIONS, apiKey);
        }
        throw err;
      }
    },
    enabled: !!apiKey,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false,
  });
}
