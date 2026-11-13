-- Ranks, admin brutes and daily classic tournaments.
alter table brutes add column rank smallint not null default 0 check (rank between 0 and 11);
alter table brutes add column rank_titles smallint not null default 0 check (rank_titles >= 0);
-- Set when an admin creates the brute and never changed afterwards, even if the owner is demoted.
alter table brutes add column admin_brute boolean not null default false;
update brutes b set admin_brute = true from users u where u.id = b.owner_id and u.role = 'admin';
-- Banked XP: a brute at its cap has no waiting level-up (rank 0 cap is level 20), so nobody is stuck.
update brutes set pending_level_up = false where not admin_brute and level_ups + 1 >= 20;

-- Created before the fights changes below, which point at it.
create table classic_tournaments (
  id bigserial primary key,
  brute_id bigint not null references brutes on delete cascade,
  day date not null,
  rank smallint not null,
  titles_before smallint not null,
  size smallint not null,
  snapshot jsonb not null,
  rounds jsonb not null,
  rounds_opened smallint not null default 0,
  champion boolean not null,
  created_at timestamptz not null default now(),
  unique (brute_id, day)
);

-- A fight now comes from either a training offer or a tournament round, never both.
alter table fights alter column offer_id drop not null;
alter table fights add column tournament_id bigint references classic_tournaments on delete cascade;
alter table fights add column tournament_round smallint;
alter table fights add constraint fights_one_source check ((offer_id is null) <> (tournament_id is null));
create unique index fights_tournament_round_unique on fights (tournament_id, tournament_round);
