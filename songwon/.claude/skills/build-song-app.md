---
name: build-song-app
description: Build a complete song-based language learning app from a Spotify playlist — full pipeline from extraction to deployed app
user_invocable: true
---

# Build Song-Based Language Learning App

End-to-end pipeline: Spotify playlist → language learning app with lessons, song practice, and TTS audio. The pipeline uses scripts for mechanical work and AI judgment for analysis, curriculum design, and quality gates.

**Principle**: scripts do the heavy lifting, AI assists with checks and fills gaps between scripts. Never freestyle what a script can handle. When AI generates content (corpus analysis, curriculum, lessons), use structured prompts with validation — not open-ended generation.

---

## Phase 1: Source Songs (scripts only)

**Input**: Spotify playlist URL
**Output**: `korean_songs.json`

```bash
# Extract all tracks with metadata
python3 pipeline/extract_playlist.py <SPOTIFY_PLAYLIST_URL>

# Filter to Korean songs (ISRC codes, hangul detection, genre matching)
python3 pipeline/filter_korean.py
```

**Checks**:
- Verify `korean_songs.json` has a reasonable count (expect 30-60% of playlist to be Korean)
- Spot-check 5 random entries: are they actually Korean songs?
- If count is suspiciously low, check `playlist.spotdl` for encoding issues or missing genre data

**Requirements**: `pip3 install spotipy`, Spotify API creds in `.env.local` (`SPOTIPY_CLIENT_ID`, `SPOTIPY_CLIENT_SECRET`)

---

## Phase 2: Select Songs (script + user input)

**Input**: `korean_songs.json`
**Output**: `selected_songs.json`

```bash
# Interactive picker or batch from file
python3 pipeline/select_songs.py
# Or: python3 pipeline/select_songs.py --from-file picks.txt
```

