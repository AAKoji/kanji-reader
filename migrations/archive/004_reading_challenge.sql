-- 004: 1-Minute Reading Challenge — per-word reading levels and a per-round score log.
-- Run in the Supabase SQL Editor. Additive only, so it is safe on a live database:
-- existing user_words rows get reading_level 0 and mastered false.

alter table user_words add column if not exists reading_level int not null default 0;
alter table user_words add column if not exists mastered boolean not null default false;

-- One row per finished round. Kept as a log rather than a running total so progress
-- views can be derived later without another migration.
create table if not exists reading_challenge_rounds (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz default now(),
  jlpt_level text not null check (jlpt_level in ('N1', 'N2', 'N3', 'N4', 'N5')),
  score numeric(5, 1) not null,
  tapped_count int not null,
  correct_count int not null
);

create index if not exists idx_reading_challenge_rounds_user_id on reading_challenge_rounds(user_id);

alter table reading_challenge_rounds enable row level security;

-- No update/delete policies: past scores can't be rewritten from the browser.
create policy "Own rounds read"   on reading_challenge_rounds for select using (user_id = auth.uid());
create policy "Own rounds insert" on reading_challenge_rounds for insert with check (user_id = auth.uid());
