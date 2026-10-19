-- MyBrute++ initial schema.
-- Brutes are stored in the original engine's canonical form (seed id, level-up count, packed choice bits);
-- stats, weapons, skills and pets are always recalculated from the engine, never stored as truth.

create table settings (
  key   text primary key,
  value jsonb not null
);
insert into settings (key, value) values
  ('max_brutes_default', '5'),   -- brutes per account unless users.max_brutes overrides it
  ('daily_fights', '10');        -- training fights per brute per day (Europe/Paris)

create table users (
  id            bigserial primary key,
  username      text not null,
  password_hash text not null,
  max_brutes    integer check (max_brutes is null or max_brutes >= 0),  -- null: use the default
  created_at    timestamptz not null default now()
);
create unique index users_username_unique on users (lower(username));

create table sessions (
  token_hash bytea primary key,          -- sha256 of the cookie token; the token itself is never stored
  user_id    bigint not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user on sessions (user_id);

create table brutes (
  id               bigserial primary key,
  owner_id         bigint not null references users (id) on delete cascade,
  name             text not null,
  seed_id          integer not null check (seed_id between 1 and 2147483647),  -- the original game's brute id
  gfx              text not null check (gfx ~ '^\d{1,6}(;\d{1,6}){15}$'),     -- locked after creation
  level_ups        integer not null default 0 check (level_ups >= 0),          -- displayed level = level_ups + 1
  bits             text not null default '' check (bits ~ '^([0-9a-f]{2})*$'),  -- packed choices, LSB first (hex)
  xp               integer not null default 0 check (xp >= 0),
  pending_level_up boolean not null default false,
  fights_day       date,                                                        -- Europe/Paris day of fights_used
  fights_used      integer not null default 0 check (fights_used >= 0),
  created_at       timestamptz not null default now()
);
create unique index brutes_name_unique on brutes (lower(name));
create index brutes_owner on brutes (owner_id);

create table level_ups (
  brute_id   bigint not null references brutes (id) on delete cascade,
  idx        integer not null,            -- level-up index (0-based): reaching displayed level idx + 2
  choice     smallint not null check (choice in (0, 1)),
  options    jsonb not null,              -- the two authentic options offered
  xp_spent   integer not null,
  created_at timestamptz not null default now(),
  primary key (brute_id, idx)
);

-- The eight candidates shown on the opponent screen. The client only ever sends back an offer id.
create table opponent_offers (
  id          bigserial primary key,
  brute_id    bigint not null references brutes (id) on delete cascade,
  level_ups   integer not null,           -- the brute's level-ups when offered; stale after a level-up
  seed_id     integer not null check (seed_id between 1 and 2147483647),
  name        text not null,
  gfx         text not null,
  bits        text not null,
  created_at  timestamptz not null default now(),
  consumed_at timestamptz
);
create index opponent_offers_brute on opponent_offers (brute_id) where consumed_at is null;

create table fights (
  id             bigserial primary key,
  brute_id       bigint not null references brutes (id) on delete cascade,
  offer_id       bigint not null unique references opponent_offers (id),  -- one fight per offer: idempotency
  created_at     timestamptz not null default now(),
  spec           jsonb not null,          -- full engine input (seed, arena, both brutes); replays exactly
  result         text not null check (result in ('win', 'loss', 'draw')),
  events         integer not null,
  xp_awarded     integer not null,
  level_ups      integer not null,        -- the brute's level-ups at fight time
  xp_after       integer not null,
  pending_after  boolean not null,
  player_stats   jsonb not null,          -- extractStats() for the player's brute
  opponent_stats jsonb not null
);
create index fights_brute_time on fights (brute_id, created_at desc, id desc);

create table lab_payloads (
  id         bigserial primary key,
  user_id    bigint not null references users (id) on delete cascade,
  label      text not null,
  params     text not null,
  created_at timestamptz not null default now()
);
create index lab_payloads_user on lab_payloads (user_id, created_at desc);

create table lab_brutes (
  id         bigserial primary key,
  user_id    bigint not null references users (id) on delete cascade,
  label      text not null,
  brute      jsonb not null,
  created_at timestamptz not null default now()
);
create index lab_brutes_user on lab_brutes (user_id, created_at desc);
