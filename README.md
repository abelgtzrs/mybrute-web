# MyBrute++

A modern home for the original Muxxu La Brute / El Bruto, built around the recovered original engine:
the Haxe-compiled `Gladiator` and `Arena` (progression and combat) and the original Flash SWFs played through Ruffle.

- **Classic mode:** accounts, persistent brutes, ten training fights a day, authentic level-up choices.
  The server decides every fight with the original engine; `client.swf` plays it back.
- **Laboratory:** unrestricted experiments: any brute, level, choices or appearance, team fights, historical payloads.
  Lab copies never change Classic brutes.
- **Tournaments:** separate competition page with single/double elimination, round robin, MLB-style divisions and playoffs,
  and the current 36-entrant UEFA Champions League-style league phase. Enter saved Lab brutes, generated brutes, or rosters; simulate rounds or watch fights in a side panel (with a viewer mode).
  Elimination brackets show brute headshots; a watched fight's result, bracket and standings update only once it ends.

## Layout

| Path | What it is |
|---|---|
| `packages/engine` | The original engine files, vendored unchanged (see `vendor/VENDOR.md`), plus typed adapters: payload build/import, progression, appearance, inventory, combat stats, the Lab's avoid list. Shared by the browser and the server. |
| `apps/server` | Fastify API + PostgreSQL: accounts, sessions, brutes, opponents, fights, level-ups, Lab and tournament saves. SQL migrations in `migrations/`. |
| `apps/web` | Vite + React app: Classic, Laboratory, and Tournaments pages. Ruffle is pinned and self-hosted from `public/ruffle`; SWFs live in `public/swf`. |
| `legacy/` | The previous single-page lab and the client-only prototype, kept for reference. |

## Engine knowledge base

For a readable guide to the original Haxe engine, start with the [engine knowledge base](docs/engine/index.md), also shown in the app's **Guide** page (`/guide`, rendered from these same files). It links concept pages for the arena, shared data definitions, gladiator progression, and localization.

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

| `ADMIN_USERNAMES` | comma-separated usernames that are admins (applied at startup and when they register) |

### Deploy on Railway

Railway builds from GitHub, runs the server, and provides Postgres and an HTTPS address. Nothing in
the repo is Railway-specific; these settings live in its dashboard.

1. Create a project at [railway.com](https://railway.com) and choose **Deploy from GitHub repo**. Pick this repo and the `main` branch.
2. In the same project, add a **PostgreSQL** database.
3. In the app service's **Settings**, set:
   - Build command: `npm run build`
   - Start command: `npm run start -w @mybrute/server`
   - Healthcheck path: `/`
4. In the app service's **Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (a reference to the database from step 2) |
   | `NODE_ENV` | `production` |
   | `COOKIE_SECURE` | `1` |
   | `HOST` | `0.0.0.0` |
   | `ADMIN_USERNAMES` | the username you will register with |

   Leave `PORT` unset: Railway supplies it.
5. In **Settings → Networking**, generate a public domain. That HTTPS address is the game.
6. Open it and register the `ADMIN_USERNAMES` account. It gets the Admin and Laboratory links.

Every push to `main` redeploys. Migrations run on each start.

## Admin tools

Admins get an **Admin** link in the menu (`/admin`). Make the first one from the command line, after
registering the account (uses `DATABASE_URL`, or the embedded development database when it's unset):

```sh
npm run admin -w @mybrute/server -- grant <username>    # also: revoke <username>, list
```

| Page | What admins can do |
|---|---|
| Overview | Player, brute and fight counts, today's results, the highest levels, recent admin changes |
| Players | Search; per player: make or remove admin, suspend (with a reason shown at sign-in) or lift it, set a brute limit, reset the password, sign out everywhere, delete the account |
| Brutes | Search by name, id or owner; per brute: the full cell, set XP, give back today's fights, undo the last level-up, rename, move to another player, delete |
| Fights | Every fight, filtered by result, brute, owner or opponent; watch any of them |
| Settings | Brutes per player and fights per brute per day |
| Log | Every admin change: who, what, when |

Safeguards:
- Every change is written to the log in the same transaction as the change.
- Admins can't change, suspend, reset or delete their own account. Another admin's account has to lose
  its admin role before it can be suspended or deleted.
- Suspending ends the player's sessions. A suspended player only learns about the suspension after
  entering the right password.
- Admins can't edit stats or level-up choices; those always come from the original engine. "Undo the last
  level-up" is exact: it refunds the XP, and the same two rewards come back, because offers depend only on
  earlier choices.

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
