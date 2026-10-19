import { Link } from "react-router-dom";
import type { FightListItem, FightResult } from "../api";

const LABEL: Record<FightResult, string> = { win: "Victory", loss: "Defeat", draw: "Draw" };

export function ResultBadge({ result }: { result: FightResult }) {
  return <span className={`result-badge ${result}`}>{LABEL[result]}</span>;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function FightRow({ f }: { f: FightListItem }) {
  return (
    <li className="fight-row">
      <ResultBadge result={f.result} />
      <span className="fight-row-main">
        <span>vs <strong>{f.opponent.name}</strong> <span className="muted">(level {f.opponent.level})</span></span>
        <span className="muted small">{when(f.createdAt)}, +{f.xpAwarded} XP, dealt {f.damageDealt}, took {f.damageReceived}</span>
      </span>
      <Link to={`/fights/${f.id}`} className="btn small ghost">Watch</Link>
    </li>
  );
}
