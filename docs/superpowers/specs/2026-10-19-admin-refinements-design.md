# Admin refinements — design

Date: 2026-10-19 · Status: approved design, awaiting spec review

## Context and goals

The admin tools (commit 7f2cf77) give one role, `admin`, six pages (Overview, Players, Brutes, Fights,
Settings, Log) and an audit log written in the same transaction as every change. The game is in
development/testing; the people using these tools are the owner plus a few trusted moderators.

Goals, in build order:

1. A **moderator** role with a small, safe set of powers.
2. **Usability**: filter/sort/page state in the URL, server-side sorting, date ranges, and every name or
   id links to its player, brute or fight.
3. **Test brutes**: admins spawn brutes for any player, optionally auto-levelled through real engine offers.
4. **Insight**: activity charts over time and a per-player history timeline.

Each step ships on its own and leaves the app working.

### Constraints carried over

- The engine rule stays strict: admins never set stats or invent level-up choices. Every level-up a brute
  has is one of the two authentic offers, picked by someone (player, admin by hand, or a seeded PRNG).
- Every change is audited in the same transaction, as today.
- Admins still can't act on their own account.

### Out of scope

Impersonation / "view as", fight re-simulation, bulk actions, balance stats, health checks, global
search, undo-from-log, IP logging. Player appearance settings are a separate spec, built after this one.

## 1. Moderator role

**Schema** (`003_admin_refinements.sql`): replace the `users.role` check with
`role in ('player', 'moderator', 'admin')`.

**Server** (`admin.ts`):

- New guard `requireStaff(req)`: role is `moderator` or `admin`. The `/api/admin/` preHandler uses
  `requireStaff`; admin-only handlers additionally call `requireAdmin`.
- Moderators may call:
  - every `GET /api/admin/*` route;
  - `POST /users/:id/suspend`, `POST /users/:id/unsuspend`;
  - `POST /brutes/:id/rename`.
  For these, when the caller is a moderator, the target account (or the brute's owner) must have role
  `player`; otherwise `403 "Moderators can only act on players."`.
- Everything else stays admin-only, including role changes.
- `setRole` accepts `player | moderator | admin`. Audit actions: `user.grant_admin`, `user.revoke_admin`,
  `user.grant_moderator`, `user.revoke_moderator` (moving moderator → admin logs `user.grant_admin`
  with `detail.from = "moderator"`).
- Existing safeguards extend to moderators: a moderator must be set back to `player` before being
  suspended or deleted; a suspended player can't be made moderator.
- `overview` adds a `moderators` count.

**Session**: `SessionUser.role` already exists; its type widens to include `moderator`. `/api/me`
returns it, and the menu shows the Admin link for moderators too.

**Web**: a `useStaffRole()` helper; buttons a moderator can't use are not rendered (Settings page link
hidden for moderators). The server is the authority either way.

**CLI**: unchanged (`grant`/`revoke` handle admin only). Moderators are made from the Players page.

## 2. Usability: URL state, sorting, links

**URL state**: every list page (Players, Brutes, Fights, Log) reads and writes its filters, `sort`, `dir`
and `page` via `useSearchParams`. Changing a filter resets `page`. Back/forward and shared links work.

**Server sorting**: each list endpoint takes `sort` and `dir` (`asc|desc`), checked against a per-list
allowlist mapped to SQL expressions. Unknown keys → `400`. Ties break on `id desc` so pages are stable.

| List | Sort keys (default first) |
|---|---|
| Players | `created` (desc), `username`, `lastLogin`, `brutes`, `fights` |
| Brutes | `created` (desc), `name`, `level`, `xp`, `fights`, `owner` |
| Fights | `created` (desc), `xp`, `events` |
| Log | `created` (desc) — not sortable otherwise |

**Date ranges**: Fights and Log accept `from` and `to` (ISO dates, inclusive, Europe/Paris days like the
rest of the game). Invalid dates → `400`.

**Sortable headers**: a `SortHeader` component in `admin/kit.tsx` shows the current direction and
toggles it.

**Cross-linking**: `UserLink`, `BruteLink` and `FightLink` in `admin/kit.tsx` render a router link to the
admin detail page. Used in every table, detail page and the Overview. Log entries link their target when
`target_id` still exists; deleted targets render `target_label` as plain text (the log list query adds
an `exists` flag per row).

## 3. Test brutes

**Schema**: `brutes.is_test boolean not null default false`.

**Spawn** — admin only: `POST /api/admin/brutes/spawn`

```
{ ownerId: string,           // required; any account
  name?: string,             // default: generated, unique ("Test-<6 hex>")
  seedId?: number,           // default: random free seed
  gfx?: string,              // default: randomGfx() driven by the choice PRNG
  level?: number,            // 1..max; default 1
  choiceSeed?: number }      // PRNG seed for level-up picks; default random, always recorded
```

- Reuses the creation insert from `classic.createBrute` (factored into a shared
  `insertBrute(tx, ownerId, name, seedId, gfx, { isTest })`); the owner's brute limit is **not** applied.
