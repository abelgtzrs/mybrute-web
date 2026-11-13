// Attribute row and kit chips, shared by the Laboratory and Classic screens.
import type { BonusKind } from "@mybrute/engine";
import { useNames } from "./language";

export interface AttributeValues { strength: number; agility: number; speed: number; life: number }
export interface KitValues { weapons: string[]; supers: string[]; followers: string[]; perms: string[]; talents: string[] }

export function AttributeRow({ a, compact = false }: { a: AttributeValues; compact?: boolean }) {
  return (
    <dl className={"stat-row" + (compact ? " compact" : "")}>
      <div><dt>Strength</dt><dd>{a.strength}</dd></div>
      <div><dt>Agility</dt><dd>{a.agility}</dd></div>
      <div><dt>Speed</dt><dd>{a.speed}</dd></div>
      <div><dt>Life</dt><dd>{a.life}</dd></div>
    </dl>
  );
}

// the category names match the engine's bonus kinds, so chips and level-up options share colours
const GROUPS: [keyof KitValues, string, string][] = [
  ["weapons", "Weapons", "Weapons"], ["supers", "Supers", "Super"], ["followers", "Pets", "Followers"],
  ["perms", "Skills", "Permanent"], ["talents", "Talents", "Talent"],
];

export function KitList({ kit, hideEmpty = false }: { kit: KitValues; hideEmpty?: boolean }) {
  const { name } = useNames();
  return (
    <dl className="kit">
      {GROUPS.filter(([key]) => !hideEmpty || kit[key].length).map(([key, label, kind]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{kit[key].length ? kit[key].map((x) => <span key={x} className={`chip kind-${kind}`}>{name(kind as BonusKind, x)}</span>) : <span className="muted">None</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function XpBar({ xp, required, label = true, banked = false }: { xp: number; required: number; label?: boolean; banked?: boolean }) {
  const pct = Math.min(100, Math.round((xp / required) * 100));
  return (
    <div className="xp">
      {label && <div className="xp-label"><span>Experience</span><span>{xp} / {required} XP{banked && " (banked)"}</span></div>}
      <div className="xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={required} aria-valuenow={Math.min(xp, required)} aria-label="Experience toward the next level">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FightPips({ left, total }: { left: number; total: number }) {
  if (total > 30) return null; // admins can raise the daily limit; past this the "x of y left" text says it better
  return (
    <div className="pips" aria-label={`${left} of ${total} fights left today`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < left ? "pip on" : "pip"} />)}
    </div>
  );
}
