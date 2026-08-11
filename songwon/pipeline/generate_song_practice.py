# generate_song_practice.py — Generates rich practice data for all 72 songs
# Usage: python3 pipeline/generate_song_practice.py [--dry-run] [--song SONG_ID] [--force]
# Reads: public/data/song_index.json, public/data/lyrics/*.txt, pipeline/song_context/*.json
# Writes: public/data/song_practice/{songId}.json
#
# Approach: sends FULL lyrics + song context to Claude and lets it select the best
# 12-15 study lines. This avoids split sentences, bad line picks, and missing context.
#
# Gotchas:
# - Song context files use "Artist - Title.json" naming, not songId
# - Claude API returns JSON inside markdown fences — must strip them
# - Rate limit: ~60 req/min on Sonnet. Script has a small delay between songs.
# - Some songs have very few Korean lines — min 5 to be worth generating
# - Lines that are split across two lines in the lyrics (enjambment) should be
#   joined by Claude into a single study unit
# - V1 of this script pre-extracted lines then sent them individually — BAD.
#   Split sentences, wrong translations (크게=largely vs big), no grammar context.
#   V2 sends full lyrics + song_context and lets Claude pick the study units.
# - 72 songs takes ~10 min at ~8s/song. Total cost: ~$1-2 on Sonnet.
# - Songs with mixed Korean/English (like TWICE - Likey) may produce lines with
#   only 1-2 word chunks. The validator warns but doesn't fail — it's correct.

import json
import os
import re
import sys
import time
import argparse
from pathlib import Path

PIPELINE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = PIPELINE_DIR.parent
SONG_INDEX = PROJECT_DIR / "public" / "data" / "song_index.json"
LYRICS_DIR = PROJECT_DIR / "public" / "data" / "lyrics"
CONTEXT_DIR = PIPELINE_DIR / "song_context"
OUTPUT_DIR = PROJECT_DIR / "public" / "data" / "song_practice"


def load_api_key():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    env_path = PROJECT_DIR / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip()
    return None


def load_song_context(artist: str, title: str) -> dict | None:
    filename = f"{artist} - {title}.json"
    path = CONTEXT_DIR / filename
    if path.exists():
        return json.loads(path.read_text())
    return None


def build_prompt(lyrics_text: str, artist: str, title: str, context: dict | None) -> str:
    context_block = ""
    if context:
        story = context.get("song_story", {})
        grammar = context.get("grammar_highlights", [])

        context_block = f"""
## Song context — use this to make your translations accurate and natural

Overview: {story.get('overview', '')}

Cultural notes: {story.get('cultural_root', '')}

Honorific level: {context.get('honorific_level', 'unknown')}
"""
        if grammar:
            context_block += "\nKey grammar in this song:\n"
            for g in grammar:
                context_block += f"- {g['pattern']}: {g['usage']}\n"

        # Include verse-by-verse context if available
        lyrics_section = story.get("the_lyrics", {})
        if lyrics_section:
            context_block += "\nVerse-by-verse meaning:\n"
            for section_name, section in lyrics_section.items():
                if isinstance(section, dict) and "literal" in section:
                    context_block += f"- {section_name}: {section['literal']}\n"

    return f"""You are an expert Korean language teacher creating study material for a song practice app. The app teaches Korean through K-pop/K-indie songs, line by line.

## Your task

From the lyrics of "{title}" by {artist}, select 12-15 Korean lines that are the most valuable for language learning. For each line, provide a breakdown a beginner-to-intermediate learner can actually learn from.

## Full lyrics

{lyrics_text}
{context_block}
## Line selection rules

1. **Join split sentences.** If a thought spans two short lines in the lyrics (enjambment), combine them into one study unit. Example: if the lyrics have "혹시 내가 너를 좋아하게" on one line and "되버린걸까" on the next, combine them as "혹시 내가 너를 좋아하게 되버린걸까" — that's one sentence, one study unit.
2. **Include the chorus hook.** The chorus is what sticks — always include the signature line(s). If the chorus repeats, include it once.
3. **Deduplicate.** Repeated lines (chorus, refrains) appear only once.
4. **Skip English-only lines** and lines that are just ad-libs or interjections ("yeah", "oh oh oh").
5. **Prefer lines with interesting grammar or vocabulary** over simple filler lines.
6. **Order them as they appear in the song** (verse 1 → pre-chorus → chorus → verse 2 → bridge, etc.)
7. **Aim for 12-15 lines.** If the song has fewer than 12 unique meaningful Korean lines, include all of them.

## For each line, provide:

1. **korean**: The Korean text (joined if it was split across lines)
2. **english**: A natural, idiomatic English translation. NOT word-for-word literal. It should sound like something a person would actually say. Translate in the context of the song — the same word can mean different things depending on the situation.
3. **words**: A breakdown of 3-6 meaningful chunks. Rules:
   - Group naturally: verb stem + ending together (들려 = "is heard"), noun + particle when they form a unit (목소리만 = "only [your] voice"), compound expressions (것 같아 = "seems like")
   - Don't over-split into morphemes. A learner needs "목소리만" → "only the voice", not "목소리" + "만" separately.
   - Each chunk needs:
     - **korean**: the chunk as it appears
     - **english**: what it means IN THIS CONTEXT (크게 with 들려 = "loudly", but 크게 with 보여 = "big/huge" — translate for the actual line)
     - **role**: one of EXACTLY these values: `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `particle`, `interjection`, `expression`, `connector`
4. **grammar** (optional): If the line contains a notable grammar pattern that a learner should know, include it as an object with:
   - **pattern**: the grammar pattern (e.g. "-다 보니", "-려고 해도")
   - **meaning**: what the pattern does (e.g. "as a result of doing ~", "even if one tries to ~")
   - **note**: a one-sentence explanation of how it's used in THIS line

## Output format

Return ONLY valid JSON (no markdown fences, no commentary before or after). Structure:

[
  {{
    "korean": "full Korean line",
    "english": "natural English translation",
    "words": [
      {{ "korean": "chunk", "english": "meaning in context", "role": "noun" }}
    ],
    "grammar": {{ "pattern": "-다 보니", "meaning": "as a result of ~ing", "note": "..." }}
  }}
]

The "grammar" field is optional — only include it when the line has a pattern worth teaching. Most lines won't have one."""


