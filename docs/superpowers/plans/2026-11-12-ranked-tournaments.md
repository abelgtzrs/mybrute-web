# Ranked Tournaments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classic brutes enter one daily single-elimination tournament against NPCs, earn XP, titles and ranks; ranks set a level cap with banked XP and a time capsule rewind. Results stay hidden until each round is opened.

**Architecture:** Pure rank rules go in `rules.ts` (the existing Classic rules file). The bracket simulation is a pure module, `bracket.ts`. Database work (enter, open, list, view, capsule) lives in a new `ranked.ts` next to `classic.ts` and follows its pattern: one transaction per mutation, locking the brute row. Tournament fights are copied into the existing `fights` table only when their round opens, so hidden results never exist anywhere a player can read them.

**Tech Stack:** Fastify 5, Postgres (pg), vitest with embedded Postgres (`apps/server/test`), React + react-router (`apps/web`), `@mybrute/engine` (`runFight`, `extractStats`, `randomGfx`, `bitsToHex`, `hexToChoices`, `displayLevel`, `pendingOptions`).

**Spec:** `docs/superpowers/specs/2026-11-10-ranked-tournaments-design.md` (read it alongside this plan).

## Global Constraints

- Display level = `level_ups + 1`. All rank values come from the spec's 12-row table, defined once in `rules.ts`.
- Bracket size = `min(16 × 2^rank_titles, 256)`.
- Rewards: won fight +2 XP; lost fight 0; title XP = `5 × min(titles_before + 1, 5)`.
- Waiting level-up = `level < cap && xp >= requiredXp(level)`. Admin brutes have no cap.
- Classic day = `classicDay()` (Europe/Paris).
- Draw retry: seed + 1, up to 20 tries; then the winner is picked from the seed's parity (`seed & 1`: 0 = brute wins) and the original spec is stored.
- NPC names are `String(seedId)`; gfx comes from `randomGfx(rand)`.
- Tournament routes live under `/api/brutes/:id/...`. Never touch `/api/tournaments` (admin Lab tool) or `tournament_saves`.
- Before every round is opened, no API response may reveal later opponents, the number of rounds won, or `champion`.
- Code should read easily, with plain-language comments on the why (user preference).

## Review Focus

1. **Double-clicking Enter, or a second tab.** Today's rounds must stay unopened, and the second request gets `already_entered`. Test in Task 4.
2. **A past tournament that was never opened, followed by a new entry.** Its rewards are paid first, and the new bracket uses the updated rank and size. Test in Task 4.
3. **Opening rounds after the brute has trained, levelled up or rewound.** The fights still use the snapshot from entry. Test in Task 4 (training and level-up) and Task 6 (capsule).
4. **A brute with banked XP at its cap.** It can still train, the level-up flag stays false, and the cell shows "banked". Test in Task 2.
5. **Guessing a fight URL or tournament id that belongs to another player.** The answer is 404, the same as a missing one. Test in Task 4.

---

### Task 1: Rank rules

**Files:**
- Modify: `apps/server/src/rules.ts`
- Test: `apps/server/test/rules.test.ts`

**Interfaces:**
- Produces (all exported from `rules.ts`):
  - `interface Rank { name: string; npcMin: number; npcMax: number; cap: number; titlesNeeded: number | null }`
  - `const RANKS: readonly Rank[]` (12 rows, exactly the spec table, in order)
  - `const TOP_RANK = 11`
  - `capFor(rank: number, adminBrute: boolean): number` (returns `Infinity` for admin brutes)
  - `bracketSize(rankTitles: number): number`
  - `titleXp(titlesBefore: number): number`
  - `isWaiting(xp: number, displayLevel: number, cap: number): boolean`
  - `rankInfo(rank: number, rankTitles: number, adminBrute: boolean): { rank: number; name: string; titles: number; titlesNeeded: number | null; cap: number | null; bracketSize: number }` (`cap` is null for admin brutes)

