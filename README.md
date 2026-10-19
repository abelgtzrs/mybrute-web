# MyBrute++

A modern home for the original Muxxu La Brute / El Bruto, built around the recovered original engine:
the Haxe-compiled `Gladiator` and `Arena` (progression and combat) and the original Flash SWFs played through Ruffle.

## Layout

| Path | What it is |
|---|---|
| `packages/engine` | The original engine files, vendored unchanged (see `vendor/VENDOR.md`), plus typed adapters: payload build/import, progression, appearance, inventory and combat stats. Shared by the browser and (later) the server. |
| `apps/web` | Vite + React app. Today: the Laboratory. Ruffle is pinned and self-hosted from `public/ruffle`; SWFs live in `public/swf`. |
| `legacy/` | The previous single-page lab and the client-only prototype, kept for reference. |

## Setup

Needs Node 20 or newer.

```sh
npm install          # also copies the pinned Ruffle build into apps/web/public/ruffle
npm run dev          # http://localhost:5173/lab
npm test             # engine tests (golden replays, payload round-trips, progression, stats)
npm run build        # production build of the web app (apps/web/dist)
```

## Engine rules worth knowing

- A brute's displayed level is its level-up count + 1. A new brute is level 1 with 0 level-ups.
- Level-up choice `i` (0-based) is stored as bit `i`, least significant bit first. Picking the second option also
  reseeds the brute's RNG, so it changes every later offer. Offers at level-up `i` depend only on choices before `i`.
- A `client.swf` payload carries the fight's inputs (seed, brutes, team properties), and the SWF re-simulates the fight.
  `FightAPI.run` is the same Arena in JS, so the server can compute the authoritative result and the SWF plays it back.
- `client.swf` opens the payload's `_end` URL when the winner banner appears. The app uses that to know when playback has finished.

## Regenerating engine wrappers and fixtures

```sh
npm run gen -w @mybrute/engine      # after changing anything in packages/engine/vendor
npm run golden -w @mybrute/engine   # re-records fixtures from legacy/ (the unpatched originals)
```
