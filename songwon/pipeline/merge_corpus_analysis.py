# merge_corpus_analysis.py — Merges 4 batch analysis files into unified corpus_analysis.json
# Usage: python pipeline/merge_corpus_analysis.py
# Reads: scratchpad/analysis_batch_{1-4}.json + pipeline/song_manifest.json
# Writes: pipeline/corpus_analysis.json
#
# Gotchas:
# - Agents used inconsistent safe_name formats: some used manifest's "Artist - Song",
#   others slugified to "artist_song". This script normalizes all to manifest format
#   via fuzzy matching on a slugified key.

import json
import os
import re
import sys
from collections import defaultdict

SCRATCHPAD = "/private/tmp/claude-501/-Users-apple-Documents-Claude-Code-language-learning-through-songs/ab877163-a156-4429-9098-a13933e26a81/scratchpad"
PIPELINE_DIR = os.path.dirname(__file__)
MANIFEST = os.path.join(PIPELINE_DIR, "song_manifest.json")
OUTPUT = os.path.join(PIPELINE_DIR, "corpus_analysis.json")


def slugify(name):
    """Convert any safe_name format to a normalized slug for matching."""
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9가-힣\s]', '', s)
    s = re.sub(r'\s+', '_', s)
    return s


def build_name_map():
    """Build mapping from any slug variant -> canonical manifest safe_name."""
    with open(MANIFEST) as f:
        manifest = json.load(f)

    name_map = {}
    canonical_names = set()
    for song in manifest["songs"]:
        canonical = song["safe_name"]
        canonical_names.add(canonical)
        slug = slugify(canonical)
        name_map[slug] = canonical
        name_map[canonical] = canonical

    # Explicit overrides for slugs the agents produced that don't fuzzy-match
    overrides = {
        "bewhy_ok": "BewhY - OK (Prod. by GRAY)",
        "davichi_geudaenikkayo": "DAVICHI - 그대니까요",
        "iu_g_dragon_palette_feat_g_dragon": "IU, G-DRAGON - Palette (feat. G-DRAGON)",
        "lim_jae_beum_nagin": "Lim Jae Beum - 낙인",
        "mamamoo_mr_ambiguous": "MAMAMOO - Mr-Ambiguous",
        "nca_tikitik_yujunho_jian_flashback": "NC.A, TIKITIK, 유준호, JIAN - Flashback",
        "park_boram_hyehwadong": "Park Boram - Hyehwadong (or Sangmundong)",
        "taeyeon_11_11": "TAEYEON - 11_11",
    }
    for slug, canonical in overrides.items():
        name_map[slug] = canonical

    return name_map, canonical_names


def normalize_name(name, name_map):
    """Try to map a name to its canonical form."""
    if name in name_map:
        return name_map[name]
    slug = slugify(name)
    if slug in name_map:
        return name_map[slug]
    for key, canonical in name_map.items():
        if slug in key or key in slug:
            return canonical
    return name


def normalize_songs_list(songs, name_map):
    """Normalize a list of safe_names."""
    return sorted(set(normalize_name(s, name_map) for s in songs))


