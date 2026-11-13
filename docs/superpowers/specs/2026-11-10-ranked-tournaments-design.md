# Ranked tournaments: design

Date: 2026-11-10, revised 2026-11-13 · Status: implemented; full bracket addendum approved, not built

## Goal

Classic brutes earn ranks by winning daily tournaments. A brute's rank sets the NPC level range of its tournaments
and a level cap. At the cap, a time capsule lets the brute rewind and try a different branch of level-up choices.
Tournament results stay hidden until the player opens each round, so watching a round is never spoiled.

Non-goals: other players' brutes as NPCs; leaderboards; brute
transfers; any change to the admin Lab tournament tool (`apps/web/src/tournaments/`, `tournament_saves`).

Anti-goals (a failure even if it works): a tournament result visible anywhere (XP bar, rank icon, history, fight URL,
API) before its round is opened; a brute that can neither fight nor level up; rewards paid twice for one round.

## Ranks

Every new brute starts at rank 0. Icons: `LaBrute/www/img/icons/<rank>.png` (0–11), copied to `apps/web/public/ranks/`.

| # | Rank | NPC levels | Player cap | Titles to rank up |
|---|------|-----------|-----------|-------------------|
| 0 | Padawan | 10–15 | 20 | 3 |
| 1 | Finger Flicker | 15–25 | 30 | 3 |
| 2 | Plaster Puller | 25–35 | 40 | 3 |
| 3 | Cheeky Slapper | 35–50 | 55 | 3 |
| 4 | Fist of Steel | 45–65 | 75 | 4 |
| 5 | Blazing Avenger | 60–80 | 90 | 4 |
| 6 | Furious Soul | 75–100 | 110 | 4 |
| 7 | Haemogoblin | 90–120 | 130 | 4 |
| 8 | Sword Swallower | 100–135 | 155 | 5 |
| 9 | Satan's Bicep | 115–150 | 170 | 5 |
| 10 | Chaos Dentist | 130–170 | 190 | 5 |
| 11 | Brutal Legend | 150–200 | 220 | — (top rank) |

