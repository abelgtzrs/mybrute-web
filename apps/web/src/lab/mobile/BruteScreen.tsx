// The mobile Lab's home screen: one brute. A fixed block (portrait, name, level, id, team, stats and the
// original inventory) stays on screen; the folding sections under it scroll.
import { forwardRef, useRef, useState, type ReactNode } from "react";
import {
  destiny,
  displayLevel,
  isValidSeedId,
  levelUpsFor,
  MAX_LAB_LEVEL,
  nearestIdWithStance,
  randomLabId,
} from "@mybrute/engine";
import { Portrait } from "../../swf/Portrait";
import { CommitInput, parseIntStrict } from "../../ui/CommitInput";
import { InventoryControls, InventoryPanel, useInventorySettings } from "../../ui/InventoryPanel";
import { Bits, BruteSummary, FindIdButton, LevelUps, STANCES, type SaveTarget } from "../BruteEditor";
import { LookEditor } from "../LookEditor";
import { exportBrute } from "../bruteCode";
import { editorTargets, type Lab } from "../useLab";

/** pinned: the kit list and level-ups stay on screen together (a toggle in the gear sheet) */
export function BruteScreen({ lab, pinned }: { lab: Lab; pinned: boolean }) {
  const open = editorTargets(lab);
  if (!open) {
    return (
      <section className="panel mbrute-empty">
        <p>Pick a brute above, or open one from Teams or Bench.</p>
      </section>
    );
  }
  // key: a different brute starts with fresh fields (save target, open sections, errors)
  return <OpenBrute key={open.key} lab={lab} open={open} pinned={pinned} />;
}

type Open = NonNullable<ReturnType<typeof editorTargets>>;

