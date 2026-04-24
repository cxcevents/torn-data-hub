export type StatKey = "strength" | "speed" | "defense" | "dexterity";

export const ENHANCERS: Array<{
  id: number;
  name: string;
  colorClass: string;
  textClass: string;
  borderClass: string;
  boost: string;
  stat: StatKey;
  bonusPct: number;
}> = [
  {
    id: 463,
    name: "Epinephrine",
    colorClass: "bg-amber-500",
    textClass: "text-amber-500",
    borderClass: "border-amber-500",
    boost: "+500% Strength",
    stat: "strength",
    bonusPct: 500,
  },
  {
    id: 464,
    name: "Melatonin",
    colorClass: "bg-sky-500",
    textClass: "text-sky-500",
    borderClass: "border-sky-500",
    boost: "+500% Speed",
    stat: "speed",
    bonusPct: 500,
  },
  {
    id: 465,
    name: "Serotonin",
    colorClass: "bg-emerald-500",
    textClass: "text-emerald-500",
    borderClass: "border-emerald-500",
    boost: "+300% Defense (+25% Life)",
    stat: "defense",
    bonusPct: 300,
  },
  {
    id: 814,
    name: "Tyrosine",
    colorClass: "bg-violet-500",
    textClass: "text-violet-500",
    borderClass: "border-violet-500",
    boost: "+500% Dexterity",
    stat: "dexterity",
    bonusPct: 500,
  }
];

export const ENHANCER_DURATION_SECONDS = 120;
