# 今日の記事 — Kanji Reader

A daily Japanese reading app for vocabulary acquisition. A new article is generated every day by Claude. Words are clickable — saving them tracks your personal vocabulary list. Above-level words display as hiragana but are still clickable so you can look up the meaning.

**Live app:** https://kanji-reader-gamma.vercel.app

---

## Usage

Add `?user=name` and optionally `?level=N3` to the URL:

```
https://kanji-reader-gamma.vercel.app/?user=alex&level=N3
```

- `user` — identifies you; your saved words are stored under this name
- `level` — your JLPT level (N5–N1). Words above your level show as grey hiragana; click them to see the meaning. Omit to show all kanji.

Each person gets their own vocab list. Bookmark your personal URL.

---

## Project structure

```
src/
  main.jsx              # Entry point
  App.jsx               # Main app logic
  article.js            # Today's article (auto-replaced daily by GitHub Actions)
  supabase.js           # Supabase client
  index.css             # All styles
  components/
    WordPopup.jsx       # Click popup (save / delete)
    VocabList.jsx       # 単語リスト tab
scripts/
  generate_article.py   # Calls Claude API to produce a new article.js
.github/
  workflows/
    daily-article.yml   # Runs generate_article.py daily at 3am UTC (noon JST)
setup.sql               # Run once in Supabase to create tables
.env.example            # Copy to .env.local and fill in your keys
```

---

## Daily article generation

A GitHub Actions workflow runs every day at 3am UTC (noon Japan time):

1. Calls the Claude API (`claude-opus-4-8`) with a rotating topic
2. Validates the output (JLPT tags, required fields)
3. Writes `src/article.js` and commits it to the repo
4. Vercel auto-deploys on the new commit

To trigger manually: **Actions → Daily Article Generation → Run workflow**

Required GitHub secret: `ANTHROPIC_API_KEY`

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL and anon key
npm run dev
# → http://localhost:5173/?user=alex&level=N3
```

---

## Infrastructure

| Service | Purpose |
|---|---|
| Supabase | Stores saved words per user (`setup.sql` creates the tables) |
| Vercel | Hosts the app; auto-deploys on every push to `main` |
| GitHub Actions | Runs the daily article generation script |
| Anthropic API | Powers article generation (`claude-opus-4-8`) |
| Vercel Analytics | Usage analytics (injected in `main.jsx`) |
