import { useState } from "react";
import {
  GFX_LABELS, INVENTORY_LANGS, bitsToB64, bitsToHex, displayLevel, gfxParts, gfxString, hexToChoices, inventoryParams,
  isValidSeedId, levelUpsFor, randomChoices, randomLabId, BONUSES, bonusKey, isAvoided,
  type BonusKind, type Choice, type Description, type FightSpec, type SpecBrute,
} from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import { SwfPlayer } from "../swf/SwfPlayer";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import type { LabAction } from "./state";

type Tab = "levels" | "look" | "bits";
const TABS: [Tab, string][] = [["levels", "Level-ups"], ["look", "Appearance"], ["bits", "Bits"]];

interface Props {
  index: number;
  brute: SpecBrute;
  original: SpecBrute | undefined;
  desc: Description | null;
  spec: FightSpec;
  dispatch: (a: LabAction) => void;
  onSave: (b: SpecBrute) => void;
}

export function BruteEditor({ index, brute, original, desc, spec, dispatch, onSave }: Props) {
  const [tab, setTab] = useState<Tab>("levels");
  const update = (patch: Partial<SpecBrute>) => dispatch({ type: "updateBrute", index, patch });
  const otherIds = spec.brutes.filter((_, i) => i !== index).map((b) => b.id);
  const teamCount = spec.brutes.filter((b) => b.team === brute.team).length;

  return (
    <section className="editor panel" aria-label={`Editing ${brute.name}`}>
      <div className="editor-main">
      <div className="editor-top">
      <div className="editor-head">
        <Portrait gfx={brute.gfx} name={brute.name} lazy={false} className="editor-portrait" />
        <div className="editor-fields">
          <label className="name-field">
            <span className="sr-only">Name</span>
            <CommitInput value={brute.name} className="name-input" maxLength={40} onCommit={(t) => { if (!t) return "A brute needs a name."; update({ name: t }); }} />
          </label>
          <div className="form-grid">
            <label>Level
              <CommitInput value={displayLevel(brute.levelUps)} inputMode="numeric" onCommit={(t) => {
                const v = parseIntStrict(t); if (v === null || v < 1 || v > 500) return "Level is 1 to 500.";
                update({ levelUps: levelUpsFor(v) });
              }} />
            </label>
            <label className="id-field">Id
              <span className="input-with-btn">
                <CommitInput value={brute.id} inputMode="numeric" onCommit={(t) => {
                  const v = parseIntStrict(t); if (!isValidSeedId(v)) return "Id is a whole number from 1 to 2147483647.";
                  if (otherIds.includes(v)) return `Id ${v} is already in this fight.`;
                  update({ id: v });
                }} />
                <button type="button" className="btn small ghost" title="Pick a random id" onClick={() => update({ id: randomLabId(otherIds) })}>Random</button>
              </span>
            </label>
            <fieldset className="team-switch">
              <legend>Team</legend>
              {([0, 1] as const).map((t) => (
                <label key={t} className={`seg team-${t}`}>
                  <input type="radio" name={`team-${index}`} checked={brute.team === t}
                    disabled={brute.team !== t && teamCount < 2}
                    onChange={() => update({ team: t })} />
                  {t}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="row">
            <button type="button" className="btn small" onClick={() => onSave(brute)}>Save to bench</button>
            <button type="button" className="btn small ghost" disabled={!original} onClick={() => dispatch({ type: "resetBrute", index })}>Reset</button>
            <button type="button" className="btn small danger" disabled={teamCount < 2} title={teamCount < 2 ? "Each team needs at least one brute." : undefined}
              onClick={() => dispatch({ type: "removeBrute", index })}>Remove</button>
          </div>
        </div>
      </div>

      {desc && <BruteSummary desc={desc} />}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel">
        {tab === "levels" && desc && <LevelUps brute={brute} desc={desc} originalLevelUps={original?.levelUps ?? brute.levelUps} update={update} />}
        {tab === "look" && <Appearance brute={brute} update={update} />}
        {tab === "bits" && <Bits brute={brute} update={update} />}
      </div>
      </div>
      <InventoryPanel brute={brute} defaultLang={spec.lang} />
    </section>
  );
}

const pretty = (s: string) => s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

function BruteSummary({ desc }: { desc: Description }) {
  const f = desc.fin;
  // the category names match the engine's bonus kinds, so chips and level-up options share colours
  const groups: [string, string, string[]][] = [
    ["Weapons", "Weapons", f.weapons], ["Supers", "Super", f.supers], ["Pets", "Followers", f.followers],
    ["Skills", "Permanent", f.perms], ["Talents", "Talent", f.talents],
  ];
  return (
    <div className="summary">
      <dl className="stat-row">
        <div><dt>Strength</dt><dd>{f.force}</dd></div>
        <div><dt>Agility</dt><dd>{f.agility}</dd></div>
        <div><dt>Speed</dt><dd>{f.speed}</dd></div>
        <div><dt>Life</dt><dd>{f.life}</dd></div>
      </dl>
      <dl className="kit">
        {groups.map(([label, kind, items]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{items.length ? items.map((x) => <span key={x} className={`chip kind-${kind}`}>{pretty(x)}</span>) : <span className="muted">None</span>}</dd>
          </div>
        ))}
      </dl>
      {!desc.check && <p className="warning" role="alert">The step-by-step replay and the original setLevels disagree for this brute. Its stats may be wrong.</p>}
    </div>
  );
}

function LevelUps({ brute, desc, originalLevelUps, update }: { brute: SpecBrute; desc: Description; originalLevelUps: number; update: (p: Partial<SpecBrute>) => void }) {
  const avoid = new Set(brute.avoid ?? []);
  const setAll = (c: Choice[]) => update({ choices: c });
  return (
    <div>
      <AvoidRewards avoid={brute.avoid ?? []} onChange={(list) => update({ avoid: list })} />
      {!desc.levels.length ? <p className="muted">A level 1 brute has no level-ups yet. Raise its level to choose rewards.</p> : (
        <>
          <div className="row">
            <button type="button" className="btn small ghost" onClick={() => setAll(Array(brute.levelUps).fill(0))}>All first options</button>
            <button type="button" className="btn small ghost" onClick={() => setAll(Array(brute.levelUps).fill(1))}>All second options</button>
            <button type="button" className="btn small ghost" onClick={() => setAll(randomChoices(brute.levelUps))}>Random choices</button>
          </div>
          <p className="hint">Picking the second option also changes every later choice, exactly as in the original game.</p>
          <ol className="levels">
            {desc.levels.map((lv, i) => {
              const blocked = isAvoided(lv.opts[0], avoid);
              return (
                <li key={i} className={(i >= originalLevelUps ? "added" : "") + (blocked ? " blocked" : "")}>
                  <span className="lv">Lv {i + 2}</span>
                  {lv.opts.map((o, oi) => (
                    <button key={oi} type="button" aria-pressed={lv.bit === oi}
                      className={"opt" + (o.t === "b" ? ` bonus kind-${o.kind}` : "") + (oi === 0 && blocked ? " avoided" : "")}
                      disabled={oi === 0 && blocked}
                      title={oi === 0 && blocked ? "On your avoid list, so the second option is taken" : undefined}
                      onClick={() => { const c = brute.choices.slice(); c[i] = oi as Choice; update({ choices: c }); }}>
                      {o.text}
                    </button>
                  ))}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

const KIND_GROUPS: [BonusKind, string][] = [["Weapons", "Weapons"], ["Super", "Supers"], ["Followers", "Pets"], ["Permanent", "Skills"], ["Talent", "Talents"]];

/** Rewards to steer away from: when one is offered at a level-up, the second option is taken instead. */
function AvoidRewards({ avoid, onChange }: { avoid: string[]; onChange: (list: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toggle = (key: string) => onChange(avoid.includes(key) ? avoid.filter((k) => k !== key) : [...avoid, key]);
  const q = query.trim().toLowerCase();
  return (
    <section className="avoid" aria-label="Avoided rewards">
      <div className="avoid-head">
        <h4>Avoid rewards</h4>
        <span className="muted">{avoid.length ? `${avoid.length} on the list` : "None"}</span>
        <button type="button" className="btn small ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Done" : "Choose rewards"}</button>
      </div>
      {avoid.length > 0 && (
        <div className="avoid-chips">
          {avoid.map((key) => {
            const [kind, id] = key.split(":");
            return <button key={key} type="button" className={`chip removable kind-${kind}`} aria-label={`Stop avoiding ${pretty(id)}`} onClick={() => toggle(key)}>{pretty(id)} <span aria-hidden="true">×</span></button>;
          })}
          <button type="button" className="link clear-avoid" onClick={() => onChange([])}>Clear all</button>
        </div>
      )}
      {open && (
        <div className="avoid-picker">
          <input type="search" value={query} placeholder="Filter rewards" aria-label="Filter rewards" onChange={(e) => setQuery(e.target.value)} />
          {KIND_GROUPS.map(([kind, label]) => {
            const items = BONUSES.filter((b) => b.kind === kind && (!q || pretty(b.id).toLowerCase().includes(q))).sort((a, b) => pretty(a.id).localeCompare(pretty(b.id)));
            return items.length > 0 && (
              <fieldset key={kind} className="avoid-group">
                <legend>{label}</legend>
                {items.map((b) => {
                  const key = bonusKey(b.kind, b.id);
                  return <button key={key} type="button" aria-pressed={avoid.includes(key)} className={`chip toggle kind-${kind}`} onClick={() => toggle(key)}>{pretty(b.id)}</button>;
                })}
              </fieldset>
            );
          })}
        </div>
      )}
      <p className="hint">When an avoided reward is offered, the second option is taken automatically. Later offers change as a result, and they are checked too.</p>
    </section>
  );
}

function Appearance({ brute, update }: { brute: SpecBrute; update: (p: Partial<SpecBrute>) => void }) {
  const parts = gfxParts(brute.gfx);
  const setPart = (i: number, v: number) => { const p = parts.slice(); p[i] = v; update({ gfx: gfxString(p) }); };
  return (
    <div>
      <div className="row">
        <button type="button" className="btn small" onClick={() => { const p = parts.slice(); for (let i = 2; i < 16; i++) p[i] = Math.floor(Math.random() * 100); update({ gfx: gfxString(p) }); }}>Randomize look</button>
      </div>
      <div className="gfx-grid">
        {GFX_LABELS.map((label, i) => (
          <label key={label}>{label}
            <CommitInput value={parts[i]} inputMode="numeric" onCommit={(t) => { const v = parseIntStrict(t); if (v === null || v < 0) return "Use 0 or more."; setPart(i, v); }} />
          </label>
        ))}
      </div>
      <label className="wide">Appearance string
        <CommitInput value={brute.gfx} spellCheck={false} onCommit={(t) => { const s = t.replace(/\s+/g, ""); if (!/^\d+(;\d+){15}$/.test(s)) return "Use 16 numbers separated by semicolons."; update({ gfx: s }); }} />
      </label>
      <p className="hint">In fights, the Part 1 slot shows the brute's armor instead of this value.</p>
    </div>
  );
}

/** The original inventory.swf, always shown beside the editor (between stats and tabs on phones). */
function InventoryPanel({ brute, defaultLang }: { brute: SpecBrute; defaultLang: string }) {
  const [lang, setLang] = useState((INVENTORY_LANGS as readonly string[]).includes(defaultLang) ? defaultLang : "en");
  const [ownedOnly, setOwnedOnly] = useState(false);
  return (
    <aside className="editor-inventory" aria-label={`Inventory of ${brute.name}`}>
      <div className="inventory-controls">
        <label className="inline">Language
          <select value={lang} onChange={(e) => setLang(e.target.value)}>{INVENTORY_LANGS.map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <label className="check" title="Experimental: hide what this brute doesn't have">
          <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Owned only
        </label>
      </div>
      <SwfPlayer swf="inventory-transparent.swf" params={inventoryParams(brute, { lang, ownedOnly })} label={`Inventory of ${brute.name}`} className="inventory-swf" transparent />
    </aside>
  );
}

function Bits({ brute, update }: { brute: SpecBrute; update: (p: Partial<SpecBrute>) => void }) {
  return (
    <div className="bits">
      <label className="wide">Level-up bits (hex, one byte per 8 level-ups)
        <CommitInput value={bitsToHex(brute.choices, brute.levelUps)} spellCheck={false} onCommit={(t) => {
          if (t && !/^[0-9a-fA-F\s]*$/.test(t)) return "Use hex digits only.";
          update({ choices: hexToChoices(t, brute.levelUps) });
        }} />
      </label>
      <dl className="facts">
        <div><dt>Level-ups taken</dt><dd>{brute.levelUps}</dd></div>
        <div><dt>Payload form (base64)</dt><dd><code>{bitsToB64(brute.choices, brute.levelUps) || "None"}</code></dd></div>
        <div><dt>Second options picked</dt><dd>{brute.choices.filter((c) => c === 1).length}</dd></div>
      </dl>
    </div>
  );
}
