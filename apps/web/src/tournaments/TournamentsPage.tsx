import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildParams, MAX_LAB_LEVEL, type FightSpec, type SpecBrute } from "@mybrute/engine";
import { useLabStore, type SavedBrute } from "../lab/storage";
import { SwfPlayer } from "../swf/SwfPlayer";
import { registerEnd, swfUrl } from "../swf/ruffle";
import { useLanguage } from "../ui/language";
import { Bracket, Headshot, bracketRounds } from "./Bracket";
import { advanceTournament, createTournament, newRandomEntrant, randomEntrantId, resolveMatch, simulateMatch, standings, type Tournament, type TournamentFormat, type TournamentMatch, type TournamentEntrant } from "./model";
import { useTournamentStore, type SavedTournament } from "./storage";
import "./tournaments.css";

interface Watching { matchId: string; params: string; nonce: number; result: TournamentMatch; ended: boolean }

/** Keys of bracket ties, bracket slots and standings rows that changed between two states, used to animate new results. */
function changedKeys(before: Tournament, after: Tournament) {
  const keys = new Set<string>();
  const old = new Map(bracketRounds(before).flat().map((tie) => [tie.key, tie]));
  for (const tie of bracketRounds(after).flat()) {
    const prior = old.get(tie.key);
    if (tie.winnerId && !prior?.winnerId) keys.add(`win:${tie.key}`);
    for (const id of [tie.a, tie.b]) if (id && prior?.a !== id && prior?.b !== id) keys.add(`arrive:${tie.key}:${id}`);
  }
  const stage = (t: Tournament) => t.stage === "playoffs" ? "regular" : t.stage;
  const points = new Map(standings(before, stage(before)).map((row) => [row.entrant.id, row.points]));
  for (const row of standings(after, stage(after))) if (points.get(row.entrant.id) !== row.points) keys.add(`row:${row.entrant.id}`);
  return keys;
}

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  single: "Single elimination",
  double: "Double elimination",
  "round-robin": "Round robin league",
  mlb: "MLB-style divisions and playoffs",
  ucl: "UEFA Champions League-style",
};
const STAGE_LABELS = { main: "Bracket", regular: "League phase", playoffs: "Playoffs" } as const;
const displayLevel = (brute: SpecBrute) => brute.levelUps + 1;
const matchText = (match: TournamentMatch, entrants: TournamentEntrant[]) => {
  const a = entrants.find((entrant) => entrant.id === match.a)?.name ?? "TBD";
  const b = entrants.find((entrant) => entrant.id === match.b)?.name ?? (match.winnerId ? "Bye" : "TBD");
  return `${a} vs ${b}`;
};

