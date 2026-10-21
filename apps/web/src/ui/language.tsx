// The site-wide language: reward names everywhere (from the original game's Lang.hx) and the default
// language for the Flash fight and inventory. Remembered per browser.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { bonusName, isNameLang, optionText, type LevelOption, type NameLang } from "@mybrute/engine";

const KEY = "mybrute.lang";
const LANGS: [NameLang, string][] = [["en", "English"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"]];

const read = (): NameLang => {
  try { const l = localStorage.getItem(KEY); return isNameLang(l) ? l : "en"; } catch { return "en"; }
};

const LanguageContext = createContext<{ lang: NameLang; setLang: (l: NameLang) => void }>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(read);
  const setLang = (l: NameLang) => { setLangState(l); try { localStorage.setItem(KEY, l); } catch { /* still applies for this visit */ } };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

/** Reward and level-up option names in the site language. */
export function useNames() {
  const { lang } = useLanguage();
  return useMemo(() => ({
    lang,
    name: (kind: Parameters<typeof bonusName>[0], id: string) => bonusName(kind, id, lang),
    option: (o: LevelOption) => optionText(o, lang),
  }), [lang]);
}

export function LanguagePicker() {
  const { lang, setLang } = useLanguage();
  return (
    <select className="lang-picker" aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as NameLang)}>
      {/* short codes keep the phone masthead within 360px; the full name is the tooltip */}
      {LANGS.map(([k, label]) => <option key={k} value={k} title={label}>{k.toUpperCase()}</option>)}
    </select>
  );
}
