-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste this → Run

-- 1. Words table (shared across all users)
create table if not exists words (
  id serial primary key,
  text text unique not null,
  reading text,
  meaning text,
  jlpt_level text,
  created_at timestamptz default now()
);

-- 2. Per-user saved words
create table if not exists user_words (
  id serial primary key,
  user_name text not null,
  word_text text not null references words(text) on delete cascade,
  save_type text not null check (save_type in ('vocab', 'reading')),
  saved_at timestamptz default now(),
  unique(user_name, word_text)
);

-- 3. Indexes for fast per-user lookups
create index if not exists idx_user_words_user on user_words(user_name);

-- 4. Enable Row Level Security but allow all reads/writes (no auth for now)
alter table words enable row level security;
alter table user_words enable row level security;

create policy "Public read words" on words for select using (true);
create policy "Public insert words" on words for insert with check (true);

create policy "Public read user_words" on user_words for select using (true);
create policy "Public insert user_words" on user_words for insert with check (true);
create policy "Public update user_words" on user_words for update using (true);
create policy "Public delete user_words" on user_words for delete using (true);
