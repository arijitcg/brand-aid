-- Adds local-vs-national/MNC tagging to discovered competitors, so results
-- can mix small local businesses with large players that still have a real
-- presence in the searched location (not just category leadership).

alter table competitors
  add column if not exists tier text not null default 'local' check (tier in ('local', 'national'));
