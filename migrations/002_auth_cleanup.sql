-- 002: Finish the auth migration. Run ONLY after every legacy user has signed in once
-- and their rows have been mapped. Find each user's id under Authentication → Users.

-- Step A (one line per legacy user, edit before running):
-- update user_words set user_id = '<auth-user-uuid>' where user_name = '<old-name>';

-- Step B: check nothing is left unmapped. Must return 0 before continuing.
-- select count(*) from user_words where user_id is null;

-- Step C: lock in the new shape
alter table user_words alter column user_id set not null;
alter table user_words drop constraint if exists user_words_user_name_word_text_key;
drop index if exists idx_user_words_user;
alter table user_words drop column user_name;
