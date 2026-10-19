// Typed views of the original modules. Types describe what the original code returns;
// they were established by reading vendor/*.js, not invented.
import { GladAPI as G } from "./generated/glad.js";
import { FightAPI as F } from "./generated/fight.js";
import { LaBrute as L } from "./generated/labrute.js";
import { FightLog as FL } from "./generated/fightlog.js";
import { Inventory as I } from "./generated/inventory.js";

/** One level-up option as returned by GladAPI.opt */
export type LevelOption =
  | { t: "c"; c0: number; c1: number | null; text: string } // caracs: +3 c0, or +2 c0 / +1 c1 (0 str, 1 agi, 2 spd, 3 life)
  | { t: "b"; kind: "Permanent" | "Super" | "Followers" | "Talent" | "Weapons"; id: string; text: string };

export interface Description {
  levels: { opts: [LevelOption, LevelOption]; bit: 0 | 1 }[];
  /** true when GladAPI's step-by-step replay agrees with the original Gladiator.setLevels */
  check: boolean;
  fin: {
    force: number; agility: number; speed: number; lifeMax: number; life: number;
    weapons: string[]; supers: string[]; followers: string[]; perms: string[]; talents: string[];
  };
}

/** A serialized enum value from FightAPI.ser */
export interface HistoryEvent { a: string; p: any[] }

export interface EngineGlad { s: number; t: number; gfx: string; lvl: number; bits: string | null; n: string }
export interface EngineInput { seed: number; glads: EngineGlad[]; p0: Record<string, unknown> | null; p1: Record<string, unknown> | null }
export interface EngineResult {
  /** winning team, or null if the Arena hit its 1000-action limit */
  win: 0 | 1 | null;
  history: HistoryEvent[];
  /** MyBrute++ patch: Arena TeamStat counters per team, in TEAM_STATS order */
  teamStats: [number[], number[]];
  achievements: [string[], string[]];
}

export const TEAM_STATS = ["DODGE", "PARADE", "DISARM", "RIPOSTE", "COUNTER", "FOL_FRAG", "DAMAGE_MAX", "STRIKE", "MISSILE_LIGHT"] as const;

export type HxNode =
  | { k: "n" | "z" | "t" | "f" }
  | { k: "i" | "d" | "y" | "s"; v: string }
  | { k: "a"; v: HxNode[] }
  | { k: "o"; v: [HxNode, HxNode][] };

export interface LabruteSession {
  info: { mini: string | null; lang: string; k: string; seed: number; arena: number };
  glads: { name: string; id: number; team: number; lvl: number; gfx: string; choices: number[] }[];
  params(): string;
  fightInput(): EngineInput;
  supports(): { team: number; id: number; lvl: number; bits: string; gfx: string }[];
}

export const GladAPI = G as { describe(id: number, levelUps: number, choices: number[]): Description };
export const FightAPI = F as { run(input: EngineInput): EngineResult };
export const LaBrute = L as {
  decode(data: string, key: string): { plain: string; ok: boolean };
  encode(plain: string, key: string): string;
  pdecode(s: string): string;
  pencode(s: string): string;
  parseHx(t: string): HxNode;
  serHx(n: HxNode): string;
  parseInput(text: string): { data: string; k: string; lang: string };
  open(text: string, opts?: { mini?: string; end?: string }): LabruteSession;
  b64enc(bytes: number[]): string;
  b64dec(s: string): number[];
  bytesToChoices(bytes: number[], n: number): number[];
  choicesToBytes(choices: number[], n: number): number[];
};
export const FightLog = FL as {
  format(history: HistoryEvent[], glads: { id: number; name: string; team: number; life: number }[]): { i: number; kind: "info" | "move" | "hit" | "miss" | "death" | "end"; text: string }[];
};
export const Inventory = I as {
  params(g: { id: number; lvl: number; choices: number[] }, opts?: { lang?: string; ownedOnly?: boolean }): string;
};
