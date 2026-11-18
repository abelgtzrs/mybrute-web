# Full Bracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The tournament page shows the whole bracket on load, revealing results round by round.

**Architecture:** `simulateBracket` runs the full bracket to a champion and also returns every entrant plus every round's winners. Entry stores them in new nullable columns. The view sends only the revealed rounds' winners.

**Tech Stack:** Fastify + Postgres, vitest with embedded Postgres, React.

**Spec:** `docs/superpowers/specs/2026-11-10-ranked-tournaments-design.md`, section "Addendum (2026-11-13): full bracket, revealed round by round". It is binding.

## Global Constraints

- Revealed rounds = `totalRounds` once the tournament is finished, otherwise `rounds_opened`.
- `bracket.winners` holds only revealed rounds. A response must never carry anything about an unrevealed round's results (no extra arrays, no bits, no champion).
- `winners[r]` lists the winning *slot indexes* (into `entrants`) in match order. Round 1 has `size/2` entries; the final has 1.
- Old rows (null columns) give `bracket: null`.
- Code reads easily, with plain-language comments on the why.

## Review Focus

1. **A tournament where the brute is knocked out in round 1.** Before opening, `winners` is `[]`. After opening, every round is revealed up to the champion.
2. **A champion tournament with 256 entrants.** `winners` has lengths 128, 64, …, 1, and the last entry is the brute's slot.
3. **A tournament row created before this change.** `bracket` is null and the page still works.

---

### Task 1: Server — full simulation, storage, view

**Files:** modify `apps/server/src/bracket.ts`, `apps/server/src/ranked.ts`; create `apps/server/migrations/007_full_bracket.sql`; tests in `apps/server/test/bracket.test.ts` and `apps/server/test/ranked.test.ts`.

**Interfaces:**
- `simulateBracket(snapshot, rank, size, rand): { rounds: BracketRound[]; entrants: Entrant[]; bruteSlot: number; winners: number[][] }`, where `Entrant = { seedId: number; name: string; gfx: string; levelUps: number }`. `rounds` is unchanged in meaning: it holds the brute's fights only. Update every caller.
- Migration 007: `alter table classic_tournaments add column entrants jsonb, add column brute_slot smallint, add column winners jsonb;`
- `TournamentView.bracket: { entrants: { name: string; level: number; gfx: string; isBrute: boolean }[]; winners: number[][] } | null`.

- [ ] **Step 1: Write the failing tests.**
  - bracket.test, `"simulates the whole bracket to a champion"`: for a 16 bracket, `winners.length === 4` with lengths `[8,4,2,1]`. Each winner in round r is one of the two slots of its match (round 1: slots `2i` or `2i+1`; later rounds: `winners[r-1][2i]` or `winners[r-1][2i+1]`). `entrants[bruteSlot].seedId === snap.seedId`. The brute's slot is in `winners[k]` exactly for the rounds it won (`k < number of wins`).
  - ranked.test, `"reveals the bracket round by round"`: a level-500 brute enters. `bracket.entrants.length === 16` and exactly one has `isBrute`. `bracket.winners` is `[]`. Opening round 1 gives `winners.length === 1` with 8 entries. After `{ all: true }`, `winners.length === 4` and `winners[3][0]` is the brute's slot.
  - ranked.test, `"a knocked-out brute reveals the rest of the bracket"`: a level-1 brute enters. Opening round 1 makes `finished === true` and `winners.length === 4`.
  - ranked.test, `"old tournaments without bracket data still load"`: null out the three columns in the database. The view returns `bracket: null` with status 200.
- [ ] **Step 2: Run and check they fail.** Run `npm test -w @mybrute/server -- bracket ranked`.
- [ ] **Step 3: Implement.** Keep simulating after the brute loses. Store the three new columns at entry. Build `bracket` in `view()` from the stored columns, slicing `winners` to the revealed rounds.
- [ ] **Step 4: Run all server tests and the type check.** Run `npm test -w @mybrute/server` and `npm run typecheck`. Both must be green.
- [ ] **Step 5: Commit.** Message: `Store and reveal the full tournament bracket`.

### Task 2: Web — bracket on the tournament page

**Files:** modify `apps/web/src/api.ts` (`TournamentView.bracket`) and `apps/web/src/classic/Tournament.tsx`; create `apps/web/src/classic/TournamentBracket.tsx`; styles in `apps/web/src/classic.css`. Reuse the look and the lazy headshot approach of `apps/web/src/tournaments/Bracket.tsx` and `tournaments.css` (the admin Lab bracket) without changing the Lab tool.

- [ ] **Step 1: Add `TournamentBracket({ bracket, totalRounds })`.**
  - One column per round (round 1 to `totalRounds`), scrolling sideways.
  - Each match shows its two entrants (lazy headshot, name, level). Round 1 entrants come from slot pairs. Round r+1 entrants come from `winners[r]` when that round is revealed; otherwise show empty "?" slots.
  - Mark the winner of each revealed match. Highlight the brute's slot and its path.
  - Label columns "Round of N", "Quarter-final", "Semi-final" and "Final".
  - Use plain buttons or links only where something is interactive, and give images alt text.
- [ ] **Step 2: Show it on `TournamentPage`** above the existing round list when `bracket` is set. Keep Watch / Skip to result.
- [ ] **Step 3: Type check and build.** Run `npm run typecheck`, and `npm run build -w @mybrute/web` if it's quick.
- [ ] **Step 4: Commit.** Message: `Web: full tournament bracket`.
