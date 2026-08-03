#!/usr/bin/env python3
"""
Fetch Korean lyrics for all selected songs.

Sources (tried in order):
1. lyrics.ovh free API — no key needed, decent K-pop coverage
2. Genius web scrape via lyricsgenius — needs GENIUS_API_TOKEN in .env.local

Filters: only keeps lyrics with Korean (hangul) characters.
Saves progress to lyrics_status.json (resumable).

Usage: python3 pipeline/fetch_lyrics.py
"""

import json
import os
import re
import time
import requests
import urllib.parse

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
    """Remove common junk from lyrics."""
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
            r'^\[.*\]$',  # section markers like [Chorus]
        ]
        if any(re.search(p, line) for p in skip_patterns):
            continue
        cleaned.append(line)
    result = '\n'.join(cleaned).strip()
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result


def try_lyrics_ovh(artist, title):
    """Free API, no key needed."""
    # Try exact match first
    url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(artist)}/{urllib.parse.quote(title)}"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            lyrics = r.json().get("lyrics", "")
            if lyrics and has_hangul(lyrics):
                return clean_lyrics(lyrics), "lyrics.ovh"
    except Exception:
        pass

    # Try simplified artist name (remove feat. credits)
    simple_artist = re.split(r'[,&]', artist)[0].strip()
    simple_title = re.sub(r'\(.*?\)', '', title).strip()
    if simple_artist != artist or simple_title != title:
        url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(simple_artist)}/{urllib.parse.quote(simple_title)}"
        try:
            r = requests.get(url, timeout=15)
            if r.status_code == 200:
                lyrics = r.json().get("lyrics", "")
                if lyrics and has_hangul(lyrics):
                    return clean_lyrics(lyrics), "lyrics.ovh (simplified)"
        except Exception:
            pass

    return None, None


def try_genius(artist, title):
    """Try lyricsgenius library. Needs GENIUS_API_TOKEN."""
    env_path = os.path.join(PIPELINE_DIR, '..', '.env.local')
    token = None
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('GENIUS_API_TOKEN='):
                    token = line.split('=', 1)[1].strip()

    if not token:
        return None, None

    try:
        import lyricsgenius
        genius = lyricsgenius.Genius(token, timeout=15, verbose=False)
        simple_artist = re.split(r'[,&]', artist)[0].strip()
        song = genius.search_song(title, simple_artist)
        if song and song.lyrics and has_hangul(song.lyrics):
            return clean_lyrics(song.lyrics), "genius"
    except Exception:
        pass

    return None, None


def load_status():
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE) as f:
            return json.load(f)
    return {}


def save_status(status):
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2, ensure_ascii=False)


def main():
    os.makedirs(LYRICS_DIR, exist_ok=True)

    with open(SELECTED_FILE) as f:
        data = json.load(f)

    songs = data["songs"]
    status = load_status()

    done = sum(1 for v in status.values() if v.get("status") == "ok")
    total = len(songs)
    print(f"\n=== Lyrics Fetch Pipeline ===")
    print(f"Total: {total} songs, Already done: {done}\n")

    for i, song in enumerate(songs):
        artist = song["artist"]
        name = song["name"]
        safe = make_safe_filename(artist, name)
        key = f"{artist}||{name}"

        if key in status and status[key].get("status") == "ok":
            continue

        print(f"[{i+1}/{total}] {artist} - {name} ... ", end="", flush=True)

        lyrics, source = try_lyrics_ovh(artist, name)

        if not lyrics:
            lyrics, source = try_genius(artist, name)

        if lyrics:
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
        else:
            status[key] = {"status": "not_found", "artist": artist, "name": name}
            print("NOT FOUND")

        save_status(status)
        time.sleep(1.5)

    ok = sum(1 for v in status.values() if v.get("status") == "ok")
    missing = sum(1 for v in status.values() if v.get("status") != "ok")
    print(f"\n=== Done: {ok} found, {missing} missing ===")

    if missing > 0:
        print("\nMissing lyrics:")
        for k, v in status.items():
            if v.get("status") != "ok":
                parts = k.split("||")
                print(f"  {parts[0]} - {parts[1]}")


if __name__ == "__main__":
    main()
