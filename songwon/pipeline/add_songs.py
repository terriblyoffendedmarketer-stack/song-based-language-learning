#!/usr/bin/env python3
# add_songs.py — Add new songs to Songwon's practice library (full pipeline)
#
# Usage:
#   python3 pipeline/add_songs.py "ARTIST - Title" ["ARTIST - Title" ...]
#   python3 pipeline/add_songs.py --from-file songs.txt
#   python3 pipeline/add_songs.py --check-only "ARTIST - Title"   # dry run
#
# What it does (in order):
#   1. Parse input → (artist, title) pairs
#   2. Skip songs already in song_index.json
#   3. Fetch lyrics (lyrics.ovh → Genius API fallback)
#   4. Validate lyrics have enough Korean lines (min 5)
#   5. Search YouTube Music for audio match
#   6. Download MP3 (uses Chrome cookies to avoid 403)
#   7. Update all data files (song_index, selected_songs, download_status, song_manifest)
#   8. Generate practice data via Claude API (generate_song_practice.py)
#   9. Generate TTS cache (generate_tts.py)
#
# Requires:
#   pip3 install requests edge-tts anthropic
#   yt-dlp + ffmpeg (brew install yt-dlp ffmpeg)
#   Chrome browser (for YouTube cookies)
#   ANTHROPIC_API_KEY in .env.local (for practice data generation)
#   GENIUS_API_TOKEN in .env.local (optional, for lyrics fallback)
#
# Gotchas:
#   - yt-dlp without --cookies-from-browser chrome gets 403 on most YouTube Music tracks.
#     We always use Chrome cookies. If Chrome isn't available, download will fail gracefully.
#   - lyrics.ovh is free but spotty — Genius API is the reliable fallback for K-pop.
#   - Some songs have very few Korean lines (mixed Korean/English). We warn but still add
#     if >= 5 Korean lines. Below that the practice session would be too thin.
#   - YouTube Music search sometimes returns dance practice or lyric videos instead of
#     the studio audio. We search "artist title" and take the top result — manual
#     verification is recommended for important songs.
#   - The generate_song_practice.py step calls Claude API (~$0.02/song on Sonnet).
#   - TTS generation is incremental — only new Korean text gets generated.

import json
import os
import re
import sys
import time
import subprocess
import argparse
import urllib.parse
from pathlib import Path

PIPELINE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = PIPELINE_DIR.parent
SONG_INDEX_PATH = PROJECT_DIR / "public" / "data" / "song_index.json"
LYRICS_DIR_PUBLIC = PROJECT_DIR / "public" / "data" / "lyrics"
LYRICS_DIR_PIPELINE = PIPELINE_DIR / "lyrics"
AUDIO_DIR = PIPELINE_DIR / "audio"
AUDIO_DIR_PUBLIC = PROJECT_DIR / "public" / "audio"
SELECTED_SONGS_PATH = PIPELINE_DIR / "selected_songs.json"
DOWNLOAD_STATUS_PATH = PIPELINE_DIR / "download_status.json"
MANIFEST_PATH = PIPELINE_DIR / "song_manifest.json"


def has_hangul(text):
    return bool(re.search(r'[가-힯]', text))


def count_korean_lines(text):
    lines = [l for l in text.strip().split('\n') if l.strip()]
    korean = [l for l in lines if has_hangul(l)]
    unique = list(set(korean))
    return len(korean), len(lines), len(unique)


def make_song_id(artist, title):
    sid = f"{artist}-{title}".lower()
    sid = re.sub(r'[^a-z0-9-]', '-', sid)
    sid = re.sub(r'-+', '-', sid).strip('-')
    return sid


def make_safe_filename(artist, title):
    safe = f"{artist} - {title}"
    safe = re.sub(r'[<>:"/\\|?*]', '_', safe)
    safe = safe.strip('. ')
    if len(safe) > 200:
        safe = safe[:200]
    return safe


def load_json(path):
    if path.exists():
        return json.loads(path.read_text())
    return None


def save_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def parse_song_input(raw):
    """Parse 'ARTIST - Title' into (artist, title)."""
    if ' - ' in raw:
        parts = raw.split(' - ', 1)
        return parts[0].strip(), parts[1].strip()
    raise ValueError(f"Cannot parse '{raw}' — expected 'ARTIST - Title' format")


