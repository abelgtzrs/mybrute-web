-- The full bracket (all entrants, the brute's slot, each round's winning slots), shown round by round.
-- Null on tournaments created before this change.
alter table classic_tournaments add column entrants jsonb, add column brute_slot smallint, add column winners jsonb;