export function TournamentsPage() {
  const labStore = useLabStore();
  const store = useTournamentStore();
  const { lang } = useLanguage();
  const [bench, setBench] = useState<SavedBrute[]>([]);
  const [saved, setSaved] = useState<SavedTournament[]>([]);
  const [selected, setSelected] = useState<SavedTournament | null>(null);
  const [format, setFormat] = useState<TournamentFormat>("single");
  const [name, setName] = useState("New tournament");
  const [source, setSource] = useState<"bench" | "random" | "both">("bench");
  const [mode, setMode] = useState<"individual" | "roster">("individual");
  const [checked, setChecked] = useState<string[]>([]);
  const [randomCount, setRandomCount] = useState(8);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(10);
  const [rosterSize, setRosterSize] = useState(2);
  const [divisions, setDivisions] = useState(2);
  const [gamesPerRival, setGamesPerRival] = useState(2);
  const [wildcards, setWildcards] = useState(2);
  const [uclDirect, setUclDirect] = useState(8);
  const [uclPlayoffs, setUclPlayoffs] = useState(16);
  const [createOpen, setCreateOpen] = useState(false);
  const [watching, setWatching] = useState<Watching | null>(null);
  const [viewer, setViewer] = useState(false);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [endUrl, setEndUrl] = useState("javascript:()");
  const endHandler = useRef<() => void>(() => {});
  const freshTimer = useRef<number>(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const [brutes, tournaments] = await Promise.all([labStore.listBrutes(), store.list()]);
      setBench(brutes);
      setSaved(tournaments);
      setSelected((current) => current ? tournaments.find((item) => item.key === current.key) ?? null : null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't load tournaments.");
    }
  };
  useEffect(() => { void reload(); }, [labStore, store]);
  useEffect(() => {
    const end = registerEnd(() => endHandler.current());
    setEndUrl(end.url);
    return end.dispose;
  }, []);
  useEffect(() => () => window.clearTimeout(freshTimer.current), []);

  const announce = (before: Tournament, after: Tournament) => {
    window.clearTimeout(freshTimer.current);
    setFresh(changedKeys(before, after));
    freshTimer.current = window.setTimeout(() => setFresh(new Set()), 2800);
  };

  const currentMatches = useMemo(() => selected?.tournament.matches.filter((match) => match.stage === selected.tournament.stage && match.round === selected.tournament.round) ?? [], [selected]);
  const standingsRows = selected ? standings(selected.tournament, selected.tournament.stage === "playoffs" ? "regular" : selected.tournament.stage) : [];
  const selectedBench = checked.map((key) => bench.find((item) => item.key === key)).filter((item): item is SavedBrute => !!item);
  const benchEntrants = () => {
    const brutes = selectedBench.map(({ brute }) => ({ ...structuredClone(brute), team: 0 as const }));
    if (mode === "individual") return brutes.map((brute) => ({ id: `bench-${randomEntrantId()}`, name: brute.name, seed: 0, division: 0, brutes: [brute] }));
    const result: TournamentEntrant[] = [];
    for (let i = 0; i + rosterSize <= brutes.length; i += rosterSize) {
      const roster = brutes.slice(i, i + rosterSize);
      result.push({ id: `bench-${randomEntrantId()}`, name: `Roster ${result.length + 1}`, seed: 0, division: 0, brutes: roster });
    }
    return result;
  };

  const create = async () => {
    setBusy(true);
    try {
      const checkRange = (label: string, value: number, minimum: number, maximum: number) => {
        if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}.`);
      };
      if (source !== "bench") {
        checkRange("Random entrants", randomCount, 0, 64);
        checkRange("Minimum level", minLevel, 1, MAX_LAB_LEVEL);
        checkRange("Maximum level", maxLevel, 1, MAX_LAB_LEVEL);
        if (minLevel > maxLevel) throw new Error("Minimum level can't be higher than maximum level.");
      }
      if (mode === "roster") checkRange("Roster size", rosterSize, 1, 4);
      if (format === "mlb") {
        checkRange("Divisions", divisions, 1, 8);
        checkRange("Games per division rival", gamesPerRival, 1, 4);
        checkRange("Wild cards", wildcards, 0, 8);
      }
      if (format === "ucl") {
        checkRange("Direct playoff places", uclDirect, 1, 32);
        checkRange("Playoff places", uclPlayoffs, 0, 32);
      }
      const entrants = source === "random" ? [] : benchEntrants();
      const neededRandom = source === "random" || source === "both" ? randomCount : 0;
      if (entrants.length + neededRandom < 2) throw new Error("Select at least two bench brutes or add random entrants.");
      if (entrants.length + neededRandom > 64) throw new Error("Tournaments support up to 64 entrants.");
      const ids = entrants.flatMap((entrant) => entrant.brutes.map((brute) => brute.id));
      for (let i = 0; i < neededRandom; i++) {
        const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
        const count = mode === "roster" ? rosterSize : 1;
        const entrant = newRandomEntrant(`Random ${i + 1}`, count, level - 1, ids);
        ids.push(...entrant.brutes.map((brute) => brute.id));
        entrants.push(entrant);
      }
      const tournament = createTournament({ name, format, lang, entrants, divisions, gamesPerRival, wildcards, uclDirect, uclPlayoffs });
      const item = await store.save(tournament.name, tournament);
      setSaved((all) => [item, ...all]);
      setSelected(item);
      setCreateOpen(false);
      setNotice(`Created and saved "${item.label}".`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't create the tournament.");
    } finally {
      setBusy(false);
    }
  };

  const persist = async (tournament: Tournament) => {
    if (!selected) return;
    setBusy(true);
    try {
      const item = await store.save(tournament.name, tournament, selected.key);
      announce(selected.tournament, tournament);
      setSaved((all) => all.map((old) => old.key === item.key ? item : old));
      setSelected(item);
      setNotice("Tournament progress saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't save tournament progress.");
    } finally {
      setBusy(false);
    }
  };

  const simulateRound = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const t = structuredClone(selected.tournament);
      const todo = t.matches.filter((match) => match.stage === t.stage && match.round === t.round && !match.winnerId && match.b);
      if (!todo.length) throw new Error("There are no unresolved fights in this round.");
      for (const match of todo) Object.assign(match, simulateMatch(t, match));
      const item = await store.save(t.name, t, selected.key);
      announce(selected.tournament, t);
      setSaved((all) => all.map((old) => old.key === item.key ? item : old));
      setSelected(item);
      setNotice(`Simulated ${todo.length} fights and saved the results.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't simulate this round.");
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    if (!selected) return;
    try { await persist(advanceTournament(selected.tournament)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't advance the tournament."); }
  };

  const watch = (match: TournamentMatch) => {
    if (!selected || pending) return;
    try {
      const tournament = selected.tournament;
      const played = !!match.winnerId;
      const { spec, result } = resolveMatch(tournament, match);
      const params = buildParams(spec as FightSpec, { mini: swfUrl("mini_perso.swf"), end: played ? "javascript:()" : endUrl });
      setFresh(new Set());
      setWatching({ matchId: match.id, params, nonce: Date.now(), result: played ? match : result, ended: played });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't start this fight."); }
  };

  // Records the hidden result and updates the bracket and standings. Runs when playback ends or the viewer skips ahead.
  const reveal = async () => {
    if (!selected || !watching || watching.ended) return;
    const shown = watching;
    setWatching({ ...shown, ended: true });
    setBusy(true);
    try {
      const tournament = structuredClone(selected.tournament);
      const index = tournament.matches.findIndex((entry) => entry.id === shown.matchId);
      if (index < 0 || tournament.matches[index].winnerId) return;
      tournament.matches[index] = shown.result;
      const item = await store.save(tournament.name, tournament, selected.key);
      announce(selected.tournament, tournament);
      setSaved((all) => all.map((old) => old.key === item.key ? item : old));
      setSelected(item);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't save the fight result."); }
    finally { setBusy(false); }
  };
  endHandler.current = () => void reveal();

  const remove = async (item: SavedTournament) => {
    try {
      await store.delete(item.key);
      setSaved((all) => all.filter((entry) => entry.key !== item.key));
      if (selected?.key === item.key) setSelected(null);
      setNotice(`Deleted "${item.label}".`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't delete the tournament."); }
  };

  const inputNumber = (label: string, value: number, change: (n: number) => void, min?: number, max?: number) => (
    <label>{label}<input type="number" min={min} max={max} value={value} onChange={(event) => change(Number(event.target.value))} /></label>
  );
  const activeMatches = currentMatches.filter((match) => match.b && !match.winnerId);
  const pending = !!watching && !watching.ended;
  const hasBracket = !!selected && bracketRounds(selected.tournament).length > 0;
  const nextMatch = activeMatches[0];
  const watchedMatch = watching && selected?.tournament.matches.find((match) => match.id === watching.matchId);
  const watchedA = selected?.tournament.entrants.find((entrant) => entrant.id === watchedMatch?.a);
  const watchedB = selected?.tournament.entrants.find((entrant) => entrant.id === watchedMatch?.b);
  const canAdvance = !!selected && !selected.tournament.completed && currentMatches.every((match) => match.winnerId !== null);
  const activeTitle = selected ? `${selected.tournament.name} · ${FORMAT_LABELS[selected.tournament.format]}` : "";
  const stageLabel = selected ? STAGE_LABELS[selected.tournament.stage] : "";
  const entrantLabel = (id: string) => selected?.tournament.entrants.find((entrant) => entrant.id === id)?.name ?? "—";

  return (
    <div className={"tournaments-page" + (viewer && selected ? " viewer" : "")}>
      <header className="tournaments-header">
        <div><p className="eyebrow">MYBRUTE++ · COMPETITION</p><h1>Tournaments</h1><p>Create a bracket or league from Lab bench brutes, generated brutes, or both.</p></div>
        <Link className="btn ghost" to="/lab">Open Laboratory</Link>
      </header>

      {notice && <p className="tournament-notice" role="status">{notice}<button className="link" onClick={() => setNotice(null)}>Dismiss</button></p>}

      <div className="tournament-layout">
        <aside className="tournament-sidebar panel">
          <div className="tournament-section-heading"><h2>Saved tournaments</h2><button className="btn small ghost" onClick={() => void reload()}>Refresh</button></div>
          {saved.length ? <ul className="tournament-saves">{saved.map((item) => (
            <li key={item.key} className={selected?.key === item.key ? "selected" : ""}>
              <button className="tournament-save-pick" onClick={() => { setSelected(item); setWatching(null); }}><strong>{item.label}</strong><span>{FORMAT_LABELS[item.tournament.format]}</span><small>{item.tournament.completed ? "Complete" : `${item.tournament.entrants.length} entrants · ${STAGE_LABELS[item.tournament.stage]}`}</small></button>
              <button type="button" className="link tournament-delete" aria-label={`Delete ${item.label}`} onClick={() => void remove(item)}>Delete</button>
            </li>
          ))}</ul> : <p className="hint">No saved tournaments yet.</p>}

          <details className="tournament-create" open={!selected || createOpen} onToggle={(event) => setCreateOpen(event.currentTarget.open)}>
            <summary><strong>Create tournament</strong></summary>
            <div className="tournament-form">
              <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label>
              <label>Format<select value={format} onChange={(event) => { const next = event.target.value as TournamentFormat; setFormat(next); setRandomCount(next === "ucl" ? 36 : 8); }}>{Object.entries(FORMAT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <div className="tournament-choice">
                <span>Entrants</span>
                {(["individual", "roster"] as const).map((value) => <label key={value} className="check"><input type="radio" checked={mode === value} onChange={() => setMode(value)} />{value === "individual" ? "Individual brutes" : "Rosters"}</label>)}
              </div>
              <label>Source<select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="bench">Bench brutes</option><option value="random">Random brutes</option><option value="both">Bench + random</option></select></label>
              {mode === "roster" && inputNumber("Brutes per roster", rosterSize, setRosterSize, 1, 4)}
              {(source === "random" || source === "both") && <div className="form-grid">
                {inputNumber("Random entrants", randomCount, setRandomCount, 0, 64)}
                {inputNumber("Min level", minLevel, setMinLevel)}
                {inputNumber("Max level", maxLevel, setMaxLevel)}
              </div>}
              {(source === "bench" || source === "both") && <div className="tournament-bench-picks">
                <span>Choose bench brutes {selectedBench.length ? `(${selectedBench.length} selected)` : ""}</span>
                {bench.length ? bench.map((item) => <label className="check" key={item.key}><input type="checkbox" checked={checked.includes(item.key)} onChange={() => setChecked((all) => all.includes(item.key) ? all.filter((key) => key !== item.key) : [...all, item.key])} />{item.label} · level {displayLevel(item.brute)}</label>) : <small>No saved Lab brutes found. Add brutes on the Lab bench first.</small>}
                {mode === "roster" && <small>Selected brutes are grouped into rosters in the order selected. Incomplete groups are skipped.</small>}
              </div>}
              {format === "mlb" && <div className="form-grid">{inputNumber("Divisions", divisions, setDivisions, 1, 8)}{inputNumber("Games per division rival", gamesPerRival, setGamesPerRival, 1, 4)}{inputNumber("Wild cards", wildcards, setWildcards, 0, 8)}</div>}
              {format === "ucl" && <div className="form-grid">{inputNumber("Direct playoff places", uclDirect, setUclDirect, 1, 32)}{inputNumber("Playoff places", uclPlayoffs, setUclPlayoffs, 0, 32)}<p className="hint wide">The league phase schedules up to 8 distinct opponents per entrant.</p></div>}
              <button type="button" className="btn play" disabled={busy} onClick={() => void create()}>Create &amp; save</button>
            </div>
          </details>
          <p className="tournament-save-location">Saves go to your {store.where === "account" ? "account" : "browser"}.</p>
        </aside>

        <section className="tournament-main">
          {!selected ? <div className="panel tournament-empty"><h2>Set up a competition</h2><p>Choose a format, pick brutes from the Lab bench or generate entrants at a level range, then simulate a round or watch fights one at a time.</p></div> : (
            <div className="tournament-workspace">
              <div className="tournament-left">
              <section className="panel tournament-overview">
                <div className="tournament-section-heading"><div><p className="eyebrow">{stageLabel} · {selected.tournament.completed ? "FINISHED" : `ROUND ${selected.tournament.round}`}</p><h2>{activeTitle}</h2></div><button className="btn danger" onClick={() => void remove(selected)}>Delete tournament</button></div>
                <p>{selected.tournament.entrants.length} entrants · {selected.tournament.entrants.reduce((n, entrant) => n + entrant.brutes.length, 0)} brutes · {selected.tournament.completed ? `Champion: ${entrantLabel(selected.tournament.championId ?? "")}` : "One fight per matchup; deterministic seeded results."}</p>
                {!selected.tournament.completed && <div className="row">
                  <button type="button" className="btn play" disabled={busy || pending || !activeMatches.length} onClick={() => void simulateRound()}>Simulate round ({activeMatches.length})</button>
                  <button type="button" className="btn" disabled={busy || pending || !canAdvance} onClick={() => void advance()}>{selected.tournament.stage === "regular" ? "Advance to next round" : "Advance bracket"}</button>
                </div>}
              </section>

              {hasBracket && <section className="panel tournament-bracket"><h3>{selected.tournament.format === "double" ? "Elimination rounds" : "Bracket"}</h3><Bracket tournament={selected.tournament} fresh={fresh} activeMatchId={pending ? watching?.matchId : undefined} onPlay={watch} playDisabled={busy || pending} />{selected.tournament.format === "double" && <p className="hint">Filled dots are losses; two losses eliminates an entrant. Each round pairs entrants with the same record.</p>}</section>}

              <div className="tournament-columns">
                <section className="panel">
                  <h3>{selected.tournament.stage === "playoffs" ? "Current playoff round" : "Current round"}</h3>
                  {currentMatches.length ? <ol className="tournament-matches">{currentMatches.map((match) => {
                    const winner = match.winnerId ? entrantLabel(match.winnerId) : null;
                    const live = pending && watching?.matchId === match.id;
                    return <li key={match.id} className={live ? "live" : ""}>
                      <div><strong>{matchText(match, selected.tournament.entrants)}</strong><small>{match.b ? `${selected.tournament.format === "ucl" && match.stage === "playoffs" && match.leg ? `Leg ${match.leg} · ` : ""}${live ? "In progress…" : winner ? `Winner: ${winner}` : "Not played"}` : `${entrantLabel(match.a)} advances on a bye`}</small></div>
                      {match.b && <button className="btn small ghost" disabled={busy || pending} onClick={() => watch(match)}>{winner ? "Watch again" : "Watch"}</button>}
                    </li>;
                  })}</ol> : <p className="hint">No fights scheduled for this round.</p>}
                </section>
                <section className="panel">
                  <h3>Standings</h3>
                  <ol className="tournament-standings">{standingsRows.map((row, index) => <li key={row.entrant.id} className={fresh.has(`row:${row.entrant.id}`) ? "just-scored" : ""}><b>{index + 1}.</b><span>{row.entrant.name}</span><strong>{row.points} pts</strong><small>{row.wins}W {row.losses}L · seed {row.entrant.seed}</small></li>)}</ol>
                  <p className="hint">Win = 3 points; standings ties break by wins, then seed. Bracket byes advance automatically.</p>
                </section>
              </div>
              </div>

              <aside className="panel tournament-fight" aria-label="Fight">
                <div className="tournament-section-heading">
                  <h3>Fight</h3>
                  <div className="row">
                    <button className="btn small ghost" onClick={() => setViewer((on) => !on)}>{viewer ? "Exit viewer mode" : "Viewer mode"}</button>
                    {watching && <button className="btn small ghost" onClick={() => setWatching(null)}>{pending ? "Cancel" : "Close"}</button>}
                  </div>
                </div>
                {watchedMatch ? <>
                  <div className="fight-versus">
                    {[watchedA, watchedB].map((entrant, side) => (
                      <div key={side} className={"fight-side" + (watching?.ended && watching.result.winnerId === entrant?.id ? " winner" : "") + (watching?.ended && watching.result.winnerId !== entrant?.id ? " loser" : "")}>
                        <Headshot entrant={entrant} /><strong>{entrant?.name ?? "—"}</strong>
                      </div>
                    ))}
                  </div>
                  <SwfPlayer key={watching!.nonce} swf="client.swf" params={watching!.params} label="Tournament fight playback" allowScript className="fight-swf" />
                  {pending ? <div className="fight-status"><span>Fight in progress. The result stays hidden until it ends.</span><button className="btn small" onClick={() => void reveal()}>Skip to result</button></div>
                    : <div className="fight-result" key={`result-${watching!.nonce}`}><strong>{entrantLabel(watching!.result.winnerId ?? "")} wins!</strong></div>}
                </> : <p className="hint fight-idle">Pick a fight to watch. Results are recorded in the bracket and standings only after it ends.</p>}
                {nextMatch && !pending && <button className="btn play" disabled={busy} onClick={() => watch(nextMatch)}>Watch next fight: {matchText(nextMatch, selected.tournament.entrants)}</button>}
              </aside>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
