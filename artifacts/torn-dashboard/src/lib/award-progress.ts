// Maps award requirement descriptions to personal-stat fields and computes progress.

import type { AwardCatalogEntry } from "./awards";

export interface PlayerSnapshot {
  personalstats: Record<string, number>;
  level: number;
  awards: number;
}

export interface AwardProgress {
  /** Current value toward the requirement, or null when unknown */
  current: number | null;
  target: number | null;
  /** 0–100, or null when unknown */
  percent: number | null;
  /** Which stat the progress was derived from (for transparency) */
  statLabel?: string;
}

function parseNum(s: string): number {
  return Number(s.replace(/[,$]/g, ""));
}

const DRUG_STATS: Record<string, string> = {
  cannabis: "cantaken",
  ecstasy: "exttaken",
  ketamine: "kettaken",
  lsd: "lsdtaken",
  opium: "opitaken",
  shrooms: "shrtaken",
  speed: "spetaken",
  pcp: "pcptaken",
  xanax: "xantaken",
  vicodin: "victaken",
};

const TRAVEL_STATS: Record<string, string> = {
  argentina: "argtravel",
  mexico: "mextravel",
  "united arab emirates": "dubtravel",
  hawaii: "hawtravel",
  japan: "japtravel",
  "united kingdom": "lontravel",
  "south africa": "soutravel",
  switzerland: "switravel",
  china: "chitravel",
  canada: "cantravel",
  "cayman islands": "caytravel",
};

const WEAPON_STATS: Record<string, string> = {
  mechanical: "chahits",
  "heavy artillery": "heahits",
  clubbing: "axehits",
  temporary: "grehits",
  "machine gun": "machits",
  pistol: "pishits",
  rifle: "rifhits",
  shotgun: "shohits",
  smg: "smghits",
  piercing: "piehits",
  slashing: "slahits",
};

// Crimes 2.0 offense categories present in personalstats
const CRIME_STATS: Record<string, string> = {
  theft: "theft",
  fraud: "fraud",
  counterfeiting: "counterfeiting",
  extortion: "extortion",
  vandalism: "vandalism",
  "illicit services": "illicitservices",
  "illegal production": "illegalproduction",
  computer: "cybercrime",
  cybercrime: "cybercrime",
};

const BATTLE_STATS: Record<string, string> = {
  strength: "strength",
  defense: "defense",
  speed: "speed",
  dexterity: "dexterity",
};

interface Rule {
  pattern: RegExp;
  resolve: (m: RegExpMatchArray, p: PlayerSnapshot) => { current: number; target: number; statLabel: string } | null;
}

function statRule(target: number, statKey: string, statLabel: string, p: PlayerSnapshot) {
  const current = p.personalstats[statKey];
  if (current === undefined) return null;
  return { current, target, statLabel };
}

