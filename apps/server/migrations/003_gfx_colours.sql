-- Colour fields (the last five appearance numbers) may also be -1.

alter table brutes drop constraint brutes_gfx_check;
alter table brutes add constraint brutes_gfx_check
  check (gfx ~ '^\d{1,6}(;\d{1,6}){10}(;(-1|\d{1,6})){5}$');
