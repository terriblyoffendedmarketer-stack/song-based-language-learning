#!/usr/bin/env python3
"""
Fetch missing Korean lyrics via Genius API (lyricsgenius library).

Requires:
  pip3 install lyricsgenius

Environment (in ../.env.local):
  GENIUS_API_TOKEN=...  (free at genius.com/api-clients)

For songs that lyrics.ovh couldn't find, this script uses the Genius API
with the lyricsgenius library. It filters for hangul presence to ensure
we get Korean lyrics, not romanization or translations.

Updates lyrics_status.json (same format as fetch_lyrics.py).

Usage: python3 pipeline/fetch_lyrics_web.py
"""

import json
import os
import re
import time

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
LYRICS_DIR = os.path.join(PIPELINE_DIR, "lyrics")
STATUS_FILE = os.path.join(PIPELINE_DIR, "lyrics_status.json")
SELECTED_FILE = os.path.join(PIPELINE_DIR, "selected_songs.json")


def has_hangul(text):
    return bool(re.search(r'[가-힯]', text))


def count_hangul_lines(text):
    return sum(1 for line in text.strip().split('\n') if has_hangul(line))


def make_safe_filename(artist, name):
    safe = f"{artist} - {name}"
    safe = re.sub(r'[<>:"/\\|?*]', '_', safe)
    safe = safe.strip('. ')
    if len(safe) > 200:
        safe = safe[:200]
    return safe


def clean_lyrics(text):
    lines = text.strip().split('\n')
    cleaned = []
    for line in lines:
        line = line.strip()
        if not line:
            cleaned.append('')
            continue
        skip_patterns = [
            r'^\d+\s*Contributors',
            r'^Translations',
            r'Embed$',
            r'^You might also like',
            r'^\[.*\]$',
            r'^Source\s*:',
            r'^Credit\s*:',
            r'^Writer\s*:',
            r'^Composer\s*:',
            r'^Lyricist\s*:',
            r'^작사\s*:',
            r'^작곡\s*:',
            r'^편곡\s*:',
        ]
        if any(re.search(p, line) for p in skip_patterns):
            continue
        cleaned.append(line)
    result = '\n'.join(cleaned).strip()
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result


def load_token():
    env_path = os.path.join(PIPELINE_DIR, '..', '.env.local')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('GENIUS_API_TOKEN='):
                    return line.split('=', 1)[1].strip()
    return None


def load_status():
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE) as f:
            return json.load(f)
    return {}


def save_status(status):
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2, ensure_ascii=False)


def main():
    import lyricsgenius

    os.makedirs(LYRICS_DIR, exist_ok=True)

    token = load_token()
    if not token:
        print("Error: GENIUS_API_TOKEN not found in .env.local")
        print("Get a free token at genius.com/api-clients")
        return

    genius = lyricsgenius.Genius(token, timeout=15)

    with open(SELECTED_FILE) as f:
        data = json.load(f)

    songs = data["songs"]
    status = load_status()

    missing = []
    for song in songs:
        key = f"{song['artist']}||{song['name']}"
        if key not in status or status[key].get("status") != "ok":
            missing.append(song)

    print(f"\n=== Genius Lyrics Fetch — {len(missing)} missing songs ===\n")

    found = 0
    for i, song in enumerate(missing):
        artist = song["artist"]
        name = song["name"]
        safe = make_safe_filename(artist, name)
        key = f"{artist}||{name}"

        print(f"[{i+1}/{len(missing)}] {artist} - {name} ... ", end="", flush=True)

        lyrics = None
        source = None

        # Try with simplified artist name (strip feat. credits)
        simple_artist = re.split(r'[,&]', artist)[0].strip()
        simple_title = re.sub(r'\(.*?\)', '', name).strip()

        search_attempts = [
            (simple_artist, simple_title),
            (simple_artist, name),
            (artist, name),
        ]

        for a, t in search_attempts:
            try:
                result = genius.search_song(t, a)
                if result and result.lyrics and has_hangul(result.lyrics):
                    lyrics = clean_lyrics(result.lyrics)
                    source = "genius"
                    break
            except Exception:
                pass
            time.sleep(1)

        if lyrics and count_hangul_lines(lyrics) >= 3:
            lyrics_path = os.path.join(LYRICS_DIR, f"{safe}.txt")
            with open(lyrics_path, "w", encoding="utf-8") as f:
                f.write(lyrics)

            hangul_lines = count_hangul_lines(lyrics)
            total_lines = len([l for l in lyrics.split('\n') if l.strip()])
            status[key] = {
                "status": "ok",
                "source": source,
                "file": lyrics_path,
                "hangul_lines": hangul_lines,
                "total_lines": total_lines,
            }
            print(f"OK ({source}, {hangul_lines}/{total_lines} Korean lines)")
            found += 1
        else:
            status[key] = {"status": "not_found", "artist": artist, "name": name}
            print("NOT FOUND")

        save_status(status)
        time.sleep(1.5)

    ok_total = sum(1 for v in status.values() if v.get("status") == "ok")
    missing_total = sum(1 for v in status.values() if v.get("status") != "ok")
    print(f"\n=== Done: {ok_total} found total, {missing_total} still missing ===")
    print(f"This run found {found} new lyrics.\n")

    if missing_total > 0:
        print("Still missing:")
        for k, v in status.items():
            if v.get("status") != "ok":
                parts = k.split("||")
                print(f"  {parts[0]} - {parts[1]}")


if __name__ == "__main__":
    main()
