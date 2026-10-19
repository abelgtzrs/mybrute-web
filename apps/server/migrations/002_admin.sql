-- Admin tools: roles, suspensions and an audit log of every admin change.

alter table users
  add column role           text not null default 'player' check (role in ('player', 'admin')),
  add column suspended_at   timestamptz,          -- suspended players can't sign in; their sessions are dropped
  add column suspend_reason text,
  add column last_login_at  timestamptz;

-- One row per admin change, written in the same transaction as the change.
create table admin_log (
  id           bigserial primary key,
  admin_id     bigint references users (id) on delete set null,
  admin_name   text not null,                    -- kept even if the admin account is deleted later
  action       text not null,
  target_kind  text not null check (target_kind in ('user', 'brute', 'settings')),
  target_id    text,
  target_label text not null,                    -- the name at the time, so the log stays readable after deletions
  detail       jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index admin_log_time on admin_log (created_at desc, id desc);
create index admin_log_target on admin_log (target_kind, target_id);
