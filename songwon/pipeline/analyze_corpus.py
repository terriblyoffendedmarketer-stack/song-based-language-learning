#!/usr/bin/env python3
# analyze_corpus.py — Automated corpus analysis via Claude API
#
# Usage: python3 pipeline/analyze_corpus.py [--batch-size 10] [--force]
# Reads: pipeline/lyrics/*.txt, pipeline/selected_songs.json
# Writes: pipeline/corpus_analysis.json
#
# Analyzes all song lyrics in batches via Claude API to extract:
#   - Vocabulary (word, meaning, pos, TOPIK level, which songs, frequency)
#   - Grammar patterns (pattern, meaning, TOPIK level, examples, which songs, frequency)
#   - Song difficulty (per-song difficulty score, avg TOPIK, grammar complexity, korean ratio)
#
# Batches lyrics into groups of 10-15 songs, sends each batch to Claude,
# then merges all batch results into a single corpus_analysis.json.
#
# Gotchas:
#   - Batches of >15 songs degrade quality. 10 is the sweet spot.
#   - Claude may refuse to reproduce full lyrics — we only send them for analysis,
#     not asking it to output them. The prompt explicitly says "analyze, don't reproduce."
#   - TOPIK level estimates are approximate. Levels 1-2 are reliable, 3-6 less so.
#   - Songs with very few Korean lines (<5) produce sparse analysis — expected.
#   - Total cost: ~$2-3 for 60 songs on Sonnet (6 batches × ~$0.40/batch).
#   - Existing corpus_analysis.json is overwritten unless --force is NOT set and it exists.

import json
import os
import re
import sys
import time
import argparse
from pathlib import Path

PIPELINE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = PIPELINE_DIR.parent
LYRICS_DIR = PIPELINE_DIR / "lyrics"
SELECTED_SONGS = PIPELINE_DIR / "selected_songs.json"
OUTPUT_FILE = PIPELINE_DIR / "corpus_analysis.json"
BATCH_DIR = PIPELINE_DIR / ".corpus_batches"


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


def has_hangul(text):
    return bool(re.search(r'[가-힯]', text))


def count_korean_lines(text):
    return sum(1 for l in text.strip().split('\n') if l.strip() and has_hangul(l))


def make_safe_name(artist, name):
    safe = f"{artist} - {name}"
    safe = re.sub(r'[<>:"/\\|?*]', '_', safe)
    return safe.strip('. ')


def build_batch_prompt(songs_with_lyrics):
    """Build the analysis prompt for a batch of songs."""
    songs_block = ""
    for i, (artist, title, lyrics) in enumerate(songs_with_lyrics, 1):
        korean_count = count_korean_lines(lyrics)
        songs_block += f"\n### Song {i}: {artist} — {title} ({korean_count} Korean lines)\n\n{lyrics}\n"

    return f"""You are an expert Korean linguist analyzing song lyrics for a language learning app. Analyze the following {len(songs_with_lyrics)} songs and extract structured data. Do NOT reproduce the lyrics — only analyze them.

{songs_block}

## Extract the following:

### 1. Vocabulary
For EVERY meaningful Korean word that appears (not particles alone, not English words), provide:
- word: the dictionary form (e.g. 가다 not 가고)
- meaning: English translation
- pos: noun, verb, adjective, adverb, or expression
- topik_level: estimated TOPIK level 1-6 (1=most basic like 나/너/가다, 6=literary/rare)
- songs: list of "Artist - Title" strings where this word appears

### 2. Grammar Patterns
For every Korean grammar construction used, provide:
- pattern: the grammar pattern (e.g. -고 싶다, -(으)면, -아/어서)
- meaning: what it does in English
- topik_level: estimated TOPIK level 1-6
- examples: 2-4 actual Korean lines from the lyrics that use this pattern
- songs: list of "Artist - Title" strings that use this pattern

### 3. Song Difficulty
For each song, provide:
- safe_name: "Artist - Title"
- difficulty_score: 1-5 (1=very easy, 5=very hard)
- avg_topik_level: average TOPIK level of the vocabulary used (float)
- grammar_complexity: low, medium, or high
- korean_ratio: percentage of lines that contain Korean (integer 0-100)
- key_vocab_count: number of distinct meaningful vocab words
- key_grammar_count: number of distinct grammar patterns used
- slang_level: none, some, or heavy
- notes: any data quality issues (wrong lyrics, not actually a song, mostly English, etc.)

## Output format

Return ONLY valid JSON (no markdown fences, no commentary). Structure:

{{
  "vocabulary": [
    {{"word": "꿈", "meaning": "dream", "pos": "noun", "topik_level": 1, "songs": ["Artist - Title", ...]}}
  ],
  "grammar_patterns": [
    {{"pattern": "-고", "meaning": "and / and then", "topik_level": 1, "examples": ["line1", "line2"], "songs": ["Artist - Title", ...]}}
  ],
  "song_difficulty": [
    {{"safe_name": "Artist - Title", "difficulty_score": 3, "avg_topik_level": 2.5, "grammar_complexity": "medium", "korean_ratio": 85, "key_vocab_count": 30, "key_grammar_count": 8, "slang_level": "none", "notes": ""}}
  ]
}}"""


