# MyBrute++ Project Overview

## 1. Project summary

MyBrute++ is a modern recreation of the Muxxu / El Bruto game experience. It combines:

- A React and Vite web application.
- A Fastify API backed by PostgreSQL.
- A shared TypeScript game-engine package.
- Recovered original Haxe/JavaScript engine code.
- Original Flash SWF playback through Ruffle.
- Classic persistent gameplay.
- An unrestricted Laboratory for experiments.
- Tournament creation and simulation.
- Daily ranked tournaments for Classic brutes, with rank progression and a time capsule.
- Administrative tools for moderation and maintenance.
- A built-in documentation Guide based on the engine knowledge base.

The server is authoritative for saved data and fight outcomes. The browser is responsible for navigation, editing, presentation, and playback. The original engine is shared between browser and server code so that displayed results and authoritative results use the same rules.

## 2. Repository layout

```text
mybrute-plus/
├── apps/
│   ├── server/                 Fastify API and PostgreSQL application
│   └── web/                    React/Vite frontend
├── packages/
│   └── engine/                 Shared game engine and typed adapters
├── docs/
│   ├── engine/                 Engine knowledge base shown in the Guide
│   └── superpowers/specs/      Design/specification documents
├── icons/                      Shared weapon icons
├── LaBrute/                    Original/recovered Haxe, Flash, and assets
├── legacy/                     Older prototypes retained for reference
├── scripts/                    Repository-level development scripts
├── package.json                Workspace configuration
└── README.md                   Short project introduction and instructions
```

The generated `dist`, local database, dependency, and tool-output directories are runtime or development artifacts rather than primary source areas.

## 3. High-level architecture

```text
User browser
    │
    ▼
apps/web/src/main.tsx
    │  React providers, router, global styles
    ▼
apps/web/src/App.tsx
    │  URL-to-page routing and site navigation
    ▼
React feature pages
    │  api.ts / useApi.ts
    ▼
HTTP API
    │
    ▼
apps/server/src/app.ts
    │  Fastify routes and error handling
    ├── auth.ts
    ├── classic.ts
    ├── lab.ts
    ├── tournaments.ts
    └── admin.ts
    │
    ├── PostgreSQL database
    └── packages/engine
            │
            ├── progression and level-up rules
            ├── stats and inventory calculations
            ├── fight simulation
            ├── payload generation
            └── appearance and name helpers

Fight playback path:

Saved fight → FightView.tsx → SwfPlayer.tsx → Ruffle → client.swf
```

## 4. Runtime responsibilities

### Browser

The browser application:

- Displays all user-facing pages.
- Handles client-side routing.
- Maintains authentication and language context.
- Loads and submits API data.
- Provides editors for brutes, payloads, and tournaments.
- Displays fight histories and results.
- Plays saved fights in the original Flash client through Ruffle.

The browser does not replace the server as the authority for persistent Classic gameplay.

### Server

The server:

- Authenticates users through cookie-backed sessions.
- Validates requests and enforces game rules.
- Stores accounts, brutes, fights, Lab data, tournaments, and audit records.
- Computes and saves fight outcomes.
- Prevents replay or modification of invalid Classic actions.
- Serves the compiled web application in production.
- Runs database migrations at startup.

### Engine package

The engine package:

- Exposes typed adapters around recovered game code.
- Implements progression and level-up calculations.
- Calculates derived stats.
- Creates and reads fight payloads.
- Provides inventory and appearance helpers.
- Runs combat using recovered original logic.
- Supplies shared behavior to both the browser and the server.

## 5. Frontend entry points and shared infrastructure

