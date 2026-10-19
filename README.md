# MyBrute++

A modern home for the original Muxxu La Brute / El Bruto, built around the recovered original engine:
the Haxe-compiled `Gladiator` and `Arena` (progression and combat) and the original Flash SWFs played through Ruffle.

- **Classic mode:** accounts, persistent brutes, ten training fights a day, authentic level-up choices.
  The server decides every fight with the original engine; `client.swf` plays it back.
- **Laboratory:** unrestricted experiments: any brute, level, choices or appearance, team fights, historical payloads.
  Lab copies never change Classic brutes.

## Layout

| Path | What it is |
|---|---|
| `packages/engine` | The original engine files, vendored unchanged (see `vendor/VENDOR.md`), plus typed adapters: payload build/import, progression, appearance, inventory, combat stats, the Lab's avoid list. Shared by the browser and the server. |
| `apps/server` | Fastify API + PostgreSQL: accounts, sessions, brutes, opponents, fights, level-ups, Lab saves. SQL migrations in `migrations/`. |
| `apps/web` | Vite + React app: Classic screens and the Laboratory. Ruffle is pinned and self-hosted from `public/ruffle`; SWFs live in `public/swf`. |
| `legacy/` | The previous single-page lab and the client-only prototype, kept for reference. |

## Development

Needs Node 20 or newer. No database setup: development and tests use an embedded PostgreSQL 17
(`apps/server/.pgdata`, created on first run).

```sh
npm install
npm run dev          # API on :3001 (with the embedded database) + web app on http://localhost:5173
npm test             # engine tests + API tests against a real database
npm run typecheck
```

Stop `npm run dev` with Ctrl+C. To use your own PostgreSQL instead, set `DATABASE_URL` before starting.

## Deployment

The server serves the built web app and the API from one process.

```sh
npm ci
npm run build                                  # builds apps/web/dist
DATABASE_URL=postgres://user:pass@host/db \
NODE_ENV=production COOKIE_SECURE=1 HOST=0.0.0.0 PORT=3001 \
npm run start -w @mybrute/server               # applies migrations, then serves everything
```

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required in production) |
| `COOKIE_SECURE=1` | send the session cookie only over HTTPS (set it behind TLS) |
| `HOST`, `PORT` | where to listen (default 127.0.0.1:3001) |
| `WEB_DIST` | built web app to serve (default `apps/web/dist`) |

Game settings live in the `settings` table: `max_brutes_default` (brutes per account, default 5) and
`daily_fights` (default 10). A single account can get its own limit through `users.max_brutes`.

```sql
update settings set value = '8' where key = 'max_brutes_default';
update users set max_brutes = 20 where lower(username) = 'someone';
```

## Classic rules

- A new brute is level 1. Its attributes, and the two rewards offered at every level-up, come from the original
  progression for its id and earlier choices. Its appearance and id are locked once created.
- XP to advance from level L is `2 × L`. A win gives 2 XP; a defeat or a draw (the arena's 1000-action limit) gives 1.
- Reaching the XP needed never levels up by itself: the brute waits until the player picks one of the two rewards.
  Fights are blocked until then. Extra XP carries over.
- Each brute has 10 training fights per day, reset at midnight Bordeaux time (Europe/Paris).
- Opponents: eight per visit, same level, random id (also their name), random choices and appearance.
  The server stores them, so a player can only fight an opponent it actually offered.
- The fight seed is picked when the fight is committed, so outcomes can't be scouted in advance. Each offer can
  be fought once; repeating the request returns the same fight. Results are saved before playback, so closing
  or reloading the page changes nothing.

## Engine rules worth knowing

- A brute's displayed level is its level-up count + 1.
- Level-up choice `i` (0-based) is stored as bit `i`, least significant bit first. Picking the second option also
  reseeds the brute's RNG, so it changes every later offer. Offers at level-up `i` depend only on choices before `i`.
- A `client.swf` payload carries the fight's inputs (seed, brutes, team properties), and the SWF re-simulates the fight.
  `FightAPI.run` is the same Arena in JS, so the server computes the authoritative result and the SWF plays it back.
- `client.swf` opens the payload's `_end` URL when the winner banner appears; the app uses that to reveal results.

## Regenerating engine wrappers and fixtures

```sh
npm run gen -w @mybrute/engine      # after changing anything in packages/engine/vendor
npm run golden -w @mybrute/engine   # re-records fixtures from legacy/ (the unpatched originals)
```