For automated selection (no user input), select songs that:
- Have high Korean line counts (>20 unique Korean lines preferred)
- Span difficulty levels (don't cluster at one end)
- Cover diverse grammar patterns
- Include popular/recognizable songs for motivation

**Target**: 40-80 songs. Below 40 the curriculum will be thin. Above 80 the pipeline cost goes up without proportional benefit.

---

## Phase 3: Acquire Content (scripts with AI fallbacks)

**Input**: `selected_songs.json`
**Output**: `pipeline/audio/*.mp3`, `pipeline/lyrics/*.txt`, `public/data/lyrics/*.txt`

### 3a. Download audio

```bash
python3 pipeline/download_songs.py
```

**Gotcha**: yt-dlp needs `--cookies-from-browser chrome` to avoid YouTube 403 errors. The script handles this. If downloads fail:
1. Check Chrome is installed and user has visited YouTube recently
2. Try Safari cookies: modify the download_audio call to use `--cookies-from-browser safari`
3. Search with Korean artist name variants (선미 instead of SUNMI, 아이유 instead of IU)
4. Last resort: user manually provides MP3

### 3b. Fetch lyrics

```bash
# Free API first
python3 pipeline/fetch_lyrics.py

# Genius API for anything missed
python3 pipeline/fetch_lyrics_web.py
```

**AI fallback for missing lyrics**: If both scripts fail for a song:
1. Search the web for `"ARTIST TITLE 가사"` (가사 = lyrics in Korean)
2. Check colorcodedlyrics.com, genius.com, namu.wiki
3. Validate: does the text have hangul? Are there >5 Korean lines? Is it the right song (not a translation/romanization)?
4. Save to both `pipeline/lyrics/` and `public/data/lyrics/`
5. **Never fabricate lyrics.** If you can't find them, skip the song.

**Validation gate** (run after all lyrics are fetched):
```python
# For each lyrics file:
# - Has hangul? (reject if not)
# - >= 5 unique Korean lines? (warn if 5-10, reject if <5)
# - Not a translation/romanization? (check: ratio of hangul characters to total should be >40%)
# - Not a tracklist/credits page mistakenly captured? (check first 3 lines for dates/track numbers)
```

### 3c. Build song manifest

After audio + lyrics are complete:
```bash
# This may need a script — or update song_manifest.json manually
# Each entry: artist, name, safe_name, mp3 path, lyrics path, youtube_id
```

---

## Phase 4: Corpus Analysis (AI-driven, structured)

**Input**: All lyrics files
**Output**: `pipeline/corpus_analysis.json`

This is the most critical AI step. The output drives curriculum design.

### How to do it

Send lyrics in batches of 10-15 songs to the Claude API (not in-context — use `generate_song_practice.py` as the pattern). For each batch, extract:

1. **Vocabulary**: every meaningful Korean word, with:
   - `word`, `meaning`, `pos` (noun/verb/adjective/adverb)
   - `topik_level` (1-6, estimate based on frequency and complexity)
   - `songs` (which songs contain this word)
   - `frequency` (how many songs it appears in)

2. **Grammar patterns**: every grammar construction, with:
   - `pattern`, `meaning`, `topik_level`
   - `examples` (2-4 actual lines from the lyrics)
   - `songs` (which songs use this pattern)
   - `frequency`

3. **Song difficulty**: per-song rating with:
   - `difficulty_score` (1-5)
   - `avg_topik_level` (average of vocab TOPIK levels)
   - `grammar_complexity` (low/medium/high)
   - `korean_ratio` (% of lines that are Korean)
   - `key_vocab_count`, `key_grammar_count`
   - `notes` (any data quality issues)

### Validation gate

After merging all batches into `corpus_analysis.json`:
- Total unique vocab should be 500-2000 for 40-80 songs
- Grammar patterns should be 100-500
- Every song in `selected_songs.json` should appear in `song_difficulty`
- TOPIK level distribution should roughly follow a bell curve (most at levels 2-4)
- Flag any song with `korean_ratio` < 20% or `notes` mentioning data issues

### Script to build this

Use the existing `merge_corpus_analysis.py` to combine batch outputs:
```bash
python3 pipeline/merge_corpus_analysis.py
```

If this script doesn't exist for the new project, create one following the pattern: read batch JSON files, deduplicate vocab by word, merge song lists, compute frequencies.

---

## Phase 5: Curriculum Design (AI-driven with rules)

**Input**: `corpus_analysis.json`, `CURRICULUM_PROGRESSION.md` (template)
**Output**: `CURRICULUM_PROGRESSION.md` (filled), `curriculum_map.json`, lesson configs

### The rules (non-negotiable)

1. **Grammar progression follows proven pedagogy** (King Sejong Institute / TOPIK order):
   - Unit 1: Connectors & basics (-고, -고 싶다, -고 있다, -(으)면)
   - Unit 2: Contrast & negation (-지만, -지 못하다, -지 않다, -아/어서)
   - Unit 3: Requests & speculation (-아/어 줘, -(으)ㄹ 것 같다, -잖아, -는데)
   - Unit 4: Tense & change (past tense, -게 되다, indirect speech, -(으)ㄹ 수 있다)
   - Unit 5: Advanced (passive voice, -다 보니, -나 보다, -(으)ㄹ 텐데)

2. **Songs are assigned to grammar, not the other way around**. Find songs that demonstrate each grammar point. A lesson may pull lines from 2-3 songs.

3. **Each lesson has**: 1 grammar focus, 2 vocab words + 2 phrases, 1 primary song
4. **20 lessons total** (4 per unit), unless the corpus is unusually large/small
5. **Vocab follows frequency**: most common words first, weighted by TOPIK level

### How to do it

1. Sort grammar patterns from corpus by TOPIK level (ascending) and frequency (descending)
2. Map to the 5-unit structure above
3. For each lesson slot, find the best-fit song: one that uses the target grammar AND has good Korean line count
4. Select 2 words (highest frequency, matching TOPIK level) + build 2 phrases using the grammar pattern
5. Write LESSON_CONFIG entries (same format as `generate_lesson_v6.py`)

### Script

```bash
python3 pipeline/build_curriculum_map.py
```

### Validation gate

- Every grammar pattern in lessons exists in `corpus_analysis.json`
- Every song assigned to a lesson exists in `selected_songs.json` and has lyrics
- No song appears as primary in more than 2 lessons
- TOPIK levels increase monotonically across units (unit 1 avg < unit 2 avg < ...)
- Vocab doesn't repeat across lessons

---

## Phase 6: Generate Lessons (script via API)

**Input**: LESSON_CONFIG (in `generate_lesson_v6.py`), lyrics, curriculum
**Output**: `public/data/lessons_v5/*.json`

```bash
# Generate one lesson at a time for quality
python3 pipeline/generate_lesson_v6.py 1
python3 pipeline/generate_lesson_v6.py 2
# ... through 20
```

**Critical gotcha**: Generate ONE lesson at a time. Quality degrades in batch. Each call costs ~$0.05-0.10 on Sonnet.

### Validation gate (built into the script)

The `quality_gate()` function checks:
- Every quiz has exactly 1 correct answer
- All screen types are valid
- Korean text is present where expected
- No duplicate screens
- Word/phrase cards have all required fields

If validation fails, the script should retry (up to 2 times) before failing.

---

## Phase 7: Song Practice Data (script via API)

**Input**: `song_index.json`, lyrics, song context
**Output**: `public/data/song_practice/*.json`

```bash
# All songs at once (or --song SONG_ID for individual)
python3 pipeline/generate_song_practice.py
```

This generates 12-15 study lines per song with word breakdowns and grammar notes. ~$0.02/song on Sonnet.

### Validation gate

```bash
python3 pipeline/audit_song_practice.py
```

Checks: line count per song, word breakdown completeness, grammar note presence, Korean text validity.

---

## Phase 8: Song Context (AI-driven)

**Input**: Lyrics files
**Output**: `pipeline/song_context/*.json`

For each song, generate verse-by-verse context: literal meaning, cultural notes, honorific level, grammar highlights. This enriches the practice experience.

**Pattern**: Send full lyrics to Claude API → get structured JSON with song_story (overview, cultural_root, the_lyrics section-by-section), honorific_level, grammar_highlights.

**Then merge actual lyrics** (because AI may refuse to reproduce them):
```bash
python3 pipeline/merge_lyrics_into_context.py
```

---

## Phase 9: TTS Cache (script only)

**Input**: All lesson JSONs, all practice JSONs
**Output**: `pipeline/tts_cache/*.mp3`

```bash
python3 pipeline/generate_tts.py
```

Incremental — only generates clips for new Korean text. Uses Edge TTS (`ko-KR-SunHiNeural` voice), free.

**Requirement**: `pip3 install edge-tts`

---

## Phase 10: Build Song Index & App Data (script)

**Input**: All pipeline data
**Output**: `public/data/song_index.json`, `public/data/practice/vocab_pool.json`, `public/data/practice/grammar_pool.json`

Build the song index from manifest + lesson assignments:
```python
# song_index.json structure: {totalSongs, songs: [{id, title, artist, koreanLines, uniqueKoreanLines, totalLines, youtubeId, lyricsFile, lessons: [{lessonId, lessonNumber, unit, grammar}]}]}
```

Build practice pools by extracting all vocab/grammar from lessons into flat arrays for the SRS practice engine.

---

## Phase 11: App Setup (if building from scratch)

If this is a new app (not adding to Songwon):

1. **Scaffold**: Next.js + TypeScript + Tailwind CSS
2. **Copy the engine**: The lesson engine (`app/learn/v5/`), song practice (`app/songs/[songId]/practice/`), and practice engine (`lib/practice-engine.ts`) are reusable
3. **Data loading**: `lib/seed-loader.ts` pattern — load JSON from `public/data/`
4. **TTS API**: `app/api/tts-cached/route.ts` — serves cached MP3s, generates on-demand
5. **Audio API**: `app/api/audio/route.ts` — streams MP3s with range request support

---

## Pipeline Cost Estimate

For a 60-song corpus:
- Corpus analysis: ~$2-3 (Sonnet, 5-6 batch calls)
- Lesson generation: ~$1-2 (20 lessons × $0.05-0.10)
- Song practice: ~$1.20 (60 songs × $0.02)
- Song context: ~$2-3 (60 context files)
- TTS: Free (Edge TTS)
- **Total: ~$6-10 in API costs**

---

## Quick Reference: Which Steps Are Scripts vs AI

| Step | Method | Script | AI Role |
|------|--------|--------|---------|
| Playlist extraction | Script only | `extract_playlist.py` | None |
| Korean filtering | Script only | `filter_korean.py` | None |
| Song selection | Script + user | `select_songs.py` | Recommend songs if automated |
| Audio download | Script | `download_songs.py` | Fallback search with Korean names |
| Lyrics fetch | Script + AI fallback | `fetch_lyrics.py`, `fetch_lyrics_web.py` | Web search for missing lyrics |
| Corpus analysis | AI with structure | `merge_corpus_analysis.py` | Analyze lyrics batches → structured JSON |
| Curriculum design | AI with rules | `build_curriculum_map.py` | Map grammar progression → songs |
| Lesson generation | Script via API | `generate_lesson_v6.py` | Claude API generates, script validates |
| Song practice | Script via API | `generate_song_practice.py` | Claude API generates, script validates |
| Song context | AI with structure | `merge_lyrics_into_context.py` | Claude API generates context |
| TTS cache | Script only | `generate_tts.py` | None |
| App build | Template + customize | — | Adapt engine to new language/branding |

---

## Adding Songs to an Existing App

For adding songs without rebuilding the curriculum, use the `/add-songs` skill instead. That handles: lyrics → audio → data files → practice data → TTS in one pass via `pipeline/add_songs.py`.
