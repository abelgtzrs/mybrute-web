import { newLabBrute, randomSeed, randomLabId, runFight, validateSpec, type SpecBrute } from "@mybrute/engine";

export type TournamentFormat = "single" | "double" | "round-robin" | "mlb" | "ucl";
export type TournamentStage = "main" | "regular" | "playoffs";

export interface TournamentEntrant {
  id: string;
  name: string;
  seed: number;
  division: number;
  brutes: SpecBrute[];
}

export interface TournamentMatch {
  id: string;
  tieId?: string;
  leg?: number;
  round: number;
  stage: TournamentStage;
  a: string;
  b: string | null;
  winnerId: string | null;
  winsA?: number;
  winsB?: number;
}

export interface Tournament {
  name: string;
  format: TournamentFormat;
  seed: number;
  lang: string;
  entrants: TournamentEntrant[];
  matches: TournamentMatch[];
  round: number;
  stage: TournamentStage;
  completed: boolean;
  championId: string | null;
  losses: Record<string, number>;
  playoffSeeds: Record<string, number>;
  rules: { divisions: number; gamesPerRival: number; wildcards: number; uclDirect: number; uclPlayoffs: number };
}

export interface TournamentConfig {
  name: string;
  format: TournamentFormat;
  seed?: number;
  lang?: string;
  entrants: TournamentEntrant[];
  divisions?: number;
  gamesPerRival?: number;
  wildcards?: number;
  uclDirect?: number;
  uclPlayoffs?: number;
}

const pairId = (stage: TournamentStage, round: number, index: number) => `${stage}-${round}-${index}`;
const ordered = (entrants: TournamentEntrant[], seeds?: Record<string, number>) =>
  [...entrants].sort((a, b) => (seeds?.[a.id] ?? a.seed) - (seeds?.[b.id] ?? b.seed));

function roundRobinRounds(entrants: TournamentEntrant[], games = 1, stage: TournamentStage = "main"): TournamentMatch[] {
  const teams: (TournamentEntrant | null)[] = [...entrants];
  if (teams.length % 2) teams.push(null);
  const rounds = teams.length - 1;
  const matches: TournamentMatch[] = [];
  for (let leg = 0; leg < games; leg++) {
    let rotation = [...teams];
    for (let round = 0; round < rounds; round++) {
      let index = 0;
      for (let i = 0; i < rotation.length / 2; i++) {
        const left = rotation[i];
        const right = rotation[rotation.length - 1 - i];
        if (left) matches.push({ id: pairId(stage, leg * rounds + round + 1, index++), round: leg * rounds + round + 1, stage, a: left.id, b: right?.id ?? null, winnerId: right ? null : left.id });
      }
      rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
    }
  }
  return matches;
}

/** Standard seeding order for a bracket of `size` slots: adjacent slots meet, e.g. [1,8,4,5,2,7,3,6]. */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((seed) => [seed, n + 1 - seed]);
  }
  return order;
}

/** Round 1 places seeds with `bracketOrder`; later rounds pair adjacent winners, keeping the bracket tree fixed. */
function knockoutRound(entrants: TournamentEntrant[], round: number, stage: TournamentStage, seedMap?: Record<string, number>): TournamentMatch[] {
  let slots: (TournamentEntrant | undefined)[];
  if (round === 1) {
    const seeded = ordered(entrants, seedMap);
    const size = 2 ** Math.ceil(Math.log2(seeded.length));
    slots = bracketOrder(size).map((seed) => seeded[seed - 1]);
  } else {
    slots = entrants;
  }
  const matches: TournamentMatch[] = [];
  let index = 0;
  for (let i = 0; i + 1 < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    if (!a) continue;
    const tieId = pairId(stage, round, index++);
    matches.push({ id: tieId, tieId, round, stage, a: a.id, b: b?.id ?? null, winnerId: b ? null : a.id, leg: 1 });
  }
  return matches;
}

function scheduledKnockoutRound(t: Tournament, entrants: TournamentEntrant[], round: number) {
  const firstLegs = knockoutRound(entrants, round, "playoffs", t.playoffSeeds);
  if (t.format !== "ucl" || entrants.length <= 2) return firstLegs;
  return firstLegs.flatMap((first) => first.b ? [
    { ...first, id: `${first.id}-1`, leg: 1 },
    { ...first, id: `${first.id}-2`, a: first.b, b: first.a, winnerId: null, leg: 2 },
  ] : [first]);
}

