// Combat statistics derived from the original Arena history (fight.js) and the patched-in TeamStat counters.
// Only values the events state unambiguously are counted. Not derivable, deliberately left out:
//  - Bomb and Downpour damage per target (the events don't say who was hit), so they're counted as uses only.
//  - Kill credit (Death has no killer), so we count enemies that went down while this brute's team fought.
// Death can be emitted more than once for the same fighter; each fighter is counted once.
// Followers are attributed to their team; in 1v1 (Classic) that is exactly the brute that owns them.
// A hypnotized follower switches to the hypnotist's team (Hypno event) and is attributed accordingly.
import { TEAM_STATS, type EngineResult, type HistoryEvent } from "./vendor";

export interface FighterStats {
  id: number;
  team: 0 | 1;
  result: "win" | "loss" | "draw";
  attacks: number;
  hits: number;
  /** damage this brute dealt itself (melee, thrown weapons, grabs) */
  damageDealt: number;
  /** damage dealt by this brute's pets (its team's followers) */
  petDamageDealt: number;
  /** damageDealt + petDamageDealt */
  totalDamageDealt: number;
  damageReceived: number;
  poisonDamageReceived: number;
  petDamageReceived: number;
  highestHit: number;
  attacksDodgedByOpponent: number;
  attacksBlockedByOpponent: number;
  dodges: number;
  blocks: number;
  weaponsDrawn: number;
  weaponsUsed: string[];
  weaponsThrown: number;
  weaponsTrashed: number;
  disarms: number;
  timesDisarmed: number;
  weaponsDestroyed: number;
  shieldsBroken: number;
  steals: number;
  nets: number;
  grabs: number;
  hypnosis: number;
  bombs: number;
  downpours: number;
  potions: number;
  meals: number;
  lifeRestored: number;
  petsKilled: number;
  petsLost: number;
  enemyBrutesDown: number;
  died: boolean;
  /** Arena TeamStat counters for this brute's team (followers excluded by the engine). Exact per brute in 1v1. */
  teamCounters: Record<(typeof TEAM_STATS)[number], number>;
  /** true when several brutes share the team, so team counters and pet stats are shared */
  teamShared: boolean;
}

const zero = (id: number, team: 0 | 1): Omit<FighterStats, "teamCounters" | "teamShared"> => ({
  id, team, result: "draw", attacks: 0, hits: 0, damageDealt: 0, petDamageDealt: 0, totalDamageDealt: 0,
  damageReceived: 0, poisonDamageReceived: 0, petDamageReceived: 0, highestHit: 0, attacksDodgedByOpponent: 0,
  attacksBlockedByOpponent: 0, dodges: 0, blocks: 0, weaponsDrawn: 0, weaponsUsed: [], weaponsThrown: 0,
  weaponsTrashed: 0, disarms: 0, timesDisarmed: 0, weaponsDestroyed: 0, shieldsBroken: 0, steals: 0, nets: 0,
  grabs: 0, hypnosis: 0, bombs: 0, downpours: 0, potions: 0, meals: 0, lifeRestored: 0, petsKilled: 0, petsLost: 0,
  enemyBrutesDown: 0, died: false,
});

const enumName = (v: unknown) => (v && typeof v === "object" && "a" in (v as object) ? String((v as HistoryEvent).a) : String(v));

