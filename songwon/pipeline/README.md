# Song Acquisition & Lesson Generation Pipeline

Status as of 2026-08-07. All pipeline steps complete through V5 lesson generation + TTS cache.

## Scripts (reusable tools)

Every step has a standalone script with a header comment explaining usage and gotchas.

### Song Acquisition

| Script | What it does | Dependencies |
|--------|-------------|-------------|
| `extract_playlist.py` | Extracts all tracks from a Spotify playlist with metadata, ISRC codes, genres | `pip3 install spotipy` + Spotify API creds in `.env.local` |
| `filter_korean.py` | Filters Korean songs from a mixed-language playlist (ISRC, hangul, genres, known artists) | None (stdlib only) |
| `select_songs.py` | Interactive song picker — number ranges, batch file, or manual add | None (stdlib only) |
| `download_songs.py` | Downloads songs from YouTube Music as MP3 (studio audio, not MVs). Resumable. | `yt-dlp`, `ffmpeg` |
| `fetch_lyrics.py` | Fetches Korean lyrics from lyrics.ovh free API. Resumable. | `pip3 install requests` |
| `fetch_lyrics_web.py` | Fetches lyrics from Genius API for songs the free API missed. Resumable. | `pip3 install requests` (+ `GENIUS_API_TOKEN` in `.env.local`) |

### Analysis & Curriculum

| Script | What it does | Dependencies |
|--------|-------------|-------------|
| `merge_corpus_analysis.py` | Merges batch analysis JSON files into unified `corpus_analysis.json` | None (stdlib only) |
| `merge_lyrics_into_context.py` | Injects Korean lyrics text into AI-generated context files (workaround for AI refusing to reproduce lyrics) | None (stdlib only) |
| `build_curriculum_map.py` | Maps songs to 5 learning levels based on corpus analysis | None (stdlib only) |

### Lesson Generation

| Script | What it does | Dependencies |
|--------|-------------|-------------|
| `generate_lessons.py` | V2/V3 lesson generator — flat structure (deprecated, kept for reference) | `pip3 install anthropic` |
| `generate_lessons_v5.py` | V5 lesson generator — interleaved screens from curriculum progression | `pip3 install anthropic` |
| `generate_lesson_v6.py` | V6 single-lesson generator — API-based with quality gate validation. Has LESSON_CONFIG for all 20 lessons. | `pip3 install anthropic` |
| `generate_tts.py` | Pre-generates Edge TTS MP3s for ALL Korean text in V5 lessons. Deep walks JSON to find every string. | `pip3 install edge-tts` |

## How to run the full pipeline from scratch

```bash
# 1. Extract playlist
python3 pipeline/extract_playlist.py https://open.spotify.com/playlist/YOUR_PLAYLIST_ID

# 2. Filter Korean songs
python3 pipeline/filter_korean.py

# 3. Select songs interactively (or --from-file list.txt)
python3 pipeline/select_songs.py

# 4. Download from YouTube Music
python3 pipeline/download_songs.py

# 5. Fetch lyrics (API first, then Genius for missing)
python3 pipeline/fetch_lyrics.py
python3 pipeline/fetch_lyrics_web.py

# 6. Corpus analysis — feed all lyrics to Claude in conversation, save as corpus_analysis.json
# (Manual step — use Claude to analyze vocabulary, grammar, difficulty per song)

# 7. Build curriculum map
python3 pipeline/build_curriculum_map.py

# 8. Song context — generate verse-by-verse breakdowns via Claude, then merge lyrics
python3 pipeline/merge_lyrics_into_context.py

# 9. Generate V5 lessons (uses Anthropic API)
python3 pipeline/generate_lesson_v6.py

# 10. Generate TTS cache for all Korean text in lessons
python3 pipeline/generate_tts.py

# 11. Copy lessons to web app
cp pipeline/lessons_v5/*.json public/data/lessons_v5/
```

## Regenerating TTS cache

When lessons change or new ones are added:

```bash
# Regenerates ALL Korean text from public/data/lessons_v5/*.json
# Deep-walks every JSON field to find Korean strings
# Skips already-cached files, only generates missing ones
python3 pipeline/generate_tts.py
```

The script found 1,733 unique Korean texts across 20 lessons. Cache is at `pipeline/tts_cache/` (~4,691 files including rate variants).

## Data files

| File | What it is |
|------|-----------|
| `playlist.spotdl` | Raw Spotify data — 495 tracks with ISRC codes + artist genres |
| `korean_songs.json` | Filtered Korean songs — 250 songs with match reasons |
| `selected_songs.json` | User's 72 selected songs for lesson generation |
| `download_status.json` | Per-song download results (YouTube IDs, titles, file sizes) |
| `lyrics_status.json` | Per-song lyrics fetch results (source, hangul line counts) |
| `audio/` | 72 MP3 files (gitignored, ~500MB) |
| `lyrics/` | 72 lyrics text files |
| `song_manifest.json` | Unified index: every song → MP3 path → lyrics path |
| `corpus_analysis.json` | Vocabulary (1,127 words), grammar (320 patterns), per-song difficulty |
| `curriculum_map.json` | Songs mapped to 5 learning levels |
| `song_context/*.json` | 72 verse-by-verse context files (literal + cultural meaning) |
| `tts_cache/` | ~4,691 pre-generated Edge TTS MP3s + manifest.json |
| `CURRICULUM_DESIGN.md` | How songs become lessons |
| `CURRICULUM_PROGRESSION.md` | Grammar-first curriculum (20 lessons, 5 units) |
| `SESSION_DESIGN.md` | V4 canonical session flow (interleaved teach/test) |
| `EXAMPLE_LESSON_10cm_My_Eyes.md` | Gold-standard example lesson (38 screens) |

## Pipeline status — ALL COMPLETE

1. **Spotify extraction** — 495 tracks from "Asian - ALL - TXT" playlist
2. **Korean filtering** — 250 Korean songs detected
3. **Song selection** — 72 songs (63 original + 5 user additions + 4 later additions)
4. **YouTube Music download** — 72 MP3s (studio audio)
5. **Lyrics fetching** — 72/72 lyrics (lyrics.ovh + Genius API)
6. **Corpus analysis** — 1,127 vocab, 320 grammar patterns, difficulty ratings
7. **Song context** — 72 verse-by-verse breakdowns
8. **Curriculum map** — 72 songs → 5 levels (6/11/27/23/5 per level)
9. **V5 lesson generation** — 20 lessons, ~30 screens each, interleaved teach/test
10. **TTS cache** — ~4,691 Korean audio clips (Edge TTS, `ko-KR-SunHiNeural`)

## V2 Universal App — Building Blocks

These scripts are the reusable foundation for V2 (user provides Spotify playlist → auto-generated lessons):

1. `extract_playlist.py` — takes any Spotify playlist URL, outputs structured JSON
2. `filter_korean.py` — language detection (extensible to other languages for V3)
3. `download_songs.py` — resumable YouTube Music downloader
4. `fetch_lyrics.py` + `fetch_lyrics_web.py` — multi-source lyrics fetching
5. `generate_lesson_v6.py` — API-based lesson generation with quality gates
6. `generate_tts.py` — TTS cache generation for any lesson set

For V2, these need: a web-facing orchestrator, user-facing config (API key input), and the corpus analysis step automated (currently manual Claude conversation).