# --- Step 1: Fetch lyrics ---

def fetch_lyrics_ovh(artist, title):
    """Fetch from lyrics.ovh (free, no API key)."""
    import requests
    url = f'https://api.lyrics.ovh/v1/{urllib.parse.quote(artist)}/{urllib.parse.quote(title)}'
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            data = r.json()
            return data.get('lyrics', '')
    except Exception:
        pass
    return None


def fetch_lyrics_genius(artist, title):
    """Fetch from Genius API (needs GENIUS_API_TOKEN)."""
    token = _load_env_var('GENIUS_API_TOKEN')
    if not token:
        return None
    try:
        import lyricsgenius
        genius = lyricsgenius.Genius(token, verbose=False, timeout=15)
        genius.remove_section_headers = True
        song = genius.search_song(title, artist)
        if song and song.lyrics:
            return song.lyrics
    except ImportError:
        import requests
        headers = {'Authorization': f'Bearer {token}'}
        search_url = f'https://api.genius.com/search?q={urllib.parse.quote(f"{artist} {title}")}'
        try:
            r = requests.get(search_url, headers=headers, timeout=15)
            if r.status_code == 200:
                hits = r.json().get('response', {}).get('hits', [])
                for hit in hits:
                    result = hit.get('result', {})
                    if has_hangul(result.get('full_title', '')):
                        print(f"    Genius: found '{result['full_title']}' but lyricsgenius not installed for scraping")
                        return None
        except Exception:
            pass
    except Exception:
        pass
    return None


def clean_lyrics(text):
    """Remove junk from lyrics text."""
    lines = text.strip().split('\n')
    cleaned = []
    for line in lines:
        line = line.strip()
        if line.lower().startswith('paroles de la chanson'):
            continue
        # Keep section headers like [Verse 1] only if they have hangul
        if line.startswith('[') and line.endswith(']') and not has_hangul(line):
            continue
        cleaned.append(line)
    while cleaned and not cleaned[0]:
        cleaned.pop(0)
    while cleaned and not cleaned[-1]:
        cleaned.pop()
    return '\n'.join(cleaned)


def fetch_and_save_lyrics(artist, title, safe_name, dry_run=False):
    """Try multiple sources, save to both lyrics dirs. Returns (text, source) or (None, error)."""
    # Check if already exists
    existing = LYRICS_DIR_PUBLIC / f"{safe_name}.txt"
    if existing.exists():
        text = existing.read_text()
        korean, total, unique = count_korean_lines(text)
        return text, f"already_exists ({korean} Korean / {total} total)"

    # Try lyrics.ovh
    print(f"    lyrics.ovh... ", end="", flush=True)
    text = fetch_lyrics_ovh(artist, title)
    source = "lyrics.ovh"

    if not text or not has_hangul(text):
        print("no Korean lyrics")
        # Try Genius
        print(f"    Genius API... ", end="", flush=True)
        text = fetch_lyrics_genius(artist, title)
        source = "genius"

    if not text or not has_hangul(text):
        print("no Korean lyrics")
        return None, "no_korean_lyrics_found"

    text = clean_lyrics(text)
    korean, total, unique = count_korean_lines(text)

    if korean < 5:
        print(f"only {korean} Korean lines (min 5)")
        return None, f"too_few_korean_lines ({korean})"

    if not dry_run:
        for d in [LYRICS_DIR_PUBLIC, LYRICS_DIR_PIPELINE]:
            d.mkdir(parents=True, exist_ok=True)
            (d / f"{safe_name}.txt").write_text(text)

    print(f"OK ({korean} Korean / {total} total)")
    return text, source


# --- Step 2: YouTube Music download ---

