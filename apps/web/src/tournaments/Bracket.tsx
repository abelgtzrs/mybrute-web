import { memo } from "react";
import { persoParams } from "@mybrute/engine";
import { SwfPlayer } from "../swf/SwfPlayer";
import type { Tournament, TournamentEntrant, TournamentMatch } from "./model";

export interface BracketTie {
  key: string;
  round: number;
  a: string | null;
  b: string | null;
  bye: boolean;
  winnerId: string | null;
  matchIds: string[];
  scheduled: boolean;
}

/** A close-up of an entrant's lead brute: the idle perso.swf frame, cropped to the head. */
export const Headshot = memo(function Headshot({ entrant, className }: { entrant?: TournamentEntrant; className?: string }) {
  if (!entrant) return <span className={"headshot empty " + (className ?? "")} aria-hidden="true">?</span>;
  return (
    <span className={"headshot " + (className ?? "")}>
      <SwfPlayer
        swf="perso.swf"
        params={persoParams(entrant.brutes[0].gfx, { stop: true })}
        label={`Headshot of ${entrant.name}`}
        lazy
        transparent
        className="headshot-art"
      />
    </span>
  );
});

function tieWinner(legs: TournamentMatch[]): string | null {
  if (legs.length === 1) return legs[0].winnerId;
  const decider = legs.find((leg) => leg.leg === 3);
  if (decider?.winnerId) return decider.winnerId;
  if (legs.some((leg) => !leg.winnerId)) return null;
  const tally = new Map<string, number>();
  for (const leg of legs) tally.set(leg.winnerId!, (tally.get(leg.winnerId!) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((x, y) => y[1] - x[1]);
  return ranked.length < 2 || ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
}

/** Knockout rounds as columns of ties. Single elimination and playoffs project future rounds from known winners. */
export function bracketRounds(t: Tournament): BracketTie[][] {
  const stage = t.format === "single" || t.format === "double" ? "main" : "playoffs";
  const byRound = new Map<number, Map<string, TournamentMatch[]>>();
  for (const match of t.matches) {
    if (match.stage !== stage) continue;
    const round = byRound.get(match.round) ?? new Map<string, TournamentMatch[]>();
    const key = match.tieId ?? match.id;
    round.set(key, [...(round.get(key) ?? []), match]);
    byRound.set(match.round, round);
  }
  if (!byRound.size) return [];
  const rounds: BracketTie[][] = [];
  const last = Math.max(...byRound.keys());
  const project = t.format !== "double";
  const firstCount = byRound.get(1)?.size ?? 0;
  const total = project && firstCount ? Math.max(last, Math.log2(firstCount) + 1) : last;
  for (let round = 1; round <= total; round++) {
    const real = byRound.get(round);
    if (real) {
      rounds.push([...real.entries()].map(([key, legs]) => ({
        key, round, a: legs[0].a, b: legs[0].b, bye: !legs[0].b, winnerId: tieWinner(legs), matchIds: legs.map((leg) => leg.id), scheduled: true,
      })));
    } else if (project && rounds[round - 2]) {
      const previous = rounds[round - 2];
      rounds.push(Array.from({ length: Math.floor(previous.length / 2) }, (_, i) => ({
        key: `proj-${round}-${i}`, round, a: previous[i * 2].winnerId, b: previous[i * 2 + 1].winnerId, bye: false, winnerId: null, matchIds: [], scheduled: false,
      })));
    }
  }
  return rounds.filter((round) => round.length);
}

function roundName(index: number, count: number) {
  const fromEnd = count - 1 - index;
  return fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semifinals" : fromEnd === 2 ? "Quarterfinals" : `Round ${index + 1}`;
}

export function Bracket({ tournament, fresh, activeMatchId, onPlay, playDisabled }: { tournament: Tournament; fresh: ReadonlySet<string>; activeMatchId?: string; onPlay?: (match: TournamentMatch) => void; playDisabled?: boolean }) {
  const rounds = bracketRounds(tournament);
  if (!rounds.length) return null;
  const entrant = (id: string | null) => tournament.entrants.find((item) => item.id === id);
  const double = tournament.format === "double";
  const lossesBefore = (id: string, round: number) => {
    let n = 0;
    for (const match of tournament.matches) {
      if (match.stage === "main" && match.round < round && match.b && match.winnerId && match.winnerId !== id && (match.a === id || match.b === id)) n++;
    }
    return n;
  };
  return (
    <div className="bracket" role="group" aria-label="Bracket">
      {rounds.map((ties, index) => (
        <div className="bracket-round" key={index}>
          <h4>{double ? `Round ${ties[0].round}` : roundName(index, rounds.length)}</h4>
          <div className="bracket-ties">
            {ties.map((tie) => {
              const legs = tie.matchIds.map((id) => tournament.matches.find((match) => match.id === id)).filter((match): match is TournamentMatch => !!match && !!match.b);
              const target = legs.find((match) => !match.winnerId) ?? legs[legs.length - 1];
              return (
              <div className={"bracket-tie" + (tie.matchIds.includes(activeMatchId ?? "") ? " live" : "") + (fresh.has(`win:${tie.key}`) ? " just-decided" : "")} key={tie.key}>
                {[tie.a, tie.b].map((id, slot) => {
                  const who = entrant(id);
                  const won = !!tie.winnerId && tie.winnerId === id;
                  const lost = !!tie.winnerId && !!id && tie.winnerId !== id;
                  const arrive = !!id && fresh.has(`arrive:${tie.key}:${id}`);
                  const empty = !who && !(slot === 1 && tie.bye);
                  return (
                    <div key={slot} className={"bracket-slot" + (won ? " won" : "") + (lost ? " lost" : "") + (arrive ? " arrived" : "") + (empty ? " tbd" : "")}>
                      <Headshot entrant={who} />
                      <span className="bracket-name">
                        {who ? who.name : slot === 1 && tie.bye ? "Bye" : "TBD"}
                        {who && <small>seed {who.seed}{double && id ? ` · ${"●".repeat(lossesBefore(id, tie.round))}${"○".repeat(Math.max(0, 2 - lossesBefore(id, tie.round)))}` : ""}</small>}
                      </span>
                    </div>
                  );
                })}
                {onPlay && target && <button type="button" className="btn small bracket-play" disabled={playDisabled} onClick={() => onPlay(target)} aria-label={`${target.winnerId ? "Replay" : "Play"} fight`}>{target.winnerId ? "▶ Replay" : "▶ Play"}</button>}
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
