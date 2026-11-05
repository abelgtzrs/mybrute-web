import { useRef, useState } from "react";
import {
  bitsToB64,
  bitsToHex,
  destiny,
  nearestIdWithStance,
  displayLevel,
  hexToChoices,
  isValidSeedId,
  levelUpsFor,
  MAX_LAB_LEVEL,
  randomChoices,
  randomLabId,
  BONUSES,
  bonusKey,
  isAvoided,
  type BonusKind,
  type Choice,
  type Description,
  type SpecBrute,
} from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import {
  InventoryControls,
  InventoryPanel,
  useInventorySettings,
} from "../ui/InventoryPanel";
import { GfxEditor } from "../ui/GfxEditor";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import { useNames } from "../ui/language";
import { exportBrute } from "./bruteCode";

type Extra = "look" | "bits";
const EXTRAS: [Extra, string][] = [
  ["look", "Appearance"],
  ["bits", "Bits"],
];
const STANCES: [number | null, string][] = [
  [null, "Normal stance"],
  [0, "Stance 0"],
  [1, "Stance 1"],
];

/** Where the editor can save a brute: back where it came from, the bench, a team, or a team's support slot. */
export type SaveTarget =
  | "origin"
  | "bench"
  | "team:0"
  | "team:1"
  | "support:0"
  | "support:1";

interface Props {
  brute: SpecBrute;
  original: SpecBrute | undefined;
  desc: Description | null;
  lang: string;
  /** what is being edited, when it isn't a brute in the fight (e.g. "Bench: Axe tank") */
  source?: string;
  /** ids the brute must not take */
  takenIds: number[];
  update: (patch: Partial<SpecBrute>) => void;
  onReset: () => void;
  /** fight brutes only: switching teams; teamCount is how many brutes share its team */
  teamCount?: number;
  /** fight brutes: remove from the fight; drafts: close the editor */
  onRemove?: () => void;
  onClose?: () => void;
  saveTargets: [SaveTarget, string][];
  onSaveTo: (target: SaveTarget, b: SpecBrute) => void;
  /** the details card's height in px, set with the divider below it; null fits the content */
  height: number | null;
  onHeight: (h: number | null) => void;
}

