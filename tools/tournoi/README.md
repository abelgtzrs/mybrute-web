# tournoi.swf (the Flash tournament bracket)

The original La Brute tournament bracket, rebuilt from Motion Twin's Haxe 2 source and extended from 64 to 256
entrants. The built file is committed as `apps/web/public/swf/tournoi.swf`; rebuilding is a manual step (it is not
part of `npm run build`).

## Rebuild

From the repo root:

```sh
sh tools/tournoi/get-haxe.sh   # once: downloads Haxe 2.10 into tools/tournoi/.haxe2/ (git-ignored)
sh tools/tournoi/build.sh      # writes apps/web/public/swf/tournoi.swf
```

- `build.sh` uses the Windows Haxe 2.10 build. Set `HAXE2_HOME` to use another Haxe 2.10 install.
- It also needs the original sources in `LaBrute/` (git-ignored, not in the repo): `LaBrute/src/com/Data.hx` (the
  `TournamentData` type) and `LaBrute/fla/tournoi/gfx.swf` (the art library).

## Files

- `src/Tournoi.hx`: Motion Twin's `LaBrute/fla/tournoi/Tournoi.hx`. Every change is marked `MyBrute++`.
- `src/Codec.hx`: a stand-in for Motion Twin's `Codec`, which is not in the archive. It reads the `data` flashvar as a
  plain Haxe-serialized value.
- `lib/mt/DepthManager.hx`, `lib/mt/bumdum/Lib.hx`: Motion Twin's libraries, unchanged.

## What the SWF expects (flashvar `data`)

A Haxe-serialized `TournamentData`: `_glads` (one `{ _id, _gfx, _lvl, _n, _u, _m }` per entrant in slot order),
`_perso` (absolute `perso.swf` URL), `_fight` (URL prefix), `_view` (`null`), `_user`, `_league` (rank 0..11; the
podium has one frame per rank) and `_max` (bracket size). A VS badge is clickable only for the player's own decided
fights (one side's `_u == _user`), and opens `_fight + <round, 1-based>`.

## Credits and licence

`lib/mt/` comes from [motion-twin/WebGamesArchives](https://github.com/motion-twin/WebGamesArchives)
(`libs-haxe2/mt`, commit `8b8e2f202e1fa8cdf1d96e4140dad0cba458054e`) by Motion Twin, licensed
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). `src/Tournoi.hx` is adapted from Motion Twin's
La Brute source (`LaBrute/fla/tournoi/`). MyBrute++ is non-commercial.
