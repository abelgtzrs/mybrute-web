// The gear in the mobile Lab's top bar: everything that applies to the whole fight, in a sheet from the bottom.
import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FightFields } from "../FightFields";
import { ParametersDialog } from "../ParametersDialog";
import { setLabLayout } from "../layoutChoice";
import type { Lab } from "../useLab";

interface Props {
  lab: Lab;
  open: boolean;
  onClose: () => void;
  /** opens the saved-fights dialog (it lives on the page, so it can stay open after this sheet closes) */
  onOpenFight: () => void;
  sizeControl: ReactNode;
  /** Brute screen layout: kit list and level-ups always on screen */
  pinned: boolean;
  onPinned: (on: boolean) => void;
}

export function SettingsSheet({ lab, open, onClose, onOpenFight, sizeControl, pinned, onPinned }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  // each action closes the sheet first, so its result (a toast, a prompt, a dialog) isn't hidden behind it
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <dialog
      ref={ref}
      className="dialog msheet"
      aria-labelledby="msettings-title"
      // only this sheet's own close: React also hands it the close of dialogs opened inside it (Parameters)
      onClose={(e) => e.target === e.currentTarget && onClose()}
      // a tap on the dimmed area outside the sheet closes it
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <section className="dialog-body">
        <div className="row bench-head">
          <h2 id="msettings-title">Fight</h2>
          <button type="button" className="btn small ghost" onClick={onClose}>Close</button>
        </div>
        <p className="muted msheet-source">{lab.state.sourceLabel}</p>
        <div className="msheet-actions">
          <button type="button" className="btn ghost" onClick={then(lab.newFight)}>New fight</button>
          <button type="button" className="btn ghost" onClick={then(onOpenFight)}>Open fight</button>
          <button type="button" className="btn ghost" onClick={then(lab.savePayload)}>Save fight</button>
          <button type="button" className="btn ghost" onClick={then(lab.copyParams)}>Copy payload</button>
          <ParametersDialog spec={lab.spec} descs={lab.descs} stats={lab.stats} pets={lab.pets} errors={lab.errors} dispatch={lab.dispatch} />
        </div>
        <div className="msheet-fields">
          <FightFields lab={lab} />
        </div>
        <div className="msheet-size">
          <span className="muted">Brute size</span>
          {sizeControl}
        </div>
        <label className="check msheet-pin">
          <input type="checkbox" checked={pinned} onChange={(e) => onPinned(e.target.checked)} />
          <span>
            Keep weapons, skills, pets and level-ups on screen
            <span className="hint">Brute screen: both lists stay visible and scroll on their own; appearance and saving open as sheets.</span>
          </span>
        </label>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            // remembered in this browser, so opening /lab on this phone stops coming here
            setLabLayout("desktop");
            onClose();
            nav("/lab");
          }}
        >
          Desktop Lab
        </button>
      </section>
    </dialog>
  );
}
