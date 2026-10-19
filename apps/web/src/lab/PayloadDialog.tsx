import { useEffect, useRef, useState } from "react";
import examples from "../data/examples.json";
import type { LabStore, SavedPayload } from "./storage";

interface Props {
  open: boolean;
  store: LabStore;
  onClose: () => void;
  /** throws with a readable message when the text isn't a usable payload */
  onLoad: (params: string, label: string) => void;
}

export function PayloadDialog({ open, store, onClose, onLoad }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPayload[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setSaved(store.listPayloads()); setError(null); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, store]);

  const tryLoad = (params: string, label: string) => {
    try { onLoad(params, label); setText(""); onClose(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="payload-title">
      <form method="dialog" className="dialog-body" onSubmit={(e) => { e.preventDefault(); tryLoad(text, "Pasted payload"); }}>
        <h2 id="payload-title">Open a fight</h2>
        <label className="wide">Paste a payload
          <textarea value={text} rows={5} spellCheck={false} placeholder="data=…&k=…&lang=… (an embed tag works too)" onChange={(e) => setText(e.target.value)} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="row">
          <button type="submit" className="btn" disabled={!text.trim()}>Open pasted fight</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>

        <h3>Historical fights</h3>
        <ul className="pick-list">
          {examples.map((e) => (
            <li key={e.label}><button type="button" className="link" onClick={() => tryLoad(e.params, e.label)}>{e.label}</button></li>
          ))}
        </ul>

        <h3>Your saved fights</h3>
        {saved.length === 0 ? <p className="muted">Fights you save from the Lab show up here.</p> : (
          <ul className="pick-list">
            {saved.map((p) => (
              <li key={p.key}>
                <button type="button" className="link" onClick={() => tryLoad(p.params, p.label)}>{p.label}</button>
                <button type="button" className="btn small ghost" aria-label={`Delete ${p.label}`} onClick={() => { store.deletePayload(p.key); setSaved(store.listPayloads()); }}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </dialog>
  );
}
