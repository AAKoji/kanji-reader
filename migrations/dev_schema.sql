-- One-time setup of an isolated "dev" schema in the production Supabase project.
-- Local dev and Vercel Preview point at it via VITE_SUPABASE_SCHEMA=dev.
-- Afterwards: Project Settings → Data API → Exposed schemas → add "dev".

create schema if not exists dev;

grant usage on schema dev to anon, authenticated, service_role;

-- Tables created later in dev (by setup.sql / migrations) get the same grants as public's.
alter default privileges in schema dev grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema dev grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema dev grant all on functions to anon, authenticated, service_role;

-- To run setup.sql or a migration against dev instead of public, put this line
-- at the top of the SQL Editor query before pasting the file:
--   set search_path to dev;