- [ ] **Step 1: Write the failing tests** in `rules.test.ts`, in a new `describe("ranks")`:
  - `"has 12 ranks whose NPC ranges sit below their caps"`: `RANKS.length === 12`; for every rank, `npcMin <= npcMax < cap`; `RANKS[11].titlesNeeded === null`; titles needed are 3,3,3,3,4,4,4,4,5,5,5.
  - `"sizes brackets by titles and caps them at 256"`: `bracketSize(0) === 16`, `bracketSize(2) === 64`, `bracketSize(4) === 256`, `bracketSize(9) === 256`.
  - `"pays 5, 10, 15, 20, 25 XP for titles, then 25"`: `[0,1,2,3,4,5,40].map(titleXp)` equals `[5,10,15,20,25,25,25]`.
  - `"only waits for a level-up below the cap"`: `isWaiting(40, 19, 20) === true`; `isWaiting(999, 20, 20) === false`; `isWaiting(999, 25, capFor(0, true)) === true`.
  - `"gives admin brutes no cap"`: `capFor(0, false) === 20`; `capFor(0, true) === Infinity`; `rankInfo(0, 0, true).cap === null`.
- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @mybrute/server -- rules`. Expected: FAIL, imports not found.
- [ ] **Step 3: Implement** the interfaces above in `rules.ts`, below `isPending`. Leave `isPending` in place; Task 2 replaces its callers.
- [ ] **Step 4: Run them and check they pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Add rank table and cap rules`.

### Task 2: Migration, admin flag, cap and banking in training, level-ups and admin tools

**Files:**
- Create: `apps/server/migrations/006_ranked_tournaments.sql`
- Modify: `apps/server/src/classic.ts` (`BruteRow`, `summary`, `createBrute`, `startFight`, `levelUp`)
- Modify: `apps/server/src/admin.ts` (`setXp`, `undoLevelUp`, its `BruteRow`)
- Modify: `apps/server/test/helpers.ts` (`reset` truncates `classic_tournaments`)
- Test: `apps/server/test/classic.test.ts`, `apps/server/test/admin.test.ts`

**Interfaces:**
- Consumes: Task 1 (`capFor`, `isWaiting`, `rankInfo`).
- Produces:
  - Columns `brutes.rank`, `brutes.rank_titles`, `brutes.admin_brute`.
  - Table `classic_tournaments` and the new `fights` columns, exactly as in the spec's "Data" section. Postgres doesn't allow forward references, so create `classic_tournaments` before altering `fights`.
  - The brute summary gains `adminBrute: boolean`, `rank: ReturnType<typeof rankInfo>` and `banked: boolean` (true when the level is at or above the cap).
  - `BruteRow` (classic.ts) gains `rank: number; rank_titles: number; admin_brute: boolean`.

- [ ] **Step 1: Write the failing tests** (classic.test.ts, new `describe("ranks and caps")`):
  - `"starts brutes at rank 0, flags brutes an admin creates, and keeps the flag after demotion"`: a player's brute has `rank.rank === 0`, `adminBrute === false`. Set the user's role to admin, create a second brute, and it has `adminBrute === true`. Set the role back to player and the brute still has `adminBrute === true`.
  - `"banks XP at the cap without a waiting level-up, and fights stay allowed"`: `raise(id, 19)` (level 20, rank 0 cap 20), set `xp = 100`, fight once. Expected: status 200, `pending_level_up === false`, xp is 101 or 102, cell `brute.banked === true`.
  - `"refuses a level-up at the cap"`: level 20, `xp = 100`, force `pending_level_up = true` in the database, POST level-up `{ index: 19, choice: 0 }`. Expected: status 409, error `"level_cap"`.
  - `"lets an admin brute level past the cap"`: admin-flagged brute at level 20 with `xp = 100`. One fight leaves `pending_level_up === true`.
  - admin.test.ts `"set XP follows the cap"`: a player brute at level 20, admin sets XP to 500. Expected: `pendingLevelUp === false`.
- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @mybrute/server -- classic admin`. Expected: FAIL.
- [ ] **Step 3: Write migration 006.** Write the columns, the table and the `fights` changes from the spec. Then add the backfill `update brutes b set admin_brute = true from users u where u.id = b.owner_id and u.role = 'admin'` and the unstick `update brutes set pending_level_up = false where not admin_brute and level_ups + 1 >= 20`. Also add the check `(offer_id is null) <> (tournament_id is null)` and a unique index on `(tournament_id, tournament_round)`.
- [ ] **Step 4: Wire the rules.**
  - `createBrute`: insert `admin_brute = (role === "admin")`.
  - `startFight`: compute `pendingAfter` with `isWaiting(xpAfter, level, capFor(b.rank, b.admin_brute))`.
  - `levelUp`: before the existing pending check, throw `conflict("This brute has reached its rank's level cap. Win tournaments to raise it.", "level_cap")` when `displayLevel(b.level_ups) >= cap`. Compute the new `pending` with `isWaiting`.
  - `admin.ts` `setXp` and `undoLevelUp`: use `isWaiting` with the brute's cap. Add `rank` and `admin_brute` to admin's `BruteRow` (it already selects `b.*`).
  - `summary`: add the fields from Interfaces.
  - Remove `isPending` from `rules.ts` once nothing imports it, and drop its old test if one exists.
- [ ] **Step 5: Run them and check they pass.** Run `npm test -w @mybrute/server`. Expected: all PASS, including the old suites.
- [ ] **Step 6: Commit.** Message: `Ranks, admin brute flag and level caps with banked XP`.

### Task 3: Bracket simulation (pure)

**Files:**
- Create: `apps/server/src/bracket.ts`
- Test: `apps/server/test/bracket.test.ts` (no database)

**Interfaces:**
- Consumes: `RANKS` (Task 1); engine `runFight`, `extractStats`, `randomGfx`, `bitsToHex`, `hexToChoices`, `FightSpec`, `FighterStats`.
- Produces:
  - `interface Snapshot { seedId: number; name: string; gfx: string; levelUps: number; bits: string }`
  - `interface Npc { seedId: number; name: string; gfx: string; levelUps: number; bits: string }`
  - `interface BracketRound { opponent: Npc; spec: FightSpec; result: "win" | "loss"; events: number; playerStats: FighterStats; opponentStats: FighterStats }`
  - `simulateBracket(snapshot: Snapshot, rank: number, size: number, rand: (n: number) => number): BracketRound[]`
  - `decideFight(spec: FightSpec): { spec: FightSpec; win: 0 | 1; events: number; stats: Map<number, FighterStats> }` (exported for testing)

Approach: build `size − 1` NPCs (unique seed ids, never the brute's; level from `npcMin + rand(npcMax − npcMin + 1)`; random choices; `randomGfx(rand)`). Put the brute in slot `rand(size)`. Then loop over rounds: pair adjacent slots and run every fight with `decideFight`. The brute is always team 0, in brute-vs-NPC fights and in NPC-vs-NPC ones, where the left slot takes team 0. Record a `BracketRound` only for the brute's fight. Stop after the brute loses or after the final.

- [ ] **Step 1: Write the failing tests:**
  - `"plays the brute's path through a 16-brute bracket"`: `simulateBracket(snap, 0, 16, cryptoRand)`. Expected: 1 to 4 rounds; every round except the last is a `"win"`; if there are fewer than 4 rounds, the last is a `"loss"`; opponent levels (`levelUps + 1`) are between 10 and 15; every opponent seed id is different and none equals `snap.seedId`.
  - `"stores specs that replay to the stored result"`: for each round, `runFight(round.spec).win` equals `round.result === "win" ? 0 : 1`, unless all 20 tries drew, which the test can't force, so just assert that `spec.brutes[0].id === snap.seedId`.
  - `"a champion wins every round of a 256 bracket"`: give a level-500 snapshot at rank 0 (`levelUps: 499`) and 256 entrants. Expected: `rounds.length === 8` and all are wins. This also checks speed: assert it takes under 2000 ms.
- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @mybrute/server -- bracket`. Expected: FAIL.
- [ ] **Step 3: Implement `bracket.ts`** as described above. `decideFight` follows the spec's "Draw retry" constraint.
- [ ] **Step 4: Run them and check they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Pure single-elimination bracket simulation`.

### Task 4: Enter, open, view and list tournaments

**Files:**
- Create: `apps/server/src/ranked.ts`
- Modify: `apps/server/src/app.ts` (routes)
- Modify: `apps/server/src/classic.ts` (export `ownedBrute`, `dayString`, `getSettings`, `summary`, `records`, `emptyRecord` if `ranked.ts` needs them; prefer exporting over copying)
- Test: `apps/server/test/ranked.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 2 columns, Task 3 `simulateBracket`, `Snapshot`, `BracketRound`.
- Produces:
  - `enterTournament(db, userId, bruteId): Promise<{ tournament: TournamentView }>`
  - `openRounds(db, userId, bruteId, tid, body: unknown): Promise<{ fightIds: string[]; tournament: TournamentView }>`
  - `getBruteTournament(db, userId, bruteId, tid): Promise<{ tournament: TournamentView }>`
  - `listBruteTournaments(db, userId, bruteId, page: number): Promise<{ total; page; pageSize; items: TournamentListItem[] }>`
  - `TournamentView = { id: string; day: string; rank: number; rankName: string; size: number; totalRounds: number; roundsOpened: number; finished: boolean; champion: boolean | null; rounds: OpenedRound[]; next: { opponent: { name: string; level: number; gfx: string } } | null }`. Here `OpenedRound = { round: number; fightId: string; result: "win" | "loss"; opponent: { name; level; gfx } }`, `totalRounds = log2(size)`, `champion` is null until `finished`, and `next` is set only while the round after the last opened win still exists.
  - `TournamentListItem = { id; day; rank; rankName; size; roundsOpened; finished: boolean; placing: string | null }`. `placing` is null until finished, then `"Champion"`, `"Final"`, `"Semi-final"`, `"Quarter-final"` or `"Round of N"` for the round the brute lost in.
  - Routes: `POST /api/brutes/:id/tournament`, `GET /api/brutes/:id/tournaments?page=`, `GET /api/brutes/:id/tournaments/:tid`, `POST /api/brutes/:id/tournaments/:tid/open`.

