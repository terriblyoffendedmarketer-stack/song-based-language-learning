# V2 Roadmap — Practice, Depth & Song Learning

V2 keeps the existing 20 lessons as-is but adds the practice layer that turns information into retention. The core insight: lessons introduce, practice is where learning happens.

See `LEARNING_SCIENCE_AUDIT.md` for the full audit against Krashen, Bloom, Ebbinghaus, Justin Sung, and incidental learning research. Every framework points to the same two gaps: not enough exposure/practice, and assessments that are too easy.

## What's Changing

**New features:**
1. Song Practice — ungated, standalone song learning (browse any of 72 songs, learn line-by-line)
2. Vocab/Grammar Practice — spaced-repetition drills that gate lesson progression
3. Better quiz distractors — plausible wrong answers that force real thinking
4. Spotify playlist generation — one-click playlist of all 72 lesson songs
5. UX bug fixes — analytics, navigation, lesson access

**What stays the same:**
- 20 V5 lessons (intro/reference material)
- Lesson content and screen types
- TTS system, progress saving, daily reminders

---

## Phase 1: UX Bug Fixes `[~]`

Fix broken navigation and tracking before building new features.

- [ ] **Analytics page**: connect to V5 progress system (currently reads old `AppState`, not `V5UserProgress`)
- [ ] **Lesson browser clickability**: make individual lessons in browse view clickable/launchable (not just the resume card on home)
- [ ] **Unlock 5 at a time**: allow access to ~5 lessons at once so user can switch between them
- [ ] **Tab navigation**: fix Grammar/Vocabulary tabs that don't work
- [ ] **Back navigation**: ensure lesson list → lesson → back works without reset

## Phase 2: Song Practice (Standalone) `[ ]`

Ungated song learning — the app's second front door. User browses 72 songs, picks one, learns it line by line. No lessons required.

### 2a: Song Browser UI
- [ ] New `/songs` route: grid/list of all 72 songs with artist, title, album art placeholder
- [ ] Search/filter by artist, title
- [ ] No locks — every song is accessible from day one
- [ ] Shows progress per song (lines learned / total lines)

### 2b: Song Practice Engine
- [ ] Parse lyrics files → extract Korean lines → skip pure English lines
- [ ] Deduplicate repeated lines (choruses) — teach once, mark as covered
- [ ] Target: ~12-15 unique sequential lines per song (~50% of song bulk)
- [ ] Practice flow per line:
  1. Show the Korean line with audio (TTS)
  2. Word-by-word breakdown (each word → meaning → role in sentence)
  3. Full line translation reveal
  4. 2-3 quiz questions on that line (vocab meaning, grammar usage, fill-blank)
  5. Move to next line
- [ ] Session saves progress — resume where you left off
- [ ] At end: show all learned lines together (mini sing-along of what they know)

### 2c: Song Practice Content Generation
- [ ] Pipeline script: generate practice data for all 72 songs
  - Input: lyrics file + song_context JSON
  - Output: `public/data/song_practice/{songId}.json` — line-by-line breakdowns + quiz questions
- [ ] Claude API generates: word breakdowns, translations, quiz questions with plausible distractors
- [ ] TTS generation for all practice lines + individual words

## Phase 3: Vocab/Grammar Practice `[ ]`

The retention engine. Pulls vocab/grammar from completed lessons and drills them in varied contexts. Gates lesson progression.