export function createTournament(config: TournamentConfig): Tournament {
  const divisions = Math.max(1, Math.min(8, Math.floor(config.divisions ?? 2), config.entrants.length));
  const entrants = config.entrants.map((entrant, i) => ({ ...entrant, seed: i + 1, division: i % divisions }));
  if (entrants.length < 2 || entrants.length > 64) throw new Error("A tournament needs between 2 and 64 entrants.");
  if (entrants.some((e) => e.brutes.length < 1 || e.brutes.length > 4)) throw new Error("Each entrant needs 1 to 4 brutes.");
  const bruteIds = entrants.flatMap((entrant) => entrant.brutes.map((brute) => brute.id));
  if (new Set(bruteIds).size !== bruteIds.length) throw new Error("Each tournament brute must have a unique ID. Remove duplicate bench brutes.");
  const format = config.format;
  const rules = {
    divisions,
    gamesPerRival: Math.max(1, Math.min(4, Math.floor(config.gamesPerRival ?? 2))),
    wildcards: Math.max(0, Math.min(8, Math.floor(config.wildcards ?? 2))),
    uclDirect: Math.max(1, Math.floor(config.uclDirect ?? 8)),
    uclPlayoffs: Math.max(0, Math.floor(config.uclPlayoffs ?? 16)),
  };
  const tournament: Tournament = {
    name: config.name.trim().slice(0, 80) || "Tournament",
    format,
    seed: config.seed ?? randomSeed(),
    lang: config.lang ?? "en",
    entrants,
    matches: [],
    round: 1,
    stage: format === "mlb" || format === "ucl" ? "regular" : "main",
    completed: false,
    championId: null,
    losses: Object.fromEntries(entrants.map((e) => [e.id, 0])),
    playoffSeeds: {},
    rules,
  };
  switch (format) {
    case "single":
      tournament.matches = knockoutRound(entrants, 1, "main");
      break;
    case "double":
      tournament.matches = doubleEliminationRound(tournament, 1);
      break;
    case "round-robin":
      tournament.matches = roundRobinRounds(entrants);
      break;
    case "mlb": {
      const groups = Array.from({ length: divisions }, (_, d) => entrants.filter((e) => e.division === d));
      tournament.matches = groups.flatMap((group) => roundRobinRounds(group, rules.gamesPerRival, "regular"));
      break;
    }
    case "ucl":
      tournament.matches = roundRobinRounds(entrants, 1, "regular").filter((match) => match.round <= Math.min(8, entrants.length - 1));
      break;
  }
  if (tournament.matches.length > 1000) throw new Error("This schedule exceeds 1,000 fixtures. Add divisions or reduce games per division rival.");
  return tournament;
}

function doubleEliminationRound(t: Tournament, round: number): TournamentMatch[] {
  const active = ordered(t.entrants.filter((entrant) => (t.losses[entrant.id] ?? 0) < 2));
  if (active.length <= 1) return [];
  const paired = new Set<string>();
  const matches: TournamentMatch[] = [];
  const groups = [0, 1].map((losses) => active.filter((entrant) => (t.losses[entrant.id] ?? 0) === losses));
  const leftovers: TournamentEntrant[] = [];
  let index = 0;
  for (const group of groups) {
    while (group.length > 1) {
      const a = group.shift()!;
      let other = group.findIndex((b) => !paired.has([a.id, b.id].sort().join(":")));
      if (other < 0) other = 0;
      const [b] = group.splice(other, 1);
      paired.add([a.id, b.id].sort().join(":"));
      matches.push({ id: pairId("main", round, index++), round, stage: "main", a: a.id, b: b.id, winnerId: null });
    }
    if (group.length) leftovers.push(group[0]);
  }
  if (leftovers.length === 2) {
    const [a, b] = leftovers;
    matches.push({ id: pairId("main", round, index++), round, stage: "main", a: a.id, b: b.id, winnerId: null });
  } else if (leftovers.length === 1) {
    const [entrant] = leftovers;
    matches.push({ id: pairId("main", round, index), round, stage: "main", a: entrant.id, b: null, winnerId: entrant.id });
  }
  return matches;
}

