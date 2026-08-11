// Curated "how to earn this" guidance keyed by award category.

import type { AwardCatalogEntry } from "./awards";

const HONOR_TIPS: Record<string, string> = {
  crimes:
    "Grind Crimes 2.0 in the Crimes tab. Each offense category has its own counter, so focus your nerve on the specific crime the honor needs. Crime skill rises as you commit crimes, unlocking better outcomes — spend nerve as soon as it fills, and use Xanax carefully if you want extra nerve (watch addiction). Merits in Crime XP and the Criminal Record education courses speed this up.",
  gym: "Train the specific stat in the gym with every energy bar. Use Xanax/energy cans on stacking days, book Sports Science education for gym gains, and pick a specialist gym that favors your target stat once unlocked. Happy stacking (candy/e-cans before a big train) multiplies gains.",
  travel:
    "Fly with an airstrip, WLT job special, or business-class ticket to cut flight times. Buy 5–19 plushies/flowers each trip so travel also earns money. Argentina and Mexico are the shortest flights — great for racking up trip counts cheaply.",
  drugs:
    "Use the specific drug listed. Cannabis is the cheapest and safest to chain for count-based honors. Space doses around addiction — rehab in Switzerland when your gym gains drop. For 'overdose' honors, note that ODs have real downsides (hospital time, stat loss for some drugs).",
  missions:
    "Run missions from the Missions tab. Duke's early missions are quick, and higher difficulty contracts pay more mission credits. Do a couple of contracts every week and the credit/contract totals accumulate steadily.",
  attacking:
    "Pick weak targets (see the Leveling Targets tool) and chain attacks when your faction runs chains. Stealth attacks, critical hits and rounds fired all accumulate naturally — equip the relevant weapon type if the honor needs specific finishing hits.",
  weapons:
    "Finishing hits only count with the weapon type listed — equip it as your primary/secondary/melee/temp and land the killing blow. Farm easy targets so you control the finishing hit.",
  camo: "Win attacks — any wins count. Use the Leveling Targets tool to find easy, inactive targets and grind wins whenever you have energy left over from training.",
  jail: "Busting: try busting players from jail (Jail page) — success scales with your bust skill, which grows with each successful bust. Start with low-time, low-level inmates. Bails cost money but count separately.",
  hospital:
    "Medical items: use blood bags/first aid kits to heal after attacks instead of waiting. Filling blood bags needs empty bags + full life. Reviving requires the Reviver ability (education + faction/company support).",
  money:
    "Bank investments just need the cash — invest at the city bank and let it sit. Church donations and stock investments count cumulatively. Stock payouts come from holding benefit blocks (e.g. TCB) long-term.",
  items:
    "City finds: click around the city map daily (or use the map item finder). Dump finds: search the dump when energy is spare. Bazaar customers grow by listing cheap, high-demand items (flowers, plushies, drugs).",
  education:
    "Queue every class in the listed field at the education page. Courses run in real time even while you're offline — always keep one running. Bachelor's-length fields take months, so start early.",
  level: "Level up by gaining XP from attacks — hospitalize wins give the most. Keep attacking targets near or above your level (see Leveling Targets) and your level will climb.",
  casino:
    "Casino honors are mostly luck or grind. Spin/roll with spare money only. High-Low streaks and poker scores take patience; lottery and slots jackpots are pure chance — buy tickets daily.",
  misc: "Check the requirement text — most misc honors come from steady daily play: job points accumulate from working, viruses need the relevant education, newspaper submissions are periodic community events.",
  competitions:
    "These come from Torn's seasonal competitions (Easter eggs, Halloween, Elimination, Mr & Ms Torn, Dog Tags…). Participate when the event runs — many just require showing up and playing.",
  commitment:
    "Time-based: stay married, log in on holidays, keep your activity streak. These arrive on their own as long as you keep playing (and stay married!).",
};

const MEDAL_TIPS: Record<string, string> = {
  crime: HONOR_TIPS.crimes,
  combat: HONOR_TIPS.attacking,
  networth:
    "Networth medals need your recorded networth to stay above the threshold for several days. Bank your cash (city bank counts), hold stocks/items — just don't spend below the line before the qualifying period ends.",
  rank: "Rank rises from a mix of level, crimes committed, and networth. Keep all three growing — level via attacking, crimes via nerve, networth via banking — and ranks unlock naturally.",
  level: HONOR_TIPS.level,
  commitment:
    "Days-played and activity medals accrue automatically — just log in regularly and keep your account active.",
  miscellaneous:
    "Check the requirement text: busts, medical items, city finds and travel medals all track the same personal stats as their honor counterparts — steady daily play gets you there.",
};

/** Returns curated guidance for an award, or null when none applies (e.g. default/event honors). */
export function getAwardTip(award: AwardCatalogEntry): string | null {
  if (award.kind === "honor") {
    if (award.category === "default") return null;
    return HONOR_TIPS[award.category] ?? null;
  }
  return MEDAL_TIPS[award.category] ?? null;
}
