export interface TornResponse {
  error?: { code: number; error: string };
  name?: string;
  player_id?: number;
  level?: number;
  age?: number;
  last_action?: { relative: string; status: string; timestamp: number };
  status?: { description: string; state: string; color: string; until: number };
  faction?: { faction_id: number; faction_name: string; faction_tag: string; position: string; days_in_faction: number };
  life?: { current: number; maximum: number };
  gender?: string;
  signup?: string;
  profile_image?: string;
  awards?: number;
  energy?: Bar;
  nerve?: Bar;
  happy?: Bar;
  chain?: ChainBar;
  cooldowns?: { drug: number; medical: number; booster: number };
  money_onhand?: number;
  city_bank?: { amount: number; time_left: number };
  vault_amount?: number;
  points?: number;
  travel?: { destination: string; method: string; timestamp: number; departed: number; time_left: number };
  education_current?: number;
  education_timeleft?: number;
  education_completed?: number[];
  perks?: any;
  events?: Record<string, { timestamp: number; event: string }>;
  messages?: Record<string, { timestamp: number; name: string; type: string; title: string; seen: number; read: number }>;
  notifications?: { messages: number; events: number; awards: number; competition: number };
  newevents?: number;
  newmessages?: number;
  personalstats?: Record<string, number>;
  networth?: { total: number; wallet: number; bank: number; points: number; items: number; stockmarket: number; auctionhouse: number; company: number; displaycase: number; bazaar: number; properties: number; itemmarket: number; piggybank: number; pending: number; unpaidfees: number };
  strength?: number;
  defense?: number;
  speed?: number;
  dexterity?: number;
  total?: number;
  strength_modifier?: number;
  defense_modifier?: number;
  speed_modifier?: number;
  dexterity_modifier?: number;
  manual_labor?: number;
  intelligence?: number;
  endurance?: number;
  jobpoints?: { jobs: Record<string, number>; companies: Record<string, { name: string; jobpoints: number }> };
  medals_awarded?: number[];
  medals_time?: number[];
  merits?: Record<string, number>;
  refills?: { energy_refill_used: boolean; nerve_refill_used: boolean; token_refill_used: boolean; special_refill_used: boolean };
  [key: string]: any;
}

export interface Bar {
  current: number;
  maximum: number;
  increment: number;
  interval: number;
  ticktime: number;
  fulltime: number;
}

export interface ChainBar extends Bar {
  timeout: number;
  modifier: number;
  cooldown: number;
}

export const fetchTorn = async (selections: string[], key: string): Promise<TornResponse> => {
  const url = `https://api.torn.com/user/?selections=${selections.join(",")}&key=${key}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.error || "Torn API Error");
  }
  
  return data;
};
