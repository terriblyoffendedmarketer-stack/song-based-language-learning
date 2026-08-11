# audit_song_practice.py — Full quantitative audit of all song practice data files
# Usage: python3 pipeline/audit_song_practice.py
# Reads: public/data/song_practice/*.json
# Reports: line counts, role validity, grammar note coverage, duplicates, warnings

import json
import os
from pathlib import Path
from collections import Counter

PROJECT_DIR = Path(os.path.dirname(os.path.abspath(__file__))).parent
PRACTICE_DIR = PROJECT_DIR / "public" / "data" / "song_practice"

VALID_ROLES = {"noun", "verb", "adjective", "adverb", "pronoun", "particle", "interjection", "expression", "connector"}


def audit_file(filepath):
    """Audit a single song practice file. Returns dict of metrics + list of warnings."""
    warnings = []
    data = json.loads(filepath.read_text())
    song_id = data.get("songId", filepath.stem)
    lines = data.get("lines", [])

    line_count = len(lines)
    grammar_count = sum(1 for l in lines if l.get("grammar"))
    word_counts = []
    invalid_roles = []
    korean_seen = Counter()

    for i, line in enumerate(lines):
        korean = line.get("korean", "")
        english = line.get("english", "")
        words = line.get("words", [])

        if not korean:
            warnings.append(f"{song_id} line {i+1}: missing korean text")
        if not english:
            warnings.append(f"{song_id} line {i+1}: missing english text")

        word_counts.append(len(words))
        if len(words) < 2:
            warnings.append(f"{song_id} line {i+1}: only {len(words)} word chunk(s) — '{korean[:30]}'")
        if len(words) > 8:
            warnings.append(f"{song_id} line {i+1}: {len(words)} word chunks (over-split) — '{korean[:30]}'")

        korean_seen[korean] += 1

        for j, w in enumerate(words):
            role = w.get("role", "")
            if role not in VALID_ROLES:
                invalid_roles.append(f"{song_id} line {i+1} word {j+1}: '{role}'")
                warnings.append(f"{song_id} line {i+1} word {j+1}: invalid role '{role}'")

        # Check grammar note quality
        grammar = line.get("grammar")
        if grammar:
            if not grammar.get("pattern"):
                warnings.append(f"{song_id} line {i+1}: grammar missing 'pattern'")
            if not grammar.get("meaning"):
                warnings.append(f"{song_id} line {i+1}: grammar missing 'meaning'")
            if not grammar.get("note"):
                warnings.append(f"{song_id} line {i+1}: grammar missing 'note'")

    # Check duplicates
    duplicates = [(k, c) for k, c in korean_seen.items() if c > 1]
    for dup_text, dup_count in duplicates:
        warnings.append(f"{song_id}: duplicate line ({dup_count}x) — '{dup_text[:40]}'")

    return {
        "song_id": song_id,
        "line_count": line_count,
        "grammar_count": grammar_count,
        "grammar_pct": round(grammar_count / line_count * 100) if line_count > 0 else 0,
        "avg_words": round(sum(word_counts) / len(word_counts), 1) if word_counts else 0,
        "min_words": min(word_counts) if word_counts else 0,
        "max_words": max(word_counts) if word_counts else 0,
        "invalid_roles": len(invalid_roles),
        "duplicates": len(duplicates),
        "warnings": warnings,
    }


def main():
    files = sorted(PRACTICE_DIR.glob("*.json"))
    print(f"Auditing {len(files)} song practice files...\n")

    all_metrics = []
    all_warnings = []
    total_lines = 0
    total_grammar = 0
    total_invalid = 0
    total_duplicates = 0
    line_counts = []

    for f in files:
        metrics = audit_file(f)
        all_metrics.append(metrics)
        all_warnings.extend(metrics["warnings"])
        total_lines += metrics["line_count"]
        total_grammar += metrics["grammar_count"]
        total_invalid += metrics["invalid_roles"]
        total_duplicates += metrics["duplicates"]
        line_counts.append(metrics["line_count"])

    # Summary
    print("=" * 60)
    print("QUANTITATIVE AUDIT SUMMARY")
    print("=" * 60)
    print(f"Files:              {len(files)}")
    print(f"Total lines:        {total_lines}")
    print(f"Avg lines/song:     {round(total_lines / len(files), 1) if files else 0}")
    print(f"Min lines:          {min(line_counts) if line_counts else 0}")
    print(f"Max lines:          {max(line_counts) if line_counts else 0}")
    print(f"Grammar notes:      {total_grammar} ({round(total_grammar / total_lines * 100) if total_lines else 0}%)")
    print(f"Invalid roles:      {total_invalid}")
    print(f"Duplicate lines:    {total_duplicates}")
    print(f"Total warnings:     {len(all_warnings)}")

    # Distribution
    print(f"\nLine count distribution:")
    buckets = {"<10": 0, "10-12": 0, "13-15": 0, "16-18": 0, ">18": 0}
    for lc in line_counts:
        if lc < 10:
            buckets["<10"] += 1
        elif lc <= 12:
            buckets["10-12"] += 1
        elif lc <= 15:
            buckets["13-15"] += 1
        elif lc <= 18:
            buckets["16-18"] += 1
        else:
            buckets[">18"] += 1
    for bucket, count in buckets.items():
        bar = "█" * count
        print(f"  {bucket:>5}: {count:>3} {bar}")

    # Songs with issues
    problem_songs = [m for m in all_metrics if m["warnings"]]
    if problem_songs:
        print(f"\nSongs with warnings ({len(problem_songs)}):")
        for m in problem_songs:
            print(f"  {m['song_id']}: {len(m['warnings'])} warning(s)")

    # All warnings
    if all_warnings:
        print(f"\nAll warnings ({len(all_warnings)}):")
        for w in all_warnings:
            print(f"  - {w}")

    # Per-song summary table
    print(f"\n{'Song ID':<50} {'Lines':>5} {'Grammar':>7} {'AvgW':>5} {'Warn':>5}")
    print("-" * 75)
    for m in all_metrics:
        flag = " ⚠" if m["warnings"] else ""
        print(f"{m['song_id']:<50} {m['line_count']:>5} {m['grammar_count']:>7} {m['avg_words']:>5} {len(m['warnings']):>5}{flag}")

    print(f"\n{'=' * 60}")
    if total_invalid == 0 and total_duplicates == 0:
        print("✓ PASS — No invalid roles, no duplicates")
    else:
        print(f"✗ ISSUES — {total_invalid} invalid roles, {total_duplicates} duplicates")


if __name__ == "__main__":
    main()
