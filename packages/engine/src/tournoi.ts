// Flashvars for the original tournoi.swf (rebuilt in tools/tournoi). The SWF takes a plain,
// unencrypted Haxe-serialized TournamentData in the `data` flashvar.
import { LaBrute, type HxNode } from "./vendor";
import { plainToHx, toBytes } from "./payload";

export interface TournoiEntrant { name: string; level: number; gfx: string; isBrute: boolean }
export interface TournoiBracket { entrants: TournoiEntrant[]; winners: number[][] }
export interface TournoiOptions { perso: string; fightPrefix: string; user: string; league: number }

/** Stage size. Mirrors tools/tournoi/src/Tournoi.hx init(): every doubling past 64 adds 160px of width. */
export function tournoiSize(size: number): { width: number; height: number } {
  const extra = Math.max(0, Math.log2(size) - 6);
  return { width: 800 + 160 * extra, height: extra === 0 ? 600 : 20 + (size / 4) * 36 };
}

export function tournoiParams(bracket: TournoiBracket, opts: TournoiOptions): string {
  // _m = wins shown so far. `winners` is already cut to revealed rounds, so counting is all we do (no spoilers).
  const wins = new Map<number, number>();
  for (const round of bracket.winners) for (const slot of round) wins.set(slot, (wins.get(slot) ?? 0) + 1);

  const glads = bracket.entrants.map((e, i) => ({
    _id: i, _gfx: e.gfx, _lvl: e.level, _n: toBytes(e.name), _u: e.isBrute ? toBytes(opts.user) : "", _m: wins.get(i) ?? 0,
  }));
  const data = {
    _glads: glads, _perso: opts.perso, _fight: opts.fightPrefix, _view: null,
    _user: toBytes(opts.user), _league: opts.league, _max: bracket.entrants.length,
  };
  return "data=" + encodeURIComponent(LaBrute.serHx(plainToHx(data) as HxNode));
}
