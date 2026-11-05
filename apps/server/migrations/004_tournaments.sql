create table tournament_saves (
  id         bigserial primary key,
  user_id    bigint not null references users (id) on delete cascade,
  label      text not null,
  tournament jsonb not null,
  created_at timestamptz not null default now()
);
create index tournament_saves_user on tournament_saves (user_id, created_at desc);
