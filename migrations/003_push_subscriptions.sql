-- 003: Web Push subscriptions, one row per device.
-- Run in the Supabase SQL Editor. Additive only, so it is safe on a live database.
-- The daily sender (scripts/send_push.py) reads this table with the service role key,
-- which bypasses RLS; clients only ever see their own rows.

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