Levels are display levels (`level_ups + 1`). The table lives once, in the server (`ranked.ts`). Brute summaries send
the derived values (rank name, cap, titles needed, today's bracket size), so the web app only maps rank → icon.
The table is kept as is even though a new level-1 brute meets level 10–15 Padawans (decided).

## Admin brutes

- New column `brutes.admin_brute boolean not null default false`, set to true when an admin creates the brute.
  Migration backfills it from the current owner's role. It never changes afterwards, even if the owner is demoted.
- Admin brutes ignore level caps, cannot use the time capsule (they never need it) and still earn ranks.
- Admin-only edit powers (unlimited appearance changes, etc.) keep checking the *current user's* role, as today.
- An "Admin brute" label shows wherever brutes are listed: cell, My brutes, opponents, tournament pages.

## XP, cap and banking

- XP is always added (banked), with no upper limit, from both training and tournament fights.
- Cap = the rank's player cap, or none for admin brutes.
- A level-up is *waiting* only when `display level < cap and xp >= requiredXp(level)`. This one rule replaces
  `isPending` everywhere `pending_level_up` is written (training fight, tournament reward, level-up, rank-up,
  capsule). A brute at its cap with banked XP therefore never has a waiting level-up and can always fight.
- `levelUp` refuses when display level >= cap (guard, in addition to the rule above).
- A rank-up raises the cap; recompute waiting right away. Banked XP may cover several levels; the existing level-up
  code already carries leftover XP over and recomputes, so the player picks them one at a time.
- Migration: set `pending_level_up = false` for non-admin brutes whose display level is >= 20 (rank 0 cap), so no
  existing brute is stuck.
- Brutes created or imported above their cap keep their level, bank XP, and cannot level up until a rank-up lifts
  the cap. They cannot use the capsule (it needs the level to equal the cap exactly).
- The cell's XP bar shows "banked" when the brute is at or above its cap.

## Tournaments

### Entering — `POST /api/brutes/:id/tournament`

1. Owner only. Lock the brute row.
2. Refuse if the brute already entered today (Classic day, Europe/Paris, `classicDay()`). The unique key
   `(brute_id, day)` on `classic_tournaments` makes this safe under concurrent requests. This check comes first,
   so a double click, retry or second tab never opens today's rounds.
3. If the brute has a tournament from a *past* day with unopened rounds, open them all (same as "Skip to result",
   rewards included) and commit that in its own transaction. The new tournament's rank and size depend on it.
4. Refuse if a level-up is waiting (`level_up_pending`, same as training fights). This runs after step 3, which
   may leave one waiting; the player levels up and enters again.
5. Snapshot the brute: `seed_id, name, gfx, level_ups, bits`. All of its fights use this snapshot, so later
   training, level-ups or a capsule rewind never change the tournament.
6. Size = `min(16 × 2^rank_titles, 256)` (16, 32, 64, 128, 256; rank 11 stays at 256).
7. Entrants: the brute plus `size − 1` NPCs. Each NPC: a random seed id (unique in the bracket, not the brute's),
   a level picked uniformly from the rank's range, random level-up choices and random gfx, generated the same way
   `newOpponents` does. Name = `String(seedId)`, as for training opponents.
8. The brute goes into a random slot. Simulate round by round with standard single-elimination pairing (adjacent
   slots meet) until the brute is knocked out or wins the final. NPC-vs-NPC fights matter only for who the brute
   meets next; they are not stored.
9. A fight that ends in a draw is rerun with seed + 1, up to 20 tries (as `resolveMatch` in the Lab does); the
   stored spec is the one that produced the winner. If all 20 draw, the winner is picked from the seed's parity
   and the stored spec is the original one. (Measured: 0 draws in 160 fights at levels 15–200.)
10. Store the tournament (below). Nothing is written to `fights` and no reward is paid yet. Simulation of a full
    256 bracket takes about 0.1 s, so it runs inside the request.
11. Respond with the tournament view (below).

### Opening rounds — `POST /api/brutes/:id/tournaments/:tid/open` `{ all?: boolean }`

- Opens the next unopened round (or every remaining round with `all: true`). Rounds open strictly in order.
- Allowed while a level-up is waiting (the snapshot makes it safe), so "Skip to result" never stops partway. The
  tournament page shows a "level-up waiting" notice with a link to the cell when one is.
- In one transaction, locking the brute row and the tournament row:
  - insert the round's fight into `fights` (spec, result, events, stats from the stored round; `level_ups` =
    snapshot level-ups; `xp_awarded` = the fight's XP; `xp_after` / `pending_after` = the brute's values after
    this round's rewards), tagged with `tournament_id` and `tournament_round`;
  - pay the round's rewards and bump `rounds_opened`.
- Idempotent: the unique key `(tournament_id, tournament_round)` on `fights` plus `rounds_opened` mean a double
  click or a retried request pays nothing extra. Opening when everything is open returns the current view.
- Returns the opened fight id(s) and the updated view. "Watch" = open, then go to `/fights/:id`; "Skip to result" =
  open with `all: true`.

### Rewards (paid as each round opens)

- Won fight: +2 XP. Lost fight: 0 XP. A brute knocked out keeps the XP from the wins before.
- Winning the final (a title), on top of the +2 for the final:
  - n = `titles_before + 1`, using the rank and titles stored at entry; title XP = `5 × min(n, 5)` (5, 10, 15,
    20, 25, then 25 forever, including rank 11).
  - `rank_titles += 1`; if it reaches the rank's requirement and rank < 11, `rank += 1` and `rank_titles = 0`
    (the next bracket goes back to 16). Rank 11 keeps counting titles. Then recompute the waiting level-up.
- A lost tournament changes nothing else. Tournament fights do not use the daily training fights.

### What the player can see before opening

The tournament view shows: day, rank, size, the opened rounds in full (opponent name, level, gfx, result, Watch
link), and the opponent of the next round only. It never shows how many rounds the brute won, later opponents,
`champion`, or totals until every round is open. The stored record holds the full outcome, so the API must build
this view, never return the raw row to the client.

### Other routes

- `GET /api/brutes/:id/tournaments?page=` — the brute's tournaments, newest first (for the History tab). Each row:
  day, rank, size, rounds opened; result shown only when fully opened ("Round of 32", "Champion"), else "Open".
- `GET /api/brutes/:id/tournaments/:tid` — one tournament view.
- `POST /api/brutes/:id/time-capsule` `{ level }` — see below.

Paths live under `/api/brutes/...` so they don't clash with the admin Lab `/api/tournaments` routes.

## Time capsule

- Available only when the brute is not an admin brute and its display level equals its rank's cap exactly.
- The player picks a target display level from 1 to cap − 5.
- In one transaction: delete `level_ups` rows with `idx >= target − 1`; cut `bits` to `target − 1` choices; set
  `level_ups = target − 1`; **keep `xp` (the bank)**; recompute the waiting level-up (the brute is now below its
  cap, so banked XP usually lets it climb straight back, picking a new branch). Open opponent offers go stale
  through their existing `level_ups` check. Rank, titles, fight history and unopened tournaments (snapshotted) are
  untouched.
- Usable any number of times. The UI asks for confirmation, because a rewind can't be undone.

## Data (migration 006)

- `brutes`: `rank smallint not null default 0 check (rank between 0 and 11)`,
  `rank_titles smallint not null default 0 check (rank_titles >= 0)`, `admin_brute boolean not null default false`;
  backfill `admin_brute`; clear stuck `pending_level_up` (see XP section).
- `classic_tournaments`: `id bigserial`, `brute_id` (cascade), `day date`, `rank`, `titles_before`, `size`,
  `snapshot jsonb`, `rounds jsonb` (one entry per brute fight: opponent `{ seedId, name, gfx, levelUps, bits }`,
  `spec`, `result`, `events`, `playerStats`, `opponentStats`), `rounds_opened smallint not null default 0`,
  `champion boolean`, `created_at`. Unique `(brute_id, day)`. Only the opponents the brute actually met are stored.
- `fights`: `offer_id` becomes nullable; add `tournament_id bigint references classic_tournaments on delete cascade`
  and `tournament_round smallint`; check exactly one of `offer_id` / `tournament_id` is set; unique
  `(tournament_id, tournament_round)`.

## Where tournament fights show up

- Win/loss records (`records()`) and lifetime stats (`lifetime()`): training fights only (`offer_id is not null`).
- History page: two tabs, **Fights** (training only, as today) and **Tournaments** (the list above, each row
  linking to its tournament page).
- Fight page: a tournament fight shows "Round X of Y" (Y = log2(size), the full bracket, so it leaks nothing) and
  a link back to its tournament instead of the training XP lines.
- Brute summaries show the stored rank and bracket size, even when a past unopened tournament may change them;
  working out the real values would leak its result.
- Admin overview, player and brute fight counts: include tournament fights (they are real fights).

## Server

New `apps/server/src/ranked.ts`: rank table, `capFor`, `titlesNeeded`, `bracketSize`, the waiting rule, bracket
simulation, `enterTournament`, `openRounds`, `listBruteTournaments`, `getBruteTournament`, `useTimeCapsule`.
`classic.ts`: the waiting rule in training fights and level-up, the cap guard in `levelUp`, `admin_brute` set in
`createBrute`, `rank`/`rankTitles`/rank info/`adminBrute` in brute summaries, training-only records and lifetime,
tournament info in `getFight`. `admin.ts`: the admin "set XP" and "undo last level-up" actions also write `pending_level_up`, so they use the
waiting rule too.

## Web

- Cell page rank panel: icon, rank name, titles x/N, today's bracket size, "Enter today's tournament" (disabled
  with a reason while a level-up is waiting; once entered, a link to today's tournament), the time capsule control
  when available, "banked" on the XP bar at the cap.
- Tournament page `/brutes/:id/tournaments/:tid`: opened rounds (opponent, level, result, Watch), the next
  opponent with "Watch" and "Skip to result", final placing once fully opened.
- History page tabs (above). Rank icon and "Admin brute" label in My brutes, the cell and the opponents screen.

## Testing (server)

- Rank table: 12 rows, NPC ranges inside caps, sizes cap at 256.
- Entry: one per day, including two concurrent requests; refused while a level-up is waiting; a past day's
  unopened tournament is opened and paid first; entering again today does not open today's rounds.
- Opening works while a level-up is waiting.
- Snapshot: training/level-up/capsule after entry doesn't change the tournament's fights.
- Hiding: before opening, no `fights` row exists and the view leaks no later opponents, round count or champion.
- Opening: in order; double/concurrent open pays once; `all: true` opens the rest.
- Rewards: +2 per win, 0 per loss, title XP 5/10/15/20/25 then capped at 25; rank-up after 3/4/5 titles resets
  size to 16; rank 11 keeps counting.
- Cap and bank: XP banks at the cap with no waiting level-up and fights still allowed; level-up refused past the
  cap; rank-up turns banked XP into waiting level-ups; migration clears stuck pending.
- Capsule: refused below/above cap, for admin brutes and for targets above cap − 5; truncates choices, keeps XP.
- Admin flag: set at creation, survives the owner's demotion; admin brutes ignore caps.
- Records/lifetime exclude tournament fights; admin counts include them.

## Approaches considered

1. **Chosen — simulate at entry, store hidden, write each fight to `fights` when its round opens.** Hidden results
   can't leak, because they don't exist in `fights` yet, so no read path needs a "hidden" filter. The cost is one
   careful write path (opening), made idempotent with locks and a unique key.
2. All fights written to `fights` at entry, flagged hidden: simpler entry, but 8+ queries in `classic.ts` and
   `admin.ts` would need a filter, and sequential fight ids invite peeking. One missed filter spoils results.
3. A separate table for tournament fights: keeps `fights` untouched but needs a second fight page/replay path.

Also rejected: simulating each round only when it is watched. Same results as approach 1 once the brute is
snapshotted, with no speed benefit (0.1 s for a full bracket), and more ways to go wrong.

## Left to the builder

Exact UI layout and copy; how NPC gfx is randomized (reuse `newOpponents`); route handler wiring and response
shapes beyond the fields named here; pagination size for the tournaments list.

## Addendum (2026-11-13): full bracket, revealed round by round

The tournament page shows the whole bracket from the moment it loads (decided: reveal round by round, option A).

- **Simulation:** entry simulates the full bracket to a champion (NPC-vs-NPC fights included, even after the brute
  is knocked out). Still about 0.1 s for 256.
- **Stored (migration 007, nullable columns on `classic_tournaments`):** `entrants jsonb`, all `size` entrants in
  slot order as `{ seedId, name, gfx, levelUps }` (the brute included), `brute_slot smallint`, and
  `winners jsonb`, one array per round of the winning slot indexes in match order (round 1 has size/2 entries, the
  final 1). Only the brute's own fights keep full specs (the existing `rounds`). Rows from before this change have
  nulls and the page falls back to the round list.
- **Revealed rounds** = every round once the tournament is finished, otherwise `rounds_opened`. Opening round r
  reveals all of round r's results across the bracket. When the brute's losing round is opened, the tournament is
  finished, so the rest of the bracket, champion included, fills in.
- **View:** `TournamentView.bracket = { entrants: { name, level, gfx, isBrute }[], winners: number[][] } | null`.
  `winners` holds only revealed rounds. Nothing else about unrevealed rounds is sent (no bits, no seeds beyond what
  a name shows).
- **Web:** a scrollable bracket on the tournament page, one column per round, with the brute's path highlighted,
  winners moving up as rounds are revealed, unrevealed matches showing their entrants without a winner, and the
  Watch / Skip to result controls kept. Headshots load lazily (as in the Lab bracket) so a 256 bracket stays light.
  The existing opened-rounds list stays below the bracket.

## Addendum 2 (2026-11-13): the original Flash bracket (tournoi.swf), extended to 256

Replaces the HTML bracket from Addendum 1 for display (the server data from Addendum 1 stays).

- **Source:** the original `LaBrute/fla/tournoi/Tournoi.hx` + `gfx.swf`, compiled with Haxe 2.10 (Flash 8 target)
  against `mt/DepthManager.hx` and `mt/bumdum/Lib.hx` from motion-twin/WebGamesArchives (libs-haxe2). Motion
  Twin's `Codec` is not in the archive; a stand-in reads a plain Haxe-serialized `data` flashvar (the engine already
  has a Haxe serializer). The built `tournoi.swf` is committed under `apps/web/public/swf/` like the other SWFs;
  the modified source and a build script live in the repo so it can be rebuilt (build is not part of `npm run build`).
- **Extended to 7 and 8 rounds (decided: option 3):** the round count is computed from the entrant count instead
  of `TOTAL_MATCHES = 6`; the per-round layout tables (`dist`, `scales`, `CORNERS`) get entries for the extra
  rounds; the stage is as tall as the bracket (about 600 / 1,150 / 2,300 px for 64 / 128 / 256) and the page
  scrolls (decided: page scroll, `Stage.scaleMode = "noScale"`). The champion and podium move to the top centre;
  the tooltip clamps to the real stage height.
- **Data:** `TournamentData` built in the web app from `TournamentView.bracket`: `_glads` in slot order with `_m` =
  matches won *capped at the revealed rounds*, `_user` marking the player's brute, `_league` = rank (check the
  podium's frame count against the 12 ranks), `_max` = size, `_perso` = our `perso.swf`.
- **Clicks (decided):** only VS badges for the player's brute's own fights are clickable, and they open that fight's
  page. NPC-vs-NPC fights are not stored, so their badges do nothing. Clicking a brute does nothing.
- **To verify first (spike):** the unmodified SWF compiles and runs in Ruffle with its built-in random demo; how it
  draws a round whose results are hidden (it passes a null match to its drawing code, which AS2 may silently
  tolerate) — hidden rounds must show as empty slots, never as derived winners.
