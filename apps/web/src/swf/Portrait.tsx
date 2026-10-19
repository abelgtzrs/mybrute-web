import { memo } from "react";
import { persoParams } from "@mybrute/engine";
import { SwfPlayer } from "./SwfPlayer";

interface Props { gfx: string; name: string; flip?: boolean; lazy?: boolean; className?: string }

/** A brute drawn by the original perso.swf, frozen on its idle frame. */
export const Portrait = memo(function Portrait({ gfx, name, flip, lazy = true, className }: Props) {
  return (
    <SwfPlayer
      swf="perso.swf"
      params={persoParams(gfx, { stop: true, flip })}
      label={`Portrait of ${name}`}
      lazy={lazy}
      transparent
      className={"portrait " + (className ?? "")}
    />
  );
});
