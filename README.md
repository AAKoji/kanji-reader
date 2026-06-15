# 今日の記事 — Kanji Reader

A daily Japanese reading app for vocabulary acquisition. Words are clickable; saving them tracks your personal vocabulary list.

---

## Setup (takes ~15 minutes)

### Step 1 — Supabase (database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New project** — give it any name, pick a region close to Japan
3. Once the project loads, go to **SQL Editor** (left sidebar)
4. Click **New query**, paste the contents of `setup.sql`, and click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 2 — Local setup

```bash
# Clone your repo (after pushing to GitHub)
git clone https://github.com/you/kanji-reader
cd kanji-reader

# Install dependencies
npm install

# Create your local env file
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase values:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

```bash
# Run locally
npm run dev <-- This is where I stopped.
# → open http://localhost:5173/?user=alex
```

### Step 3 — GitHub

1. Create a new repo at [github.com/new](https://github.com/new)
2. Push this project to it:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/you/kanji-reader.git
git push -u origin main
```

### Step 4 — Vercel (hosting)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project** and import your repo
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
4. Click **Deploy**
5. Vercel gives you a URL like `kanji-reader.vercel.app`

---

## Sending links to friends

Just add `?user=name` to your Vercel URL:

```
https://kanji-reader.vercel.app/?user=alex
https://kanji-reader.vercel.app/?user=yuki
https://kanji-reader.vercel.app/?user=kenji
```

Each person sees their own underlines and their own vocab list. Their words are saved to Supabase under their name.

---

## Project structure

```
src/
  main.jsx          # Entry point
  App.jsx           # Main app logic
  article.js        # Hard-coded daily article (replace this to update content)
  supabase.js       # Supabase client
  index.css         # All styles
  components/
    WordPopup.jsx   # Click popup (save / delete)
    VocabList.jsx   # 単語リスト tab
setup.sql           # Run once in Supabase to create tables
.env.example        # Copy to .env.local and fill in your keys
```

## Updating the article

Edit `src/article.js`. Each segment needs:
- `text` — the word or character as it appears
- `reading` — hiragana reading (null for particles/punctuation)
- `meaning` — English meaning (null for particles/punctuation)
- `jlpt` — optional JLPT level string like `'N3'`
