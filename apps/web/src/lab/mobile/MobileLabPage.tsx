// The mobile Laboratory: one screen at a time (Brute, Teams, Fight, Bench) under a top bar that switches
// brutes and plays the fight. All state and actions come from useLab, shared with the desktop Lab.
import { useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Portrait } from "../../swf/Portrait";
import { BruteSizeControl, portraitScale, useBruteSize } from "../../ui/BruteSize";
import { LabPage } from "../LabPage";
import { PayloadDialog } from "../PayloadDialog";
import { AddBrute } from "../VersusBoard";
import { prefersDesktopLab, readPinned, savePinned } from "../layoutChoice";
import { useLab } from "../useLab";
import { BenchScreen } from "./BenchScreen";
import { BruteScreen } from "./BruteScreen";
import { FightScreen } from "./FightScreen";
import { SettingsSheet } from "./SettingsSheet";
import { TeamsScreen } from "./TeamsScreen";
import "./mobile-lab.css";

const PHONE = "(max-width: 699px)";

/**
 * What /lab shows. Phones go to the mobile Lab once, when /lab opens (resizing doesn't switch), unless
 * "Desktop Lab" was picked in this browser. The navigation state goes along, so "Try a copy in the Lab"
 * from a Classic cell still brings its brute.
 */
export function LabEntry() {
  const location = useLocation();
  const [toMobile] = useState(() => window.matchMedia(PHONE).matches && !prefersDesktopLab());
  return toMobile ? <Navigate to="/lab/mobile" replace state={location.state} /> : <LabPage />;
}

export type MobileTab = "brute" | "teams" | "fight" | "bench";
const TABS: [MobileTab, string][] = [
  ["brute", "Brute"],
  ["teams", "Teams"],
  ["fight", "Fight"],
  ["bench", "Bench"],
];

export function MobileLabPage() {
  const [tab, setTab] = useState<MobileTab>("brute");
  const lab = useLab({ onShowEditor: () => setTab("brute"), onShowArena: () => setTab("fight") });
  const { spec, selected, draft } = lab;
  const [size] = useBruteSize();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinned, setPinned] = useState(readPinned);
  const pin = (on: boolean) => {
    setPinned(on);
    savePinned(on);
  };
  const [openFight, setOpenFight] = useState(false);
  const addSheet = useRef<HTMLDialogElement>(null);

  return (
    <div className={(lab.theme === "workbench" ? "lab" : "lab term") + " mlab"} data-theme={lab.theme} style={portraitScale(size)}>
      <header className="mlab-top">
        <div className="mlab-strip" role="toolbar" aria-label="Brutes in this fight">
          {spec.brutes.map((b, i) => (
            <button
              key={i}
              type="button"
              className={`mlab-chip team-${b.team}` + (lab.problems.has(i) ? " problem" : "")}
              aria-pressed={!draft && selected === i}
              aria-label={`${b.name}, team ${b.team}`}
              onClick={() => lab.act({ type: "select", index: i })}
            >
              <Portrait gfx={b.gfx} name={b.name} flip={b.team === 1} className="mlab-chip-portrait" />
            </button>
          ))}
          {draft && (
            <button type="button" className="mlab-chip draft" aria-pressed="true" aria-label={`${draft.brute.name}, open from the ${draft.kind}`} onClick={() => setTab("brute")}>
              <Portrait gfx={draft.brute.gfx} name={draft.brute.name} className="mlab-chip-portrait" />
              <span className="mlab-chip-tag">{draft.kind === "bench" ? "Bench" : "Support"}</span>
            </button>
          )}
          <button type="button" className="mlab-chip add" aria-label="Add a brute" onClick={() => addSheet.current?.showModal()}>
            +
          </button>
        </div>
        <button type="button" className="btn ghost mlab-gear" aria-label="Fight settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
        <button type="button" className="btn play mlab-play" disabled={lab.errors.length > 0} onClick={lab.play}>
          ▶ Play
        </button>
      </header>

      {/* all four stay mounted and only the current one shows, so leaving the Fight tab doesn't restart the fight */}
      <div className="mlab-screen" hidden={tab !== "brute"}><BruteScreen lab={lab} pinned={pinned} /></div>
      <div className="mlab-screen" hidden={tab !== "teams"}><TeamsScreen lab={lab} /></div>
      <div className="mlab-screen" hidden={tab !== "fight"}><FightScreen lab={lab} /></div>
      <div className="mlab-screen" hidden={tab !== "bench"}><BenchScreen lab={lab} /></div>

      <nav className="mlab-tabs" aria-label="Lab screens">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
            {key === "bench" && lab.bench.length > 0 && <span className="muted"> {lab.bench.length}</span>}
          </button>
        ))}
      </nav>

      {/* "+" in the strip: a new brute for either team */}
      <dialog ref={addSheet} className="dialog msheet" aria-label="Add a brute" onClick={(e) => e.target === addSheet.current && addSheet.current.close()}>
        <section className="dialog-body">
          <div className="row bench-head">
            <h2>Add a brute</h2>
            <button type="button" className="btn small ghost" onClick={() => addSheet.current?.close()}>Close</button>
          </div>
          {([0, 1] as const).map((t) => (
            <AddBrute
              key={t}
              team={t}
              takenIds={spec.brutes.map((b) => b.id)}
              onAdd={(brute) => {
                lab.act({ type: "addBrute", brute });
                addSheet.current?.close();
              }}
            />
          ))}
        </section>
      </dialog>

      <SettingsSheet lab={lab} open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenFight={() => setOpenFight(true)} sizeControl={<BruteSizeControl />} pinned={pinned} onPinned={pin} />
      <PayloadDialog open={openFight} store={lab.store} onClose={() => setOpenFight(false)} onLoad={lab.loadPayload} />
      <div className="toast" role="status" aria-live="polite">
        {lab.toast}
      </div>
    </div>
  );
}
