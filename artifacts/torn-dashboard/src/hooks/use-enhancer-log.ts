import { useQuery } from "@tanstack/react-query";

export interface LogEntry {
  log: number;
  title: string;
  timestamp: number;
  category: string;
  data: {
    item?: number | any[];
    [key: string]: any;
  };
  params: any;
}

export interface LogResponse {
  error?: { code: number; error: string };
  log?: Record<string, LogEntry>;
}

export interface EnhancerLogResult {
  log: Record<string, LogEntry>;
  lastEquippedBoosterId: number | null;
}

const ENHANCER_IDS = new Set([463, 464, 465, 814]);

export function useEnhancerLog(apiKey: string | null) {
  return useQuery({
    queryKey: ["torn", "log", "enhancers-v3", apiKey ? apiKey.substring(0, 4) + "***" : "none"],
    queryFn: async (): Promise<EnhancerLogResult> => {
      if (!apiKey) throw new Error("No API key provided");
      const url = `https://api.torn.com/user/?selections=log&key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data: LogResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.error || "Torn API Error");
      }

      const log = data.log || {};
      const entries = Object.values(log);

      // Find the most recent "Items equip" event that includes a battle enhancer.
      // In Torn, "Items equip" logs appear when the player sets up their attack
      // equipment profile. The battle enhancer slot shows which enhancer is loaded.
      const equipEvents = entries
        .filter(e => e.category === "Equipping" && Array.isArray(e.data?.item))
        .sort((a, b) => b.timestamp - a.timestamp);

      let lastEquippedBoosterId: number | null = null;
      for (const event of equipEvents) {
        const itemList = event.data.item as Array<{ id: number; uid: any; qty: number }>;
        const boosterItem = itemList.find(it => ENHANCER_IDS.has(it.id));
        if (boosterItem) {
          lastEquippedBoosterId = boosterItem.id;
          break;
        }
      }

      return { log, lastEquippedBoosterId };
    },
    enabled: !!apiKey,
    refetchInterval: 15000,
    staleTime: 5000,
    retry: false,
  });
}