def merge():
    name_map, canonical_names = build_name_map()

    all_vocab = {}
    all_grammar = {}
    all_difficulty = {}
    unmapped = set()

    for batch_num in range(1, 5):
        path = os.path.join(SCRATCHPAD, f"analysis_batch_{batch_num}.json")
        if not os.path.exists(path):
            print(f"Missing {path}")
            sys.exit(1)

        with open(path) as f:
            data = json.load(f)

        print(f"Batch {batch_num}: {len(data.get('vocabulary', []))} vocab, "
              f"{len(data.get('grammar_patterns', []))} grammar, "
              f"{len(data.get('song_difficulty', []))} songs")

        for v in data.get("vocabulary", []):
            word = v["word"]
            songs = normalize_songs_list(v.get("songs", []), name_map)
            if word in all_vocab:
                existing = all_vocab[word]
                existing_songs = set(existing["songs"])
                existing["songs"] = sorted(existing_songs | set(songs))
                existing["frequency"] = len(existing["songs"])
            else:
                all_vocab[word] = {
                    "word": v["word"],
                    "meaning": v.get("meaning", ""),
                    "pos": v.get("pos", ""),
                    "topik_level": v.get("topik_level", 1),
                    "songs": songs,
                    "frequency": len(songs)
                }

        for g in data.get("grammar_patterns", []):
            pattern = g["pattern"]
            songs = normalize_songs_list(g.get("songs", []), name_map)
            if pattern in all_grammar:
                existing = all_grammar[pattern]
                existing_songs = set(existing["songs"])
                existing["songs"] = sorted(existing_songs | set(songs))
                existing["frequency"] = len(existing["songs"])
                existing_examples = existing.get("examples", [])
                new_examples = g.get("examples", [])
                seen = set(existing_examples)
                for ex in new_examples:
                    if ex not in seen:
                        existing_examples.append(ex)
                        seen.add(ex)
                existing["examples"] = existing_examples[:4]
            else:
                all_grammar[pattern] = {
                    "pattern": g["pattern"],
                    "meaning": g.get("meaning", ""),
                    "topik_level": g.get("topik_level", 1),
                    "examples": g.get("examples", [])[:4],
                    "songs": songs,
                    "frequency": len(songs)
                }

        for sd in data.get("song_difficulty", []):
            raw_name = sd.get("safe_name", "")
            canonical = normalize_name(raw_name, name_map)
            if canonical not in canonical_names:
                unmapped.add(raw_name)
            sd["safe_name"] = canonical
            all_difficulty[canonical] = sd

    if unmapped:
        print(f"\nWARNING: {len(unmapped)} safe_names could not be mapped to manifest:")
        for u in sorted(unmapped):
            print(f"  - {u}")

    vocab_list = sorted(all_vocab.values(), key=lambda x: (-x["frequency"], int(x.get("topik_level", 1)), x["word"]))
    grammar_list = sorted(all_grammar.values(), key=lambda x: (-x["frequency"], int(x.get("topik_level", 1)), x["pattern"]))
    difficulty_list = sorted(all_difficulty.values(), key=lambda x: int(x.get("difficulty_score", 3)))

    matched = set(d["safe_name"] for d in difficulty_list) & canonical_names
    missing = canonical_names - matched
    if missing:
        print(f"\nMissing difficulty ratings for {len(missing)} songs:")
        for m in sorted(missing):
            print(f"  - {m}")

    topik_dist = defaultdict(int)
    for v in vocab_list:
        topik_dist[v["topik_level"]] += 1

    result = {
        "metadata": {
            "total_songs": len(difficulty_list),
            "total_unique_vocabulary": len(vocab_list),
            "total_grammar_patterns": len(grammar_list),
            "topik_distribution": dict(sorted(topik_dist.items())),
            "difficulty_distribution": {
                "very_easy": len([d for d in difficulty_list if d.get("difficulty_score") == 1]),
                "easy": len([d for d in difficulty_list if d.get("difficulty_score") == 2]),
                "medium": len([d for d in difficulty_list if d.get("difficulty_score") == 3]),
                "hard": len([d for d in difficulty_list if d.get("difficulty_score") == 4]),
                "very_hard": len([d for d in difficulty_list if d.get("difficulty_score") == 5])
            }
        },
        "vocabulary": vocab_list,
        "grammar_patterns": grammar_list,
        "song_difficulty": difficulty_list
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nMerged corpus analysis:")
    print(f"  {len(vocab_list)} unique vocabulary items")
    print(f"  {len(grammar_list)} grammar patterns")
    print(f"  {len(difficulty_list)} songs rated")
    print(f"  TOPIK distribution: {dict(sorted(topik_dist.items()))}")
    print(f"  Written to {OUTPUT}")


if __name__ == "__main__":
    merge()