| File | Contents | Responsibility and interaction |
|---|---|---|
| `apps/web/src/main.tsx` | React bootstrap | Creates the root, installs `BrowserRouter`, `AuthProvider`, `LanguageProvider`, and global styles, then renders `App`. |
| `apps/web/src/App.tsx` | Main route tree and navigation | Maps URLs to pages, renders the masthead, handles sign-out, exposes the home page, and provides the 404 page. |
| `apps/web/src/api.ts` | API request helpers | Centralizes browser requests to the Fastify API. |
| `apps/web/src/useApi.ts` | API React helpers | Provides reusable loading, mutation, and refresh behavior for feature pages. |
| `apps/web/src/auth.tsx` | Authentication context and guards | Tracks the current user and implements `RequireAuth` and `RequireAdmin`. |
| `apps/web/src/ui/language.tsx` | Language context and picker | Stores the selected language and renders the language picker. |
| `apps/web/src/styles.css` | Global CSS | Defines global layout, typography, navigation, buttons, forms, and shared components. |
| `apps/web/src/classic.css` | Classic CSS | Styles the Classic game pages. |
| `apps/web/src/lab.css` | Laboratory CSS | Styles the Lab workspace and its panels. |
| `apps/web/src/admin.css` | Admin CSS | Styles administrative navigation, tables, forms, and dashboards. |
| `apps/web/index.html` | HTML shell | Supplies the root DOM element used by React. |
| `apps/web/vite.config.ts` | Vite configuration | Controls frontend development and production builds. |
| `apps/web/tsconfig.json` | TypeScript configuration | Defines frontend TypeScript compilation rules. |
| `apps/web/package.json` | Frontend package metadata | Defines frontend scripts and React/Vite/Ruffle dependencies. |

## 6. Frontend routes and pages

Routes are registered in `apps/web/src/App.tsx`.

### Public routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` in `App.tsx` | Landing page explaining Classic mode and the Laboratory. Links to account creation, brutes, and Lab. |
| `/login` | `LoginPage` | Signs an existing user in. |
| `/register` | `RegisterPage` | Creates a new account. |
| `/lab` | `LabPage` | Opens the unrestricted Laboratory. |
| `/tournaments` | `TournamentsPage` | Admin-only Lab tournament tool (not the ranked Classic tournaments). |
| `/guide` | `GuidePage` | Shows the default engine documentation page. |
| `/guide/:page` | `GuidePage` | Shows a selected engine documentation page. |

### Authenticated Classic routes

| Route | Component | Purpose |
|---|---|---|
| `/brutes` | `MyBrutesPage` | Lists the logged-in player’s persistent brutes. |
| `/brutes/new` | `CreateBrutePage` | Creates a new Classic brute. |
| `/brutes/:id` | `CellPage` | Shows one brute’s cell, stats, equipment, appearance, and actions. |
| `/brutes/:id/fight` | `OpponentsPage` | Loads available opponents and starts a fight. |
| `/brutes/:id/level-up` | `LevelUpPage` | Presents and submits the brute’s level-up choice. |
| `/brutes/:id/history` | `HistoryPage` | Displays the brute’s saved fight history and, on its Tournaments tab (`?tab=tournaments`), its ranked tournaments. |
| `/brutes/:id/tournaments/:tid` | `TournamentPage` | Shows one ranked tournament: opened rounds, the next opponent, and the placing. |
| `/fights/:fightId` | `FightPage` | Replays a saved fight and displays its final result. |

All Classic routes except authentication are protected by `RequireAuth`.

### Admin routes

| Route | Component | Purpose |
|---|---|---|
| `/admin` | `AdminOverview` inside `AdminLayout` | Dashboard with player, brute, fight, result, level, and audit summaries. |
| `/admin/players` | `AdminPlayers` | Searches and manages accounts. |
| `/admin/players/:id` | `AdminPlayer` | Manages one player. |
| `/admin/brutes` | `AdminBrutes` | Searches and manages brutes. |
| `/admin/brutes/:id` | `AdminBrute` | Manages one brute. |
| `/admin/fights` | `AdminFights` | Searches and inspects fights. |
| `/admin/settings` | `AdminSettings` | Manages server/game settings. |
| `/admin/log` | `AdminLog` | Displays administrative audit records. |
| `/admin/fights/:fightId` | `FightPage admin` | Lets an admin watch any saved fight. |

Admin routes are protected by `RequireAdmin`.

## 7. Classic frontend files