- For `level > 1`, it loops: compute `pendingOptions(seed, levelUps, choices)`, pick 0/1 with a
  mulberry32 PRNG seeded by `choiceSeed`, insert the `level_ups` row (with the authentic `options` and
  `xp_spent = requiredXp(current displayed level)`, as `levelUp` computes it), and verify with `describe(...).check` as `levelUp` does. At the end
  `xp = 0`, `pending_level_up = false`. This logic shares a helper with `classic.levelUp`
  (`applyLevelUp(tx, brute, choice)`) so there's one code path for writing a level-up.
- Audit `brute.spawn` with `{ owner, seedId, gfx, level, choiceSeed }`, enough to reproduce the brute
  exactly.
- Same name rules and `name_taken` conflict as normal creation.

**Step-through** — admin only: `POST /api/admin/brutes/:id/choose { choice: 0 | 1 }`

- Only for `is_test` brutes (`409 not_test` otherwise).
- Takes the next level-up regardless of XP: applies `applyLevelUp`, keeps `xp` unchanged, and recomputes
  `pending_level_up`.
- Audit `brute.choose` with `{ level, chosen: <option text> }`.
- `GET /api/admin/brutes/:id` includes `nextOffers` (the two upcoming options) for test brutes.

**Web**:

- A "Spawn test brute" form on the Brutes page: owner (search picker, default you), name, seed, level,
  choice seed, and "Random" vs "Step through" (step-through spawns at level 1 and opens the brute page).
- The brute page shows a **Test** badge and, for test brutes, the next two offers with **Take A** /
  **Take B** buttons.
- A test filter (`test=all|hide|only`, default `all`) on the Brutes and Fights lists; badges in rows.

Test brutes otherwise behave exactly like normal brutes: their owner can see and fight with them.

## 4. Insight

### Sign-in events

**Schema**: `login_events (id bigserial pk, user_id bigint not null references users on delete cascade,
at timestamptz not null default now())`, index `(user_id, at desc)` and `(at)`. Time only, no IP.

`auth.ts` inserts a row wherever it sets `last_login_at` (sign-in and registration).

### Activity charts

`GET /api/admin/stats/activity?days=30|90|365&tests=include|exclude` (default 30, exclude). Staff.
Returns one row per Europe/Paris day in the range, zero-filled:

```
{ day, signups, activePlayers, fights, levelUps }
```

- `activePlayers`: distinct users with a sign-in or a fight that day.
- `fights` / `levelUps`: with `tests=exclude`, rows belonging to test brutes are left out.

**Web**: Recharts, imported only from an `admin/ActivityChart.tsx` that the Overview loads with
`React.lazy`, so player pages never download it. Two charts: fights and level-ups (bars), signups and
active players (lines); range toggle 30/90/365 days and an "include test brutes" checkbox (both in the
URL).

### Per-player history

`GET /api/admin/users/:id/history?before=<iso>&limit=50` (staff). A single merged timeline, newest first,
cursor-paged by time:

| Kind | Source | Shape |
|---|---|---|
| `signin` | `login_events` | time |
| `brute_created` | `brutes.created_at` | brute link, test flag |
| `level_up` | `level_ups` | brute link, level, chosen option |
| `fights` | `fights`, grouped per brute per day | brute link, count, wins/losses/draws, xp gained |
| `admin` | `admin_log` where target is the user or one of their brutes | admin name, action, detail |

Built as a `union all` of the five sources ordered by time with `limit`; the grouped fight row uses the
latest fight time of that day as its timestamp. Admin actions on brutes the player no longer owns are
matched by `admin_log.target_id` against the player's current brutes, plus `detail.owner`/`detail.from`
for transfers and deletions.

**Web**: a History section on the player page with a "Load more" button.

## Error handling

All new endpoints use the existing `badRequest` / `forbidden` / `conflict` / `notFound` helpers and
messages in the same plain style. Spawn and choose run in one transaction with their audit row; a failed
`describe` check throws and rolls back, as `levelUp` does.

## Testing (`apps/server/test/admin.test.ts`, new cases)

- Moderator matrix: allowed routes succeed; admin-only routes return 403; mod actions on a
  moderator/admin target return 403; only admins change roles.
- Sorting: each allowlisted key works; an unknown key returns 400; date ranges filter correctly.
- Spawn: ignores the owner's limit; same `seedId` + `choiceSeed` + `level` give identical `bits` and
  level-up rows; every level-up's chosen option is one of the authentic offers; audit row carries seeds.
- Choose: works on test brutes, 409 on normal brutes, advances one level.
- Sign-in writes a `login_events` row.
- Activity: counts per day match seeded data; test brutes excluded by default.
- History: merges all five kinds in time order; paging with `before` returns no duplicates.

Web pages are checked by hand in the running app (no web test suite exists today).

## Docs

README "Admin tools" table and safeguards updated for moderators, test brutes, activity and history.
