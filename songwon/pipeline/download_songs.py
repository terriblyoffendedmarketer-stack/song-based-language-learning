#!/usr/bin/env python3
"""
Download selected songs from YouTube Music (not YouTube video).

For each song in selected_songs.json:
1. Search music.youtube.com for "{artist} {title}"
2. Pick the top result (studio audio, not MV)
3. Download as MP3
4. Save progress to download_status.json (resumable)

Usage: python3 pipeline/download_songs.py
"""

import json
import subprocess
import os
import time
import re
import urllib.parse

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(PIPELINE_DIR, "audio")
LYRICS_DIR = os.path.join(PIPELINE_DIR, "lyrics")
STATUS_FILE = os.path.join(PIPELINE_DIR, "download_status.json")
SELECTED_FILE = os.path.join(PIPELINE_DIR, "selected_songs.json")


def load_status():
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE) as f:
            return json.load(f)
    return {}


def save_status(status):
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2, ensure_ascii=False)


def make_safe_filename(artist, name):
    safe = f"{artist} - {name}"
    safe = re.sub(r'[<>:"/\\|?*]', '_', safe)
    safe = safe.strip('. ')
    if len(safe) > 200:
        safe = safe[:200]
    return safe


def ytmusic_search(artist, name):
    """Search YouTube Music and return top result's video ID + metadata."""
    query = f"{artist} {name}"
    search_url = f"https://music.youtube.com/search?q={urllib.parse.quote(query)}"

    try:
        result = subprocess.run(
            [
                "yt-dlp", search_url,
                "--flat-playlist",
                "--playlist-items", "1",
                "--print", "%(id)s|||%(title)s|||%(duration)s",
            ],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return None, result.stderr[:300]

        for line in result.stdout.strip().split("\n"):
            if "|||" in line:
                parts = line.split("|||")
                return {
                    "id": parts[0],
                    "title": parts[1] if len(parts) > 1 else "",
                    "duration": parts[2] if len(parts) > 2 else "",
                }, None

        return None, "no results"
    except subprocess.TimeoutExpired:
        return None, "search timeout"
    except Exception as e:
        return None, str(e)


def download_audio(video_id, safe_name):
    """Download audio from YouTube Music by video ID."""
    audio_path = os.path.join(AUDIO_DIR, f"{safe_name}.mp3")
    url = f"https://music.youtube.com/watch?v={video_id}"

    try:
        result = subprocess.run(
            [
                "yt-dlp", url,
                "-x", "--audio-format", "mp3",
                "--audio-quality", "0",
                "-o", os.path.join(AUDIO_DIR, f"{safe_name}.%(ext)s"),
                "--no-playlist",
            ],
            capture_output=True, text=True, timeout=120,
        )

        if os.path.exists(audio_path):
            size_mb = os.path.getsize(audio_path) / (1024 * 1024)
            return {"status": "ok", "file": audio_path, "size_mb": round(size_mb, 1)}
        else:
            return {
                "status": "no_audio",
                "error": "yt-dlp ran but no MP3 produced",
                "stderr": result.stderr[:300],
            }
    except subprocess.TimeoutExpired:
        return {"status": "timeout"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def process_song(artist, name, safe_name, spotify_duration=None):
    """Search YouTube Music, verify match, download."""
    audio_path = os.path.join(AUDIO_DIR, f"{safe_name}.mp3")
    if os.path.exists(audio_path):
        return {"status": "already_exists", "audio_file": audio_path}

    match, err = ytmusic_search(artist, name)
    if not match:
        return {"status": "search_failed", "error": err}

    duration_diff = None
    if spotify_duration and match["duration"] and match["duration"] != "NA":
        try:
            yt_dur = int(float(match["duration"]))
            duration_diff = abs(yt_dur - spotify_duration)
        except (ValueError, TypeError):
            pass

    dl = download_audio(match["id"], safe_name)
    dl["youtube_id"] = match["id"]
    dl["youtube_title"] = match["title"]
    dl["youtube_url"] = f"https://music.youtube.com/watch?v={match['id']}"
    dl["youtube_duration"] = match["duration"]
    if duration_diff is not None:
        dl["duration_diff_seconds"] = duration_diff

    return dl


def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(LYRICS_DIR, exist_ok=True)

    with open(SELECTED_FILE) as f:
        data = json.load(f)

    songs = data["songs"]
    status = load_status()

    done = sum(1 for v in status.values() if v.get("status") in ("ok", "already_exists"))
    total = len(songs)
    print(f"\n=== YouTube Music Download Pipeline ===")
    print(f"Total: {total} songs, Already done: {done}\n")

    for i, song in enumerate(songs):
        artist = song["artist"]
        name = song["name"]
        safe = make_safe_filename(artist, name)
        key = f"{artist}||{name}"

        if key in status and status[key].get("status") in ("ok", "already_exists"):
            continue

        print(f"[{i+1}/{total}] {artist} - {name} ... ", end="", flush=True)

        spotify_dur = song.get("duration")
        result = process_song(artist, name, safe, spotify_dur)
        result["artist"] = artist
        result["name"] = name
        status[key] = result
        save_status(status)

        if result["status"] == "ok":
            diff = result.get("duration_diff_seconds", "?")
            print(f"OK  yt:{result.get('youtube_title','')}  diff:{diff}s  {result.get('size_mb','')}MB")
        elif result["status"] == "already_exists":
            print("skip (already downloaded)")
        else:
            print(f"FAILED: {result.get('error', result['status'])[:80]}")

        time.sleep(1)

    ok = sum(1 for v in status.values() if v.get("status") in ("ok", "already_exists"))
    failed = sum(1 for v in status.values() if v.get("status") not in ("ok", "already_exists"))
    print(f"\n=== Done: {ok} OK, {failed} failed ===")

    if failed > 0:
        print("\nFailed songs:")
        for k, v in status.items():
            if v.get("status") not in ("ok", "already_exists"):
                print(f"  {v.get('artist','?')} - {v.get('name','?')}: {v.get('error', v.get('status','?'))}")

    total_size = 0
    for f_name in os.listdir(AUDIO_DIR):
        if f_name.endswith(".mp3"):
            total_size += os.path.getsize(os.path.join(AUDIO_DIR, f_name))
    print(f"\nTotal audio: {total_size / (1024*1024):.0f} MB")


if __name__ == "__main__":
    main()