Rules: follow the spec's "Entering" steps 1–11 in order and the "Opening rounds" and "Rewards" sections. The past-day auto-open in step 3 calls the same internal `openAll(tx, brute, tournamentRow)` that `openRounds` uses, in its own `withTx`, before the entry transaction. A tournament fight's `fights` row: `offer_id` null, `tournament_id`, `tournament_round` (1-based), `xp_awarded` = 2 or 0 (title XP is not added to the fight row), `level_ups` = snapshot level-ups, `xp_after` and `pending_after` = the brute's values after this round's rewards.

- [ ] **Step 1: Write the failing tests** (`ranked.test.ts`, same harness pattern as `classic.test.ts`; force outcomes by setting brute or NPC strength through `raise`):
  - `"enters once a day and refuses a second entry without opening anything"`: enter returns 200 with `roundsOpened === 0` and `rounds === []`. A second enter returns 409 `"already_entered"`, `select count(*) from fights where tournament_id is not null` is 0, and `roundsOpened` is still 0. Two concurrent enters (`Promise.all`) give exactly one 200.
  - `"refuses entry while a level-up is waiting"`: `pending_level_up = true` gives 409 `"level_up_pending"`.
  - `"hides results until rounds are opened"`: for a level-500 brute (a sure champion) right after entering, `rounds === []`, `champion === null`, the list item has `placing === null`, `next.opponent` is set, and the serialized response doesn't contain the second round's opponent seed id (read it from the database row to compare).
  - `"opens rounds in order and pays each once"`: opening once gives `fightIds.length === 1`, xp + 2, and a `fights` row with `tournament_round = 1`. Opening with `{ all: true }` opens the rest. For a champion at rank 0 with 0 titles, total XP gained is 4×2 + 5 = 13 and `rank_titles === 1`. Opening again changes nothing. Two concurrent opens pay once.
  - `"third title ranks up and resets the bracket to 16"`: set `rank_titles = 2` (size 64, so 6 rounds). After opening everything, `rank === 1`, `rank_titles === 0`, `rankInfo.bracketSize === 16`, and XP gained = 6×2 + 15.
  - `"rank 11 keeps counting titles and pays at most 25"`: `rank = 11, rank_titles = 7`. Size 256, title XP 25, `rank_titles === 8`.
  - `"a knocked-out brute keeps XP for its wins and gains no title"`: a level-1 brute at rank 0 loses in round 1 (NPCs are level 10–15). XP gained is 0, `rank_titles === 0`, and the list item shows `placing === "Round of 16"`.
  - `"opening a past day's unopened tournament happens before a new entry"`: enter, move `day` back one day in the database, then enter again. The old tournament is fully opened, its rewards are paid, and the new one is created.
  - `"fights use the snapshot taken at entry"`: enter, then `raise` the brute in the database and open everything. Every stored spec's `brutes[0].levelUps` equals the level-ups at entry.
  - `"opening works while a level-up is waiting"`: set `pending_level_up = true` after entering. Open returns 200.
  - `"other players see 404"`: a second player gets 404 from GET and open on the first player's tournament, and from `GET /api/fights/:id` on its fights.
- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @mybrute/server -- ranked`. Expected: FAIL.
- [ ] **Step 3: Implement `ranked.ts` and the routes.** The view builder reads `rounds jsonb` but only emits opened rounds plus `next`. Never return the raw row.
- [ ] **Step 4: Run all server tests and check they pass.** Run `npm test -w @mybrute/server`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Daily ranked tournaments: enter, open rounds, rewards`.

### Task 5: Training-only records, history and fight details

**Files:**
- Modify: `apps/server/src/classic.ts` (`records`, `lifetime`, `listFights`, `getFight`)
- Test: `apps/server/test/ranked.test.ts`

**Interfaces:**
- Produces: `getFight` adds `tournament: { id: string; round: number; totalRounds: number } | null` to `fight`. `records`, `lifetime` and `listFights` (which also feeds the cell's recent fights) count only `offer_id is not null`.

- [ ] **Step 1: Write the failing test** `"keeps tournament fights out of records, lifetime and fight history, and labels them on the fight page"`: after opening a tournament, `cell.brute.record.fights` and `cell.lifetime.fights` are unchanged, `GET /api/brutes/:id/fights` total is unchanged, and `GET /api/fights/:fightId` has `tournament.round === 1` and `tournament.totalRounds === 4`. The admin overview's `counts.fights` does go up.
- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Add the `offer_id is not null` filters** and the `tournament` field. For `totalRounds`, join `classic_tournaments` to get `size`.
- [ ] **Step 4: Run all server tests and check they pass.**
- [ ] **Step 5: Commit.** Message: `Keep tournament fights out of training records`.

### Task 6: Time capsule

**Files:**
- Modify: `apps/server/src/ranked.ts`, `apps/server/src/app.ts`
- Test: `apps/server/test/ranked.test.ts`

**Interfaces:**
- Produces: `useTimeCapsule(db, userId, bruteId, body: unknown): Promise<{ ok: true; level: number }>` and route `POST /api/brutes/:id/time-capsule` `{ level }`. Errors: `badRequest` for a target outside 1..cap−5, and `conflict(..., "capsule_unavailable")` when the brute isn't exactly at its cap or is an admin brute. The cell (`getCell`) adds `capsule: { maxTarget: number } | null`.

- [ ] **Step 1: Write the failing tests:**
  - `"rewinds to the chosen level, keeps banked XP and the choices before it"`: level 20 (`raise(id, 19)` with known bits), `xp = 300`, capsule `{ level: 5 }`. Expected: `level_ups === 4`; `hexToChoices(bits, 4)` equals the first 4 of the old choices; level_ups rows with `idx >= 4` are deleted; `xp === 300`; `pending_level_up === true`; rank and titles are unchanged.
  - `"refuses below the cap, above cap minus 5, and for admin brutes"`: level 19 gives 409 `capsule_unavailable`; `{ level: 16 }` at cap 20 gives 400; an admin brute at level 20 gives 409.
  - `"an unopened tournament keeps its snapshot after a rewind"`: enter, rewind, open everything. Every stored spec's `brutes[0].levelUps === 19`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement `useTimeCapsule`** in one transaction, as in the spec's "Time capsule" section. Also delete unconsumed `opponent_offers`, as `undoLevelUp` does.
- [ ] **Step 4: Run all server tests and check they pass.**
- [ ] **Step 5: Commit.** Message: `Time capsule rewind`.

### Task 7: Web: API types, rank icons, cell rank panel and labels

**Files:**
- Create: `apps/web/public/ranks/0.png` … `11.png` (copied from `LaBrute/www/img/icons/`)
- Create: `apps/web/src/classic/Rank.tsx`
- Modify: `apps/web/src/api.ts`, `apps/web/src/classic/Cell.tsx`, `apps/web/src/classic/MyBrutes.tsx`, `apps/web/src/classic/Opponents.tsx`, `apps/web/src/ui/BruteKit.tsx` (`XpBar` takes `banked?: boolean`)

**Interfaces:**
- Consumes: the server shapes from Tasks 2, 4 and 6.
- Produces:
  - `api.ts`: `RankInfo`; `BruteSummary` gains `adminBrute`, `rank: RankInfo` and `banked`; `Cell` gains `capsule`; `FightDetail` gains `tournament`; `TournamentView`; `TournamentListItem`; methods `enterTournament(id)`, `bruteTournament(id, tid)`, `bruteTournaments(id, page)`, `openRounds(id, tid, all?)` and `timeCapsule(id, level)`. The `brute` prefix avoids a clash with the existing admin Lab `api.tournaments`.
  - `Rank.tsx`: `RankIcon({ rank }: { rank: RankInfo })` (img `/ranks/${rank.rank}.png`, alt = rank name) and `AdminBruteLabel()`.

- [ ] **Step 1: Copy the icons** and add the types and methods.
- [ ] **Step 2: Build the cell rank panel.** It shows the icon, name, "titles x/N" (or "Top rank"), bracket size, and the "Enter today's tournament" button. The button is disabled with "Choose your level-up first" while one is waiting. On a 409 `already_entered`, link to today's tournament. After a successful entry, navigate to `/brutes/:id/tournaments/:tid`. When `cell.capsule` is set, show the capsule control: a level picker from 1 to `maxTarget` and a confirm step saying "This rewind can't be undone." Show "banked" on the XP bar.
- [ ] **Step 3: Add the rank icon and the "Admin brute" label** to My brutes, the cell header and the opponents screen.
- [ ] **Step 4: Typecheck.** Run `npm run typecheck`. Expected: no errors.
- [ ] **Step 5: Commit.** Message: `Web: rank panel, icons, admin brute label, time capsule`.

### Task 8: Web: tournament page, history tabs, fight page round line

**Files:**
- Create: `apps/web/src/classic/Tournament.tsx` (`TournamentPage`)
- Modify: `apps/web/src/App.tsx` (route `/brutes/:id/tournaments/:tid` under `RequireAuth`), `apps/web/src/classic/History.tsx`, `apps/web/src/classic/FightView.tsx`

**Interfaces:**
- Consumes: the `api.ts` additions from Task 7.

- [ ] **Step 1: Build `TournamentPage`.** It has a header (day, rank icon, "N-brute bracket") and the opened rounds as `FightRow`-style rows with Watch links. Show the next opponent with **Watch** (call `openRounds(id, tid)`, then navigate to `/fights/:fightId`) and **Skip to result** (`openRounds(id, tid, true)`, then re-render). When the brute has a level-up waiting, show "Level-up waiting" with a link to the level-up page. Once finished, show the placing.
- [ ] **Step 2: Add tabs to History:** **Fights** (the current page) and **Tournaments** (`bruteTournaments` list; each row shows day, rank, size, placing or "Open", and links to its page). Keep the selected tab in the URL query (`?tab=tournaments`).
- [ ] **Step 3: Update `FightView`.** When `f.tournament` is set, show "Round X of Y" and a link back to the tournament in place of the training "+XP" line, and point the back link to the tournament.
- [ ] **Step 4: Typecheck, then run it.** Run `npm run typecheck`, then use the `run` skill or `npm run dev`. Sign in, enter a tournament, watch round 1, skip to the result, and check the History tabs and the fight page. Expected: no result shows before its round is opened.
- [ ] **Step 5: Commit.** Message: `Web: tournament page and history tabs`.

### Task 9: Docs

**Files:**
- Modify: `PROJECT_OVERVIEW.md` (routes table, server files, data), spec status line ("Status: implemented")

- [ ] **Step 1: Add the new routes, files and tables.** Note that `/tournaments` is still the admin Lab tool.
- [ ] **Step 2: Commit.** Message: `Docs: ranked tournaments`.