export function buildMatchSpec(t: Tournament, match: TournamentMatch) {
  const a = t.entrants.find((entrant) => entrant.id === match.a);
  const b = t.entrants.find((entrant) => entrant.id === match.b);
  if (!a || !b) throw new Error("That match is missing an entrant.");
  let hash = 0;
  for (const char of match.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const seed = (t.seed + hash) % (2 ** 30);
  const spec = {
    seed,
    arena: 2,
    brutes: [...a.brutes.map((brute) => ({ ...brute, team: 0 as const })), ...b.brutes.map((brute) => ({ ...brute, team: 1 as const }))],
    p0: null,
    p1: null,
    lang: t.lang,
  };
  const errors = validateSpec(spec);
  if (errors.length) throw new Error(errors.join(" "));
  return spec;
}

/** Runs the fight and returns the result plus the spec (with the final seed) that reproduces it in the SWF player. */
export function resolveMatch(t: Tournament, match: TournamentMatch) {
  const base = buildMatchSpec(t, match);
  const a = t.entrants.find((entrant) => entrant.id === match.a)!;
  const b = t.entrants.find((entrant) => entrant.id === match.b)!;
  let win: 0 | 1 | null = null;
  let spec = base;
  for (let attempt = 0; attempt < 20 && win === null; attempt++) {
    spec = { ...base, seed: (base.seed + attempt) % (2 ** 30) };
    win = runFight(spec).win;
  }
  if (win === null) {
    spec = base;
    win = (base.seed & 1) as 0 | 1;
  }
  const result: TournamentMatch = { ...match, winnerId: win === 0 ? a.id : b.id, winsA: win === 0 ? 1 : 0, winsB: win === 1 ? 1 : 0 };
  return { spec, result };
}

export function simulateMatch(t: Tournament, match: TournamentMatch): TournamentMatch {
  return resolveMatch(t, match).result;
}

export function standings(t: Tournament, stage?: TournamentStage) {
  const stats = new Map(t.entrants.map((entrant) => [entrant.id, { entrant, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }]));
  for (const match of t.matches) {
    if (!match.b || !match.winnerId || (stage && match.stage !== stage)) continue;
    const a = stats.get(match.a)!;
    const b = stats.get(match.b)!;
    a.played++; b.played++;
    if (match.winnerId === a.entrant.id) { a.wins++; a.points += 3; b.losses++; }
    else { b.wins++; b.points += 3; a.losses++; }
  }
  const rows = [...stats.values()];
  const headToHead = (a: TournamentEntrant, b: TournamentEntrant) => {
    let score = 0;
    for (const match of t.matches) {
      if (!match.b || !match.winnerId || (stage && match.stage !== stage)) continue;
      if (match.a === a.id && match.b === b.id) score += match.winnerId === a.id ? 1 : -1;
      if (match.a === b.id && match.b === a.id) score += match.winnerId === a.id ? 1 : -1;
    }
    return score;
  };
  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins || headToHead(a.entrant, b.entrant) * -1 || a.entrant.seed - b.entrant.seed);
}

function startPlayoffs(t: Tournament, qualifiers: TournamentEntrant[]) {
  if (qualifiers.length < 2) {
    t.completed = true;
    t.championId = qualifiers[0]?.id ?? null;
    return t;
  }
  t.playoffSeeds = Object.fromEntries(qualifiers.map((entrant, index) => [entrant.id, index + 1]));
  const matches = scheduledKnockoutRound(t, qualifiers, 1);
  return { ...t, stage: "playoffs" as const, round: 1, matches: [...t.matches, ...matches] };
}