| File | Contents and purpose |
|---|---|
| `apps/web/src/classic/AuthPages.tsx` | Login and registration forms. Uses the authentication API and redirects after successful authentication. |
| `apps/web/src/classic/MyBrutes.tsx` | Brute list page. Loads the current user’s brutes and links to cell pages or brute creation. |
| `apps/web/src/classic/CreateBrute.tsx` | New-brute form. Sends the creation request to the server, which establishes the brute’s permanent identity and progression state. |
| `apps/web/src/classic/Cell.tsx` | Individual brute page. Combines portrait, stats, equipment, fight availability, history, and level-up actions. |
| `apps/web/src/classic/Opponents.tsx` | Opponent selection page. Requests the server-generated opponent list and commits a selected match. |
| `apps/web/src/classic/FightView.tsx` | Fight playback page. Loads the saved fight, builds playback data, embeds the SWF player, and displays the authoritative result. |
| `apps/web/src/classic/FightRow.tsx` | Reusable history-row component. Shows result, opponent, date, and a link to fight playback. |
| `apps/web/src/classic/History.tsx` | Paginated fight-history page. Loads saved results for one brute and renders `FightRow` components. |
| `apps/web/src/classic/LevelUp.tsx` | Level-up page. Displays the two server-generated rewards and submits the selected reward. |
| `apps/web/src/classic/Rank.tsx` | Rank icon and the "Admin brute" label. (The rank panel itself lives in `Cell.tsx`.) Uses the icons in `apps/web/public/ranks/` (0 to 11). |
| `apps/web/src/classic/Tournament.tsx` | Ranked tournament page. Opens the next round and shows the bracket result so far. |

### Classic gameplay sequence

```text
MyBrutesPage
  → CellPage
  → OpponentsPage
  → POST /api/brutes/:id/fights
  → server validates the offered opponent and daily limit
  → engine computes the authoritative fight
  → fight is saved
  → FightPage loads the saved fight
  → Ruffle replays client.swf
  → result is revealed when the SWF ends
```

## 8. Laboratory frontend files

The Laboratory is designed for experimentation. Lab copies do not mutate Classic brutes.

| File | Contents and purpose |
|---|---|
| `apps/web/src/lab/LabPage.tsx` | Main Lab workspace and coordinator. Connects editor, arena, saved items, dialogs, and layout state. |
| `apps/web/src/lab/BruteEditor.tsx` | Editor for experimental brute identity, level, stats, equipment, skills, pets, and appearance. |
| `apps/web/src/lab/BruteKit.tsx` | Reusable brute kit editor. Provides controls for inventory and appearance-related data. |
| `apps/web/src/lab/ArenaPanel.tsx` | Fight configuration and execution panel. Starts Lab simulations and displays fight controls. |
| `apps/web/src/lab/VersusBoard.tsx` | Two-sided fight board. Presents combatants and their selected configurations. |
| `apps/web/src/lab/Bench.tsx` | Saved Lab workspace. Manages saved experimental brutes and payloads. |
| `apps/web/src/lab/StatsPanel.tsx` | Derived-stat display. Recalculates and presents combat-relevant values. |
| `apps/web/src/lab/ParametersDialog.tsx` | Dialog for seeds, teams, levels, and other simulation parameters. |
| `apps/web/src/lab/PayloadDialog.tsx` | Import/export and saved-payload dialog. Useful for sharing or reproducing simulations. |
| `apps/web/src/lab/ColumnResizers.tsx` | Resizable split-panel behavior for the Lab layout. |
| `apps/web/src/lab/state.ts` | Lab state types, update helpers, and state transitions. |
| `apps/web/src/lab/storage.ts` | Lab draft and persistence helpers. |
| `apps/web/src/lab/bruteCode.ts` | Encodes and decodes brute configuration data for compact sharing/import. |
| `apps/web/src/data/examples.json` | Example Lab configurations and demonstration data. |

## 9. Tournament frontend files

| File | Contents and purpose |
|---|---|
| `apps/web/src/tournaments/TournamentsPage.tsx` | Tournament list, creation, editing, simulation, and fight-watching workflow. |
| `apps/web/src/tournaments/Bracket.tsx` | Brackets, standings, rounds, and advancement displays. |
| `apps/web/src/tournaments/model.ts` | Tournament domain types and format models. |
| `apps/web/src/tournaments/storage.ts` | Saved tournament loading and persistence helpers. |
| `apps/web/src/tournaments/tournaments.css` | Tournament-specific layout and visual styling. |

Supported tournament concepts include single elimination, double elimination, round robin, MLB-style divisions and playoffs, and the 36-entrant Champions League-style league phase described by the project documentation.

## 10. Guide and documentation frontend

