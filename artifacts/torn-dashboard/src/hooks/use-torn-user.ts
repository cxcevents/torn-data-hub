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
  "icons",
  "newevents",
  "newmessages"
];

export function useTornUser(apiKey: string | null) {
  return useQuery({
    queryKey: ["torn-user", apiKey],
    queryFn: async () => {
      if (!apiKey) throw new Error("No API key provided");
      return fetchTorn(TORN_SELECTIONS, apiKey);
    },
    enabled: !!apiKey,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false, // Don't retry automatically on error (like invalid key)
  });
}