export function advanceTournament(source: Tournament): Tournament {
  const t = structuredClone(source);
  const current = t.matches.filter((match) => match.stage === t.stage && match.round === t.round);
  if (current.some((match) => match.winnerId === null)) throw new Error("Finish the current round before advancing.");
  if (t.format === "double") {
    for (const match of current) if (match.b && match.winnerId) {
      const loser = match.winnerId === match.a ? match.b : match.a;
      t.losses[loser] = (t.losses[loser] ?? 0) + 1;
    }
    const active = t.entrants.filter((entrant) => (t.losses[entrant.id] ?? 0) < 2);
    if (active.length <= 1) {
      t.completed = true;
      t.championId = active[0]?.id ?? null;
      return t;
    }
    t.round++;
    t.matches.push(...doubleEliminationRound(t, t.round));
    return t;
  }
  if (t.format === "single" || t.stage === "playoffs") {
    let winners: TournamentEntrant[];
    if (t.format === "ucl" && t.stage === "playoffs") {
      const ties = new Map<string, TournamentMatch[]>();
      for (const match of current) {
        const key = match.tieId ?? match.id;
        ties.set(key, [...(ties.get(key) ?? []), match]);
      }
      winners = [];
      for (const [tieId, legs] of ties) {
        const entrants = new Set(legs.flatMap((leg) => [leg.a, leg.b].filter((id): id is string => !!id)));
        const tally = new Map([...entrants].map((id) => [id, 0]));
        for (const leg of legs) if (leg.winnerId) tally.set(leg.winnerId, (tally.get(leg.winnerId) ?? 0) + 1);
        const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
        let winnerId: string | null | undefined = ranked[0]?.[0];
        if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
          const first = legs[0];
          if (first.b) {
            const decider: TournamentMatch = { id: `${tieId}-decider`, tieId, leg: 3, round: t.round, stage: "playoffs", a: first.a, b: first.b, winnerId: null };
            const result = simulateMatch(t, decider);
            t.matches.push(result);
            winnerId = result.winnerId;
          }
        }
        const winner = t.entrants.find((entrant) => entrant.id === winnerId);
        if (winner) winners.push(winner);
      }
    } else {
      winners = current.map((match) => t.entrants.find((entrant) => entrant.id === match.winnerId)!).filter(Boolean);
    }
    if (winners.length <= 1) {
      t.completed = true;
      t.championId = winners[0]?.id ?? null;
      return t;
    }
    t.round++;
    t.matches.push(...(t.format === "ucl" ? scheduledKnockoutRound(t, winners, t.round) : knockoutRound(winners, t.round, t.stage, t.playoffSeeds)));
    return t;
  }
  const remaining = t.matches.filter((match) => match.stage === t.stage && match.winnerId === null);
  if (remaining.length) {
    t.round = Math.min(...remaining.map((match) => match.round));
    return t;
  }
  if (t.format === "mlb" && t.stage === "regular") {
    const ranked = standings(t, "regular");
    const divisionWinnerIds = new Set(Array.from({ length: t.rules.divisions }, (_, division) => ranked.find((row) => row.entrant.division === division)?.entrant.id).filter((id): id is string => !!id));
    const divisionWinners = ranked.filter((row) => divisionWinnerIds.has(row.entrant.id)).map((row) => row.entrant);
    const wildcards = ranked.filter((row) => !divisionWinners.some((winner) => winner.id === row.entrant.id)).slice(0, t.rules.wildcards).map((row) => row.entrant);
    return startPlayoffs(t, ordered([...divisionWinners, ...wildcards]));
  }
  if (t.format === "ucl" && t.stage === "regular") {
    const ranked = standings(t, "regular");
    const entrants = ranked.map((row) => row.entrant);
    const directCount = Math.min(t.rules.uclDirect, Math.max(1, Math.floor(entrants.length / 2)));
    const direct = entrants.slice(0, directCount);
    const playoffCount = Math.floor(Math.min(t.rules.uclPlayoffs, entrants.length - direct.length) / 2) * 2;
    const qualifiers = [...direct, ...entrants.slice(direct.length, direct.length + playoffCount)];
    if (qualifiers.length < 2) {
      t.completed = true; t.championId = qualifiers[0]?.id ?? null; return t;
    }
    return startPlayoffs(t, qualifiers);
  }
  t.completed = true;
  t.championId = standings(t)[0]?.entrant.id ?? null;
  return t;
}

export function newRandomEntrant(name: string, rosterSize: number, levelUps: number, takenIds: number[]): TournamentEntrant {
  const used = [...takenIds];
  const brutes = Array.from({ length: rosterSize }, (_, index) => {
    const brute = newLabBrute(0, { name: rosterSize > 1 ? `${name} ${index + 1}` : name, levelUps, id: randomLabId(used), takenIds: used, randomBits: true });
    used.push(brute.id);
    return brute;
  });
  return { id: `entrant-${brutes[0].id}`, name, seed: 0, division: 0, brutes };
}

export function randomEntrantId() { return `entrant-${randomLabId()}`; }
