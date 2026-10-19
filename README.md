# 今日の記事 — Kanji Reader

A daily Japanese reading app for vocabulary acquisition. A new article is generated every day by Claude. Words are clickable — saving them tracks your personal vocabulary list. Above-level words display as hiragana but are still clickable so you can look up the meaning.

**Live app:** https://kanji-reader-gamma.vercel.app

---

## Usage

Accounts are invite-only. Ask the admin for a username and a starting password, then sign in. On first sign-in your username becomes your display name. In **設定** (the sliders icon) you can:
- change your password (8+ characters, including the name of an animal);
- set your JLPT level (N5–N1). Words above your level show as hiragana, and you can click them to see the meaning. With no level set, all kanji are shown;
- turn on **毎日の通知**, a daily reminder at 6pm JST (11am CEST / 10am CET) when the new article is up;
- turn on **🥚 イースターエッグ** to get a button above the article that opens 宮沢賢治's 銀河鉄道の夜, split into ~5 minute pages. The furthest page you reached is remembered on that device, and 最初から starts over. A 今日 Nページ counter (on the button and in the reader) shows how many pages you read today: a page counts when you leave it with 次へ (the last page when you reach it), once per page, resetting at local midnight.

### Notifications on iPhone / iPad

iOS (16.4+) only allows notifications for apps on the Home Screen. In Safari, tap **Share → Add to Home Screen**, open the app from the new icon, and sign in again (the Home Screen app doesn't share its login with Safari). The 通知 switch then appears in 設定. On Android and desktop it works directly in the browser.

No email address is collected.
Each account has its own vocab list, protected by Supabase Row Level Security.

---

## Project structure

```
src/
  main.jsx              # Entry point
  App.jsx               # Main app logic
  article.json          # Today's article (auto-replaced daily by GitHub Actions)
  supabase.js           # Supabase client (schema from VITE_SUPABASE_SCHEMA)
  auth.js               # useSession() hook, username ↔ placeholder-email mapping
  push.js               # Web Push subscribe / unsubscribe, synced to push_subscriptions
  index.css             # All styles
  components/
    WordPopup.jsx       # Click popup (save / delete)
    VocabList.jsx       # 単語リスト tab
    SettingsSheet.jsx   # Theme, font size, JLPT level, notifications, logout
    NotificationToggle.jsx # 毎日の通知 switch (or the iOS install hint)
    LoginScreen.jsx     # Username + password sign-in (no sign-up: invite-only)
    SegmentText.jsx     # Clickable word-by-word text (article and novel)
    NovelReader.jsx     # Easter-egg novel reader: paging + progress in localStorage
public/
  manifest.webmanifest  # Makes the app installable (Home Screen)
  sw.js                 # Service worker: shows push notifications
  icons/                # App icons
  novels/ginga/         # Built novel pages (index.json + page-NNN.json), loaded on demand
scripts/
  generate_article.py   # Calls Claude API to produce a new article.json
  send_push.py          # Sends the daily reminder to every subscribed device
  build_novel.py        # Validates the novel's segment files and writes public/novels/ginga/
data/novels/
  gingatetsudono_yoru.txt  # Aozora Bunko source text (Shift_JIS, public domain)
  ginga-segments/       # Hand-segmented pages, one word per line
.github/
  workflows/
    daily-article.yml   # Runs generate_article.py daily at 6pm UTC (3am JST)
    daily-push.yml      # Runs send_push.py daily at 9am UTC (6pm JST)
setup.sql               # Fresh install: creates tables + RLS
migrations/             # Schema history (see migrations/README.md); dev_schema.sql sets up dev
.env.example            # Copy to .env.local and fill in your keys
```

---

## Daily article generation

A GitHub Actions workflow runs every day at 6pm UTC (3am JST):

1. Calls the Claude API (`claude-opus-4-8`) with a rotating topic
2. Validates the output (JLPT tags, required fields)
3. Writes `src/article.json` and commits it to the repo
4. Vercel auto-deploys on the new commit

To trigger manually: **Actions → Daily Article Generation → Run workflow**

Required GitHub secret: `ANTHROPIC_API_KEY`

---

## Easter-egg novel (銀河鉄道の夜)

The novel is built once, offline, with no API key:

1. `build_novel.py` parses the Aozora text (ruby, headings, editor notes) and splits each chapter into pages of ~700 characters at paragraph or sentence boundaries.
2. Each page was segmented into words with reading, contextual meaning and JLPT level in `data/novels/ginga-segments/page-NNN.txt` (`text|reading|meaning|jlpt` per line, `¶` for a paragraph break).
3. `python scripts/build_novel.py` checks that every segment file reproduces its page **exactly** and writes the JSON to `public/novels/ginga/`.

Other commands: `--plan` (paging stats), `--show N` (print a page with its furigana), `--report` (JLPT distribution). Changing `PAGE_TARGET_CHARS` re-pages the novel and invalidates the segment files.

Source: Aozora Bunko (青空文庫). The last page shows Aozora's 底本/入力/校正 credit verbatim (Aozora asks that it is not removed), followed by a note listing what this app changed (ruby and notes removed, gaiji replaced, paging, added glosses), as Aozora's [reuse guidelines](https://www.aozora.gr.jp/guide/kijyunn.html) expect for modified texts.

---

## Daily push reminder

`daily-push.yml` runs every day at 9am UTC (6pm JST) and calls `scripts/send_push.py`. The script reads every row of `push_subscriptions` with the service role key, sends the notification `今日の記事` with the article title as its body, and deletes subscriptions the push service reports as expired (404/410).

To trigger manually: **Actions → Daily Push Reminder → Run workflow**

### One-time setup

1. Generate a VAPID key pair locally: `npx web-push generate-vapid-keys`. Never commit it.
2. GitHub secrets:
   - `VAPID_PRIVATE_KEY` (private key from step 1)
   - `VAPID_SUBJECT` (`mailto:` plus your address)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS: keep it in GitHub secrets only, never in Vercel or `.env.local`.
3. Vercel env (Production + Preview) and `.env.local`: `VITE_VAPID_PUBLIC_KEY` (public key from step 1).

### Testing against dev

Send only to your own devices in the `dev` schema:

```bash
pip install pywebpush
SUPABASE_SCHEMA=dev SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... python scripts/send_push.py --user-id <your user id from Authentication → Users>
```

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL and anon key
npm run dev
# → http://localhost:5173
```

Local dev and Vercel Preview set `VITE_SUPABASE_SCHEMA=dev`, so they use an isolated `dev` schema in the same Supabase project. Production uses `public`, which is the default.

---

## Supabase Auth setup (dashboard, one-time)

Sign-in is username + password. Supabase requires an email per account, so each username is stored as `<username>@kanji-reader.invalid`. `.invalid` is a reserved domain that can never receive mail, so no real address is collected.

1. **Authentication → Sign In / Providers**:
   - turn off **Allow new users to sign up** (invite-only);
   - in the **Email** provider, keep it enabled and turn off **Confirm email**.
2. **Authentication → Policies** (password settings): set the minimum password length to 8.

### Adding a user

**Authentication → Users → Add user → Create new user**:
- Email: `<username>@kanji-reader.invalid`. The username is 3–20 characters from `a–z 0–9 _ -`, lowercase.
- Password: a starting password, to be sent to the friend privately.
- Check **Auto Confirm User**.

The friend then signs in with the username and changes the password in 設定. If someone forgets their password, set a new one on their row in the Users list.

---

## Infrastructure

| Service | Purpose |
|---|---|
| Supabase | Stores saved words per user (`setup.sql` creates the tables) |
| Vercel | Hosts the app; auto-deploys on every push to `main` |
| GitHub Actions | Runs the daily article generation and push reminder scripts |
| Anthropic API | Powers article generation (`claude-opus-4-8`) |
| Vercel Analytics | Usage analytics (injected in `main.jsx`) |

---

## Status — June 2026

Currently in personal testing phase. The core loop is complete and working:
- Daily article drops at 3am JST, Vercel redeploys automatically
- Level filter is live and working (stored per account)
- Vocab saving persists to Supabase per user, behind invite-only username sign-in
- Daily push reminder at 6pm JST (installable app; iOS via Home Screen)

**If daily usage picks up, next steps would be:**
- Article history — browse past days instead of only today's
- Word review mode — flashcard-style review of saved vocab
- Topic preferences — let users pick categories they care about
- Mobile layout improvements
