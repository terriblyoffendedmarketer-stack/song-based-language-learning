---
name: add-songs
description: Add new songs to Songwon's practice library — lyrics, audio, practice data, TTS
user_invocable: true
---

# Add Songs to Songwon

When the user wants to add new songs to the app, follow this process exactly. The script `pipeline/add_songs.py` handles the heavy lifting — your job is to identify the songs, run it, verify results, and handle failures.

## Step 1: Identify the songs

Parse what the user gives you — screenshots, text lists, Spotify links, artist names. Build a list of `"ARTIST - Title"` pairs. If the user gives a screenshot (like a Spotify artist page), read the song names and artists from it.

Check which songs already exist:
```bash
cat public/data/song_index.json | python3 -c "import json,sys; [print(s['id'],s['artist'],s['title']) for s in json.load(sys.stdin)['songs']]" | grep -i "ARTIST_NAME"
```

## Step 2: Run the pipeline

```bash
cd songwon && python3 pipeline/add_songs.py "ARTIST - Title1" "ARTIST - Title2" ...
```

The script handles: lyrics fetching (lyrics.ovh → Genius fallback), YouTube Music search + download (with Chrome cookies), updating all data files, generating practice data via Claude API, and TTS cache generation.

### Flags
- `--check-only` — dry run, just check lyrics and YouTube availability
- `--skip-audio` — add without downloading audio (practice-only)
- `--skip-practice` — skip Claude API practice generation
- `--skip-tts` — skip TTS generation
- `--from-file songs.txt` — read song list from file

## Step 3: Verify results

After the script runs, verify:

1. **Lyrics quality** — spot-check one lyrics file for Korean content:
   ```bash
   head -20 "public/data/lyrics/ARTIST - Title.txt"
   ```

2. **Practice data** — check the generated practice JSON has good lines:
   ```bash
   cat "public/data/song_practice/SONG_ID.json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"lines\"])} lines'); [print(f'  {l[\"korean\"]} → {l[\"english\"]}') for l in d['lines'][:3]]"
   ```

3. **Song count** — verify the index updated:
   ```bash
   cat public/data/song_index.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"totalSongs\"]} total songs')"
   ```

## Step 4: Handle failures

### Lyrics not found
Try alternative artist names:
- Korean name variants (SUNMI → 선미, IU → 아이유)
- Different title formats (Heart Burn → 열이올라요)
- Manual search: `python3 -c "import requests; r=requests.get('https://api.lyrics.ovh/v1/ARTIST/TITLE'); print(r.status_code, r.text[:200])"`

If lyrics truly can't be found automatically, the user can paste lyrics into `public/data/lyrics/ARTIST - Title.txt` manually and re-run with `--skip-audio` or the full pipeline.

### Audio download 403
The script uses `--cookies-from-browser chrome`. If Chrome cookies fail:
1. Make sure Chrome is installed and the user has visited YouTube recently
2. Try `yt-dlp --cookies-from-browser safari` as alternative
3. As a last resort, the user can manually download and place the MP3 in `pipeline/audio/ARTIST - Title.mp3`

### Practice generation fails
Needs `ANTHROPIC_API_KEY` in `.env.local`. Run individually:
```bash
python3 pipeline/generate_song_practice.py --song SONG_ID
```

## Important notes

- Songs are for the PRACTICE section only (not main lesson tree) unless explicitly asked to create curriculum lessons
- **Audio must go in `public/audio/`** — the app serves MP3s from there via Howler.js (static files deployed to Vercel). `pipeline/audio/` is gitignored and only exists locally. The `add_songs.py` script copies to both automatically.
- TTS generation is incremental — `generate_tts.py` only creates clips for new Korean text
- After adding songs, the dev server picks them up via hot reload — no rebuild needed
- Song IDs are auto-generated as `artist-title` in lowercase kebab-case