const RULES: Rule[] = [
  // ── Crimes ──
  {
    pattern: /^Commit ([\d,]+) (.+?) (?:crimes|offen[cs]es)/i,
    resolve: (m, p) => {
      const key = CRIME_STATS[m[2].toLowerCase()];
      return key ? statRule(parseNum(m[1]), key, m[2] + " crimes", p) : null;
    },
  },
  {
    pattern: /^Achieve ([\d,]+) (.+?) crimes/i,
    resolve: (m, p) => {
      const key = CRIME_STATS[m[2].toLowerCase()];
      return key ? statRule(parseNum(m[1]), key, m[2] + " crimes", p) : null;
    },
  },
  { pattern: /^Participate in ([\d,]+) organi[sz]ed crimes/i, resolve: (m, p) => statRule(parseNum(m[1]), "organisedcrimes", "organised crimes", p) },
  { pattern: /^Commit a total of ([\d,]+) criminal offen[cs]es/i, resolve: (m, p) => statRule(parseNum(m[1]), "criminaloffenses", "criminal offenses", p) },
  // ── Attacking / combat ──
  { pattern: /^Win ([\d,]+) attacks/i, resolve: (m, p) => statRule(parseNum(m[1]), "attackswon", "attacks won", p) },
  { pattern: /^(?:Win ([\d,]+) defends|Successfully defend against ([\d,]+) attacks)/i, resolve: (m, p) => statRule(parseNum(m[1] ?? m[2]), "defendswon", "defends won", p) },
  { pattern: /^Successfully escape from ([\d,]+) foes/i, resolve: (m, p) => statRule(parseNum(m[1]), "yourunaway", "escapes", p) },
  { pattern: /^Have ([\d,]+) enemies escape/i, resolve: (m, p) => statRule(parseNum(m[1]), "theyrunaway", "enemy escapes", p) },
  { pattern: /kill streak of ([\d,]+)/i, resolve: (m, p) => statRule(parseNum(m[1]), "bestkillstreak", "best kill streak", p) },
  { pattern: /^Achieve ([\d,]+) critical hits/i, resolve: (m, p) => statRule(parseNum(m[1]), "attackcriticalhits", "critical hits", p) },
  { pattern: /^Make ([\d,]+) stealthed attacks/i, resolve: (m, p) => statRule(parseNum(m[1]), "attacksstealthed", "stealthed attacks", p) },
  { pattern: /^Fire ([\d,]+) rounds/i, resolve: (m, p) => statRule(parseNum(m[1]), "roundsfired", "rounds fired", p) },
  { pattern: /^Collect ([\d,]+) bounties/i, resolve: (m, p) => statRule(parseNum(m[1]), "bountiescollected", "bounties collected", p) },
  { pattern: /^Achieve ([\d,]+) one hit kills/i, resolve: (m, p) => statRule(parseNum(m[1]), "onehitkills", "one hit kills", p) },
  { pattern: /^Achieve an ELO (?:rating )?of ([\d,]+)/i, resolve: (m, p) => statRule(parseNum(m[1]), "elo", "ELO", p) },
  { pattern: /^Mug (?:a total of )?\$([\d,]+)/i, resolve: (m, p) => statRule(parseNum(m[1]), "moneymugged", "money mugged", p) },
  { pattern: /^Deal (?:a total of )?([\d,]+) damage/i, resolve: (m, p) => statRule(parseNum(m[1]), "attackdamage", "attack damage", p) },
  { pattern: /^Achieve ([\d,]+) finishing hits with (.+?)(?: weapons?| guns?)?s?$/i,
    resolve: (m, p) => {
      const label = m[2].toLowerCase().replace(/ weapons?$/, "").replace(/s$/, "");
      const key = WEAPON_STATS[label] ?? WEAPON_STATS[m[2].toLowerCase()];
      return key ? statRule(parseNum(m[1]), key, m[2] + " finishing hits", p) : null;
    },
  },
  // ── Jail / hospital ──
  { pattern: /^Bust ([\d,]+) people/i, resolve: (m, p) => statRule(parseNum(m[1]), "peoplebusted", "people busted", p) },
  { pattern: /^Make ([\d,]+) bails/i, resolve: (m, p) => statRule(parseNum(m[1]), "peoplebought", "bails made", p) },
  { pattern: /^Go to jail ([\d,]+) times/i, resolve: (m, p) => statRule(parseNum(m[1]), "jailed", "times jailed", p) },
  { pattern: /^Go to hospital ([\d,]+) times/i, resolve: (m, p) => statRule(parseNum(m[1]), "hospital", "times hospitalized", p) },
  { pattern: /^Use ([\d,]+) medical items/i, resolve: (m, p) => statRule(parseNum(m[1]), "medicalitemsused", "medical items used", p) },
  { pattern: /^Revive ([\d,]+) people/i, resolve: (m, p) => statRule(parseNum(m[1]), "revives", "revives", p) },
  { pattern: /^Fill ([\d,]+) empty blood bags/i, resolve: (m, p) => statRule(parseNum(m[1]), "bloodwithdrawn", "blood bags filled", p) },
  // ── Travel ──
  {
    pattern: /^Travel to (?:the )?(.+?) ([\d,]+) times/i,
    resolve: (m, p) => {
      const key = TRAVEL_STATS[m[1].toLowerCase()];
      return key ? statRule(parseNum(m[2]), key, `trips to ${m[1]}`, p) : null;
    },
  },
  { pattern: /^Travel (?:abroad )?([\d,]+) times/i, resolve: (m, p) => statRule(parseNum(m[1]), "traveltimes", "travels", p) },
  // ── Drugs ──
  {
    pattern: /^Use ([\d,]+) (.+)$/i,
    resolve: (m, p) => {
      const key = DRUG_STATS[m[2].toLowerCase()];
      return key ? statRule(parseNum(m[1]), key, `${m[2]} taken`, p) : null;
    },
  },
  // ── Gym / level ──
  {
    pattern: /^Gain ([\d,]+(?:,\d{3})*) (strength|defense|speed|dexterity)/i,
    resolve: (m, p) => statRule(parseNum(m[1]), BATTLE_STATS[m[2].toLowerCase()], m[2], p),
  },
  { pattern: /^Reach level ([\d,]+)/i, resolve: (m, p) => ({ current: p.level, target: parseNum(m[1]), statLabel: "level" }) },
  { pattern: /^Achieve ([\d,]+) skill in hunting/i, resolve: (m, p) => statRule(parseNum(m[1]), "huntingskill", "hunting skill", p) },
  // ── Money / networth ──
  { pattern: /networth value of \$([\d,]+)/i, resolve: (m, p) => statRule(parseNum(m[1]), "networth", "networth", p) },
  { pattern: /^Make an investment in the city bank of \$([\d,]+)/i, resolve: (m, p) => statRule(parseNum(m[1]), "moneyinvested", "bank investment", p) },
  { pattern: /^Receive ([\d,]+) stock payouts/i, resolve: (m, p) => statRule(parseNum(m[1]), "stockpayouts", "stock payouts", p) },
  // ── Items / city ──
  { pattern: /^Find ([\d,]+) items in the city/i, resolve: (m, p) => statRule(parseNum(m[1]), "cityfinds", "city finds", p) },
  { pattern: /^Find ([\d,]+) items in the dump/i, resolve: (m, p) => statRule(parseNum(m[1]), "dumpfinds", "dump finds", p) },
  { pattern: /^Have ([\d,]+) customers buy from your bazaar/i, resolve: (m, p) => statRule(parseNum(m[1]), "bazaarcustomers", "bazaar customers", p) },
  { pattern: /^Trash ([\d,]+) items/i, resolve: (m, p) => statRule(parseNum(m[1]), "itemsdumped", "items trashed", p) },
  { pattern: /^Win ([\d,]+) auctions/i, resolve: (m, p) => statRule(parseNum(m[1]), "auctionswon", "auctions won", p) },
  { pattern: /^Drink ([\d,]+) bottles of alcohol/i, resolve: (m, p) => statRule(parseNum(m[1]), "alcoholused", "alcohol drunk", p) },
  { pattern: /^Eat ([\d,]+) bags of candy/i, resolve: (m, p) => statRule(parseNum(m[1]), "candyused", "candy eaten", p) },
  { pattern: /^Drink ([\d,]+) cans of energy drink/i, resolve: (m, p) => statRule(parseNum(m[1]), "energydrinkused", "energy drinks", p) },
  { pattern: /^Read ([\d,]+) books/i, resolve: (m, p) => statRule(parseNum(m[1]), "booksread", "books read", p) },
  // ── Misc ──
  { pattern: /^Use ([\d,]+) job points/i, resolve: (m, p) => statRule(parseNum(m[1]), "jobpointsused", "job points used", p) },
  { pattern: /^Code ([\d,]+) viruses/i, resolve: (m, p) => statRule(parseNum(m[1]), "virusescoded", "viruses coded", p) },
  { pattern: /^Achieve ([\d,]+) total awards/i, resolve: (m, p) => ({ current: p.awards, target: parseNum(m[1]), statLabel: "awards" }) },
  { pattern: /^Earn ([\d,]+) mission credits/i, resolve: (m, p) => statRule(parseNum(m[1]), "missioncreditsearned", "mission credits", p) },
  { pattern: /^Complete ([\d,]+) contracts/i, resolve: (m, p) => statRule(parseNum(m[1]), "contractscompleted", "contracts completed", p) },
  { pattern: /^Complete ([\d,]+) missions/i, resolve: (m, p) => statRule(parseNum(m[1]), "missionscompleted", "missions completed", p) },
  { pattern: /^Win ([\d,]+) races/i, resolve: (m, p) => statRule(parseNum(m[1]), "raceswon", "races won", p) },
  { pattern: /^Enter ([\d,]+) races/i, resolve: (m, p) => statRule(parseNum(m[1]), "racesentered", "races entered", p) },
  {
    pattern: /^Achieve ([\d,]+) hours of activity/i,
    resolve: (m, p) => {
      const secs = p.personalstats["useractivity"];
      if (secs === undefined) return null;
      return { current: Math.floor(secs / 3600), target: parseNum(m[1]), statLabel: "hours active" };
    },
  },
];

/** Compute progress for an incomplete award. Returns null-filled progress when no mapping exists. */
export function computeAwardProgress(award: AwardCatalogEntry, player: PlayerSnapshot): AwardProgress {
  // Legacy Crimes 1.0 honors count against retired counters — current stats would overstate progress.
  if (award.legacyCrimes) return { current: null, target: null, percent: null };
  for (const rule of RULES) {
    const m = award.description.match(rule.pattern);
    if (!m) continue;
    const resolved = rule.resolve(m, player);
    if (!resolved) continue;
    const { current, target, statLabel } = resolved;
    if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) continue;
    return {
      current,
      target,
      percent: Math.min(100, (current / target) * 100),
      statLabel,
    };
  }
  return { current: null, target: null, percent: null };
}
