# 1-Minute Reading Challenge – Spec

Oct 19, 2026 · @Alex Koji

## Spec

One round is 10 seconds of tapping known words, followed by a typed reading check on every word you tapped.

- **Pool:** saved words (`user_words`, both save types) whose `words.reading` is set and whose JLPT level is at or below the level chosen on the game's start screen (e.g. N3 → N3, N4, N5). The picker defaults to the profile's `jlpt_level`. Words without a stored reading or JLPT level are excluded.
- **Board:** each round shows a random draw of 24 words from the pool, in kanji. The game unlocks once the pool has at least 24 words; below that it shows how many more are needed.
- **Phase 1 (10 s):** tap the words you think you can read, in any order. Tapped words grey out.
- **Phase 2:** each tapped word comes back; you have 10 s to type its reading. Paste is blocked (a light deterrent only, not hardened).
- **Input:** the answer field converts romaji to hiragana live as you type (`wanakana` bound to the input), so the player sees exactly the kana that will be graded. Katakana is normalized to hiragana.
- **Accepted answers:** hiragana only, compared against the stored reading after both are normalized to hiragana. If the answer contains kanji, it is not graded: the field shows "type the reading in kana" and the timer keeps running. No penalty.
- **Scoring:** points come from the word's existing JLPT level: N5 = 1 point up to N1 = 5. A wrong answer or timeout costs the same as a correct one earns. Untapped words score 0 and change nothing.
- **Result screen:** lists every tapped word with your answer, the stored reading, and the points. A wrong answer has an "I was right" button that turns it into a correct one, to cover valid alternate readings (今日 きょう／こんにち, 一日 いちにち／ついたち).
- **Persistence:** round history and best score are stored in localStorage only, like the novel reader progress. No database changes.

## Out of scope for now

- **Per-word reading levels:** no per-word progress is tracked; the existing N1–N5 JLPT levels drive both the pool and the scoring. Revisit once there is a clear use for a per-word level (e.g. weighting the board toward weak words); it would need a `user_words` migration.
- **Alternate readings:** one stored reading per word; the "I was right" override covers the gap.
- **Server-side scores or leaderboards.**

## Consequences of the 10-second window

A round still takes about a minute, but you can no longer scan the whole board, so the game rewards spotting known words fast.

- **Round length:** 10 s of tapping plus roughly 4 to 6 tapped words at up to 10 s each. No cap on tapped words is needed.
- **Board size:** 24 words is more than anyone can tap in 10 s, and fits a phone screen in a grid.
- **Tap incentive:** because a wrong answer costs as much as a correct one earns, tapping a word only pays off when you are more than 50% sure of its reading. This rewards honest self-assessment and punishes tap-spamming.

## Decisions

- **Kanji answers are rejected, not half-scored.** The game tests readings, and a kanji answer does not prove the reading is known (handwriting input, copying the shape). Rejecting it without penalty removes the half-points flaw entirely and is simpler than detecting the input method. With live kana conversion, players rarely produce kanji anyway.
- **Zero words tapped:** show a short result screen ("nothing tapped, 0 points") and do not count it as a round.

## New dependency

- `wanakana` for live romaji-to-kana input binding and kana normalization. It handles ん (`n` / `nn` / `n'`), small kana and long vowels as typed.