function OpenBrute({ lab, open, pinned }: { lab: Lab; open: Open; pinned: boolean }) {
  const { brute, desc, update, takenIds, teamCount } = open;
  const inventory = useInventorySettings(lab.spec.lang);
  const f = desc?.fin;
  const lastOnTeam = teamCount !== undefined && teamCount < 2;
  const lookSheet = useRef<HTMLDialogElement>(null);
  const saveSheet = useRef<HTMLDialogElement>(null);
  const idSheet = useRef<HTMLDialogElement>(null);
  const toolsSheet = useRef<HTMLDialogElement>(null);
  // shown under the id normally, or in the "Id & team" sheet when pinned. Always mounted with its button, not
  // only while the id is being typed: Find ID opens a dialog that must outlive the field.
  const idAndTeam = (
    <>
      <div className="mbrute-idtools">
        <button type="button" className="btn small ghost" onClick={() => update({ id: randomLabId(takenIds) })}>Random</button>
        <FindIdButton brute={brute} takenIds={takenIds} onPick={(id) => update({ id })} />
      </div>
      {teamCount !== undefined && (
        <fieldset className="team-switch mbrute-team" title={lastOnTeam ? "Each team needs at least one brute." : undefined}>
          <legend className="sr-only">Team</legend>
          {([0, 1] as const).map((t) => (
            <label key={t} className={`seg team-${t}`}>
              <input type="radio" name="mbrute-team" checked={brute.team === t} disabled={brute.team !== t && lastOnTeam} onChange={() => update({ team: t })} />
              Team {t}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
  // the same four parts in either layout: folding sections, or pinned boxes plus two sheets
  const kitCount = f ? f.weapons.length + f.supers.length + f.followers.length + f.perms.length + f.talents.length : 0;
  const kit = desc && <BruteSummary desc={desc} id={brute.id} />;
  const levelUps = desc && <LevelUps brute={brute} desc={desc} originalLevelUps={open.original?.levelUps ?? brute.levelUps} update={update} />;
  const look = (
    <>
      <StancePicker lab={lab} open={open} />
      <h3 className="msec-sub">Appearance</h3>
      <LookEditor gfx={brute.gfx} onChange={(gfx) => update({ gfx })} />
      <h3 className="msec-sub">Bits</h3>
      <Bits brute={brute} update={update} />
    </>
  );
  const save = <SaveAndExport lab={lab} open={open} />;
  return (
    <div className={"mbrute" + (pinned ? " pinned" : "")}>
      <section className="panel mbrute-fixed" aria-label={`${brute.name}: details and inventory`}>
        <div className="mbrute-info">
          {open.source && <p className="editor-source">{open.source}</p>}
          <div className="mbrute-head">
            <Portrait gfx={brute.gfx} name={brute.name} lazy={false} className="mbrute-portrait" />
            <div className="mbrute-ids">
              <TapEdit
                label="Name"
                className="mbrute-name"
                value={brute.name}
                maxLength={40}
                onCommit={(t) => {
                  if (!t) return "A brute needs a name.";
                  update({ name: t });
                }}
              />
              <TapEdit
                label="Level"
                value={displayLevel(brute.levelUps)}
                inputMode="numeric"
                onCommit={(t) => {
                  const v = parseIntStrict(t);
                  if (v === null || v < 1 || v > MAX_LAB_LEVEL) return `Level is 1 to ${MAX_LAB_LEVEL}.`;
                  update({ levelUps: levelUpsFor(v) });
                }}
              />
              <TapEdit
                label="Id"
                value={brute.id}
                inputMode="numeric"
                onCommit={(t) => {
                  const v = parseIntStrict(t);
                  if (!isValidSeedId(v)) return "Id is a whole number from 1 to 2147483647.";
                  if (takenIds.includes(v)) return `Id ${v} is already in this fight.`;
                  update({ id: v });
                }}
              />
            </div>
          </div>
          {!pinned && idAndTeam}
          {f && (
            <dl className="mbrute-stats">
              <div><dt>HP</dt><dd>{f.life}</dd></div>
              <div><dt>STR</dt><dd>{f.force}</dd></div>
              <div><dt>AGI</dt><dd>{f.agility}</dd></div>
              <div><dt>SPD</dt><dd>{f.speed}</dd></div>
            </dl>
          )}
        </div>
        <div className="mbrute-inv">
          <InventoryPanel brute={brute} settings={inventory} />
          {!pinned && <InventoryControls {...inventory} />}
        </div>
      </section>

      {pinned ? (
        // pinned: the kit list and the level-ups each scroll in their own box and are always on screen;
        // the less-used parts open as sheets
        <>
          <div className="mpin-actions">
            <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => idSheet.current?.showModal()}>Id &amp; team</button>
            <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => lookSheet.current?.showModal()}>Look &amp; bits</button>
            <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => toolsSheet.current?.showModal()}>Level tools</button>
            <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => saveSheet.current?.showModal()}>Save</button>
          </div>
          <section className="panel mpin-kit" aria-label="Weapons, skills and pets">
            {kit}
          </section>
          <section className="panel mpin-levels" aria-label="Level-ups">
            {levelUps}
          </section>
          <Sheet ref={idSheet} title="Id & team">{idAndTeam}</Sheet>
          {/* the same level-up list, showing only its tools (lock, avoid, presets, all first/second, random);
              they change the brute, so the choices on screen follow */}
          <Sheet ref={toolsSheet} title="Level-up tools" className="mpin-tools">{levelUps}</Sheet>
          <Sheet ref={lookSheet} title="Appearance, bits & inventory">
            {look}
            <h3 className="msec-sub">Inventory</h3>
            <InventoryControls {...inventory} />
          </Sheet>
          <Sheet ref={saveSheet} title="Save & export">{save}</Sheet>
        </>
      ) : (
        <div className="mbrute-sections">
          <details className="panel msec" open>
            <summary>
              Weapons, skills, pets <span className="muted">{kitCount}</span>
            </summary>
            {kit}
          </details>
          <details className="panel msec" open>
            <summary>
              Level-ups <span className="muted">{brute.levelUps} choices</span>
            </summary>
            {levelUps}
          </details>
          <details className="panel msec">
            <summary>Appearance &amp; bits</summary>
            {look}
          </details>
          <details className="panel msec">
            <summary>Save &amp; export</summary>
            {save}
          </details>
        </div>
      )}
    </div>
  );
}

/** A bottom sheet for one part of the Brute screen; tapping outside it or Close shuts it. */
const Sheet = forwardRef<HTMLDialogElement, { title: string; className?: string; children: ReactNode }>(function Sheet({ title, className, children }, ref) {
  const close = (e: { currentTarget: HTMLElement }) => e.currentTarget.closest("dialog")?.close();
  return (
    <dialog ref={ref} className={"dialog msheet " + (className ?? "")} aria-label={title} onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <section className="dialog-body">
        <div className="row bench-head">
          <h2>{title}</h2>
          <button type="button" className="btn small ghost" onClick={close}>Close</button>
        </div>
        {children}
      </section>
    </dialog>
  );
});

/**
 * A value shown as text; tapping it turns it into a field. The field keeps CommitInput's rules (Enter or
 * leaving the field applies, Escape cancels) and shows a rejected value's reason under it, since phones
 * have no hover tooltips.
 */
function TapEdit({
  label,
  value,
  onCommit,
  className,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string | number;
  onCommit: (t: string) => string | void;
  className?: string;
  inputMode?: "numeric";
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  // set during the field's own blur, before the wrapper's blur handler runs (state would still be stale there)
  const rejected = useRef(false);
  const cancel = () => {
    setError("");
    setEditing(false);
  };
  if (!editing) {
    return (
      <button type="button" className={"mbrute-tap " + (className ?? "")} onClick={() => setEditing(true)}>
        {label !== "Name" && <span className="muted">{label} </span>}
        {value}
      </button>
    );
  }
  return (
    // leaving the field goes back to text, unless the value was just rejected: then the field and the reason stay,
    // with Cancel (phones have no Escape key). On the wrapper: CommitInput sets its own onKeyDown/onBlur; these bubble up.
    <span
      className="mbrute-edit"
      onBlur={(e) => {
        if (e.target instanceof HTMLInputElement && !rejected.current) setEditing(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && cancel()}
    >
      <label>
        <span className="sr-only">{label}</span>
        <CommitInput
          autoFocus
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          className={className}
          onCommit={(t) => {
            const err = onCommit(t);
            rejected.current = !!err;
            setError(err || "");
            if (!err) setEditing(false);
            return err;
          }}
          onFocus={() => (rejected.current = false)}
        />
      </label>
      {error && (
        <span className="mbrute-edit-error">
          <span className="field-error" role="alert">{error}</span>
          <button type="button" className="btn small ghost" onClick={cancel}>Cancel</button>
        </span>
      )}
    </span>
  );
}

/** Stance comes from the id; picking one moves the brute to the nearest free id with it (same as desktop). */
function StancePicker({ open }: { lab: Lab; open: Open }) {
  const [error, setError] = useState("");
  const { stance } = destiny(open.brute.id);
  return (
    <>
      <label className="msec-field" title="Rolled from the id (about 1 brute in 1000 has a special idle pose). Picking one moves the brute to the nearest id with it, which changes its stats and rewards.">
        Stance
        <select
          value={stance ?? ""}
          onChange={(e) => {
            const want = e.target.value === "" ? null : Number(e.target.value);
            const id = nearestIdWithStance(open.brute.id, want, open.takenIds);
            if (id === null) setError("No free id with that stance nearby.");
            else {
              setError("");
              open.update({ id });
            }
          }}
        >
          {STANCES.map(([v, label]) => (
            <option key={label} value={v ?? ""}>{label}</option>
          ))}
        </select>
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </>
  );
}

function SaveAndExport({ lab, open }: { lab: Lab; open: Open }) {
  const [target, setTarget] = useState<SaveTarget>(open.saveTargets[0][0]);
  const [copied, setCopied] = useState("");
  const lastOnTeam = open.teamCount !== undefined && open.teamCount < 2;
  return (
    <div className="msave">
      <label className="msec-field">
        Save to
        <select value={target} onChange={(e) => setTarget(e.target.value as SaveTarget)}>
          {open.saveTargets.map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </label>
      <div className="msave-row">
        <button type="button" className="btn" onClick={() => lab.saveTo(target, open.brute)}>Save</button>
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            navigator.clipboard.writeText(exportBrute(open.brute)).then(
              () => setCopied("Copied"),
              () => setCopied("Clipboard unavailable"),
            )
          }
        >
          Export code
        </button>
        {copied && <span className="muted" role="status">{copied}</span>}
      </div>
      <div className="msave-row">
        <button type="button" className="btn ghost" disabled={!open.original} onClick={open.onReset}>Reset</button>
        {open.onRemove && (
          <button type="button" className="btn danger" disabled={lastOnTeam} title={lastOnTeam ? "Each team needs at least one brute." : undefined} onClick={open.onRemove}>
            Remove from fight
          </button>
        )}
        {open.onClose && (
          <button type="button" className="btn ghost" onClick={open.onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
