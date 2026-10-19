import { useState } from "react";
import { INVENTORY_LANGS, inventoryParams } from "@mybrute/engine";
import { SwfPlayer } from "../swf/SwfPlayer";

/** The original inventory.swf, always shown beside the editor (between stats and tabs on phones). */
export function InventoryPanel({ brute, defaultLang = "en" }: { brute: { id: number; levelUps: number; choices: readonly number[]; name: string }; defaultLang?: string }) {
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
