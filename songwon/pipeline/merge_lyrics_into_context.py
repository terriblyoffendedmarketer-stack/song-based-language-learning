# merge_lyrics_into_context.py — Populates 'lines' fields in song context files with actual Korean lyrics
# Usage: python pipeline/merge_lyrics_into_context.py
# Reads: pipeline/song_context/*.json + pipeline/lyrics/*.txt
# Writes: updated pipeline/song_context/*.json (in-place)
#
# Gotchas:
# - Context files have descriptive 'lines' fields like "Opening verse — first 4 lines"
#   because agents couldn't include Korean lyrics. This script replaces those with real lyrics.
# - Lyrics files contain mixed Korean/romanization/English. We extract only Korean lines.
# - The gold-standard Gaho file already has real lyrics — this script skips files where
#   lines already contain Korean characters.

import json
import os
import re
import sys
from pathlib import Path

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTEXT_DIR = os.path.join(PIPELINE_DIR, "song_context")
LYRICS_DIR = os.path.join(PIPELINE_DIR, "lyrics")
MANIFEST = os.path.join(PIPELINE_DIR, "song_manifest.json")


def has_korean(text):
    return bool(re.search(r'[가-힯㄰-㆏ᄀ-ᇿ]', text))


def extract_korean_lines(lyrics_text):
    """Extract lines that contain Korean characters, stripping romanization."""
    lines = []
    for line in lyrics_text.split('\n'):
        line = line.strip()
        if not line:
            continue
        if has_korean(line):
            lines.append(line)
    return lines


def find_lyrics_file(safe_name):
    """Find the lyrics .txt file for a given safe_name."""
    txt_path = os.path.join(LYRICS_DIR, f"{safe_name}.txt")
    if os.path.exists(txt_path):
        return txt_path
    # Try manifest lookup
    with open(MANIFEST) as f:
        manifest = json.load(f)
    for song in manifest["songs"]:
        if song["safe_name"] == safe_name:
            lyrics_rel = song.get("lyrics_path", "")
            if lyrics_rel:
                full = os.path.join(PIPELINE_DIR, "..", lyrics_rel.lstrip("pipeline/"))
                full = os.path.normpath(os.path.join(PIPELINE_DIR, lyrics_rel.replace("pipeline/", "")))
                if os.path.exists(full):
                    return full
    return None


def distribute_lyrics(korean_lines, verse_count):
    """Split Korean lines roughly evenly across verse sections."""
    if not korean_lines or not verse_count:
        return [[] for _ in range(verse_count)]

    total = len(korean_lines)
    per_section = max(1, total // verse_count)
    sections = []
    idx = 0

    for i in range(verse_count):
        if i == verse_count - 1:
            sections.append(korean_lines[idx:])
        else:
            sections.append(korean_lines[idx:idx + per_section])
            idx += per_section

    return sections


def merge_one(context_path):
    """Merge Korean lyrics into a single context file."""
    with open(context_path, encoding='utf-8') as f:
        try:
            context = json.load(f)
        except json.JSONDecodeError as e:
            print(f"  SKIP (invalid JSON): {context_path}: {e}")
            return False

    safe_name = context.get("safe_name", "")
    if not safe_name:
        print(f"  SKIP (no safe_name): {context_path}")
        return False

    song_story = context.get("song_story", {})
    the_lyrics = song_story.get("the_lyrics", {})
    if not the_lyrics:
        print(f"  SKIP (no the_lyrics section): {safe_name}")
        return False

    # Check if lines already have Korean (like the Gaho reference)
    first_verse = next(iter(the_lyrics.values()), {})
    first_lines = first_verse.get("lines", "")
    if has_korean(first_lines):
        print(f"  SKIP (already has Korean): {safe_name}")
        return False

    lyrics_path = find_lyrics_file(safe_name)
    if not lyrics_path:
        print(f"  WARN (no lyrics file): {safe_name}")
        return False

    with open(lyrics_path, encoding='utf-8') as f:
        raw_lyrics = f.read()

    korean_lines = extract_korean_lines(raw_lyrics)
    if not korean_lines:
        print(f"  WARN (no Korean lines found): {safe_name}")
        return False

    verse_keys = list(the_lyrics.keys())
    sections = distribute_lyrics(korean_lines, len(verse_keys))

    for key, section_lines in zip(verse_keys, sections):
        if section_lines:
            the_lyrics[key]["lines"] = " / ".join(section_lines)

    with open(context_path, 'w', encoding='utf-8') as f:
        json.dump(context, f, ensure_ascii=False, indent=2)

    print(f"  OK: {safe_name} ({len(korean_lines)} Korean lines → {len(verse_keys)} sections)")
    return True


def main():
    context_files = sorted(Path(CONTEXT_DIR).glob("*.json"))
    print(f"Found {len(context_files)} context files\n")

    merged = 0
    skipped = 0
    errors = 0

    for path in context_files:
        result = merge_one(str(path))
        if result:
            merged += 1
        elif result is False:
            skipped += 1
        else:
            errors += 1

    print(f"\nDone: {merged} merged, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    main()
