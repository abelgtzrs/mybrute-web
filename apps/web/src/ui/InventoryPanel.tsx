import { useState } from "react";
import { INVENTORY_LANGS, inventoryParams } from "@mybrute/engine";
import { SwfPlayer } from "../swf/SwfPlayer";

export interface InventorySettings { lang: string; setLang: (l: string) => void; ownedOnly: boolean; setOwnedOnly: (v: boolean) => void }

export function useInventorySettings(defaultLang = "en"): InventorySettings {
  const [lang, setLang] = useState((INVENTORY_LANGS as readonly string[]).includes(defaultLang) ? defaultLang : "en");
  const [ownedOnly, setOwnedOnly] = useState(false);
  return { lang, setLang, ownedOnly, setOwnedOnly };
}

export function InventoryControls({ lang, setLang, ownedOnly, setOwnedOnly }: InventorySettings) {
  return (
    <div className="inventory-controls">
      <label className="inline" title="Inventory language">Inventory
        <select value={lang} onChange={(e) => setLang(e.target.value)}>{INVENTORY_LANGS.map((l) => <option key={l}>{l}</option>)}</select>
      </label>
      <label className="check" title="Experimental: hide what this brute doesn't have">
        <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Owned only
      </label>
    </div>
  );
}

/** The original inventory.swf. Pass `settings` to show its controls somewhere else; the inventory then fills its box. */
export function InventoryPanel({ brute, defaultLang = "en", settings }: { brute: { id: number; levelUps: number; choices: readonly number[]; name: string }; defaultLang?: string; settings?: InventorySettings }) {
  const own = useInventorySettings(defaultLang);
  const s = settings ?? own;
  return (
    <aside className="editor-inventory" aria-label={`Inventory of ${brute.name}`}>
      {!settings && <InventoryControls {...s} />}
      <SwfPlayer swf="inventory-transparent.swf" params={inventoryParams(brute, { lang: s.lang, ownedOnly: s.ownedOnly })} label={`Inventory of ${brute.name}`} className="inventory-swf" transparent />
    </aside>
  );
}
