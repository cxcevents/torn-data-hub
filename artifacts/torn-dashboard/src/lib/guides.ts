// Guide definitions for the Guides section.
// Add new guides here — the Guides page picks them up automatically.

export type GuideCategory =
  | "getting-started"
  | "leveling"
  | "faction"
  | "money"
  | "drugs-boosters"
  | "combat"
  | "misc";

export type GuideAudience = "new" | "established" | "all";

export interface Guide {
  slug: string;            // unique id, used in the URL later
  title: string;
  summary: string;         // one-two sentence teaser shown on the card
  category: GuideCategory;
  audience: GuideAudience; // who it's for
  updated: string;         // ISO date, shown as "Updated ..."
  minutes?: number;        // rough read time
}

export const CATEGORIES: { id: GuideCategory; label: string }[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "leveling", label: "Leveling" },
  { id: "faction", label: "Faction" },
  { id: "money", label: "Money Making" },
  { id: "drugs-boosters", label: "Drugs & Boosters" },
  { id: "combat", label: "Combat" },
  { id: "misc", label: "Misc" },
];

export const AUDIENCES: { id: GuideAudience; label: string }[] = [
  { id: "new", label: "New players" },
  { id: "established", label: "Established players" },
  { id: "all", label: "Everyone" },
];

// ── Guides ──────────────────────────────────────────────────────────────────
// Empty for now — first guides coming soon.
export const GUIDES: Guide[] = [];
