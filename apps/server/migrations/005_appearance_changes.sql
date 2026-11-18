-- How many times the owner has changed this brute's appearance. Players get one; admins are not limited.
alter table brutes add column appearance_changes integer not null default 0 check (appearance_changes >= 0);
