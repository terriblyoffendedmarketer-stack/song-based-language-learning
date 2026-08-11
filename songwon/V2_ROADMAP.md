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

## Phase 1: UX Bug Fixes `[x]`

Fix broken navigation and tracking before building new features.

- [x] **Analytics page**: connected to V5 progress system (`V5UserProgress`)
- [x] **Lesson browser clickability**: individual lessons clickable/launchable in browse view
- [x] **Unlock 5 at a time**: unit-based unlock (5 lessons per unit)
- [x] **Tab navigation**: grammar/vocabulary tabs functional
- [x] **Back navigation**: lesson list → lesson → back works

## Phase 2: Song Practice (Standalone) `[x]`

Ungated song learning — the app's second front door. User browses 72 songs, picks one, learns it line by line. No lessons required.

### 2a: Song Browser UI
- [x] New `/songs` route: grid/list of all 72 songs with artist, title, album art placeholder
- [x] Search/filter by artist, title
- [x] No locks — every song is accessible from day one
- [x] Shows progress per song (lines learned / total lines)

### 2b: Song Practice Engine
- [x] Parse lyrics files → extract Korean lines → skip pure English lines
- [x] Deduplicate repeated lines (choruses) — teach once, mark as covered
- [x] Target: ~12-15 unique sequential lines per song (~50% of song bulk)
- [x] Practice flow per line:
  1. Show the Korean line with audio (TTS)
  2. Word-by-word breakdown (each word → meaning → role in sentence)
  3. Full line translation reveal
  4. 2-3 quiz questions on that line (vocab meaning, grammar usage, fill-blank)
  5. Move to next line
- [x] Session saves progress — resume where you left off
- [x] At end: show all learned lines together (mini sing-along of what they know)

### 2c: Song Practice Content Generation
- [x] Pipeline script: `pipeline/generate_song_practice.py` — generates practice data for all 72 songs
  - Input: lyrics file + song_context JSON
  - Output: `public/data/song_practice/{songId}.json` — line-by-line breakdowns
  - Supports: --dry-run, --song SONG_ID, --force
- [x] Claude API generates: word breakdowns (korean/english/role), natural translations
- [x] All 72 song practice files generated and audited (1,050 lines, 596 grammar notes, 0 invalid roles)
- [x] Audit script: `pipeline/audit_song_practice.py` — quantitative quality check
- [x] Quiz questions with plausible distractors (done in Phase 3c)
- [x] TTS generation for practice lines + individual words (generate_tts.py updated to extract from song_practice/*.json)

## Phase 3: Vocab/Grammar Practice `[x]`

The retention engine. Pulls vocab/grammar from completed lessons and drills them in varied contexts. Gates lesson progression.

### 3a: Practice Session Engine
- [x] Pool all vocab + grammar from completed lessons (`public/data/practice/vocab_pool.json`, `grammar_pool.json`)
- [x] Each practice session: 12 questions, mixed types:
  - Word → meaning (with plausible distractors from other learned words)
  - Meaning → word
  - Grammar pattern → meaning
- [x] **Interleaving across lessons** (Sung SIR): mix all completed lesson material in a single session
- [x] Spaced repetition: SRS scheduling, wrong answers appear more frequently (Ebbinghaus)
- [x] Track mastery per word/grammar point (new/learning/mastered)
- [x] Practice lobby with mastery overview, session stats
- [x] Practice route at `/practice` with BottomNav integration
- [x] Fill-in-the-blank using song lines (blank a word from a real song line, pick the missing word)
- [x] Listening comprehension (TTS auto-plays → pick the English meaning)
- [x] **Comparison questions**: "-고 vs -지만 — which fits here?" with confusable pairs
- [x] **Novel context application**: "Read this new line and pick what it means" (Sung: encoding quality)
- [x] Wrong answer → corrective feedback + schedule re-exposure (Bloom: remediation before re-test)

### 3b: Progression Gates
- [x] Lessons 1-5 unlocked by default (Unit 1)
- [x] To unlock next batch of 5: pass previous batch + 2 practice sessions per set
- [x] Practice sessions always available (can grind as much as you want)
- [x] Visual progress: mastery overview in practice lobby (new/learning/mastered)
- [x] `getUnlockRequirements()` helper for UI to show what's needed

### 3c: Better Quiz Distractors (Bloom + Sung)
- [x] Distractor pool: all vocab from all lessons in practice engine
- [x] Same part of speech, same type (word/phrase) preferred for distractors
- [x] **Discrimination feedback**: shows why correct answer is right and why selected wrong answer is wrong
- [x] Never have multiple valid answers for fill-in-the-blank (distractors exclude words in same sentence)
- [x] Target: user must actually read and reason, not eliminate by category

## Phase 4: Spotify Playlist `[x]`

Script that creates a Spotify playlist of all 72 songs for passive listening exposure.

- [x] Python script: `pipeline/create_spotify_playlist.py`
  - Reads `song_manifest.json` for all 72 songs
  - Searches Spotify API for each track (spotipy + OAuth)
  - Creates "Songwon Study Songs" playlist on user's account
  - Saves playlist URL to `public/data/spotify_playlist.json`
- [x] "Listen on Spotify" link on home page (conditional on playlist data existing)

## Phase 5: Integration & Polish `[x]`

- [x] Home screen: practice CTA + song library as equal entry points
- [x] Song practice progress visible on home screen (songs started + lines learned)
- [x] Vocab mastery dashboard in practice lobby (new/learning/mastered counts + bar)
- [x] Cross-reference: when practicing a song, highlight words the user already knows from lessons
- [x] When doing lesson practice, pull example sentences from songs the user has practiced

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
