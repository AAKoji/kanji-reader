# migrations

## New database

Run only `../setup.sql`. It already contains the end state of every archived migration.

For a new `dev` schema, run `dev_schema.sql` first, then `setup.sql` with
`set search_path to dev;` at the top of the query.

## archive/

One-off upgrades from the old `?user=` setup. **All applied to `public` and `dev`, last on 2026-10-26.**
Kept as a record of how the schema got here. Do not run them again: they expect the
old table shape and fail on a database built from the current `setup.sql`.

| File | What it did | Applied |
|---|---|---|
| `001_auth.sql` | Added `profiles`, `user_words.user_id`, owner-only RLS | dev 2026-10-06, public 2026-10-13 |
| `002_auth_cleanup.sql` | Mapped legacy rows, made `user_id` required, dropped `user_name` | public 2026-10-13 (A) + 2026-10-19 (C), dev 2026-10-19 |
| `003_push_subscriptions.sql` | Added `push_subscriptions` for Web Push | dev 2026-10-13, public 2026-10-16 |
| `004_reading_challenge.sql` | Added `user_words.reading_level`/`mastered` and `reading_challenge_rounds` for the reading challenge | dev 2026-10-26, public 2026-10-26 |

Before running 001 on `public`, a backup table `public.user_words_backup` was made. It was dropped on 2026-10-19.

## Adding a new migration

Name it `004_<what>.sql` in this folder. Run it on `dev` first, then on `public`, and update
`setup.sql` so a fresh install matches. Move it to `archive/` once it has been applied to both.