| File | Contents and purpose |
|---|---|
| `apps/web/src/guide/GuidePage.tsx` | Guide route, page selection, and documentation layout. |
| `apps/web/src/guide/Markdown.tsx` | Markdown-to-React rendering used by the Guide. |
| `apps/web/src/guide/guide.css` | Documentation-specific typography and layout. |
| `docs/engine/index.md` | Entry page for the engine knowledge base. |
| `docs/engine/arena.md` | Arena and fight behavior. |
| `docs/engine/data.md` | Shared engine data definitions. |
| `docs/engine/gladiator.md` | Gladiator progression and state. |
| `docs/engine/lang.md` | Localization and language data. |
| `docs/engine/pets.md` | Pet behavior and data. |
| `docs/engine/skills.md` | Skills and effects. |
| `docs/engine/weapons.md` | Weapon definitions and behavior. |

## 11. SWF and visual integration

| File | Contents and purpose |
|---|---| 
| `apps/web/src/swf/SwfPlayer.tsx` | React wrapper for loading and displaying Ruffle/SWF content. |
| `apps/web/src/swf/ruffle.ts` | Ruffle runtime initialization and configuration. |
| `apps/web/src/swf/useSwfEnd.ts` | Detects the original client’s `_end` callback and synchronizes playback completion with React state. |
| `apps/web/src/swf/Portrait.tsx` | Renders brute portraits using original appearance data/assets. |
| `apps/web/public/swf/client.swf` | Original fight playback client. Re-simulates the fight visually from the payload. |
| `apps/web/public/swf/inventory.swf` | Original inventory visual client. |
| `apps/web/public/swf/inventory-transparent.swf` | Transparent inventory variant. |
| `apps/web/public/swf/mini_perso.swf` | Small portrait/personage renderer. |
| `apps/web/public/swf/perso.swf` | Full portrait/personage renderer. |

The server saves the outcome before playback begins. As a result, refreshing or abandoning a fight does not change the result.

## 12. Server entry and infrastructure

| File | Contents and purpose |
|---|---|
| `apps/server/src/main.ts` | Starts the application. Chooses PostgreSQL or the embedded development database, runs migrations, applies configured admin usernames, starts Fastify, and handles shutdown. |
| `apps/server/src/app.ts` | Creates the Fastify instance, installs cookies/auth, registers every API route, handles errors, and serves the built frontend in production. |
| `apps/server/src/auth.ts` | Authentication plugin, session cookie handling, password checks, user lookup, and authorization helpers. |
| `apps/server/src/config.ts` | Reads environment variables such as `DATABASE_URL`, `COOKIE_SECURE`, `HOST`, `PORT`, `WEB_DIST`, and `ADMIN_USERNAMES`. |
| `apps/server/src/db.ts` | PostgreSQL pool creation and shared database access. |
| `apps/server/src/devdb.ts` | Starts the embedded PostgreSQL instance used in local development and tests. |
| `apps/server/src/migrate.ts` | Discovers and applies SQL migrations. |
| `apps/server/src/migrate-cli.ts` | Command-line migration entry point. |
| `apps/server/src/errors.ts` | Application HTTP errors and consistent error responses. |
| `apps/server/src/rules.ts` | Shared validation and game-rule constraints. |
| `apps/server/tsconfig.json` | Server TypeScript configuration. |
| `apps/server/vitest.config.ts` | Vitest configuration for server tests. |
| `apps/server/package.json` | Server scripts and Fastify/PostgreSQL dependencies. |

## 13. Server API feature modules

### `apps/server/src/classic.ts`

Implements persistent Classic gameplay, including:

- Listing a user’s brutes.
- Creating and deleting brutes.
- Loading a brute cell.
- Generating and storing opponents.
- Starting fights.
- Listing fight history.
- Loading individual fights.
- Processing level-up choices.
- Enforcing daily fight limits and valid opponent offers.

This module calls the engine package to calculate progression, fight inputs, fight results, and payload data.

### `apps/server/src/ranked.ts`

Implements daily ranked tournaments for Classic brutes:

- Entering a brute into the day's tournament. The whole bracket is simulated at entry and stored hidden in `classic_tournaments`.
- Opening rounds one at a time. A round's fight is written to `fights` and paid only when the player opens it.
- Listing tournaments and viewing one, plus the time capsule rewind.

### `apps/server/src/bracket.ts`

Pure bracket simulation with no database access. It runs the NPC bracket rounds for a given rank and size.

### `apps/server/src/lab.ts`

Implements Lab persistence:

- Listing, saving, and deleting Lab payloads.
- Listing, saving, and deleting Lab brutes.
- Keeping experimental data separate from Classic data.

### `apps/server/src/tournaments.ts`

