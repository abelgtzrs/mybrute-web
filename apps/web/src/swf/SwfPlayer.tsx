import { useEffect, useRef, useState } from "react";
import { ruffleReady, SWF_BASE, type RufflePlayerElement } from "./ruffle";

interface Props {
  /** file name under /swf, e.g. "client.swf" */
  swf: string;
  /** FlashVars string */
  params: string;
  /** what the player shows, for screen readers and error text */
  label: string;
  className?: string;
  /** only client.swf needs this, so its _end javascript: URL can signal the page */
  allowScript?: boolean;
  /** don't create a player until the element is on screen (perso previews in long lists) */
  lazy?: boolean;
}

/**
 * One Ruffle instance per mounted component. A new `params` value reloads the same instance;
 * unmounting removes it. StrictMode's mount → unmount → mount simply creates a fresh player.
 */
export function SwfPlayer({ swf, params, label, className, allowScript = false, lazy = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<RufflePlayerElement | null>(null);
  const [visible, setVisible] = useState(!lazy);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible || !host.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    io.observe(host.current);
    return () => io.disconnect();
  }, [visible]);

  // create/destroy the player with the component
  useEffect(() => () => { player.current?.remove(); player.current = null; }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    ruffleReady()
      .then((ruffle) => {
        if (cancelled || !host.current) return;
        if (!player.current) {
          player.current = ruffle.createPlayer();
          player.current.style.width = "100%";
          player.current.style.height = "100%";
          player.current.setAttribute("aria-label", label);
          host.current.replaceChildren(player.current);
        }
        setError(null);
        return player.current.load({
          url: SWF_BASE + swf,
          parameters: params,
          base: SWF_BASE,
          allowScriptAccess: allowScript,
          autoplay: "on",
          letterbox: "on",
          contextMenu: "off",
          unmuteOverlay: "hidden",
          splashScreen: false,
          logLevel: "warn",
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message || `Couldn't load ${swf}.`));
    return () => { cancelled = true; };
  }, [visible, swf, params, allowScript, label]);

  return (
    <div className={"swf " + (className ?? "")} role="img" aria-label={label}>
      <div ref={host} className="swf-host" />
      {error && <p className="swf-error">{error}</p>}
    </div>
  );
}
