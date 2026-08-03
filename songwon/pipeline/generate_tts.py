# generate_tts.py — Pre-generate TTS audio for all Korean text in lessons
# Usage: python3 pipeline/generate_tts.py [--voice ko-KR-SunHiNeural]
# Requires: edge-tts (pip install edge-tts)
# Output: pipeline/tts_cache/{hash}.mp3 + pipeline/tts_cache/manifest.json
#
# Extracts all Korean text from:
#   - Lesson lyric lines
#   - Vocabulary words (individual words from corpus_analysis)
#   - Exercise prompts and options containing Korean
#   - Song lyrics lines
#
# Skips any text already generated (checks manifest).
# The web app serves these via /api/tts-cached route.
#
# Gotchas:
# - edge-tts is async, we batch with asyncio.gather but cap concurrency
#   to avoid rate limiting from Microsoft's servers
# - Hash is md5 of (text + voice) to handle voice changes

import asyncio
import hashlib
import json
import os
import sys
import glob
import re
import argparse

CACHE_DIR = os.path.join(os.path.dirname(__file__), "tts_cache")
MANIFEST_PATH = os.path.join(CACHE_DIR, "manifest.json")
CONCURRENCY = 5

def text_hash(text: str, voice: str) -> str:
    return hashlib.md5(f"{text}|{voice}".encode()).hexdigest()

def has_korean(text: str) -> bool:
    return bool(re.search(r'[가-힣]', text))

def extract_texts_from_lessons(lessons_dir: str) -> set:
    texts = set()
    for f in glob.glob(os.path.join(lessons_dir, "*.json")):
        try:
            d = json.load(open(f))
        except (json.JSONDecodeError, IOError):
            continue
        for section in d.get("sections", []):
            for line in section.get("lyricLines", []):
                if has_korean(line):
                    texts.add(line.strip())
            for ex in section.get("exercises", []):
                if has_korean(ex.get("prompt", "")):
                    texts.add(ex["prompt"].strip())
                for opt in ex.get("options", []):
                    if has_korean(opt):
                        texts.add(opt.strip())
                ca = ex.get("correctAnswer", "")
                if isinstance(ca, str) and has_korean(ca):
                    texts.add(ca.strip())
                elif isinstance(ca, list):
                    for a in ca:
                        if has_korean(a):
                            texts.add(a.strip())
    return texts

def extract_texts_from_corpus(corpus_path: str) -> set:
    texts = set()
    try:
        d = json.load(open(corpus_path))
    except (json.JSONDecodeError, IOError):
        return texts
    for item in d.get("vocabulary", []):
        word = item.get("word", "")
        if has_korean(word):
            texts.add(word.strip())
    return texts

def extract_texts_from_lyrics(lyrics_dir: str) -> set:
    texts = set()
    for f in glob.glob(os.path.join(lyrics_dir, "*.txt")):
        try:
            with open(f) as fh:
                for line in fh:
                    line = line.strip()
                    if line and has_korean(line):
                        texts.add(line)
        except IOError:
            continue
    return texts

async def generate_one(text: str, voice: str, semaphore: asyncio.Semaphore) -> tuple:
    import edge_tts
    h = text_hash(text, voice)
    out_path = os.path.join(CACHE_DIR, f"{h}.mp3")
    if os.path.exists(out_path):
        return (h, text, True)

    async with semaphore:
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(out_path)
            return (h, text, True)
        except Exception as e:
            print(f"  FAIL: {text[:40]}... — {e}", file=sys.stderr)
            return (h, text, False)

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="ko-KR-SunHiNeural")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    base = os.path.dirname(__file__)
    lessons_dir = os.path.join(base, "lessons")
    corpus_path = os.path.join(base, "corpus_analysis.json")
    lyrics_dir = os.path.join(base, "lyrics")

    print("Extracting Korean texts...")
    texts = set()
    texts |= extract_texts_from_lessons(lessons_dir)
    print(f"  From lessons: {len(texts)}")
    corpus_texts = extract_texts_from_corpus(corpus_path)
    texts |= corpus_texts
    print(f"  From corpus vocab: {len(corpus_texts)} (total: {len(texts)})")
    lyrics_texts = extract_texts_from_lyrics(lyrics_dir)
    texts |= lyrics_texts
    print(f"  From lyrics: {len(lyrics_texts)} (total: {len(texts)})")

    os.makedirs(CACHE_DIR, exist_ok=True)

    # Load existing manifest
    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        manifest = json.load(open(MANIFEST_PATH))

    # Filter already generated
    to_generate = []
    for text in sorted(texts):
        h = text_hash(text, args.voice)
        if h in manifest and os.path.exists(os.path.join(CACHE_DIR, f"{h}.mp3")):
            continue
        to_generate.append(text)

    print(f"\nTotal unique Korean texts: {len(texts)}")
    print(f"Already cached: {len(texts) - len(to_generate)}")
    print(f"To generate: {len(to_generate)}")

    if args.dry_run:
        for t in to_generate[:20]:
            print(f"  {t[:60]}")
        if len(to_generate) > 20:
            print(f"  ... and {len(to_generate) - 20} more")
        return

    if not to_generate:
        print("Nothing to generate!")
        return

    print(f"\nGenerating with voice: {args.voice}")
    print(f"Concurrency: {CONCURRENCY}")

    semaphore = asyncio.Semaphore(CONCURRENCY)
    tasks = [generate_one(text, args.voice, semaphore) for text in to_generate]

    done = 0
    ok = 0
    for coro in asyncio.as_completed(tasks):
        h, text, success = await coro
        done += 1
        if success:
            ok += 1
            manifest[h] = {"text": text, "voice": args.voice}
        if done % 50 == 0 or done == len(tasks):
            print(f"  {done}/{len(tasks)} done ({ok} OK)")
            # Save manifest periodically
            with open(MANIFEST_PATH, "w") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)

    # Final save
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\nDone! {ok}/{len(to_generate)} generated successfully.")
    print(f"Cache dir: {CACHE_DIR}")
    print(f"Total cached: {len(manifest)}")

if __name__ == "__main__":
    asyncio.run(main())
