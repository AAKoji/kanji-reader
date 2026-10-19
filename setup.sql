-- Run this in your Supabase SQL Editor for a fresh install
-- Dashboard → SQL Editor → New query → paste this → Run
-- (Already contains the end state of every migration in migrations/archive/.)

-- 1. Words table (shared across all users)
create table if not exists words (
  id serial primary key,
  text text unique not null,
  reading text,
  meaning text,
  jlpt_level text,
  created_at timestamptz default now()
);

-- 2. One profile per Supabase Auth user
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  jlpt_level text check (jlpt_level in ('N1', 'N2', 'N3', 'N4', 'N5')),
  created_at timestamptz default now()
);

-- 3. Per-user saved words
create table if not exists user_words (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_text text not null references words(text) on delete cascade,
  save_type text not null check (save_type in ('vocab', 'reading')),
  saved_at timestamptz default now(),
  unique(user_id, word_text)
);

create index if not exists idx_user_words_user_id on user_words(user_id);

-- 4. Row Level Security: words are public to read, everything else is owner-only
alter table words enable row level security;
alter table profiles enable row level security;
alter table user_words enable row level security;

create policy "Public read words" on words for select using (true);
create policy "Auth insert words" on words for insert to authenticated with check (true);

create policy "Own profile" on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Own words read"   on user_words for select using (user_id = auth.uid());
create policy "Own words insert" on user_words for insert with check (user_id = auth.uid());
create policy "Own words update" on user_words for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own words delete" on user_words for delete using (user_id = auth.uid());

-- 5. Web Push subscriptions, one row per device (read by scripts/send_push.py with the service role key)
create table if not exists push_subscriptions (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "Own push read"   on push_subscriptions for select using (user_id = auth.uid());
create policy "Own push insert" on push_subscriptions for insert with check (user_id = auth.uid());
create policy "Own push update" on push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own push delete" on push_subscriptions for delete using (user_id = auth.uid());
