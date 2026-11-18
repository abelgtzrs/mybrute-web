// Mobile Lab: the fight in the original client, with the action log, statistics and achievements as tabs under it.
import { useEffect, useState } from "react";
import { SwfPlayer } from "../../swf/SwfPlayer";
import { Achievements, ActionLog } from "../ArenaPanel";
import { StatsPanel } from "../StatsPanel";
import type { Lab } from "../useLab";

type Tab = "log" | "stats" | "achievements";
const TABS: [Tab, string][] = [
  ["log", "Action log"],
  ["stats", "Statistics"],
  ["achievements", "Achievements"],
];

export function FightScreen({ lab }: { lab: Lab }) {
  const { spec, sim, errors, playback } = lab;
  const [tab, setTab] = useState<Tab>("log");
  // Expand covers the whole screen with the stage. Only a class changes, so the player (and the fight) keeps running.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [expanded]);
  const stale = playback !== null && playback.snapshot !== JSON.stringify(spec);
  const runnable = errors.length === 0 && sim;

  return (
    <div className="mfight">
      <div className={"mfight-stage-wrap" + (expanded ? " expanded" : "")}>
        <div className="stage mfight-stage">
          {playback && (
            <button type="button" className="stage-expand" aria-pressed={expanded} onClick={() => setExpanded((x) => !x)}>
              {expanded ? "✕ Close" : "⤢ Expand"}
            </button>
          )}
          {playback ? (
            <SwfPlayer key={playback.nonce} swf="client.swf" params={playback.params} label="Fight playback" allowScript className="fight-swf" />
          ) : (
            <div className="stage-empty">
              <p>Press Play to watch this fight in the original Flash client.</p>
              <button type="button" className="btn play" disabled={errors.length > 0} onClick={lab.play}>Play fight</button>
            </div>
          )}
        </div>
      </div>
      {stale && (
        <p className="notice">
          You've changed the fight since it started playing.{" "}
          <button type="button" className="link" onClick={lab.play}>Play the new version</button>
        </p>
      )}
      {playback?.ended && !stale && <p className="notice quiet">Playback finished. <button type="button" className="link" onClick={lab.play}>Replay</button></p>}
      {errors.length > 0 && (
        <div className="problems" role="alert">
          <h3>Fix these before the fight can run</h3>
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="arena-tabs mfight-tabs" role="tablist" aria-label="Fight details">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" id={`mfight-tab-${key}`} aria-selected={tab === key} aria-controls={`mfight-view-${key}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel mfight-view" role="tabpanel" id={`mfight-view-${tab}`} aria-labelledby={`mfight-tab-${tab}`}>
        {tab === "log" && (runnable ? <ActionLog spec={spec} descs={lab.descs} sim={sim} notify={lab.notify} /> : <p className="muted">The action log appears once the fight can run.</p>)}
        {tab === "stats" && <StatsPanel spec={spec} sim={sim} stats={lab.stats} pets={lab.pets} errors={errors} />}
        {tab === "achievements" && (runnable ? <Achievements spec={spec} sim={sim} /> : <p className="muted">Achievements appear once the fight can run.</p>)}
      </div>
    </div>
  );
}
