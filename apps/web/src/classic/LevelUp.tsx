import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { LevelOption } from "@mybrute/engine";
import { api } from "../api";
import { Portrait } from "../swf/Portrait";
import { AttributeRow } from "../ui/BruteKit";
import { useApi } from "../useApi";
import { useNames } from "../ui/language";

const KIND_LABEL: Record<string, string> = { Weapons: "Weapon", Super: "Super", Followers: "Pet", Permanent: "Skill", Talent: "Talent" };
const CARACS = ["Strength", "Agility", "Speed", "Life"];

function OptionBody({ o }: { o: LevelOption }) {
  const { name } = useNames();
  if (o.t === "b") {
    return <><span className="option-kind">{KIND_LABEL[o.kind] ?? o.kind}</span><span className="option-name">{name(o.kind, o.id)}</span></>;
  }
  return (
    <>
      <span className="option-kind">Attributes</span>
      <span className="option-name">{o.c1 === null ? `+3 ${CARACS[o.c0]}` : `+2 ${CARACS[o.c0]}, +1 ${CARACS[o.c1]}`}</span>
    </>
  );
}

/** The two authentic rewards from the original progression; the player must pick one explicitly. */
export function LevelUpPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data, error } = useApi(() => api.cell(id), [id]);
  const [pick, setPick] = useState<0 | 1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  if (error) return <div className="page"><p className="page-status error" role="alert">{error.message}</p></div>;
  if (!data) return <div className="page"><p className="page-status">Loading…</p></div>;
  const b = data.brute;
  if (!data.pendingOptions) {
    return <div className="page"><p className="page-status">{b.name} has no level-up waiting. <Link to={`/brutes/${b.id}`}>Back to the cell</Link></p></div>;
  }
  const confirm = async () => {
    if (pick === null) return;
    setBusy(true); setFail(null);
    try { await api.levelUp(b.id, b.levelUps, pick); nav(`/brutes/${b.id}`, { replace: true }); }
    catch (e) { setFail((e as Error).message); setBusy(false); }
  };

  return (
    <div className="page levelup">
      <section className="panel levelup-card" aria-labelledby="lu-title">
        <Portrait gfx={b.gfx} name={b.name} lazy={false} className="levelup-portrait" />
        <div className="levelup-body">
          <h1 id="lu-title">{b.name} reaches level {b.level + 1}</h1>
          <p className="muted">Pick one reward. These two come from {b.name}'s own destiny in the original game, and the choice also shapes every later offer.</p>
          <AttributeRow a={data.attributes} compact />
          <div className="options" role="radiogroup" aria-label="Rewards">
            {data.pendingOptions.map((o, i) => (
              <button key={i} type="button" role="radio" aria-checked={pick === i}
                className={"option-card" + (o.t === "b" ? ` kind-${o.kind}` : " caracs")} onClick={() => setPick(i as 0 | 1)}>
                <OptionBody o={o} />
              </button>
            ))}
          </div>
          {fail && <p className="field-error" role="alert">{fail}</p>}
          <div className="row">
            <button type="button" className="btn play gold" disabled={pick === null || busy} onClick={confirm}>
              {pick === null ? "Pick a reward" : "Take this reward"}
            </button>
            <Link to={`/brutes/${b.id}`} className="btn ghost">Decide later</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