Implements tournament persistence and server-side tournament operations. It stores tournament definitions and state and supports the web tournament workflow.

### `apps/server/src/admin.ts`

Registers administrative API routes and operations, including:

- Overview metrics.
- Player search and account changes.
- Suspension and session invalidation.
- Password resets.
- Brute search and editing.
- XP and level-up correction tools.
- Fight browsing and playback access.
- Settings management.
- Audit log access.

Administrative changes are logged in the same transaction as the change whenever applicable.

## 14. API routes

The main routes are registered in `apps/server/src/app.ts`.

### Authentication

Authentication routes are supplied through `authPlugin` from `auth.ts`. The frontend uses them through `api.ts` and `auth.tsx`.

### Classic API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/brutes` | List the current user’s brutes. |
| `POST` | `/api/brutes` | Create a brute. |
| `GET` | `/api/brutes/:id` | Load one brute cell. |
| `DELETE` | `/api/brutes/:id` | Delete a brute. |
| `POST` | `/api/brutes/:id/opponents` | Generate or load the current opponent offer. |
| `POST` | `/api/brutes/:id/fights` | Commit a fight. |
| `GET` | `/api/brutes/:id/fights` | List fight history. |
| `POST` | `/api/brutes/:id/level-up` | Submit a level-up reward choice. |
| `GET` | `/api/fights/:id` | Load a saved fight. |
| `POST` | `/api/brutes/:id/tournament` | Enter the brute into today's ranked tournament. |
| `GET` | `/api/brutes/:id/tournaments` | List the brute's ranked tournaments (paginated). |
| `GET` | `/api/brutes/:id/tournaments/:tid` | Load one ranked tournament. |
| `POST` | `/api/brutes/:id/tournaments/:tid/open` | Open the next round(s) and pay for them. |
| `POST` | `/api/brutes/:id/time-capsule` | Rewind a brute at its level cap to a lower level. |

### Laboratory API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/lab/payloads` | List saved Lab payloads. |
| `POST` | `/api/lab/payloads` | Save a Lab payload. |
| `DELETE` | `/api/lab/payloads/:id` | Delete a Lab payload. |
| `GET` | `/api/lab/brutes` | List saved Lab brutes. |
| `POST` | `/api/lab/brutes` | Save a Lab brute. |
| `DELETE` | `/api/lab/brutes/:id` | Delete a Lab brute. |

### Lab tournament API (admin only)

