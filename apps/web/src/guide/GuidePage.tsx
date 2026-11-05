import { useEffect } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import indexDoc from "../../../../docs/engine/index.md?raw";
import arenaDoc from "../../../../docs/engine/arena.md?raw";
import dataDoc from "../../../../docs/engine/data.md?raw";
import gladiatorDoc from "../../../../docs/engine/gladiator.md?raw";
import langDoc from "../../../../docs/engine/lang.md?raw";
import weaponsDoc from "../../../../docs/engine/weapons.md?raw";
import skillsDoc from "../../../../docs/engine/skills.md?raw";
import petsDoc from "../../../../docs/engine/pets.md?raw";
import { Markdown } from "./Markdown";
import "./guide.css";

// The Markdown files in docs/engine are the single source of truth for this page.
const GENERAL = [
  { slug: "weapons", title: "Weapons", blurb: "Every weapon's stats and odds", source: weaponsDoc },
  { slug: "skills", title: "Skills", blurb: "Abilities, supers and talents", source: skillsDoc },
  { slug: "pets", title: "Pets", blurb: "Dogs, panther and bear", source: petsDoc },
];
const MODULES = [
  { slug: "arena", title: "Arena", blurb: "Turns, attacks, supers and winning", source: arenaDoc },
  { slug: "data", title: "Data", blurb: "Enums, events, weapons and weights", source: dataDoc },
  { slug: "gladiator", title: "Gladiator", blurb: "Stats, level-ups and bonuses", source: gladiatorDoc },
  { slug: "lang", title: "Lang", blurb: "Languages and display names", source: langDoc },
];
const PAGES = [...GENERAL, ...MODULES];

export function GuidePage() {
  const { page } = useParams();
  const { hash, pathname } = useLocation();
  const current = PAGES.find((p) => p.slug === page);

  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else document.querySelector("main")?.scrollTo({ top: 0 });
  }, [hash, pathname]);

  return (
    <div className="guide">
      <aside className="guide-nav panel" aria-label="Engine guide">
        <h3>Engine guide</h3>
        <NavLink to="/guide" end>Overview</NavLink>
        {[["General", GENERAL], ["Source modules", MODULES]].map(([label, group]) => (
          <div key={label as string} className="guide-group">
            <h4>{label as string}</h4>
            {(group as typeof GENERAL).map((p) => (
              <NavLink key={p.slug} to={`/guide/${p.slug}`}>
                {p.title}
                <small>{p.blurb}</small>
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <article className="guide-body panel">
        {page && !current ? (
          <>
            <h2>Page not found</h2>
            <p><Link to="/guide">Back to the guide overview</Link></p>
          </>
        ) : (
          <Markdown source={current ? current.source : indexDoc} />
        )}
      </article>
    </div>
  );
}
