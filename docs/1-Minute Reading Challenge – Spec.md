# 1-Minute Reading Challenge – Spec

Oct 19, 2026 · @Alex Koji · revised Oct 26, 2026

## Spec

One round is 10 seconds of tapping known words, followed by a typed reading check on every word you tapped.

- **Pool:** saved words (`user_words`, both save types) that have a stored reading, a JLPT level at or below the level chosen on the game's start screen (e.g. N3 → N3, N4, N5), and at least one kanji. Words flagged `mastered` are excluded. The picker defaults to the profile's `jlpt_level`.
- **Minimum:** 30 usable words. With fewer, the game says so and names the usable count and the chosen level (for example, "only 20 usable words at N4").
- **Phase 1 (10 s):** 30 words are drawn at random from the pool and shown in kanji. Tap the words you think you can read, in any order. Tapped words grey out; tapping again undoes the selection.
- **Phase 2:** the tapped words come back one at a time, in tap order; you have 10 s to type each reading. Paste and drop are blocked (a light deterrent only, not hardened).
- **Input:** the device's own Japanese keyboard. An Enter that confirms a keyboard conversion does not submit the answer.
- **Accepted answers:** the answer and the stored reading are both converted from katakana to hiragana before comparing.
  - Kana matching the reading earns full points.
  - Typing the shown word itself (kanji) earns half points.
  - Anything else, or a timeout, is wrong.
- **Scoring:** points come from the word's own JLPT level: N5 = 1 point up to N1 = 5. A wrong answer or timeout costs the same as a correct one earns. Untapped words score 0 and change nothing.
- **Levels:** every saved word has a `reading_level` that starts at 0.
  - Any correct answer (kana or kanji) adds 1; a wrong answer or timeout resets it to 0.
  - When a word reaches 7, `mastered` is set on its `user_words` entry and it leaves the pool. The word is never deleted.
  - The vocabulary list can filter mastered words, so the user can delete them by hand.
- **Zero taps:** if nothing is tapped in 10 s, the result screen says "nothing tapped, 0 points" and the round is not saved.
- **Score history:** every finished round is stored as one row in `reading_challenge_rounds` (level, score, tapped and correct counts), so progress can be shown later.
- **Data:** one stored reading per word for now; alternate readings are out of scope.

## Consequences of the 10-second window

A round still takes about a minute, but you can no longer scan the whole pool, so the game now rewards spotting known words fast.

- **Round length:** 10 s of tapping plus roughly 4 to 6 tapped words at up to 10 s each. No cap on tapped words is needed.
- **Pool size:** the pool must be larger than what you can tap in 10 s, which is why the minimum is 30.

## Kanji half-points flaw

Halving points for kanji answers also halves them for players who typed the reading and converted it, which proves they know the reading.

**Accepted.** Any kanji answer gets half points. It is simpler and nudges players toward typing kana, which is the answer wanted anyway.