def call_api(prompt, api_key):
    """Call Claude API for corpus analysis."""
    try:
        from anthropic import Anthropic
    except ImportError:
        print("ERROR: pip3 install anthropic")
        sys.exit(1)

    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```\s*$', '', text)

    return json.loads(text)


def merge_batches(batch_results):
    """Merge multiple batch results into a single corpus analysis."""
    all_vocab = {}
    all_grammar = {}
    all_difficulty = {}

    for batch in batch_results:
        # Merge vocabulary
        for v in batch.get("vocabulary", []):
            word = v["word"]
            if word in all_vocab:
                existing = all_vocab[word]
                existing["songs"] = list(set(existing["songs"] + v.get("songs", [])))
                existing["frequency"] = len(existing["songs"])
            else:
                v["frequency"] = len(v.get("songs", []))
                all_vocab[word] = v

        # Merge grammar patterns
        for g in batch.get("grammar_patterns", []):
            pattern = g["pattern"]
            if pattern in all_grammar:
                existing = all_grammar[pattern]
                existing["songs"] = list(set(existing["songs"] + g.get("songs", [])))
                existing["examples"] = list(set(existing.get("examples", []) + g.get("examples", [])))[:6]
                existing["frequency"] = len(existing["songs"])
            else:
                g["frequency"] = len(g.get("songs", []))
                all_grammar[pattern] = g

        # Merge song difficulty (no dedup needed — each song in one batch)
        for s in batch.get("song_difficulty", []):
            all_difficulty[s["safe_name"]] = s

    # Sort vocab by frequency descending
    vocab_list = sorted(all_vocab.values(), key=lambda x: x.get("frequency", 0), reverse=True)
    grammar_list = sorted(all_grammar.values(), key=lambda x: x.get("frequency", 0), reverse=True)

    # TOPIK distribution
    topik_dist = {}
    for v in vocab_list:
        level = str(v.get("topik_level", 3))
        topik_dist[level] = topik_dist.get(level, 0) + 1

    # Difficulty distribution
    diff_labels = {1: "very_easy", 2: "easy", 3: "medium", 4: "hard", 5: "very_hard"}
    diff_dist = {}
    for s in all_difficulty.values():
        label = diff_labels.get(s.get("difficulty_score", 3), "medium")
        diff_dist[label] = diff_dist.get(label, 0) + 1

    return {
        "metadata": {
            "total_songs": len(all_difficulty),
            "total_unique_vocabulary": len(vocab_list),
            "total_grammar_patterns": len(grammar_list),
            "topik_distribution": topik_dist,
            "difficulty_distribution": diff_dist,
        },
        "vocabulary": vocab_list,
        "grammar_patterns": grammar_list,
        "song_difficulty": all_difficulty,
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze song lyrics corpus via Claude API")
    parser.add_argument("--batch-size", type=int, default=10, help="Songs per API call (default 10)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing corpus_analysis.json")
    parser.add_argument("--resume", action="store_true", help="Resume from saved batch files")
    args = parser.parse_args()

    if OUTPUT_FILE.exists() and not args.force and not args.resume:
        print(f"corpus_analysis.json already exists. Use --force to overwrite or --resume to continue.")
        sys.exit(0)

    api_key = load_api_key()
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not found in env or .env.local")
        sys.exit(1)

    # Load selected songs
    with open(SELECTED_SONGS) as f:
        selected = json.load(f)
    songs = selected["songs"]

    # Load lyrics for each song
    songs_with_lyrics = []
    for song in songs:
        artist = song["artist"]
        name = song["name"]
        safe = make_safe_name(artist, name)
        lyrics_path = LYRICS_DIR / f"{safe}.txt"
        if lyrics_path.exists():
            lyrics = lyrics_path.read_text()
            if count_korean_lines(lyrics) >= 5:
                songs_with_lyrics.append((artist, name, lyrics))
            else:
                print(f"  SKIP {safe}: too few Korean lines ({count_korean_lines(lyrics)})")
        else:
            print(f"  SKIP {safe}: no lyrics file")

    print(f"\n{'='*60}")
    print(f"  Corpus Analysis: {len(songs_with_lyrics)} songs")
    print(f"  Batch size: {args.batch_size}")
    print(f"  Estimated batches: {(len(songs_with_lyrics) + args.batch_size - 1) // args.batch_size}")
    print(f"{'='*60}\n")

    # Create batches
    batches = []
    for i in range(0, len(songs_with_lyrics), args.batch_size):
        batches.append(songs_with_lyrics[i:i + args.batch_size])

    BATCH_DIR.mkdir(exist_ok=True)
    batch_results = []

    for i, batch in enumerate(batches, 1):
        batch_file = BATCH_DIR / f"batch_{i}.json"

        if args.resume and batch_file.exists():
            print(f"[{i}/{len(batches)}] Loading cached batch...")
            batch_results.append(json.loads(batch_file.read_text()))
            continue

        song_names = [f"{a} - {t}" for a, t, _ in batch]
        print(f"[{i}/{len(batches)}] Analyzing: {', '.join(song_names[:3])}{'...' if len(song_names) > 3 else ''}")

        prompt = build_batch_prompt(batch)

        try:
            result = call_api(prompt, api_key)
            batch_file.write_text(json.dumps(result, indent=2, ensure_ascii=False))
            batch_results.append(result)

            vocab_count = len(result.get("vocabulary", []))
            grammar_count = len(result.get("grammar_patterns", []))
            print(f"  → {vocab_count} vocab, {grammar_count} grammar patterns")
        except Exception as e:
            print(f"  ERROR: {e}")
            print(f"  Saving progress and continuing...")
            continue

        time.sleep(2)

    if not batch_results:
        print("No batches completed. Nothing to merge.")
        sys.exit(1)

    # Merge
    print(f"\nMerging {len(batch_results)} batches...")
    merged = merge_batches(batch_results)
    OUTPUT_FILE.write_text(json.dumps(merged, indent=2, ensure_ascii=False))

    print(f"\n{'='*60}")
    print(f"  Corpus analysis complete!")
    print(f"  Vocabulary: {merged['metadata']['total_unique_vocabulary']} unique words")
    print(f"  Grammar: {merged['metadata']['total_grammar_patterns']} patterns")
    print(f"  Songs analyzed: {merged['metadata']['total_songs']}")
    print(f"  TOPIK distribution: {merged['metadata']['topik_distribution']}")
    print(f"  Saved to: {OUTPUT_FILE}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
