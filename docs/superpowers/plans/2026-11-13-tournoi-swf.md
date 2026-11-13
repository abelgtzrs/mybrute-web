# Original Tournament SWF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The tournament page shows the bracket in the original `tournoi.swf`, rebuilt from Motion Twin's source and extended to 128 and 256 entrants. It replaces the HTML bracket.

**Architecture:**
- **SWF source:** the modified source, the two vendored `mt` files and a build script live in `tools/tournoi/`. The built SWF is committed to `apps/web/public/swf/tournoi.swf`, like the other SWFs.
- **Data:** a pure engine function turns the server's `TournamentView.bracket` into the SWF's flashvars, keeping the reveal cap.
- **Page:** the tournament page plays the SWF in one Ruffle player, sized to the bracket.

**Tech Stack:** Haxe 2.10 (Flash 8 target), Ruffle, React, vitest (engine).

**Spec:** `docs/superpowers/specs/2026-11-10-ranked-tournaments-design.md`, sections "Addendum (2026-11-13)" (server data) and "Addendum 2 (2026-11-13)" (this work). Both are binding.

**Spike results (already proven):** these files are the validated starting point; copy them, don't rewrite them.
- The spike folder: `C:/Users/ABELGU~1/AppData/Local/Temp/claude/3b82e86096c77c82/699e7cdf-311b-4a0e-9201-86258e0b15d4/scratchpad/tournoi-build/`.
- `src/Tournoi.hx` there compiles and renders 64/128/256 correctly, including hidden rounds as empty boxes. Every change in it is marked "MyBrute++".
- `src/Codec.hx` is the stand-in decoder.
- `lib/mt/DepthManager.hx` and `lib/mt/bumdum/Lib.hx` are the vendored `mt` files.
- The screenshot helpers are in `../tt/` (`make-data.mjs`, `cdpshot.mjs`, `fla/tournoi/data.html`).

## Global Constraints

- **Stage size:** `extra = max(0, log2(size) - 6)`; width `800 + 160 × extra`; height `600` if `extra == 0`, else `20 + (size / 4) × 36`. That gives 800×600 up to 64, 960×1172 for 128 and 1120×2324 for 256. The same formula lives in exactly one place on the web side, with a comment pointing at `Tournoi.hx`.
- **Reveal cap:** `_m` = the brute's wins, capped at the revealed rounds (`bracket.winners.length`). Nothing else about unrevealed rounds reaches the SWF.
- **Clicks:** only VS badges in the player's brute's own matches are clickable, and only once that match is decided. They go to that round's fight. Clicking a brute does nothing (`_view` null).
- **Licence:** the vendored `mt` files come from motion-twin/WebGamesArchives, licensed CC BY-NC-SA 4.0. `tools/tournoi/README.md` gives the source URL, the commit (8b8e2f202e1fa8cdf1d96e4140dad0cba458054e) and the licence.
- **Comments:** readable code, with plain-language comments on the why. Every change to Motion Twin code is marked `MyBrute++`.

## Review Focus

1. **A tournament where nothing is opened yet.** The SWF shows round 1 only, no VS badges, and an empty podium.
2. **A 256 bracket on a 1280-px-wide screen.** No horizontal page scroll beyond the SWF's own container, and the page scrolls vertically.
3. **A brute whose look renders as a plain white head.** Task 1 resolves it, so it renders like the same brute on the cell page.
4. **Clicking the brute's VS badge in an opened round.** It opens that fight. Clicking an NPC match does nothing.

---

### Task 1: Rebuildable tournoi.swf in the repo

**Files:**
- Create `tools/tournoi/`: `src/Tournoi.hx`, `src/Codec.hx`, `lib/mt/DepthManager.hx`, `lib/mt/bumdum/Lib.hx` (copied from the spike), `README.md` and `build.sh`.
- Build into `apps/web/public/swf/tournoi.swf`.