The `/api/tournaments` routes are the admin Lab tool, not the ranked tournaments above.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/tournaments` | List tournaments. |
| `POST` | `/api/tournaments` | Create a tournament. |
| `POST` | `/api/tournaments/:id` | Update a tournament. |
| `DELETE` | `/api/tournaments/:id` | Delete a tournament. |

Unknown `/api/*` routes return a structured 404 response.

## 15. Database migrations

| File | Schema responsibility |
|---|---|
| `apps/server/migrations/001_init.sql` | Initial tables for users, sessions, brutes, opponents, fights, and core game data. |
| `apps/server/migrations/002_admin.sql` | Roles, suspension fields, administrative settings, and audit logging. |
| `apps/server/migrations/003_gfx_colours.sql` | Additional brute appearance and color fields. |
| `apps/server/migrations/004_tournaments.sql` | Tournament storage and related state. |
| `apps/server/migrations/006_ranked_tournaments.sql` | Brute `rank`, `rank_titles` and `admin_brute` columns; `classic_tournaments` table; `fights.tournament_id` and `tournament_round` (a fight comes from a training offer or a tournament round, never both). |

Migrations are applied by `main.ts` during startup or manually through `migrate-cli.ts`.

## 16. Shared engine package

The package is located at `packages/engine` and is imported by both `apps/web` and `apps/server` as `@mybrute/engine`.

### Typed adapters

| File | Responsibility |
|---|---|
| `src/index.ts` | Public package exports. |
| `src/vendor.ts` | Bridge to recovered vendor implementations. |
| `src/progression.ts` | XP thresholds, level progression, and reward offers. |
| `src/stats.ts` | Derived combat and display stats. |
| `src/inventory.ts` | Equipment and inventory helpers. |
| `src/gfx.ts` | Appearance and graphics data helpers. |
| `src/payload.ts` | Fight payload construction and import/export. |
| `src/lab.ts` | Lab-specific engine operations. |
| `src/names.ts` | Name generation and name data access. |
| `src/avoid.ts` | Lab avoidance/exclusion logic. |
| `src/generated/names.ts` | Generated name tables. |

### Generated engine files

The generated files under `src/generated/` are JavaScript output and TypeScript declarations for the recovered engine:

- `bonuses.js` / `bonuses.d.ts`
- `fight.js` / `fight.d.ts`
- `fightlog.js` / `fightlog.d.ts`
- `glad.js` / `glad.d.ts`
- `inventory.js` / `inventory.d.ts`
- `labrute.js` / `labrute.d.ts`
- `names.ts`

These files should generally be regenerated using the engine scripts rather than manually edited.

### Vendored engine files

The files under `packages/engine/vendor/` preserve the original engine behavior:

| File | Responsibility |
|---|---|
| `vendor/labrute.js` | Original Lab/progression-related code. |
| `vendor/inventory.js` | Original inventory behavior. |
| `vendor/glad.js` | Original Gladiator state and progression. |
| `vendor/fight.js` | Original combat simulation. |
| `vendor/fightlog.js` | Original fight event/log generation. |
| `vendor/VENDOR.md` | Provenance and maintenance notes. |
| `vendor/package.json` | Vendor package metadata. |

## 17. Engine generation and fixture scripts

| File | Purpose |
|---|---|
| `packages/engine/scripts/gen-esm.mjs` | Generates ESM-compatible engine wrappers. |
| `packages/engine/scripts/export-native.ts` | Exports native/recovered engine artifacts. |
| `packages/engine/scripts/gen-names.py` | Generates name data. |
| `packages/engine/scripts/native-fixtures.ts` | Creates native engine fixtures. |
| `packages/engine/scripts/make-golden.cjs` | Regenerates expected golden outputs from legacy material. |
| `apps/web/scripts/copy-ruffle.mjs` | Copies the required Ruffle runtime for the web app. |
| `apps/web/scripts/derive-inventory.mjs` | Derives inventory assets/data. |
| `scripts/dev.mjs` | Starts the development API and frontend together. |

## 18. Testing

### Root commands

```sh
npm test
npm run typecheck
npm run build
```

### Engine tests

Located under `packages/engine/test/`:

| File | Focus |
|---|---|
| `vendor.test.ts` | Vendor compatibility and recovered implementation behavior. |
| `stats.test.ts` | Derived stat calculations. |
| `progression.test.ts` | XP and level-up progression. |
| `pets.test.ts` | Pet behavior/data. |
| `payload.test.ts` | Payload creation and parsing. |
| `native-fixtures.test.ts` | Native/recovered fixture compatibility. |
| `names.test.ts` | Name generation and data. |
| `golden.test.ts` | Golden expected outputs. |
| `gfx.test.ts` | Appearance and graphics data. |
| `avoid.test.ts` | Avoid-list behavior. |

Fixtures are stored in `packages/engine/test/fixtures/`:

- `golden.json`
- `fights.json`

### Server tests

Located under `apps/server/test/`:

| File | Focus |
|---|---|
| `accounts.test.ts` | Registration, authentication, sessions, and account behavior. |
| `classic.test.ts` | Classic brute/fight/level-up flows. |
| `admin.test.ts` | Admin authorization and moderation safeguards. |
| `rules.test.ts` | Shared business-rule validation. |
| `tournaments.test.ts` | Tournament persistence and API behavior. |
| `ranked.test.ts` | Ranked tournament entry, rounds, and time capsule. |
| `bracket.test.ts` | Pure bracket simulation. |
| `helpers.ts` | Shared test setup and request helpers. |
| `global-setup.ts` | Test database lifecycle. |

Tests use the embedded PostgreSQL development/test database when no external database URL is configured.

## 19. Game rules represented by the project

### Classic rules

- A new brute starts at level 1.
- Brute identity, appearance, and progression state are persistent.
- Each brute receives ten training fights per day.
- The daily reset is based on Bordeaux time, or `Europe/Paris`.
- Opponents are offered by the server and stored so players can only fight valid offers.
- A fight seed is selected when the fight is committed.
- The server stores the result before playback.
- A win gives 2 XP.
- A defeat or draw gives 1 XP.
- Reaching the XP threshold does not automatically level up the brute.
- Fights are blocked until a pending level-up choice is resolved.
- Level-up choices affect future progression and offers.

### Ranked tournament rules

- Brutes have 12 ranks (0 to 11). Each rank has a level cap for non-admin brutes, and the top rank is Brutal Legend.
- A brute's bracket size doubles with each title: 16, 32, and so on, up to 256.
- Each brute can enter one ranked tournament per day (`classic_tournaments` is unique per brute and day).
- Title XP is 5, 10, 15, 20, then 25 for every title after that.
- Only a brute exactly at its cap can use the time capsule, and it can rewind to any level up to 5 levels below the cap.
- Admin brutes have no level cap and cannot use the time capsule.

### Engine and playback rules

- `client.swf` receives a payload containing fight inputs.
- The SWF re-simulates the fight for visual playback.
- The server uses the same underlying engine to calculate the authoritative result.
- The SWF calls an `_end` URL/event when the winner banner appears.
- The frontend uses `useSwfEnd.ts` to reveal the saved result after playback completes.

## 20. Administration model

Admins are exposed in the navigation only when the current user has the admin role.

Available administrative operations include:

- View overall player, brute, fight, result, and audit statistics.
- Search and inspect players.
- Grant or revoke admin privileges.
- Suspend or unsuspend accounts.
- Reset passwords.
- Sign users out everywhere.
- Set brute limits.
- Delete accounts.
- Search, rename, move, edit, and delete brutes.
- Adjust XP.
- Return a brute’s daily fights.
- Undo the last level-up while restoring the exact prior reward offer.
- Search and watch fights.
- Change server settings.
- Review the administrative audit log.

Safeguards include preventing administrators from modifying, suspending, resetting, or deleting their own account and requiring audit records for administrative changes.

## 21. Original/recovered source material

The `LaBrute/` directory contains recovered original material and historical assets.

### Haxe engine sources

| Location | Contents |
|---|---|
| `LaBrute/src/com/Arena.hx` | Original arena/combat logic. |
| `LaBrute/src/com/Gladiator.hx` | Original brute state and progression. |
| `LaBrute/src/com/Data.hx` | Original shared game data. |
| `LaBrute/src/com/Lang.hx` | Original language/localization data. |
| `LaBrute/fla/client/src/` | Original Flash client fight and animation sources. |
| `LaBrute/fla/inventory/` | Inventory Flash source and build files. |
| `LaBrute/fla/tournoi/` | Tournament Flash source and build files. |
| `LaBrute/fla/mini/` | Mini portrait source. |
| `LaBrute/fla/perso/` | Full portrait source. |

### Compiled assets

The directory also contains original SWFs, FLA files, image assets, historical HTML, and supporting binaries. These are reference or playback artifacts and are not normal TypeScript application modules.

## 22. Configuration and deployment

### Development

Requirements:

- Node.js 20 or newer.
- npm.
- No separately configured PostgreSQL instance is required for normal development.

Start both applications:

```sh
npm install
npm run dev
```

The development process starts:

- Fastify API on port `3001` by default.
- Vite frontend on port `5173` by default.
- Embedded PostgreSQL when `DATABASE_URL` is not provided.

### Production

Build the web app and start the server:

```sh
npm ci
npm run build
npm run start -w @mybrute/server
```

Important environment variables:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Required in production. |
| `COOKIE_SECURE` | Makes the session cookie HTTPS-only when enabled. |
| `HOST` | Server bind host. |
| `PORT` | Server port. |
| `WEB_DIST` | Location of the built frontend. |
| `ADMIN_USERNAMES` | Comma-separated usernames promoted to admins at startup/registration. |
| `NODE_ENV` | Production mode disables the fallback embedded database. |

In production, Fastify serves the built frontend and falls back to `index.html` for client-side routes while keeping `/api/*` routes as API endpoints.

## 23. Package scripts

### Root scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the development API and web app. |
| `npm run build` | Builds the web application. |
| `npm test` | Runs workspace tests. |
| `npm run typecheck` | Type-checks workspace packages. |
| `npm start` | Builds and starts the server. |

### Web scripts

| Command | Purpose |
|---|---|
| `npm run dev -w @mybrute/web` | Starts Vite development mode. |
| `npm run build -w @mybrute/web` | Copies Ruffle, type-checks, and builds the frontend. |
| `npm run preview -w @mybrute/web` | Serves the built frontend for preview. |
| `npm run typecheck -w @mybrute/web` | Type-checks frontend code. |

### Server scripts

| Command | Purpose |
|---|---|
| `npm run dev -w @mybrute/server` | Starts Fastify with watch mode. |
| `npm run start -w @mybrute/server` | Starts the server. |
| `npm run migrate -w @mybrute/server` | Runs database migrations. |
| `npm run test -w @mybrute/server` | Runs server tests. |
| `npm run typecheck -w @mybrute/server` | Type-checks server code. |
| `npm run admin -w @mybrute/server -- grant <username>` | Grants admin role to a user. |

### Engine scripts

| Command | Purpose |
|---|---|
| `npm run gen -w @mybrute/engine` | Regenerates engine wrappers. |
| `npm run export-native -w @mybrute/engine` | Exports native engine artifacts. |
| `npm run golden -w @mybrute/engine` | Regenerates golden fixtures. |
| `npm test -w @mybrute/engine` | Runs engine tests. |
| `npm run typecheck -w @mybrute/engine` | Type-checks engine code. |

## 24. Design boundaries

The project has several deliberate boundaries:

1. **Classic vs Lab data**
   
   Classic brutes are persistent and governed by daily rules. Lab brutes are experimental and must not modify Classic records.

2. **Server authority vs browser presentation**
   
   The server validates and saves outcomes. The browser presents the result and plays the original animation.

3. **Shared engine vs UI code**
   
   Rules and calculations belong in `packages/engine`; page components should consume those results rather than duplicate game logic.

4. **Feature services vs HTTP registration**
   
   `app.ts` registers routes, while `classic.ts`, `lab.ts`, `tournaments.ts`, and `admin.ts` contain feature behavior.

5. **Source/reference artifacts vs runtime code**
   
   `LaBrute/`, `legacy/`, and generated/vendor directories preserve historical or generated material and should be treated differently from normal application source.

## 25. Typical request flows

### Create a Classic brute

```text
CreateBrutePage
  → api.ts
  → POST /api/brutes
  → app.ts
  → classic.ts
  → engine progression/gfx helpers
  → PostgreSQL
  → redirect to /brutes/:id
```

### Start a Classic fight

```text
OpponentsPage
  → POST /api/brutes/:id/opponents
  → server stores/returns valid offers
  → player chooses an opponent
  → POST /api/brutes/:id/fights
  → classic.ts validates offer and daily limit
  → engine runs fight
  → PostgreSQL stores fight and result
  → FightView loads the saved record
  → SwfPlayer replays client.swf
```

### Choose a level-up reward

```text
CellPage detects pending level-up
  → LevelUpPage
  → POST /api/brutes/:id/level-up
  → classic.ts validates the offered choices
  → engine applies the selected choice
  → PostgreSQL updates the brute
  → CellPage reloads the brute
```

### View an admin fight

```text
AdminFights
  → admin API search
  → select a fight
  → /admin/fights/:fightId
  → FightPage admin mode
  → saved fight data
  → Ruffle playback
```

## 26. Maintenance guidance

- Put shared game rules in `packages/engine`, not in individual React pages.
- Keep API route registration in `apps/server/src/app.ts` and feature logic in the corresponding service module.
- Preserve the server’s authoritative result-before-playback behavior.
- Regenerate generated engine wrappers after changing vendored engine sources.
- Regenerate golden fixtures when intentionally changing recovered engine behavior.
- Keep Classic and Lab persistence separate.
- Add server tests for changes affecting authorization, daily limits, fight commitment, or account data.
- Add engine tests for changes affecting deterministic progression, combat, payloads, stats, graphics, or inventory.
- Treat `LaBrute/` and `legacy/` as reference material unless a task explicitly requires changing them.

## 27. Important files at a glance

If someone is new to the project, the recommended reading order is:

1. `README.md`
2. `apps/web/src/main.tsx`
3. `apps/web/src/App.tsx`
4. `apps/web/src/api.ts`
5. `apps/server/src/app.ts`
6. `apps/server/src/classic.ts`
7. `packages/engine/src/index.ts`
8. `packages/engine/src/progression.ts`
9. `packages/engine/src/payload.ts`
10. `apps/web/src/classic/FightView.tsx`
11. `apps/web/src/swf/SwfPlayer.tsx`
12. `docs/engine/index.md`

Together, these files explain the main route structure, API boundary, Classic gameplay lifecycle, shared engine, and original fight playback system.
