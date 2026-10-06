-- 001: Supabase Auth ownership for user_words + profiles table.
-- Run in the Supabase SQL Editor. Safe to run on a database created by the old setup.sql.
-- Legacy rows keep user_name and get user_id = NULL; they stay invisible until mapped
-- manually (see 002_auth_cleanup.sql).

-- 1. Profiles: one row per auth user
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  jlpt_level text check (jlpt_level in ('N1', 'N2', 'N3', 'N4', 'N5')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Own profile" on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. user_words: owner column. user_name becomes optional because new rows no longer set it.
alter table user_words add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table user_words alter column user_name drop not null;

-- NULLs are distinct in a unique constraint, so unmapped legacy rows never conflict.
alter table user_words add constraint user_words_user_id_word_text_key unique (user_id, word_text);
create index if not exists idx_user_words_user_id on user_words(user_id);

-- 3. Replace the open policies with owner-only ones
drop policy if exists "Public read user_words"   on user_words;
drop policy if exists "Public insert user_words" on user_words;
drop policy if exists "Public update user_words" on user_words;
drop policy if exists "Public delete user_words" on user_words;

create policy "Own words read"   on user_words for select using (user_id = auth.uid());
create policy "Own words insert" on user_words for insert with check (user_id = auth.uid());
create policy "Own words update" on user_words for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own words delete" on user_words for delete using (user_id = auth.uid());

-- 4. words stays publicly readable, but only signed-in users may add to it
drop policy if exists "Public insert words" on words;
create policy "Auth insert words" on words for insert to authenticated with check (true);
