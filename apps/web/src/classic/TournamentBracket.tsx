import { memo } from "react";
import { persoParams } from "@mybrute/engine";
import { SwfPlayer } from "../swf/SwfPlayer";
import type { TournamentView } from "../api";

type Bracket = NonNullable<TournamentView["bracket"]>;

/** Name a round by how many brutes are still in it (2 = the final). */
function roundName(round: number, totalRounds: number, size: number) {
  const left = size / 2 ** (round - 1);
  return left === 2 ? "Final" : left === 4 ? "Semi-final" : left === 8 ? "Quarter-final" : `Round of ${left}`;
}

/** Idle brute cropped to the head. Lazy, so a 256-brute bracket only loads what scrolls into view. */
const Headshot = memo(function Headshot({ gfx, name }: { gfx: string; name: string }) {
  return (
    <span className="tb-head">
      <SwfPlayer swf="perso.swf" params={persoParams(gfx, { stop: true })} label={`Headshot of ${name}`} lazy transparent className="tb-head-art" />
    </span>
  );
});

/** One slot of a match: an entrant, or an empty "?" while the round before it is still hidden. */
function Slot({ bracket, index, won, lost }: { bracket: Bracket; index: number | undefined; won: boolean; lost: boolean }) {
  const who = index === undefined ? undefined : bracket.entrants[index];
  if (!who) return <div className="tb-slot tbd"><span className="tb-head empty" aria-hidden="true">?</span><span className="tb-name">?</span></div>;
  return (
    <div className={"tb-slot" + (who.isBrute ? " me" : "") + (won ? " won" : "") + (lost ? " lost" : "")}>
      <Headshot gfx={who.gfx} name={who.name} />
      <span className="tb-name">{who.name}<small>level {who.level}</small></span>
    </div>
  );
}

/** The whole bracket, one column per round. Only revealed rounds have winners; later matches show "?" slots. */
export function TournamentBracket({ bracket, totalRounds }: { bracket: Bracket; totalRounds: number }) {
  const { entrants, winners } = bracket;
  return (
    <div className="tb" role="group" aria-label="Tournament bracket">
      {Array.from({ length: totalRounds }, (_, r) => {
        // Round 1 pairs neighbouring slots; later rounds pair the winners of the round before (if revealed).
        const entrantsIn = r === 0 ? entrants.map((_, i) => i) : winners[r - 1];
        const matches = entrants.length / 2 ** (r + 1);
        return (
          <div className="tb-round" key={r}>
            <h4>{roundName(r + 1, totalRounds, entrants.length)}</h4>
            <div className="tb-ties">
              {Array.from({ length: matches }, (_, i) => {
                const pair = [entrantsIn?.[2 * i], entrantsIn?.[2 * i + 1]];
                const winner = winners[r]?.[i];
                const hasBrute = pair.some((p) => p !== undefined && entrants[p].isBrute);
                return (
                  <div className={"tb-tie" + (hasBrute ? " path" : "")} key={i}>
                    {pair.map((p, s) => <Slot key={s} bracket={bracket} index={p} won={winner !== undefined && p === winner} lost={winner !== undefined && p !== winner} />)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