### 3a: Practice Session Engine
- [ ] Pool all vocab + grammar from completed lessons
- [ ] Each practice session: ~10-15 questions, mixed types:
  - Word → meaning (with plausible distractors from other learned words)
  - Meaning → word
  - Fill-in-the-blank using song lines from ANY song (not just the lesson's song)
  - Grammar pattern recognition (which pattern fits this sentence?)
  - Listening comprehension (TTS plays → pick the right word/meaning)
  - **Comparison questions**: "-고 vs -지만 — which fits here?" (Sung: higher-order retrieval)
  - **Novel context application**: "Read this new line and pick what it means" (Sung: encoding quality)
- [ ] **Interleaving across lessons** (Sung SIR): mix Lesson 1-5 material in a single session
- [ ] Spaced repetition: words answered wrong appear more frequently (Ebbinghaus)
- [ ] Track mastery per word/grammar point (Bloom: concept-level, not lesson-level)
- [ ] Wrong answer → corrective feedback + schedule re-exposure (Bloom: remediation before re-test)

### 3b: Progression Gates
- [ ] Lessons 1-5 unlocked by default (Unit 1)
- [ ] To unlock next batch of 5: complete X practice sessions with Y% accuracy on current batch's vocab
- [ ] Practice sessions always available (can grind as much as you want)
- [ ] Visual progress: show which words are "mastered" vs "learning" vs "new"

### 3c: Better Quiz Distractors (Bloom + Sung)
- [ ] Distractor pool: all vocab from all lessons + practice content
- [ ] Same part of speech, similar difficulty level
- [ ] **Discrimination feedback**: "This is right because X. Option B would mean Y, which doesn't fit because Z."
- [ ] Never have multiple valid answers for fill-in-the-blank
- [ ] Target: user must actually read and reason, not eliminate by category

## Phase 4: Spotify Playlist `[ ]`

Script that creates a Spotify playlist of all 72 songs for passive listening exposure.

- [ ] Python script: `pipeline/create_spotify_playlist.py`
  - Reads `song_manifest.json` for all 72 songs
  - Searches Spotify API for each track
  - Creates "Songwon Study Songs" playlist on user's account
  - One-time OAuth flow
- [ ] Add "Listen on Spotify" button to app that links to the playlist

## Phase 5: Integration & Polish `[ ]`

- [ ] Home screen: show both lesson track and song practice as equal entry points
- [ ] Song practice progress visible on home screen
- [ ] Vocab mastery dashboard (replaces broken analytics)
- [ ] Cross-reference: when practicing a song, highlight words the user already knows from lessons
- [ ] When doing lesson practice, pull example sentences from songs the user has practiced

---

## Data Architecture

### New data files
```
public/data/song_practice/
  {songId}.json          — line-by-line breakdowns + quizzes for each song

public/data/practice/
  vocab_pool.json        — all vocab across all lessons, tagged by lesson + song
  grammar_pool.json      — all grammar patterns, tagged by lesson
  distractor_bank.json   — pre-generated plausible distractors per word/pattern
```

### New app routes
```
/songs                   — song browser (all 72 songs, ungated)
/songs/[songId]/practice — song practice engine
/practice                — vocab/grammar practice session
/practice/stats          — mastery dashboard
```

### Progress storage (localStorage)
```
songwon-song-progress    — per-song line completion + scores
songwon-practice-stats   — vocab mastery levels, practice session count, SRS data
songwon-v5-progress      — existing lesson progress (unchanged)
```

---

## Content Numbers

| Content | Count | Source |
|---------|-------|--------|
| Songs available | 72 | pipeline/lyrics/ |
| Songs in lessons | 13 | 20 lessons reuse some songs |
| Songs untapped | 59 | available for song practice only |
| Lyrics files | 72 | pipeline/lyrics/*.txt |
| Target lines per song | 12-15 | ~50% of unique Korean lines |
| Total practice lines | ~900-1,080 | 72 songs x 12-15 lines |
| Lesson vocab items | ~80-100 | 4-5 per lesson x 20 lessons |

---

## Build Order

1. **Phase 1** — UX fixes (< 1 session, unblocks everything)
2. **Phase 2a** — Song browser UI (standalone, shows the vision)
3. **Phase 2c** — Content generation pipeline (generates practice data)
4. **Phase 2b** — Song practice engine (core feature)
5. **Phase 3a** — Vocab/grammar practice engine
6. **Phase 3c** — Better distractors (improves both lesson and practice quizzes)
7. **Phase 3b** — Progression gates
8. **Phase 4** — Spotify playlist
9. **Phase 5** — Integration and polish
