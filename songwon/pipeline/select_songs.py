#!/usr/bin/env python3
"""
Interactive song selection tool.

Reads korean_songs.json and lets the user select which songs to include
in the curriculum. Saves selections to selected_songs.json.

Can also accept a text file with song names (one per line) for batch selection.

Usage:
  python3 pipeline/select_songs.py                    # interactive mode
  python3 pipeline/select_songs.py --from-file list.txt  # batch mode
  python3 pipeline/select_songs.py --add "Artist - Song"  # add one song manually

The interactive mode prints all songs numbered and lets you type numbers
or ranges (e.g. "1-10,15,20-25") to select.
"""

import json
import os
import re
import sys

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
KOREAN_SONGS_FILE = os.path.join(PIPELINE_DIR, "korean_songs.json")
SELECTED_FILE = os.path.join(PIPELINE_DIR, "selected_songs.json")


def load_korean_songs():
    with open(KOREAN_SONGS_FILE) as f:
        data = json.load(f)
    return data.get("songs", data) if isinstance(data, dict) else data


def load_selected():
    if os.path.exists(SELECTED_FILE):
        with open(SELECTED_FILE) as f:
            return json.load(f)
    return {"songs": [], "added_manually": []}


def save_selected(data):
    with open(SELECTED_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def fuzzy_match(query, songs):
    """Find songs matching a query string (artist - name)."""
    query_lower = query.lower().strip()
    matches = []
    for song in songs:
        artist = song.get("artist", "").lower()
        name = song.get("name", "").lower()
        full = f"{artist} - {name}"
        # Exact match
        if query_lower == full:
            return [song]
        # Partial match
        if query_lower in full or full in query_lower:
            matches.append(song)
        # Name-only match
        if query_lower in name or name in query_lower:
            matches.append(song)
    return matches


def parse_ranges(text, max_val):
    """Parse '1-5,8,10-12' into a set of indices."""
    indices = set()
    for part in text.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-', 1)
            try:
                a, b = int(a), int(b)
                indices.update(range(a, b + 1))
            except ValueError:
                pass
        else:
            try:
                indices.add(int(part))
            except ValueError:
                pass
    return {i for i in indices if 1 <= i <= max_val}


def add_manual_song(artist_name_str, selected_data):
    """Add a song not in the playlist."""
    parts = artist_name_str.split(' - ', 1)
    if len(parts) != 2:
        print(f"Format: 'Artist - Song Name'. Got: {artist_name_str}")
        return

    artist, name = parts[0].strip(), parts[1].strip()
    song = {
        "artist": artist,
        "name": name,
        "source": "user_added",
    }

    existing = selected_data.get("songs", [])
    for s in existing:
        if s["artist"].lower() == artist.lower() and s["name"].lower() == name.lower():
            print(f"Already selected: {artist} - {name}")
            return

    existing.append(song)
    selected_data.setdefault("added_manually", []).append(f"{artist} - {name}")
    selected_data["songs"] = existing
    save_selected(selected_data)
    print(f"Added: {artist} - {name}")


def interactive_mode(songs):
    """Print all songs and let user pick by number."""
    print(f"\n=== {len(songs)} Korean songs available ===\n")
    for i, song in enumerate(songs, 1):
        artist = song.get("artist", "Unknown")
        name = song.get("name", "Untitled")
        print(f"  {i:3d}. {artist} - {name}")

    print(f"\nEnter numbers or ranges to select (e.g. '1-10,15,20-25')")
    print("Type 'done' when finished, 'all' to select all.\n")

    selected_indices = set()
    while True:
        choice = input("> ").strip().lower()
        if choice == 'done':
            break
        if choice == 'all':
            selected_indices = set(range(1, len(songs) + 1))
            print(f"Selected all {len(songs)} songs.")
            break
        new = parse_ranges(choice, len(songs))
        selected_indices.update(new)
        print(f"Selected {len(selected_indices)} songs so far.")

    selected = [songs[i - 1] for i in sorted(selected_indices)]
    return selected


def batch_mode(filename, songs):
    """Read song names from a file and match against available songs."""
    with open(filename) as f:
        queries = [line.strip() for line in f if line.strip()]

    selected = []
    not_found = []
    for query in queries:
        matches = fuzzy_match(query, songs)
        if matches:
            selected.append(matches[0])
        else:
            not_found.append(query)

    if not_found:
        print(f"\nCouldn't match {len(not_found)} songs:")
        for q in not_found:
            print(f"  - {q}")

    return selected


def main():
    songs = load_korean_songs()
    selected_data = load_selected()

    if '--add' in sys.argv:
        idx = sys.argv.index('--add')
        if idx + 1 < len(sys.argv):
            add_manual_song(sys.argv[idx + 1], selected_data)
        else:
            print("Usage: --add 'Artist - Song Name'")
        return

    if '--from-file' in sys.argv:
        idx = sys.argv.index('--from-file')
        if idx + 1 < len(sys.argv):
            selected = batch_mode(sys.argv[idx + 1], songs)
        else:
            print("Usage: --from-file list.txt")
            return
    else:
        selected = interactive_mode(songs)

    if not selected:
        print("No songs selected.")
        return

    selected_data["songs"] = selected
    selected_data["total"] = len(selected)
    selected_data["source"] = "user_selection"
    save_selected(selected_data)
    print(f"\nSaved {len(selected)} songs to {SELECTED_FILE}")


if __name__ == "__main__":
    main()