/** Stats for every brute (not follower) in the fight, keyed by brute id. */
export function extractStats(result: EngineResult): Map<number, FighterStats> {
  const brutes = new Map<number, 0 | 1>();
  const pets = new Map<number, 0 | 1>();
  for (const e of result.history) {
    if (e.a === "AddFighter") brutes.set(e.p[0], e.p[1] === 1 ? 1 : 0);
    if (e.a === "AddFollower") pets.set(e.p[0], e.p[1] === 1 ? 1 : 0);
  }
  const perTeam = [0, 1].map((t) => [...brutes.values()].filter((x) => x === t).length);
  const out = new Map<number, ReturnType<typeof zero>>();
  for (const [id, team] of brutes) out.set(id, zero(id, team));

  const forBrute = (id: number) => out.get(id);
  const forPetOwners = (petId: number) => [...out.values()].filter((s) => s.team === pets.get(petId));
  const used = new Map<number, Set<string>>();
  const dead = new Set<number>();

  const dealt = (aid: number, tid: number, d: number) => {
    if (d <= 0) return;
    const a = forBrute(aid);
    if (a) { a.damageDealt += d; a.highestHit = Math.max(a.highestHit, d); }
    if (pets.has(aid)) forPetOwners(aid).forEach((s) => (s.petDamageDealt += d));
    const t = forBrute(tid);
    if (t) t.damageReceived += d;
    if (pets.has(tid)) forPetOwners(tid).forEach((s) => (s.petDamageReceived += d));
  };

  for (const { a: kind, p } of result.history) {
    switch (kind) {
      case "Attack": {
        const [aid, tid, d, sab, dis, disShield, disAtt] = p;
        const a = forBrute(aid), t = forBrute(tid);
        if (a) {
          a.attacks++;
          if (d > 0) a.hits++; else if (d < 0) a.attacksDodgedByOpponent++; else a.attacksBlockedByOpponent++;
          if (sab) a.weaponsDestroyed++;
          if (dis) a.disarms++;
          if (disShield) a.shieldsBroken++;
          if (disAtt) a.timesDisarmed++;
        }
        if (t) {
          if (d < 0) t.dodges++; else if (d === 0) t.blocks++;
          if (dis) t.timesDisarmed++;
        }
        dealt(aid, tid, d);
        break;
      }
      case "ThrowAttack": { const a = forBrute(p[0]); if (a) a.weaponsThrown++; dealt(p[0], p[1], p[2]); break; }
      case "Grab": { const a = forBrute(p[0]); if (a) a.grabs++; dealt(p[0], p[1], p[2]); break; }
      case "Weapon": {
        const a = forBrute(p[0]);
        if (a) { a.weaponsDrawn++; if (!used.has(p[0])) used.set(p[0], new Set()); used.get(p[0])!.add(enumName(p[1])); }
        break;
      }
      case "Trash": { const a = forBrute(p[0]); if (a) a.weaponsTrashed++; break; }
      case "Steal": { const a = forBrute(p[0]); if (a) a.steals++; break; }
      case "Net": { const a = forBrute(p[0]); if (a) a.nets++; break; }
      case "Hypno": {
        // hypnotized followers change sides: later damage by/to them belongs to the hypnotist's team
        const a = forBrute(p[0]);
        if (a) a.hypnosis++;
        const side = brutes.get(p[0]) ?? pets.get(p[0]);
        if (side !== undefined) for (const id of p[1] as number[]) if (pets.has(id)) pets.set(id, side);
        break;
      }
      case "Bomb": { const a = forBrute(p[0]); if (a) a.bombs++; break; }
      case "Downpour": { const a = forBrute(p[0]); if (a) a.downpours++; break; }
      case "Medecine": { const a = forBrute(p[0]); if (a) { a.potions++; a.lifeRestored += p[1]; } break; }
      case "Eat": { const a = forBrute(p[0]); if (a) { a.meals++; a.lifeRestored += p[1]; } break; }
      case "Poison": { const a = forBrute(p[0]); if (a) { a.poisonDamageReceived += p[1]; a.damageReceived += p[1]; } break; }
      case "Death": {
        const id = p[0];
        if (dead.has(id)) break;
        dead.add(id);
        if (pets.has(id)) {
          const team = pets.get(id)!;
          for (const s of out.values()) { if (s.team === team) s.petsLost++; else s.petsKilled++; }
        } else if (brutes.has(id)) {
          const team = brutes.get(id)!;
          out.get(id)!.died = true;
          for (const s of out.values()) if (s.team !== team) s.enemyBrutesDown++;
        }
        break;
      }
    }
  }

  const final = new Map<number, FighterStats>();
  for (const s of out.values()) {
    const counters = Object.fromEntries(TEAM_STATS.map((k, i) => [k, result.teamStats?.[s.team]?.[i] ?? 0])) as FighterStats["teamCounters"];
    final.set(s.id, {
      ...s,
      result: result.win === null ? "draw" : result.win === s.team ? "win" : "loss",
      totalDamageDealt: s.damageDealt + s.petDamageDealt,
      weaponsUsed: [...(used.get(s.id) ?? [])],
      teamCounters: counters,
      teamShared: perTeam[s.team] > 1,
    } as FighterStats);
  }
  return final;
}