def parse_response(raw: str) -> list[dict] | None:
    text = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}")
        print(f"  Raw response (first 300 chars): {text[:300]}")
        return None


def validate_output(lines_data: list[dict]) -> list[str]:
    """Check output quality. Returns list of warnings."""
    warnings = []
    valid_roles = {"noun", "verb", "adjective", "adverb", "pronoun", "particle", "interjection", "expression", "connector"}

    if len(lines_data) < 5:
        warnings.append(f"Only {len(lines_data)} lines — expected 12-15")
    if len(lines_data) > 18:
        warnings.append(f"Too many lines ({len(lines_data)}) — expected 12-15")

    for i, line in enumerate(lines_data):
        if not line.get("korean"):
            warnings.append(f"Line {i+1}: missing korean text")
        if not line.get("english"):
            warnings.append(f"Line {i+1}: missing english translation")

        words = line.get("words", [])
        if len(words) < 2:
            warnings.append(f"Line {i+1}: only {len(words)} word chunks (expected 3-6)")
        if len(words) > 8:
            warnings.append(f"Line {i+1}: {len(words)} word chunks — over-split")

        for j, w in enumerate(words):
            role = w.get("role", "")
            if role not in valid_roles:
                warnings.append(f"Line {i+1}, word {j+1}: invalid role '{role}' (should be one of {valid_roles})")

    # Check for duplicate korean lines
    seen = set()
    for line in lines_data:
        k = line.get("korean", "")
        if k in seen:
            warnings.append(f"Duplicate line: {k[:30]}...")
        seen.add(k)

    return warnings


def generate_practice_data(song: dict, dry_run: bool = False) -> bool:
    song_id = song["id"]
    artist = song["artist"]
    title = song["title"]
    lyrics_file = song["lyricsFile"]

    lyrics_path = LYRICS_DIR / lyrics_file
    if not lyrics_path.exists():
        print(f"  SKIP: lyrics file not found: {lyrics_file}")
        return False

    lyrics_text = lyrics_path.read_text().strip()
    korean_count = len([l for l in lyrics_text.split("\n") if re.search(r"[가-힣]", l)])
    if korean_count < 5:
        print(f"  SKIP: only {korean_count} Korean lines")
        return False

    context = load_song_context(artist, title)
    prompt = build_prompt(lyrics_text, artist, title, context)

    if dry_run:
        print(f"  Korean lines: {korean_count}, Context: {'yes' if context else 'no'}, Prompt: {len(prompt)} chars")
        return True

    try:
        import anthropic
    except ImportError:
        print("Error: pip3 install anthropic")
        return False

    api_key = load_api_key()
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found")
        return False

    client = anthropic.Anthropic(api_key=api_key)

    print(f"  Calling API ({korean_count} Korean lines, context={'yes' if context else 'no'})...")
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    lines_data = parse_response(raw)
    if not lines_data:
        return False

    # Validate
    warnings = validate_output(lines_data)
    if warnings:
        print(f"  WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"    - {w}")

    practice_data = {
        "songId": song_id,
        "lines": lines_data,
    }

    output_path = OUTPUT_DIR / f"{song_id}.json"
    output_path.write_text(json.dumps(practice_data, ensure_ascii=False, indent=2))
    print(f"  Saved: {output_path.name} ({len(lines_data)} lines, {len([l for l in lines_data if l.get('grammar')])} with grammar notes)")
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate song practice data")
    parser.add_argument("--dry-run", action="store_true", help="Don't call API, just show stats")
    parser.add_argument("--song", type=str, help="Generate for a single song ID")
    parser.add_argument("--force", action="store_true", help="Regenerate even if file exists")
    args = parser.parse_args()

    if not SONG_INDEX.exists():
        print(f"Error: song index not found at {SONG_INDEX}")
        sys.exit(1)

    index = json.loads(SONG_INDEX.read_text())
    songs = index["songs"]

    if args.song:
        songs = [s for s in songs if s["id"] == args.song]
        if not songs:
            print(f"Error: song '{args.song}' not found in index")
            sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total = len(songs)
    done = 0
    skipped = 0
    failed = 0

    for i, song in enumerate(songs):
        song_id = song["id"]
        output_path = OUTPUT_DIR / f"{song_id}.json"

        if output_path.exists() and not args.force:
            skipped += 1
            continue

        print(f"[{i+1}/{total}] {song['artist']} — {song['title']} ({song_id})")
        ok = generate_practice_data(song, dry_run=args.dry_run)
        if ok:
            done += 1
        else:
            failed += 1

        if not args.dry_run and i < total - 1:
            time.sleep(1)

    print(f"\nDone: {done} generated, {skipped} skipped (already exist), {failed} failed")


if __name__ == "__main__":
    main()