**Interfaces (the SWF's contract with the web app):**
- **Flashvar `data`:** a Haxe-serialized `TournamentData` with these fields:
  - `_glads`: one entry per entrant in slot order, `{ _id, _gfx, _lvl, _n, _u, _m }`.
  - `_perso`: the absolute `perso.swf` URL.
  - `_fight`: a URL prefix.
  - `_view`: `null`.
  - `_user`.
  - `_league`: the rank number.
  - `_max`: the bracket size.
- **VS click:** opens `_fight + <round number, 1-based>` with `"_self"`. It's enabled only when one side's `_u == _user`.

- [ ] **Step 1: Copy the spike files and write the build scripts.**
  - `tools/tournoi/get-haxe.sh` downloads Haxe 2.10 (GitHub release `v2-10`, `haxe-2.10-win.zip`) into `tools/tournoi/.haxe2/`. Add that folder to `.gitignore`. Copying the already-unzipped compiler from the spike's `haxe-dl/haxe-2.10-win` is fine for this run.
  - `build.sh` compiles with Haxe 2.10 from `tools/tournoi/.haxe2/haxe-2.10-win` (overridable with `HAXE2_HOME`). It picks up `Data.hx` with `-cp ../../LaBrute/src/com` instead of copying it. Output goes to `apps/web/public/swf/tournoi.swf`.
  - Run both from the repo root as `sh tools/tournoi/build.sh`. The user allows exactly that command.
- [ ] **Step 2: Patch the clicks in `doDisplay`.** Enable a VS badge only when `(inf.g0.user == data._user || inf.g1.user == data._user)` and the match is decided. Its `onPress` opens `data._fight + round`, where `round = count - (TOTAL_MATCHES - maxMatches) + 1`. Keep the existing "brute blinks when `user == _user`" behaviour.
- [ ] **Step 3: Podium frames.** Find how many frames `mcPodium.smc` has: render `_league` 0..11 with the spike helpers and screenshot. If there are fewer than 12, clamp `_league` to the last frame, with a comment.
- [ ] **Step 4: White heads (use superpowers:systematic-debugging).**
  - Take a look that renders as a plain white head in the spike, e.g. generate random looks with the engine's `randomGfx` and screenshot.
  - Compare it with the same look through `persoParams` on its own (as the cell page does).
  - Find the root cause and fix it in the right place: the `Tournoi.hx` drawing, or the data we pass in.
- [ ] **Step 5: Build and screenshot.** Build, then screenshot 64/128/256 with 0, 1 and all rounds revealed. Expected: matches the spike (empty boxes for hidden rounds, podium filled only when finished, no white heads).
- [ ] **Step 6: Commit.** Commit `tools/tournoi/` and `apps/web/public/swf/tournoi.swf`. Message: `Rebuild the original tournoi.swf, extended to 256 entrants`.

### Task 2: Engine — tournament flashvars (pure, tested)

**Files:** create `packages/engine/src/tournoi.ts` and export it from `packages/engine/src/index.ts`; test in `packages/engine/test/tournoi.test.ts`.

**Interfaces:**
- `tournoiSize(size: number): { width: number; height: number }`, using the Global Constraints formula.
- `tournoiParams(bracket: { entrants: { name: string; level: number; gfx: string; isBrute: boolean }[]; winners: number[][] }, opts: { perso: string; fightPrefix: string; user: string; league: number }): string`, which returns the `data=…` flashvars string.
  - `_m` = how many times that slot appears in `winners` (already only the revealed rounds).
  - `_u` = `opts.user` for the brute and `""` for NPCs.
  - `_n` = name, `_lvl` = level, `_gfx` = gfx, `_id` = slot index.
  - Serialize with the engine's existing Haxe serializer helpers (see `payload.ts` `plainToHx` and the vendor serializer); add a minimal one only if none can produce a plain, unencrypted Haxe-serialized string.

- [ ] **Step 1: Write the failing tests.**
  - `tournoiSize(16)` → `{800,600}`, `(64)` → `{800,600}`, `(128)` → `{960,1172}`, `(256)` → `{1120,2324}`.
  - For a 16-entrant bracket with `winners = [[1,2,5,6,8,11,13,14]]`: decoding the flashvars back (`haxe` unserialize via the vendor, or a test-only parser) gives slot 1 `_m === 1`, slot 0 `_m === 0`, and no `_m > 1` anywhere.
  - Only the brute has `_u === user`, and `_view` is `null`.
- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @mybrute/engine -- tournoi`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all tests and the type check.** Run `npm test -w @mybrute/engine` and `npm run typecheck`. Both must be green.
- [ ] **Step 5: Commit.** Message: `Engine: flashvars for the original tournament SWF`.

### Task 3: Web — show the SWF on the tournament page

**Files:**
- Modify `apps/web/src/classic/Tournament.tsx`, `apps/web/src/App.tsx` (new route) and `apps/web/src/swf/SwfPlayer.tsx` (only if it can't be given a fixed pixel size).
- Delete `apps/web/src/classic/TournamentBracket.tsx` and its `.tb-*` CSS in `apps/web/src/classic.css`.

- [ ] **Step 1: Play the SWF.** When `t.bracket` is set, render `SwfPlayer` with `swf="tournoi.swf"`:
  - `params = tournoiParams(t.bracket, { perso: swfUrl("perso.swf"), fightPrefix: "/brutes/<id>/tournaments/<tid>/watch/", user: <signed-in username>, league: t.rank })`.
  - Size it with `tournoiSize(t.size)`.
  - Put it inside a container with `overflow-x: auto`, so a narrow screen scrolls the bracket, not the page.
  - Label: "Tournament bracket". Not lazy.
  - The params change after Watch-return or Skip, so the player reloads with the new reveal.
- [ ] **Step 2: Add the click target route.** Add `/brutes/:id/tournaments/:tid/watch/:round` (RequireAuth). It loads the tournament view and replace-navigates to `/fights/<rounds[round-1].fightId>`. If that round isn't opened, it goes back to the tournament page.
- [ ] **Step 3: Delete the HTML bracket** component and its CSS. Old tournaments (`bracket` null) keep the round list.
- [ ] **Step 4: Type check and build, then look at it.** Run `npm run typecheck` and `npm run build -w @mybrute/web`. Then run the app (`npm run dev`), enter a tournament as a high-level brute, and screenshot the page before opening anything, after Watch, and after Skip. Use the spike's `cdpshot.mjs` approach, which needs a signed-in session cookie; if that's impractical, say so in the report.
- [ ] **Step 5: Commit.** Message: `Web: original tournament SWF replaces the HTML bracket`.
