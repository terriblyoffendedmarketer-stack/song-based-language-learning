# Song Acquisition Pipeline

Status as of 2026-08-01. Updated after Genius lyrics fetch.

## Scripts (reusable tools)

Every step of the pipeline has a standalone script. Anyone can plug these into their own workflow.

| Script | What it does | Dependencies |
|--------|-------------|-------------|
| `extract_playlist.py` | Extracts all tracks from a Spotify playlist with metadata, ISRC codes, genres | `pip3 install spotipy` + Spotify API creds in `.env.local` |
| `filter_korean.py` | Filters Korean songs from a mixed-language playlist (ISRC, hangul, genres, known artists) | None (stdlib only) |
| `select_songs.py` | Interactive song picker — number ranges, batch file, or manual add | None (stdlib only) |
| `download_songs.py` | Downloads songs from YouTube Music as MP3 (studio audio, not MVs). Resumable. | `yt-dlp`, `ffmpeg` |
| `fetch_lyrics.py` | Fetches Korean lyrics from lyrics.ovh free API. Resumable. | `pip3 install requests` |
| `fetch_lyrics_web.py` | Scrapes lyrics from Google/lyrics sites for songs the API missed | `pip3 install requests` |

### How to run the full pipeline from scratch

```bash
# 1. Extract playlist
python3 pipeline/extract_playlist.py https://open.spotify.com/playlist/YOUR_PLAYLIST_ID

# 2. Filter Korean songs
python3 pipeline/filter_korean.py

# 3. Select songs interactively (or --from-file list.txt)
python3 pipeline/select_songs.py

# 4. Download from YouTube Music
python3 pipeline/download_songs.py

# 5. Fetch lyrics (API first, then web scrape for missing)
python3 pipeline/fetch_lyrics.py
python3 pipeline/fetch_lyrics_web.py
```

## Data files

| File | What it is |
|------|-----------|
| `playlist.spotdl` | Raw Spotify data — 495 tracks with ISRC codes + artist genres |
| `korean_songs.json` | Filtered Korean songs — 250 songs with match reasons |
| `selected_songs.json` | User's 63 selected songs for lesson generation |
| `download_status.json` | Per-song download results (YouTube IDs, titles, file sizes) |
| `lyrics_status.json` | Per-song lyrics fetch results (source, hangul line counts) |
| `audio/` | 63 MP3 files, 457MB total (gitignored) |
| `lyrics/` | 58 lyrics text files (5 niche indie tracks still missing) |
| `song_manifest.json` | Unified index: every song → MP3 path → lyrics path |
| `CURRICULUM_DESIGN.md` | How songs become lessons — READ THIS before generating content |

## Pipeline status

### 1. Spotify playlist extraction — DONE
- **Script**: `extract_playlist.py`
- **Input**: Spotify playlist "Asian - ALL - TXT" (495 songs, mixed Asian languages)
- **Output**: `playlist.spotdl`

### 2. Korean song filtering — DONE
- **Script**: `filter_korean.py`
- **Output**: `korean_songs.json` — 250 Korean songs (out of 495 total)
- **Detection methods**: ISRC "KR" prefix (222 songs), hangul in title/artist/album, Korean genres, known artist list

### 3. Song selection — DONE
- **Script**: `select_songs.py`
- **Output**: `selected_songs.json` — 63 songs chosen by user
- 58 from the playlist, 5 user-added (not in original playlist):
  - BOL4 - Seoul
  - BTS - Mic Drop
  - Suga - Dwechita
  - IU - Through the Night(밤편지)
  - IU - Meaning of you

### 4. YouTube Music download — DONE
- **Script**: `download_songs.py`
- **Output**: `audio/` directory — 63 MP3 files (457MB total, gitignored)
- **Status file**: `download_status.json` — per-song YouTube match info
- Searches music.youtube.com for studio audio (not MVs)
- 6 songs fell back to youtube.com (region-locked on YT Music)
- SHAUN "Way Back Home" = solo Korean version (not Conor Maynard remix)
- **Known issue**: BTS "Mic Drop" downloaded Steve Aoki Remix — needs re-download

### 5. Lyrics fetching — DONE (58/63)
- **Scripts**: `fetch_lyrics.py` (lyrics.ovh API) → `fetch_lyrics_web.py` (Genius API fallback)
- **Output**: `lyrics/` directory — 58 lyrics files
- **Status file**: `lyrics_status.json`
- 26 found via lyrics.ovh, 29 via Genius API, 3 via Genius with Korean search terms
- 5 still missing (very niche indie): BUMKEY Family, Lundi Blues Fake, Sogyumo Acacia Band Almost Blue, YOUNGJOO Smells, Shin In Ryu Undecided

### Unified manifest — DONE
- **Output**: `song_manifest.json` — links every song to its MP3 and lyrics file
- 63/63 MP3s connected, 58/63 lyrics connected

## What's next

### 6. Corpus analysis (READ `CURRICULUM_DESIGN.md` FIRST)
- Feed ALL lyrics to Claude together
- Extract: vocabulary inventory, grammar patterns, per-song difficulty
- Save as `corpus_analysis.json`

### 7. Curriculum mapping
- Map songs/sections to learning levels
- Define lesson sequence
- Save as `curriculum_map.json`

### 8. Lesson generation
- Generate per-lesson content following the curriculum map
- Save as seed data JSON files for the web app

## Key decisions
- Songs come ONLY from the user's Spotify playlist + user-specified additions
- Script-based pipeline, NOT AI-based for mechanical tasks
- AI only for lesson content generation
- YouTube Music versions preferred over YouTube video
- State saved as JSON between steps (pause/resume friendly)
- User's Spotify credentials stored in `songwon/.env.local` (gitignored)