export function BruteEditor({
  brute,
  original,
  desc,
  lang,
  source,
  takenIds,
  update,
  onReset,
  teamCount,
  onRemove,
  onClose,
  saveTargets,
  onSaveTo,
  height,
  onHeight,
}: Props) {
  const card = useRef<HTMLElement>(null);
  const [target, setTarget] = useState<SaveTarget>(saveTargets[0][0]);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [stanceError, setStanceError] = useState("");
  const [copied, setCopied] = useState("");
  const { stance } = destiny(brute.id);
  const inventory = useInventorySettings(lang);

  return (
    <>
      {/* the brute itself: details on the left, the original inventory on the right, half each */}
      <section
        ref={card}
        className="editor-card panel"
        style={height ? { height } : undefined}
        aria-label={`${brute.name}: details and inventory`}
      >
        <div className="editor-info">
          {source && <p className="editor-source">{source}</p>}
          <div className="editor-head">
            <Portrait
              gfx={brute.gfx}
              name={brute.name}
              lazy={false}
              className="editor-portrait"
            />
            <div className="editor-fields">
              <label className="name-field">
                <span className="sr-only">Name</span>
                <CommitInput
                  value={brute.name}
                  className="name-input"
                  maxLength={40}
                  onCommit={(t) => {
                    if (!t) return "A brute needs a name.";
                    update({ name: t });
                  }}
                />
              </label>
              <div className="editor-line">
                <label className="level-field">
                  Level
                  <CommitInput
                    value={displayLevel(brute.levelUps)}
                    inputMode="numeric"
                    onCommit={(t) => {
                      const v = parseIntStrict(t);
                      if (v === null || v < 1 || v > MAX_LAB_LEVEL)
                        return `Level is 1 to ${MAX_LAB_LEVEL}.`;
                      update({ levelUps: levelUpsFor(v) });
                    }}
                  />
                </label>
                <label className="id-field">
                  Id
                  <span className="input-with-btn">
                    <CommitInput
                      value={brute.id}
                      inputMode="numeric"
                      onCommit={(t) => {
                        const v = parseIntStrict(t);
                        if (!isValidSeedId(v))
                          return "Id is a whole number from 1 to 2147483647.";
                        if (takenIds.includes(v))
                          return `Id ${v} is already in this fight.`;
                        update({ id: v });
                      }}
                    />
                    <button
                      type="button"
                      className="btn small ghost"
                      title="Pick a random id"
                      onClick={() => update({ id: randomLabId(takenIds) })}
                    >
                      Random
                    </button>
                    <FindIdButton
                      brute={brute}
                      takenIds={takenIds}
                      onPick={(id) => update({ id })}
                    />
                  </span>
                </label>
              </div>
              <div className="editor-line extra-toggles">
                <label
                  className="stance-field"
                  title="Rolled from the id (about 1 brute in 1000 has a special idle pose). Picking one moves the brute to the nearest id with it, which changes its stats and rewards."
                >
                  <span className="sr-only">Stance</span>
                  <select
                    value={stance ?? ""}
                    onChange={(e) => {
                      const want =
                        e.target.value === "" ? null : Number(e.target.value);
                      const id = nearestIdWithStance(brute.id, want, takenIds);
                      if (id === null)
                        setStanceError("No free id with that stance nearby.");
                      else {
                        setStanceError("");
                        update({ id });
                      }
                    }}
                  >
                    {STANCES.map(([v, label]) => (
                      <option key={label} value={v ?? ""}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {EXTRAS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="btn small ghost"
                    aria-expanded={extra === k}
                    aria-controls="editor-extra"
                    onClick={() => setExtra(extra === k ? null : k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {stanceError && (
                <p className="field-error" role="alert">
                  {stanceError}
                </p>
              )}
            </div>
          </div>
          {extra && (
            <div id="editor-extra" className="editor-extra">
              {extra === "look" ? (
                <Appearance brute={brute} update={update} />
              ) : (
                <Bits brute={brute} update={update} />
              )}
            </div>
          )}
          <div className="editor-line">
            {teamCount !== undefined && (
              <fieldset className="team-switch">
                <legend className="sr-only">Team</legend>
                {([0, 1] as const).map((t) => (
                  <label
                    key={t}
                    className={`seg team-${t}`}
                    title={`Team ${t}`}
                  >
                    <input
                      type="radio"
                      name="editor-team"
                      checked={brute.team === t}
                      disabled={brute.team !== t && teamCount < 2}
                      onChange={() => update({ team: t })}
                    />
                    {t}
                  </label>
                ))}
              </fieldset>
            )}
            <button
              type="button"
              className="btn small ghost"
              disabled={!original}
              onClick={onReset}
            >
              Reset
            </button>
            {onRemove && (
              <button
                type="button"
                className="btn small danger"
                disabled={teamCount !== undefined && teamCount < 2}
                title={
                  teamCount !== undefined && teamCount < 2
                    ? "Each team needs at least one brute."
                    : undefined
                }
                onClick={onRemove}
              >
                Remove
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="btn small ghost"
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>
          <div className="editor-line save-row">
            <label>
              <span className="sr-only">Save to</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as SaveTarget)}
              >
                {saveTargets.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn small"
              onClick={() => onSaveTo(target, brute)}
            >
              Save
            </button>
            <button
              type="button"
              className="btn small ghost"
              title="Copy this brute as a text code you can import on the Bench"
              onClick={() =>
                navigator.clipboard.writeText(exportBrute(brute)).then(
                  () => setCopied("Copied"),
                  () => setCopied("Clipboard unavailable"),
                )
              }
            >
              Export code
            </button>
            {copied && (
              <span className="muted" role="status">
                {copied}
              </span>
            )}
          </div>
          <InventoryControls {...inventory} />
          {desc && <BruteSummary desc={desc} id={brute.id} />}
        </div>
        <InventoryPanel brute={brute} settings={inventory} />
      </section>

      <HeightDivider card={card} height={height} onHeight={onHeight} />

      {/* how the brute is built: level-up choices */}
      <section className="editor-tabs panel" aria-labelledby="levelups-title">
        <h3 id="levelups-title" className="levelups-title">
          Level-ups
        </h3>
        {desc && (
          <LevelUps
            brute={brute}
            desc={desc}
            originalLevelUps={original?.levelUps ?? brute.levelUps}
            update={update}
          />
        )}
      </section>
    </>
  );
}

function FindIdButton({
  brute,
  takenIds,
  onPick,
}: {
  brute: SpecBrute;
  takenIds: number[];
  onPick: (id: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(String(brute.id));
  const [limit, setLimit] = useState("50000");
  const [stance, setStance] = useState("any");
  const [banned, setBanned] = useState<string[]>([]);
  const [results, setResults] = useState<number[]>([]);
  const [searched, setSearched] = useState(false);
  const open = () => {
    setStart(String(brute.id));
    setResults([]);
    setSearched(false);
    setBanned([]);
    dialog.current?.showModal();
  };
  const find = () => {
    const from = Math.max(1, Number(start) || 1);
    const count = Math.min(250000, Math.max(1, Number(limit) || 1));
    const found: number[] = [];
    const taken = new Set(takenIds);
    for (let id = from; id <= 2147483647 && id < from + count && found.length < 20; id++) {
      if (taken.has(id) || (stance !== "any" && String(destiny(id).stance) !== stance)) continue;
      const destinyBans = new Set(destiny(id).banned.map((b) => bonusKey(b.kind, b.id)));
      if (banned.some((key) => destinyBans.has(key))) continue;
      found.push(id);
    }
    setResults(found);
    setSearched(true);
  };
  return (
    <>
      <button type="button" className="btn small ghost" onClick={open}>Find ID</button>
      <dialog ref={dialog} className="dialog">
        <form method="dialog" className="dialog-body" onSubmit={(e) => e.preventDefault()}>
          <h2>Find an ID</h2>
          <p className="hint">Search nearby seed IDs using requirements. The current brute’s level and choices are used for reward checks.</p>
          <div className="form-grid">
            <label>Start ID<input value={start} inputMode="numeric" onChange={(e) => setStart(e.target.value)} /></label>
            <label>IDs to check<input value={limit} inputMode="numeric" onChange={(e) => setLimit(e.target.value)} /></label>
            <label>Stance<select value={stance} onChange={(e) => setStance(e.target.value)}><option value="any">Any stance</option><option value="">Normal stance</option><option value="0">Stance 0</option><option value="1">Stance 1</option></select></label>
          </div>
          <fieldset className="avoid-group">
            <legend>Weapons / skills that must not be banned</legend>
            <div className="row">
              {BONUSES.filter((b) => b.kind === "Weapons" || b.kind === "Permanent").map((b) => {
                const key = bonusKey(b.kind, b.id);
                const checked = banned.includes(key);
                return <button key={key} type="button" className="chip toggle" aria-pressed={checked} onClick={() => setBanned((current) => checked ? current.filter((x) => x !== key) : [...current, key])}>{b.kind === "Permanent" ? "Skill" : "Weapon"}: {b.id}</button>;
              })}
            </div>
            <p className="hint">Selected items must be available for the candidate ID.</p>
          </fieldset>
          <div className="row">
            <button type="button" className="btn" onClick={find}>Search</button>
            <button type="button" className="btn ghost" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
          {searched && <div><h3>{results.length ? "Matching IDs" : "No matches"}</h3>{results.length > 0 && <div className="row">{results.map((id) => <button key={id} type="button" className="btn small ghost" onClick={() => { onPick(id); dialog.current?.close(); }}>{id}</button>)}</div>}</div>}
        </form>
      </dialog>
    </>
  );
}

function BruteSummary({ desc, id }: { desc: Description; id: number }) {
  const { name } = useNames();
  const f = desc.fin;
  // the category names match the engine's bonus kinds, so chips and level-up options share colours
  const groups: [string, BonusKind, string[]][] = [
    ["Weapons", "Weapons", f.weapons],
    ["Supers", "Super", f.supers],
    ["Pets", "Followers", f.followers],
    ["Skills", "Permanent", f.perms],
    ["Talents", "Talent", f.talents],
  ];
  const { banned } = destiny(id);
  // the first level-up that picked each bonus; anything never picked came with the brute at level 1
  const gotAt = new Map<string, number>();
  desc.levels.forEach((lv, i) => {
    const o = lv.opts[lv.bit];
    if (o.t === "b" && !gotAt.has(bonusKey(o.kind, o.id)))
      gotAt.set(bonusKey(o.kind, o.id), i + 2);
  });
  return (
    <div className="summary">
      <dl className="stat-row">
        <div>
          <dt>HP</dt>
          <dd>{f.life}</dd>
        </div>
        <div>
          <dt>Strength</dt>
          <dd>{f.force}</dd>
        </div>
        <div>
          <dt>Agility</dt>
          <dd>{f.agility}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{f.speed}</dd>
        </div>
      </dl>
      <dl
        className="kit kit-scroll"
        aria-label="Weapons, supers, pets, skills and talents"
      >
        {groups
          .filter(([, , items]) => items.length)
          .map(([label, kind, items]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {items.map((x) => (
                  <span
                    key={x}
                    className={`chip kind-${kind}`}
                    title={`Obtained at level ${gotAt.get(bonusKey(kind, x)) ?? 1}`}
                  >
                    {name(kind, x)}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        {banned.length > 0 && (
          <div>
            <dt title="Ruled out by this brute's id: it will never be offered these">
              Banned
            </dt>
            <dd>
              {banned.map((b) => (
                <span
                  key={bonusKey(b.kind, b.id)}
                  className={`chip banned kind-${b.kind}`}
                  title="Never offered to this brute"
                >
                  {name(b.kind, b.id)}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      {!desc.check && (
        <p className="warning" role="alert">
          The step-by-step replay and the original setLevels disagree for this
          brute. Its stats may be wrong.
        </p>
      )}
    </div>
  );
}

function LevelUps({
  brute,
  desc,
  originalLevelUps,
  update,
}: {
  brute: SpecBrute;
  desc: Description;
  originalLevelUps: number;
  update: (p: Partial<SpecBrute>) => void;
}) {
  const { option } = useNames();
  const avoid = new Set(brute.avoid ?? []);
  // choices for levels up to `lockLevel` are kept by the bulk buttons; 0 means nothing is locked
  const [lockLevel, setLockLevel] = useState(0);
  const locked = Math.min(Math.max(lockLevel - 1, 0), brute.levelUps);
  const setRest = (pick: (n: number) => Choice[]) =>
    update({
      choices: [
        ...brute.choices.slice(0, locked),
        ...pick(brute.levelUps - locked),
      ],
    });
  // the bulk controls stay put above the list; only the list scrolls
  return (
    <>
      {!desc.levels.length ? (
        <div className="tab-panel">
          <p className="muted">
            A level 1 brute has no level-ups yet. Raise its level to choose
            rewards.
          </p>
        </div>
      ) : (
        <>
          <div className="levelups-bar">
            <div className="row">
              <label className="inline lock-level">
                Lock up to
                <select
                  value={lockLevel}
                  onChange={(e) => setLockLevel(Number(e.target.value))}
                >
                  <option value={0}>Nothing</option>
                  {desc.levels.map((_, i) => (
                    <option key={i} value={i + 2}>
                      Level {i + 2}
                    </option>
                  ))}
                </select>
              </label>
              <AvoidRewards
                name={brute.name}
                avoid={brute.avoid ?? []}
                onChange={(list) => update({ avoid: list })}
              />
              <button
                type="button"
                className="btn small ghost"
                disabled={locked >= brute.levelUps}
                onClick={() => setRest((n) => Array(n).fill(0))}
              >
                All first options
              </button>
              <button
                type="button"
                className="btn small ghost"
                disabled={locked >= brute.levelUps}
                onClick={() => setRest((n) => Array(n).fill(1))}
              >
                All second options
              </button>
              <button
                type="button"
                className="btn small ghost"
                disabled={locked >= brute.levelUps}
                onClick={() => setRest(randomChoices)}
              >
                Random choices
              </button>
            </div>
            <p className="hint">
              Picking the second option also changes every later choice, exactly
              as in the original game.
            </p>
          </div>
          <div className="tab-panel">
            <ol className="levels">
              {desc.levels.map((lv, i) => {
                const blocked = isAvoided(lv.opts[0], avoid);
                return (
                  <li
                    key={i}
                    className={
                      (i >= originalLevelUps ? "added" : "") +
                      (blocked ? " blocked" : "") +
                      (i < locked ? " locked" : "")
                    }
                  >
                    <span
                      className="lv"
                      title={
                        i < locked
                          ? "Locked: the bulk buttons keep this choice"
                          : undefined
                      }
                    >
                      Lv {i + 2}
                    </span>
                    {lv.opts.map((o, oi) => (
                      <button
                        key={oi}
                        type="button"
                        aria-pressed={lv.bit === oi}
                        className={
                          "opt" +
                          (o.t === "b" ? ` bonus kind-${o.kind}` : "") +
                          (oi === 0 && blocked ? " avoided" : "")
                        }
                        disabled={oi === 0 && blocked}
                        title={
                          oi === 0 && blocked
                            ? "On your avoid list, so the second option is taken"
                            : undefined
                        }
                        onClick={() => {
                          const c = brute.choices.slice();
                          c[i] = oi as Choice;
                          update({ choices: c });
                        }}
                      >
                        {option(o)}
                      </button>
                    ))}
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </>
  );
}

const KIND_GROUPS: [BonusKind, string][] = [
  ["Weapons", "Weapons"],
  ["Super", "Supers"],
  ["Followers", "Pets"],
  ["Permanent", "Skills"],
  ["Talent", "Talents"],
];

// shortcut: presets live in this browser only, move them to the account store if they need to follow the player
const PRESETS_KEY = "mybrute.lab.avoidPresets.v1";
type AvoidPreset = { name: string; avoid: string[] };
function readPresets(): AvoidPreset[] {
  try {
    const v = JSON.parse(localStorage.getItem(PRESETS_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Named avoid lists to save and load again. */
function AvoidPresets({
  avoid,
  onChange,
}: {
  avoid: string[];
  onChange: (list: string[]) => void;
}) {
  const [presets, setPresets] = useState(readPresets);
  const [picked, setPicked] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const store = (next: AvoidPreset[]) => {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
      setPresets(next);
      setError("");
    } catch {
      setError(
        "This browser won't let the Lab save (storage is full or blocked).",
      );
    }
  };
  const save = () => {
    const n = label.trim();
    if (!n || !avoid.length) return;
    store([{ name: n, avoid }, ...presets.filter((p) => p.name !== n)]);
    setPicked(n);
    setLabel("");
  };
  const preset = presets.find((p) => p.name === picked);
  return (
    <div className="avoid-presets">
      <label>
        <span className="sr-only">Blacklist preset</span>
        <select value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">
            {presets.length ? "Pick a preset" : "No presets yet"}
          </option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.avoid.length})
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn small ghost"
        disabled={!preset}
        onClick={() => preset && onChange(preset.avoid)}
      >
        Load
      </button>
      <button
        type="button"
        className="btn small ghost"
        disabled={!preset}
        onClick={() => {
          store(presets.filter((p) => p.name !== picked));
          setPicked("");
        }}
      >
        Delete
      </button>
      <input
        value={label}
        maxLength={40}
        placeholder="Preset name"
        aria-label="Preset name"
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      <button
        type="button"
        className="btn small"
        disabled={!label.trim() || !avoid.length}
        title={
          !avoid.length
            ? "Add rewards to the list first"
            : "Saving under an existing name replaces it"
        }
        onClick={save}
      >
        Save preset
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Rewards to steer away from: when one is offered at a level-up, the second option is taken instead. */
export function AvoidRewards({
  name: bruteName,
  avoid,
  onChange,
}: {
  name: string;
  avoid: string[];
  onChange: (list: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  // edits stay in this draft until Apply; only then does the brute's avoid list (and its choices) change
  const [draft, setDraft] = useState<string[]>(avoid);
  const [query, setQuery] = useState("");
  const { name } = useNames();
  const toggle = (key: string) =>
    setDraft(
      draft.includes(key) ? draft.filter((k) => k !== key) : [...draft, key],
    );
  const q = query.trim().toLowerCase();
  const changed =
    draft.length !== avoid.length || draft.some((k) => !avoid.includes(k));
  const openPop = () => {
    setDraft(avoid);
    setQuery("");
    setOpen(true);
  };
  const close = () => setOpen(false);
  const apply = () => {
    onChange(draft);
    close();
  };
  return (
    <div
      className="avoid-pop"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <button
        type="button"
        className="btn small ghost"
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Rewards ${bruteName} should avoid`}
        onClick={() => (open ? close() : openPop())}
      >
        Avoid{avoid.length ? ` (${avoid.length})` : ""}
      </button>
      {open && (
    <section
      className="avoid avoid-popover"
      role="dialog"
      aria-label={`${bruteName}: avoided rewards`}
    >
      <div className="avoid-head">
        <h4>
          Avoid rewards <span className="muted">· {bruteName}</span>
        </h4>
        <span className="muted">
          {draft.length ? `${draft.length} on the list` : "None"}
        </span>
      </div>
      {draft.length > 0 && (
        <div className="avoid-chips">
          {draft.map((key) => {
            const [kind, id] = key.split(":") as [BonusKind, string];
            return (
              <button
                key={key}
                type="button"
                className={`chip removable kind-${kind}`}
                aria-label={`Stop avoiding ${name(kind, id)}`}
                onClick={() => toggle(key)}
              >
                {name(kind, id)} <span aria-hidden="true">×</span>
              </button>
            );
          })}
          <button
            type="button"
            className="link clear-avoid"
            onClick={() => setDraft([])}
          >
            Clear all
          </button>
        </div>
      )}
      <AvoidPresets avoid={draft} onChange={setDraft} />
      <div className="avoid-picker">
          <input
            type="search"
            value={query}
            placeholder="Filter rewards"
            aria-label="Filter rewards"
            onChange={(e) => setQuery(e.target.value)}
          />
          {KIND_GROUPS.map(([kind, label]) => {
            const items = BONUSES.filter(
              (b) =>
                b.kind === kind &&
                (!q || name(kind, b.id).toLowerCase().includes(q)),
            ).sort((a, b) => name(kind, a.id).localeCompare(name(kind, b.id)));
            return (
              items.length > 0 && (
                <fieldset key={kind} className="avoid-group">
                  <legend>{label}</legend>
                  {items.map((b) => {
                    const key = bonusKey(b.kind, b.id);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={draft.includes(key)}
                        className={`chip toggle kind-${kind}`}
                        onClick={() => toggle(key)}
                      >
                        {name(kind, b.id)}
                      </button>
                    );
                  })}
                </fieldset>
              )
            );
          })}
        </div>
      <p className="hint">
        When an avoided reward is offered, the second option is taken
        automatically. Later offers change as a result, and they are checked
        too. Nothing changes until you apply.
      </p>
      <div className="row avoid-actions">
        <button type="button" className="btn small" disabled={!changed} onClick={apply}>
          Apply
        </button>
        <button type="button" className="btn small ghost" onClick={close}>
          Cancel
        </button>
      </div>
    </section>
      )}
    </div>
  );
}

function Appearance({
  brute,
  update,
}: {
  brute: SpecBrute;
  update: (p: Partial<SpecBrute>) => void;
}) {
  return <GfxEditor gfx={brute.gfx} onChange={(gfx) => update({ gfx })} />;
}

function Bits({
  brute,
  update,
}: {
  brute: SpecBrute;
  update: (p: Partial<SpecBrute>) => void;
}) {
  return (
    <div className="bits">
      <label className="wide">
        Level-up bits (hex, one byte per 8 level-ups)
        <CommitInput
          value={bitsToHex(brute.choices, brute.levelUps)}
          spellCheck={false}
          onCommit={(t) => {
            if (t && !/^[0-9a-fA-F\s]*$/.test(t)) return "Use hex digits only.";
            update({ choices: hexToChoices(t, brute.levelUps) });
          }}
        />
      </label>
      <dl className="facts">
        <div>
          <dt>Level-ups taken</dt>
          <dd>{brute.levelUps}</dd>
        </div>
        <div>
          <dt>Payload form (base64)</dt>
          <dd>
            <code>{bitsToB64(brute.choices, brute.levelUps) || "None"}</code>
          </dd>
        </div>
        <div>
          <dt>Second options picked</dt>
          <dd>{brute.choices.filter((c) => c === 1).length}</dd>
        </div>
      </dl>
    </div>
  );
}

const MIN_HEIGHT = 180;

/** Drag (or arrow keys) to set the details card's height; double-click or Home goes back to fitting the content. */
function HeightDivider({
  card,
  height,
  onHeight,
}: {
  card: React.RefObject<HTMLElement>;
  height: number | null;
  onHeight: (h: number | null) => void;
}) {
  const current = () =>
    card.current?.getBoundingClientRect().height ?? MIN_HEIGHT;
  const clamp = (h: number) =>
    Math.round(Math.max(MIN_HEIGHT, Math.min(h, window.innerHeight * 0.85)));
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const startY = e.clientY,
      start = current();
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      onHeight(clamp(start + ev.clientY - startY));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 80 : 20;
    if (e.key === "ArrowUp") onHeight(clamp(current() - step));
    else if (e.key === "ArrowDown") onHeight(clamp(current() + step));
    else if (e.key === "Home") onHeight(null);
    else return;
    e.preventDefault();
  };
  return (
    <div
      className="height-divider"
      role="separator"
      aria-orientation="horizontal"
      tabIndex={0}
      aria-label="Brute editor height"
      aria-valuemin={MIN_HEIGHT}
      aria-valuenow={height ?? undefined}
      title="Drag to resize. Double-click to fit the content."
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onHeight(null)}
    />
  );
}
