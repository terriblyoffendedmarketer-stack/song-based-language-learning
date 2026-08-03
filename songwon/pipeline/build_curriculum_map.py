# build_curriculum_map.py — Maps songs to learning levels and builds lesson sequence
# Usage: python3 pipeline/build_curriculum_map.py
# Reads: pipeline/corpus_analysis.json, pipeline/song_manifest.json
# Writes: pipeline/curriculum_map.json
#
# Gotchas:
# - Difficulty scores 1-5 map to levels but not 1:1. Score 1-2 → Level 1-2,
#   score 3 → Level 2-3, score 4 → Level 3-4, score 5 → Level 5.
# - korean_ratio can be int or string with %. Normalize to float 0-100.
# - Songs with low korean_ratio still get assigned — they're used for the Korean
#   portions only. Mixed-language songs work fine for targeted extraction.

import json
import os
import re
from collections import defaultdict

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(PIPELINE_DIR, "corpus_analysis.json")
MANIFEST = os.path.join(PIPELINE_DIR, "song_manifest.json")
OUTPUT = os.path.join(PIPELINE_DIR, "curriculum_map.json")


def parse_ratio(val):
    if isinstance(val, str):
        return float(val.replace('%', ''))
    return float(val) if val else 50.0


def assign_level(song):
    score = song.get("difficulty_score", 3)
    avg_topik = float(song.get("avg_topik_level", 3))
    complexity = song.get("grammar_complexity", "medium")

    if score <= 2 and avg_topik <= 2.5:
        return 1
    elif score <= 2:
        return 2
    elif score == 3 and complexity != "high":
        return 3
    elif score == 3 and complexity == "high":
        return 3
    elif score == 4 and avg_topik < 4.0:
        return 4
    elif score == 4:
        return 4
    elif score >= 5:
        return 5
    return 3


def get_song_grammar(safe_name, grammar_patterns):
    return [g for g in grammar_patterns if safe_name in g.get("songs", [])]


def get_song_vocab(safe_name, vocabulary):
    return [v for v in vocabulary if safe_name in v.get("songs", [])]


def build_level_grammar_targets():
    """Define target grammar patterns per level from CURRICULUM_DESIGN.md."""
    return {
        1: [
            "이다/아니다", "-아/어요", "있다/없다",
            "은/는", "이/가", "을/를"
        ],
        2: [
            "-았/었어요", "안/못", "-고 싶다", "-ㅂ니까/습니까",
            "-아/어서", "-고"
        ],
        3: [
            "-(으)ㄹ 거예요", "-지 마", "-(으)면", "-아/어서",
            "-네요", "-지요", "-ㄹ게요"
        ],
        4: [
            "-(으)ㄴ/는", "-겠-", "-든지", "indirect speech",
            "-(으)ㄹ 텐데", "-다가", "-더니"
        ],
        5: [
            "-(으)ㄹ 뿐만 아니라", "-는 바람에", "-고자",
            "-(으)ㄹ수록", "-는 셈이다"
        ]
    }


def build():
    with open(CORPUS, encoding='utf-8') as f:
        corpus = json.load(f)
    with open(MANIFEST, encoding='utf-8') as f:
        manifest = json.load(f)

    song_difficulties = corpus["song_difficulty"]
    vocabulary = corpus["vocabulary"]
    grammar_patterns = corpus["grammar_patterns"]

    manifest_names = {s["safe_name"] for s in manifest["songs"]}

    levels = defaultdict(list)
    song_assignments = {}

    for song in song_difficulties:
        name = song["safe_name"]
        level = assign_level(song)
        kr_ratio = parse_ratio(song.get("korean_ratio", 50))

        song_grammar = get_song_grammar(name, grammar_patterns)
        song_vocab = get_song_vocab(name, vocabulary)

        top_grammar = sorted(song_grammar, key=lambda g: -g.get("frequency", 0))[:5]
        top_vocab_by_freq = sorted(song_vocab, key=lambda v: -v.get("frequency", 0))[:10]

        entry = {
            "safe_name": name,
            "level": level,
            "difficulty_score": song.get("difficulty_score"),
            "avg_topik_level": song.get("avg_topik_level"),
            "grammar_complexity": song.get("grammar_complexity"),
            "korean_ratio": kr_ratio,
            "key_grammar": [
                {"pattern": g["pattern"], "meaning": g.get("meaning", ""), "topik_level": g.get("topik_level", 1)}
                for g in top_grammar
            ],
            "key_vocabulary": [
                {"word": v["word"], "meaning": v.get("meaning", ""), "topik_level": v.get("topik_level", 1)}
                for v in top_vocab_by_freq
            ],
            "suggested_sections": []
        }

        if level <= 2:
            entry["suggested_sections"] = ["chorus"]
        elif level == 3:
            entry["suggested_sections"] = ["chorus", "verse_1"]
        elif level == 4:
            entry["suggested_sections"] = ["verse_1", "chorus", "bridge"]
        else:
            entry["suggested_sections"] = ["full_song"]

        levels[level].append(entry)
        song_assignments[name] = entry

    # Sort within each level by difficulty score then topik level
    for level in levels:
        levels[level].sort(key=lambda x: (x["difficulty_score"], float(x.get("avg_topik_level", 3))))

    # Build high-frequency vocab per level
    level_vocab = {}
    for lvl in range(1, 6):
        songs_in_level = [s["safe_name"] for s in levels[lvl]]
        vocab_in_level = [v for v in vocabulary if any(s in v.get("songs", []) for s in songs_in_level)]
        freq_sorted = sorted(vocab_in_level, key=lambda v: (-v["frequency"], int(v.get("topik_level", 1))))
        level_vocab[lvl] = [
            {"word": v["word"], "meaning": v.get("meaning", ""), "frequency": v["frequency"], "topik_level": v.get("topik_level", 1)}
            for v in freq_sorted[:30]
        ]

    grammar_targets = build_level_grammar_targets()

    result = {
        "metadata": {
            "total_songs": len(song_assignments),
            "songs_per_level": {str(k): len(v) for k, v in sorted(levels.items())},
            "generated_from": "corpus_analysis.json",
            "level_names": {
                "1": "초급 1 — Foundations",
                "2": "초급 2 — Simple Sentences",
                "3": "초급 3 — Expressing Feelings",
                "4": "중급 1 — Connected Ideas",
                "5": "중급 2 — Nuance"
            }
        },
        "levels": {}
    }

    for lvl in range(1, 6):
        result["levels"][str(lvl)] = {
            "name": result["metadata"]["level_names"][str(lvl)],
            "target_grammar": grammar_targets.get(lvl, []),
            "high_frequency_vocab": level_vocab.get(lvl, []),
            "songs": levels.get(lvl, [])
        }

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("Curriculum map built:")
    for lvl in range(1, 6):
        songs = levels.get(lvl, [])
        print(f"  Level {lvl}: {len(songs)} songs")
    print(f"\nWritten to {OUTPUT}")


if __name__ == "__main__":
    build()