def search_youtube_music(artist, title):
    """Search YouTube Music, return {id, title, duration} or None."""
    query = f"{artist} {title}"
    search_url = f"https://music.youtube.com/search?q={urllib.parse.quote(query)}"
    try:
        result = subprocess.run(
            ["yt-dlp", search_url, "--flat-playlist", "--playlist-items", "1",
             "--print", "%(id)s|||%(title)s|||%(duration)s"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return None
        for line in result.stdout.strip().split("\n"):
            if "|||" in line:
                parts = line.split("|||")
                return {"id": parts[0], "title": parts[1] if len(parts) > 1 else "", "duration": parts[2] if len(parts) > 2 else "NA"}
    except Exception:
        pass
    return None


def download_audio(video_id, safe_name):
    """Download audio from YouTube Music. Returns (path, size_mb) or (None, error)."""
    audio_path = AUDIO_DIR / f"{safe_name}.mp3"
    public_path = AUDIO_DIR_PUBLIC / f"{safe_name}.mp3"

    if audio_path.exists():
        size_mb = round(audio_path.stat().st_size / (1024 * 1024), 1)
        if not public_path.exists():
            import shutil
            AUDIO_DIR_PUBLIC.mkdir(parents=True, exist_ok=True)
            shutil.copy2(audio_path, public_path)
        return str(audio_path), size_mb

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    url = f"https://music.youtube.com/watch?v={video_id}"

    try:
        result = subprocess.run(
            ["yt-dlp", "--cookies-from-browser", "chrome", url,
             "-x", "--audio-format", "mp3", "--audio-quality", "0",
             "-o", str(AUDIO_DIR / f"{safe_name}.%(ext)s"), "--no-playlist"],
            capture_output=True, text=True, timeout=120,
        )
        if audio_path.exists():
            size_mb = round(audio_path.stat().st_size / (1024 * 1024), 1)
            import shutil
            AUDIO_DIR_PUBLIC.mkdir(parents=True, exist_ok=True)
            shutil.copy2(audio_path, public_path)
            return str(audio_path), size_mb
        else:
            return None, result.stderr[:300]
    except subprocess.TimeoutExpired:
        return None, "download_timeout"
    except Exception as e:
        return None, str(e)


def search_and_download(artist, title, safe_name):
    """Full search + download flow. Returns dict with status info."""
    audio_path = AUDIO_DIR / f"{safe_name}.mp3"
    if audio_path.exists():
        size_mb = round(audio_path.stat().st_size / (1024 * 1024), 1)
        return {"status": "already_exists", "file": str(audio_path), "size_mb": size_mb, "youtube_id": "existing"}

    print(f"    Searching YouTube Music... ", end="", flush=True)
    match = search_youtube_music(artist, title)
    if not match:
        # Try with Korean artist name variants
        korean_names = {
            'SUNMI': '선미', 'IU': '아이유', 'BTS': '방탄소년단',
            'BLACKPINK': '블랙핑크', 'TWICE': '트와이스', 'EXO': '엑소',
        }
        if artist.upper() in korean_names:
            match = search_youtube_music(korean_names[artist.upper()], title)

    if not match:
        print("not found")
        return {"status": "search_failed"}

    print(f"found: {match['title']}")

    print(f"    Downloading... ", end="", flush=True)
    path_or_err, size_or_err = download_audio(match["id"], safe_name)

    if path_or_err and os.path.exists(path_or_err):
        print(f"OK ({size_or_err} MB)")
        return {
            "status": "ok", "file": path_or_err, "size_mb": size_or_err,
            "youtube_id": match["id"], "youtube_title": match["title"],
            "youtube_url": f"https://music.youtube.com/watch?v={match['id']}",
            "youtube_duration": match.get("duration", "NA"),
        }
    else:
        print(f"FAILED: {size_or_err}")
        return {"status": "download_failed", "error": str(size_or_err), "youtube_id": match["id"]}


# --- Step 3: Update data files ---

def update_data_files(songs_data):
    """Update song_index.json, selected_songs.json, download_status.json, song_manifest.json."""
    # song_index.json
    idx = load_json(SONG_INDEX_PATH)
    existing_ids = {s['id'] for s in idx['songs']}
    added_to_index = 0

    for s in songs_data:
        if s['id'] in existing_ids:
            continue
        idx['songs'].append({
            'id': s['id'],
            'title': s['title'],
            'artist': s['artist'],
            'koreanLines': s['koreanLines'],
            'uniqueKoreanLines': s['uniqueKoreanLines'],
            'totalLines': s['totalLines'],
            'youtubeId': s.get('youtube_id', ''),
            'lyricsFile': f"{s['safe_name']}.txt",
            'lessons': [],
        })
        added_to_index += 1

    idx['totalSongs'] = len(idx['songs'])
    save_json(SONG_INDEX_PATH, idx)

    # selected_songs.json
    sel = load_json(SELECTED_SONGS_PATH)
    existing_sel = {(s['artist'], s['name']) for s in sel['songs']}
    for s in songs_data:
        if (s['artist'], s['title']) in existing_sel:
            continue
        sel['songs'].append({'artist': s['artist'], 'name': s['title'], 'added_by': 'add_songs_script', 'source': 'user_request'})
    sel['total'] = len(sel['songs'])
    save_json(SELECTED_SONGS_PATH, sel)

    # download_status.json
    dl = load_json(DOWNLOAD_STATUS_PATH)
    for s in songs_data:
        key = f"{s['artist']}||{s['title']}"
        dl[key] = {
            'status': 'ok', 'file': s.get('audio_file', ''),
            'size_mb': s.get('size_mb', 0), 'youtube_id': s.get('youtube_id', ''),
            'youtube_title': s.get('youtube_title', s['title']),
            'youtube_url': s.get('youtube_url', ''), 'youtube_duration': 'NA',
            'artist': s['artist'], 'name': s['title'],
        }
    save_json(DOWNLOAD_STATUS_PATH, dl)

    # song_manifest.json
    manifest = load_json(MANIFEST_PATH)
    existing_m = {(s.get('artist', ''), s.get('name', '')) for s in manifest['songs']}
    for s in songs_data:
        if (s['artist'], s['title']) in existing_m:
            continue
        manifest['songs'].append({
            'artist': s['artist'], 'name': s['title'], 'safe_name': s['safe_name'],
            'mp3': s.get('audio_file', ''), 'mp3_ok': bool(s.get('audio_file')),
            'lyrics': str(LYRICS_DIR_PIPELINE / f"{s['safe_name']}.txt"),
            'lyrics_ok': True, 'lyrics_source': s.get('lyrics_source', 'unknown'),
            'youtube_id': s.get('youtube_id', ''),
        })
    manifest['total'] = len(manifest['songs'])
    manifest['mp3_count'] = sum(1 for s in manifest['songs'] if s.get('mp3_ok'))
    manifest['lyrics_count'] = sum(1 for s in manifest['songs'] if s.get('lyrics_ok'))
    save_json(MANIFEST_PATH, manifest)

    return added_to_index


# --- Step 4: Generate practice data ---

def generate_practice(song_ids):
    """Run generate_song_practice.py for each song."""
    script = PIPELINE_DIR / "generate_song_practice.py"
    results = []
    for sid in song_ids:
        practice_file = PROJECT_DIR / "public" / "data" / "song_practice" / f"{sid}.json"
        if practice_file.exists():
            results.append((sid, "already_exists"))
            continue
        try:
            result = subprocess.run(
                [sys.executable, str(script), "--song", sid],
                capture_output=True, text=True, timeout=60, cwd=str(PROJECT_DIR),
            )
            if practice_file.exists():
                results.append((sid, "ok"))
            else:
                results.append((sid, f"failed: {result.stderr[:200]}"))
        except subprocess.TimeoutExpired:
            results.append((sid, "timeout"))
        except Exception as e:
            results.append((sid, f"error: {e}"))
    return results


# --- Step 5: Generate TTS ---

def generate_tts():
    """Run generate_tts.py (incremental — only new text)."""
    script = PIPELINE_DIR / "generate_tts.py"
    try:
        result = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True, text=True, timeout=300, cwd=str(PROJECT_DIR),
        )
        # Extract count from output
        for line in result.stdout.split('\n'):
            if 'generated successfully' in line or 'To generate:' in line:
                print(f"    {line.strip()}")
        return True
    except Exception as e:
        print(f"    TTS generation error: {e}")
        return False


# --- Helpers ---

def _load_env_var(name):
    val = os.environ.get(name)
    if val:
        return val
    env_path = PROJECT_DIR / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip()
    return None


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Add new songs to Songwon")
    parser.add_argument("songs", nargs="*", help="Songs in 'ARTIST - Title' format")
    parser.add_argument("--from-file", help="Read songs from a text file (one per line)")
    parser.add_argument("--check-only", action="store_true", help="Dry run: check lyrics and YouTube availability without downloading")
    parser.add_argument("--skip-audio", action="store_true", help="Skip audio download (add song with lyrics only)")
    parser.add_argument("--skip-practice", action="store_true", help="Skip practice data generation")
    parser.add_argument("--skip-tts", action="store_true", help="Skip TTS generation")
    args = parser.parse_args()

    # Collect songs
    raw_songs = list(args.songs or [])
    if args.from_file:
        with open(args.from_file) as f:
            raw_songs.extend(line.strip() for line in f if line.strip() and not line.startswith('#'))

    if not raw_songs:
        parser.print_help()
        sys.exit(1)

    # Parse
    songs = []
    for raw in raw_songs:
        try:
            artist, title = parse_song_input(raw)
            songs.append((artist, title))
        except ValueError as e:
            print(f"ERROR: {e}")
            sys.exit(1)

    # Check existing
    idx = load_json(SONG_INDEX_PATH)
    existing_ids = {s['id'] for s in idx['songs']}

    print(f"\n{'='*60}")
    print(f"  Adding {len(songs)} song(s) to Songwon")
    print(f"{'='*60}\n")

    songs_data = []
    skipped = []
    failed = []

    for i, (artist, title) in enumerate(songs, 1):
        sid = make_song_id(artist, title)
        safe = make_safe_filename(artist, title)
        print(f"[{i}/{len(songs)}] {artist} — {title} (id: {sid})")

        if sid in existing_ids:
            print(f"  SKIP: already in song library\n")
            skipped.append(f"{artist} - {title}")
            continue

        # Step 1: Lyrics
        print(f"  Fetching lyrics...")
        lyrics_text, lyrics_result = fetch_and_save_lyrics(artist, title, safe, dry_run=args.check_only)
        if not lyrics_text:
            print(f"  FAILED: {lyrics_result}\n")
            failed.append(f"{artist} - {title}: {lyrics_result}")
            continue

        korean, total, unique = count_korean_lines(lyrics_text)

        if args.check_only:
            print(f"  CHECK: {korean} Korean / {total} total lines")
            match = search_youtube_music(artist, title)
            if match:
                print(f"  CHECK: YouTube Music → {match['title']}")
            else:
                print(f"  CHECK: YouTube Music → not found")
            print()
            continue

        # Step 2: Audio
        dl_result = {"status": "skipped", "youtube_id": ""}
        if not args.skip_audio:
            print(f"  Downloading audio...")
            dl_result = search_and_download(artist, title, safe)
            if dl_result["status"] not in ("ok", "already_exists"):
                print(f"  WARNING: audio download failed ({dl_result.get('error', dl_result['status'])})")
                print(f"  Continuing without audio — song will have practice but no playback\n")

        song_entry = {
            'id': sid, 'artist': artist, 'title': title, 'safe_name': safe,
            'koreanLines': korean, 'totalLines': total, 'uniqueKoreanLines': unique,
            'youtube_id': dl_result.get('youtube_id', ''),
            'youtube_title': dl_result.get('youtube_title', title),
            'youtube_url': dl_result.get('youtube_url', ''),
            'audio_file': dl_result.get('file', ''),
            'size_mb': dl_result.get('size_mb', 0),
            'lyrics_source': lyrics_result if 'already_exists' not in str(lyrics_result) else 'existing',
        }
        songs_data.append(song_entry)
        print()

    if args.check_only:
        print("Dry run complete — no files modified.")
        return

    if not songs_data:
        print("No new songs to add.")
        return

    # Step 3: Update data files
    print(f"Updating data files...")
    added = update_data_files(songs_data)
    print(f"  {added} songs added to song_index.json (total: {load_json(SONG_INDEX_PATH)['totalSongs']})")

    # Step 4: Generate practice data
    if not args.skip_practice:
        print(f"\nGenerating practice data...")
        song_ids = [s['id'] for s in songs_data]
        results = generate_practice(song_ids)
        for sid, status in results:
            print(f"  {sid}: {status}")

    # Step 5: TTS
    if not args.skip_tts:
        print(f"\nGenerating TTS cache...")
        generate_tts()

    # Summary
    print(f"\n{'='*60}")
    print(f"  Done!")
    print(f"  Added: {len(songs_data)} songs")
    if skipped:
        print(f"  Skipped (already exist): {len(skipped)}")
    if failed:
        print(f"  Failed: {len(failed)}")
        for f_msg in failed:
            print(f"    - {f_msg}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
