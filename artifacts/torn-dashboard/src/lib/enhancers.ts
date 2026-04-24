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
  activeBg: string;
  flashBg: string;
}> = [
  {
    id: 463,
    name: "Epinephrine",
    colorClass: "bg-orange-500",
    textClass: "text-orange-400",
    borderClass: "border-orange-500",
    boost: "+500% Strength",
    stat: "strength",
    bonusPct: 500,
    activeBg: "rgba(194, 65, 12, 0.28)",
    flashBg: "rgba(234, 88, 12, 0.55)",
  },
  {
    id: 464,
    name: "Melatonin",
    colorClass: "bg-yellow-400",
    textClass: "text-yellow-300",
    borderClass: "border-yellow-400",
    boost: "+500% Speed",
    stat: "speed",
    bonusPct: 500,
    activeBg: "rgba(161, 138, 0, 0.28)",
    flashBg: "rgba(202, 172, 0, 0.55)",
  },
  {
    id: 465,
    name: "Serotonin",
    colorClass: "bg-cyan-500",
    textClass: "text-cyan-400",
    borderClass: "border-cyan-500",
    boost: "+300% Defense (+25% Life)",
    stat: "defense",
    bonusPct: 300,
    activeBg: "rgba(6, 155, 180, 0.28)",
    flashBg: "rgba(6, 182, 212, 0.55)",
  },
  {
    id: 814,
    name: "Tyrosine",
    colorClass: "bg-violet-500",
    textClass: "text-violet-400",
    borderClass: "border-violet-500",
    boost: "+500% Dexterity",
    stat: "dexterity",
    bonusPct: 500,
    activeBg: "rgba(109, 40, 217, 0.28)",
    flashBg: "rgba(139, 92, 246, 0.55)",
  },
];

export const ENHANCER_DURATION_SECONDS = 120;
export const ENHANCER_FLASH_THRESHOLD_SECONDS = 20;
