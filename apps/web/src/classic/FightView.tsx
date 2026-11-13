import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildParams, type FighterStats } from "@mybrute/engine";
import { admin as adminApi, api } from "../api";
import { swfUrl } from "../swf/ruffle";
import { SwfPlayer } from "../swf/SwfPlayer";
import { useSwfEnd } from "../swf/useSwfEnd";
import { FightPips, XpBar } from "../ui/BruteKit";
import { useApi } from "../useApi";

/**
 * Plays a recorded fight in the original client.swf. The result was decided and saved by the server
 * before this page opened; it stays hidden until playback ends (or the player skips).
 * In admin mode it plays anyone's fight, and links lead back to the admin pages instead of the player's cell.
 */
export function FightPage({ admin = false }: { admin?: boolean }) {
  const { fightId = "" } = useParams();
  const { data, error } = useApi<FightData>(() => (admin ? adminApi.fight(fightId) : api.getFight(fightId)), [fightId, admin]);
  const [revealed, setRevealed] = useState(false);
  const [take, setTake] = useState(0);
  const endUrl = useSwfEnd(() => setRevealed(true));
  const params = useMemo(
    () => (data ? buildParams(data.fight.spec, { mini: swfUrl("mini_perso.swf"), end: endUrl }) : null),
    [data, endUrl],
  );

  if (error) return <div className="page"><p className="page-status error" role="alert">{error.message} <Link to="/brutes">Back to my brutes</Link></p></div>;
  if (!data || !params) return <div className="page"><p className="page-status">Loading the fight…</p></div>;
  const { fight: f, brute: b } = data;
  const tour = f.tournament;
  const back = admin ? `/admin/brutes/${b.id}` : tour ? `/brutes/${b.id}/tournaments/${tour.id}` : `/brutes/${b.id}`;

  return (
    <div className="page fight-page">
      <header className="page-head">
        <div>
          <h1>{f.player.name} vs {f.opponent.name}</h1>
          <span className="muted">Level {f.player.level} against level {f.opponent.level}{data.owner ? `, owned by ${data.owner.username}` : ""}</span>
        </div>
        <Link to={back} className="btn ghost light">{admin ? "Back to the brute" : tour ? "Back to the tournament" : "Back to the cell"}</Link>
      </header>
      <div className="fight-layout">
        <div className="fight-stage-wrap">
          <div className="fight-stage">
            <SwfPlayer key={take} swf="client.swf" params={params} label="Fight playback" allowScript className="fight-swf" />
          </div>
        </div>
        <aside className="panel fight-side" aria-live="polite">
          {!revealed ? (
            <div className="fight-waiting">
              <p>The fight is on. The result appears when it ends.</p>
              <button type="button" className="btn ghost" onClick={() => setRevealed(true)}>Skip to the result</button>
            </div>
          ) : (
            <FightResultPanel data={data} admin={admin} onReplay={() => { setRevealed(false); setTake((t) => t + 1); }} />
          )}
        </aside>
      </div>
    </div>
  );
}

const TITLES = { win: "Victory!", loss: "Defeat", draw: "Draw" } as const;
type FightData = Awaited<ReturnType<typeof api.getFight>> & { owner?: { id: string; username: string } };

function FightResultPanel({ data, admin, onReplay }: { data: FightData; admin: boolean; onReplay: () => void }) {
  const { fight: f, brute: b } = data;
  const canFight = !admin && !b.pendingLevelUp && b.fightsLeft > 0;
  return (
    <div className="fight-result">
      <p className={`fight-verdict ${f.result}`}>{TITLES[f.result]}</p>
      {f.result === "draw" && <p className="muted small">The arena's 1000-action limit was reached.</p>}
      {f.tournament ? (
        <p>Round {f.tournament.round} of {f.tournament.totalRounds}. <Link to={`/brutes/${b.id}/tournaments/${f.tournament.id}`}>Back to the tournament</Link></p>
      ) : (
        <>
          <p className="fight-xp">+{f.xpAwarded} XP</p>
          <XpBar xp={f.xpAfter} required={f.xpRequired} />
          {f.pendingAfter && <p className="badge gold">Level-up ready</p>}
        </>
      )}
      <StatCompare you={f.playerStats} them={f.opponentStats} names={[f.player.name, f.opponent.name]} />
      <div className="fight-next">
        {!admin && b.pendingLevelUp && <Link to={`/brutes/${b.id}/level-up`} className="btn play gold">Choose your level-up</Link>}
        {canFight && <Link to={`/brutes/${b.id}/fight`} className="btn play">Fight again</Link>}
        <FightPips left={b.fightsLeft} total={b.dailyFights} />
        <span className="muted small">{b.fightsLeft} of {b.dailyFights} fights left today</span>
        <div className="row">
          <Link to={admin ? `/admin/brutes/${b.id}` : `/brutes/${b.id}`} className="btn ghost">{admin ? "Back to the brute" : "Back to the cell"}</Link>
          <button type="button" className="btn ghost" onClick={onReplay}>Watch again</button>
        </div>
      </div>
    </div>
  );
}

const ROWS: [keyof FighterStats, string][] = [
  ["totalDamageDealt", "Damage dealt"], ["petDamageDealt", "by pets"], ["highestHit", "Best hit"], ["dodges", "Dodges"],
  ["blocks", "Blocks"], ["weaponsDrawn", "Weapons drawn"], ["disarms", "Disarms"], ["petsKilled", "Pets killed"],
];

function StatCompare({ you, them, names }: { you: FighterStats; them: FighterStats; names: [string, string] }) {
  return (
    <table className="compare">
      <thead><tr><th scope="col"><span className="sr-only">Statistic</span></th><th scope="col">{names[0]}</th><th scope="col">{names[1]}</th></tr></thead>
      <tbody>
        {ROWS.map(([k, label]) => (
          <tr key={k}><th scope="row">{label}</th><td>{String(you[k])}</td><td>{String(them[k])}</td></tr>
        ))}
        <tr><th scope="row">Counters</th><td>{you.teamCounters.COUNTER}</td><td>{them.teamCounters.COUNTER}</td></tr>
      </tbody>
    </table>
  );
}
