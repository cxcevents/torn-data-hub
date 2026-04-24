import { useQuery } from "@tanstack/react-query";

export interface LogEntry {
  log: number;
  title: string;
  timestamp: number;
  category: string;
  data: {
    item?: number;
    [key: string]: any;
  };
  params: any;
}

export interface LogResponse {
  error?: { code: number; error: string };
  log?: Record<string, LogEntry>;
}

export function useEnhancerLog(apiKey: string | null) {
  return useQuery({
    queryKey: ["torn", "log", "enhancers-v2", apiKey ? apiKey.substring(0, 4) + "***" : "none"],
    queryFn: async () => {
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
      
      return data.log || {};
    },
    enabled: !!apiKey,
    refetchInterval: 15000,
    staleTime: 5000,
    retry: false,
  });
}
