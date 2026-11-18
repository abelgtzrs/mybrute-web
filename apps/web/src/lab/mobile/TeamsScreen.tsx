// Mobile Lab: both teams, their extras (saboteur, chef, support brute) and adding brutes. Tapping a brute opens it on the Brute screen.
import { displayLevel } from "@mybrute/engine";
import { Portrait } from "../../swf/Portrait";
import { AddBrute, TeamExtras } from "../VersusBoard";
import type { Lab } from "../useLab";

export function TeamsScreen({ lab }: { lab: Lab }) {
  const { spec, descs, selected, draft, problems } = lab;
  return (
    <div className="mteams">
      {([0, 1] as const).map((team) => (
        <section key={team} className={`panel mteam team team-${team}`} aria-label={`Team ${team}`}>
          <h2 className="team-name">Team {team}</h2>
          <ul className="mteam-list">
            {spec.brutes.map((b, i) => {
              if (b.team !== team) return null;
              const f = descs[i]?.fin;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={"tile mteam-tile" + (!draft && selected === i ? " selected" : "") + (problems.has(i) ? " problem" : "")}
                    aria-pressed={!draft && selected === i}
                    onClick={() => lab.act({ type: "select", index: i })}
                  >
                    <Portrait gfx={b.gfx} name={b.name} flip={team === 1} className="tile-portrait" />
                    <span className="tile-text">
                      <span className="tile-name">{b.name || "Unnamed"}</span>
                      <span className="tile-level">Level {displayLevel(b.levelUps)} · #{b.id}</span>
                      {f && <span className="tile-stats">HP {f.life} · STR {f.force} · AGI {f.agility} · SPD {f.speed}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <TeamExtras spec={spec} team={team} dispatch={lab.dispatch} editing={draft?.kind === "support" && draft.team === team} onEdit={() => lab.editSupport(team)} />
          <AddBrute team={team} takenIds={spec.brutes.map((b) => b.id)} onAdd={(brute) => lab.act({ type: "addBrute", brute })} />
        </section>
      ))}
    </div>
  );
}
