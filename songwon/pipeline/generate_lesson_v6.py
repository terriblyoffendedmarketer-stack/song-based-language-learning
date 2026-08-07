# generate_lesson_v6.py — Generates a single V5 lesson via Anthropic API
# Usage: python3 generate_lesson_v6.py <lesson_number> [--dry-run]
# Requires: ANTHROPIC_API_KEY env var or .env.local file
# Output: writes to public/data/lessons_v5/unitN-lessonM.json
#
# Gotchas:
# - Run ONE lesson at a time. Quality degrades in batch.
# - Always verify output with quality_gate() before trusting it.
# - Lyrics files have inconsistent casing (e.g. "Good day" vs "Good Day").
# - Song lines with English mixed in (e.g. "I can fly the sky") are normal — don't filter them.
# - The API sometimes generates quiz options where multiple could be valid.
#   The quality gate catches this (exactly 1 correct per quiz).

import json
import os
import sys
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LESSONS_DIR = PROJECT_DIR / "public" / "data" / "lessons_v5"
LYRICS_DIR = SCRIPT_DIR / "lyrics"
CURRICULUM_FILE = SCRIPT_DIR / "CURRICULUM_PROGRESSION.md"

# Lesson metadata: song, grammar, vocab per lesson
LESSON_CONFIG = {
    1: {
        "songId": "10cm-phonecert", "songTitle": "Phonecert", "artist": "10cm",
        "lyricsFile": "10cm - Phonecert.txt",
        "unit": 1, "grammarFocus": "-고", "grammarMeaning": "and / and then",
        "vocab": [
            {"korean": "꿈", "english": "dream", "kind": "word", "pos": "noun"},
            {"korean": "사랑", "english": "love", "kind": "word", "pos": "noun"},
            {"korean": "웃고 울다", "english": "to laugh and cry", "kind": "phrase", "pos": ""},
            {"korean": "사랑하고 싶다", "english": "to want to love", "kind": "phrase", "pos": ""},
        ],
    },
    2: {
        "songId": "gaho-start", "songTitle": "시작", "artist": "Gaho",
        "lyricsFile": "Gaho - 시작.txt",
        "unit": 1, "grammarFocus": "-고 싶다", "grammarMeaning": "want to do",
        "vocab": [
            {"korean": "찾다", "english": "to find / to look for", "kind": "word", "pos": "verb"},
            {"korean": "사람", "english": "person", "kind": "word", "pos": "noun"},
            {"korean": "찾고 싶다", "english": "to want to find", "kind": "phrase", "pos": ""},
            {"korean": "말하고 싶다", "english": "to want to say", "kind": "phrase", "pos": ""},
        ],
    },
    3: {
        "songId": "punch-staywithme", "songTitle": "Stay With Me", "artist": "Punch",
        "lyricsFile": "Punch - Stay With Me.txt",
        "unit": 1, "grammarFocus": "-고 있다", "grammarMeaning": "progressive / ongoing state",
        "vocab": [
            {"korean": "기다리다", "english": "to wait", "kind": "word", "pos": "verb"},
            {"korean": "지키다", "english": "to protect / to keep", "kind": "word", "pos": "verb"},
            {"korean": "기다리고 있다", "english": "to be waiting", "kind": "phrase", "pos": ""},
            {"korean": "지키고 있다", "english": "to be protecting", "kind": "phrase", "pos": ""},
        ],
    },
    4: {
        "songId": "punch-staywithme2", "songTitle": "Stay With Me", "artist": "Punch",
        "lyricsFile": "Punch - Stay With Me.txt",
        "unit": 1, "grammarFocus": "-(으)면", "grammarMeaning": "if / when",
        "vocab": [
            {"korean": "괜찮다", "english": "to be okay / to be fine", "kind": "word", "pos": "adjective"},
            {"korean": "시간", "english": "time", "kind": "word", "pos": "noun"},
            {"korean": "괜찮으면", "english": "if it's okay", "kind": "phrase", "pos": ""},
            {"korean": "시간이 되면", "english": "when there's time / if you have time", "kind": "phrase", "pos": ""},
        ],
    },
    5: {
        "songId": "day6-youwerebeautiful", "songTitle": "You Were Beautiful", "artist": "DAY6",
        "lyricsFile": "DAY6 - You Were Beautiful.txt",
        "unit": 2, "grammarFocus": "-지만", "grammarMeaning": "but, although",
        "vocab": [
            {"korean": "아프다", "english": "to hurt / to be painful", "kind": "word", "pos": "adjective"},
            {"korean": "기억", "english": "memory", "kind": "word", "pos": "noun"},
            {"korean": "아프지만", "english": "it hurts but...", "kind": "phrase", "pos": ""},
            {"korean": "기억하지만", "english": "I remember but...", "kind": "phrase", "pos": ""},
        ],
    },
    6: {
        "songId": "iu-goodday", "songTitle": "Good Day", "artist": "IU",
        "lyricsFile": "IU - Good day.txt",
        "unit": 2, "grammarFocus": "-지 못하다", "grammarMeaning": "cannot do",
        "vocab": [
            {"korean": "멈추다", "english": "to stop", "kind": "word", "pos": "verb"},
            {"korean": "잊다", "english": "to forget", "kind": "word", "pos": "verb"},
            {"korean": "멈추지 못하다", "english": "cannot stop", "kind": "phrase", "pos": ""},
            {"korean": "잊지 못하다", "english": "cannot forget", "kind": "phrase", "pos": ""},
        ],
    },
    7: {
        "songId": "twice-likey", "songTitle": "Likey", "artist": "TWICE",
        "lyricsFile": "TWICE - Likey.txt",
        "unit": 2, "grammarFocus": "-지 않다", "grammarMeaning": "not, negation",
        "vocab": [
            {"korean": "변하다", "english": "to change", "kind": "word", "pos": "verb"},
            {"korean": "끝", "english": "end", "kind": "word", "pos": "noun"},
            {"korean": "변하지 않다", "english": "to not change", "kind": "phrase", "pos": ""},
            {"korean": "끝나지 않다", "english": "to not end", "kind": "phrase", "pos": ""},
        ],
    },
    8: {
        "songId": "punch-staywithme3", "songTitle": "Stay With Me", "artist": "Punch",
        "lyricsFile": "Punch - Stay With Me.txt",
        "unit": 2, "grammarFocus": "-아/어서", "grammarMeaning": "because / and then",
        "vocab": [
            {"korean": "보다", "english": "to see / to watch", "kind": "word", "pos": "verb"},
            {"korean": "듣다", "english": "to hear / to listen", "kind": "word", "pos": "verb"},
            {"korean": "봐서", "english": "because I saw / having seen", "kind": "phrase", "pos": ""},
            {"korean": "들어서", "english": "because I heard / having heard", "kind": "phrase", "pos": ""},
        ],
    },
    9: {
        "songId": "shaun-waybackhome", "songTitle": "Way Back Home", "artist": "SHAUN",
        "lyricsFile": "SHAUN - Way Back Home.txt",
        "unit": 3, "grammarFocus": "-아/어 줘", "grammarMeaning": "please do ~ for me",
        "vocab": [
            {"korean": "잡다", "english": "to hold / to grab", "kind": "word", "pos": "verb"},
            {"korean": "안다", "english": "to hug / to hold", "kind": "word", "pos": "verb"},
            {"korean": "잡아 줘", "english": "hold onto (me) please", "kind": "phrase", "pos": ""},
            {"korean": "안아 줘", "english": "hug (me) please", "kind": "phrase", "pos": ""},
        ],
    },
    10: {
        "songId": "iu-throughthenight", "songTitle": "Through the Night(밤편지)", "artist": "IU",
        "lyricsFile": "IU - Through the Night(밤편지).txt",
        "unit": 3, "grammarFocus": "-(으)ㄹ 것 같다", "grammarMeaning": "it seems like / I think",
        "vocab": [
            {"korean": "빛나다", "english": "to shine", "kind": "word", "pos": "verb"},
            {"korean": "울다", "english": "to cry", "kind": "word", "pos": "verb"},
            {"korean": "빛날 것 같다", "english": "it seems like it'll shine", "kind": "phrase", "pos": ""},
            {"korean": "울 것 같다", "english": "I think I'll cry", "kind": "phrase", "pos": ""},
        ],
    },
    11: {
        "songId": "bol4-lovestory", "songTitle": "Love story", "artist": "BOL4",
        "lyricsFile": "BOL4 - Love story.txt",
        "unit": 3, "grammarFocus": "-잖아", "grammarMeaning": "you know / isn't it / reminding",
        "vocab": [
            {"korean": "알다", "english": "to know", "kind": "word", "pos": "verb"},
            {"korean": "남다", "english": "to remain / to be left", "kind": "word", "pos": "verb"},
            {"korean": "알잖아", "english": "you know (reminding)", "kind": "phrase", "pos": ""},
            {"korean": "남잖아", "english": "it remains, you know", "kind": "phrase", "pos": ""},
        ],
    },
    12: {
        "songId": "bol4-some", "songTitle": "Some", "artist": "BOL4",
        "lyricsFile": "BOL4 - Some.txt",
        "unit": 3, "grammarFocus": "-는데", "grammarMeaning": "background info / mild contrast",
        "vocab": [
            {"korean": "걷다", "english": "to walk", "kind": "word", "pos": "verb"},
            {"korean": "비", "english": "rain", "kind": "word", "pos": "noun"},
            {"korean": "걷는데", "english": "I'm walking, and...", "kind": "phrase", "pos": ""},
            {"korean": "비가 오는데", "english": "it's raining, but/and...", "kind": "phrase", "pos": ""},
        ],
    },
    13: {
        "songId": "bts-fakelove", "songTitle": "FAKE LOVE", "artist": "BTS",
        "lyricsFile": "BTS - FAKE LOVE.txt",
        "unit": 4, "grammarFocus": "-아/어도", "grammarMeaning": "even though, even if",
        "vocab": [
            {"korean": "사라지다", "english": "to disappear", "kind": "word", "pos": "verb"},
            {"korean": "잊다", "english": "to forget", "kind": "word", "pos": "verb"},
            {"korean": "사라져도", "english": "even if (it) disappears", "kind": "phrase", "pos": ""},
            {"korean": "잊어도", "english": "even if I forget", "kind": "phrase", "pos": ""},
        ],
    },
    14: {
        "songId": "day6-youwerebeautiful2", "songTitle": "You Were Beautiful", "artist": "DAY6",
        "lyricsFile": "DAY6 - You Were Beautiful.txt",
        "unit": 4, "grammarFocus": "-아/어지다", "grammarMeaning": "to become a state",
        "vocab": [
            {"korean": "멀어지다", "english": "to grow distant", "kind": "word", "pos": "verb"},
            {"korean": "슬프다", "english": "to be sad", "kind": "word", "pos": "adjective"},
            {"korean": "멀어지다", "english": "to grow distant / drift apart", "kind": "phrase", "pos": ""},
            {"korean": "슬퍼지다", "english": "to become sad", "kind": "phrase", "pos": ""},
        ],
    },
    15: {
        "songId": "ben-justlikeadream", "songTitle": "Just Like a Dream", "artist": "BEN",
        "lyricsFile": "BEN - Just Like a Dream.txt",
        "unit": 4, "grammarFocus": "-처럼", "grammarMeaning": "like, as",
        "vocab": [
            {"korean": "별", "english": "star", "kind": "word", "pos": "noun"},
            {"korean": "꽃", "english": "flower", "kind": "word", "pos": "noun"},
            {"korean": "꿈처럼", "english": "like a dream", "kind": "phrase", "pos": ""},
            {"korean": "별처럼", "english": "like a star", "kind": "phrase", "pos": ""},
        ],
    },
    16: {
        "songId": "10cm-myeyes", "songTitle": "My Eyes", "artist": "10cm",
        "lyricsFile": "10cm - My Eyes.txt",
        "unit": 4, "grammarFocus": "-게 되다", "grammarMeaning": "to end up ~ing",
        "vocab": [
            {"korean": "목소리", "english": "voice", "kind": "word", "pos": "noun"},
            {"korean": "들리다", "english": "to be heard", "kind": "word", "pos": "verb"},
            {"korean": "좋아하게 되다", "english": "to end up liking", "kind": "phrase", "pos": ""},
            {"korean": "들리게 되다", "english": "to end up being heard", "kind": "phrase", "pos": ""},
        ],
    },
    17: {
        "songId": "bts-fakelove2", "songTitle": "FAKE LOVE", "artist": "BTS",
        "lyricsFile": "BTS - FAKE LOVE.txt",
        "unit": 5, "grammarFocus": "-아/어 버리다", "grammarMeaning": "to do completely / with finality",
        "vocab": [
            {"korean": "버리다", "english": "to throw away", "kind": "word", "pos": "verb"},
            {"korean": "지우다", "english": "to erase / to delete", "kind": "word", "pos": "verb"},
            {"korean": "잊어 버리다", "english": "to forget completely", "kind": "phrase", "pos": ""},
            {"korean": "지워 버리다", "english": "to erase completely", "kind": "phrase", "pos": ""},
        ],
    },
    18: {
        "songId": "gaho-start2", "songTitle": "시작", "artist": "Gaho",
        "lyricsFile": "Gaho - 시작.txt",
        "unit": 5, "grammarFocus": "-기 전에", "grammarMeaning": "before doing",
        "vocab": [
            {"korean": "시작하다", "english": "to start / to begin", "kind": "word", "pos": "verb"},
            {"korean": "끝나다", "english": "to end / to finish", "kind": "word", "pos": "verb"},
            {"korean": "시작하기 전에", "english": "before starting", "kind": "phrase", "pos": ""},
            {"korean": "끝나기 전에", "english": "before it ends", "kind": "phrase", "pos": ""},
        ],
    },
    19: {
        "songId": "day6-youwerebeautiful3", "songTitle": "You Were Beautiful", "artist": "DAY6",
        "lyricsFile": "DAY6 - You Were Beautiful.txt",
        "unit": 5, "grammarFocus": "-다가도", "grammarMeaning": "even while in the middle of",
        "vocab": [
            {"korean": "생각하다", "english": "to think", "kind": "word", "pos": "verb"},
            {"korean": "혼자", "english": "alone", "kind": "word", "pos": "noun/adverb"},
            {"korean": "웃다가도", "english": "even while laughing", "kind": "phrase", "pos": ""},
            {"korean": "생각하다가도", "english": "even while thinking", "kind": "phrase", "pos": ""},
        ],
    },
    20: {
        "songId": "day6-youwerebeautiful4", "songTitle": "You Were Beautiful", "artist": "DAY6",
        "lyricsFile": "DAY6 - You Were Beautiful.txt",
        "unit": 5, "grammarFocus": "-던", "grammarMeaning": "past retrospective modifier",
        "vocab": [
            {"korean": "추억", "english": "memory / nostalgia", "kind": "word", "pos": "noun"},
            {"korean": "향기", "english": "scent / fragrance", "kind": "word", "pos": "noun"},
            {"korean": "걷던 길", "english": "the street we used to walk", "kind": "phrase", "pos": ""},
            {"korean": "좋아하던 향기", "english": "the scent I used to like", "kind": "phrase", "pos": ""},
        ],
    },
}


def load_lyrics(lesson_num):
    """Load full lyrics for a lesson's song."""
    config = LESSON_CONFIG[lesson_num]
    lyrics_path = LYRICS_DIR / config["lyricsFile"]
    if not lyrics_path.exists():
        raise FileNotFoundError(f"Lyrics not found: {lyrics_path}")
    return lyrics_path.read_text(encoding="utf-8")


def get_previously_taught(up_to_lesson):
    """Get all vocab taught in lessons 1 through up_to_lesson-1."""
    taught = []
    for i in range(1, up_to_lesson):
        config = LESSON_CONFIG[i]
        for v in config["vocab"]:
            taught.append(f'{v["korean"]} = {v["english"]} ({v["kind"]}, L{i})')
    return taught


def load_gold_standard():
    """Load Lesson 1 as the gold standard template."""
    path = LESSONS_DIR / "unit1-lesson1.json"
    return json.loads(path.read_text(encoding="utf-8"))


def build_prompt(lesson_num):
    """Build the full prompt for generating a lesson."""
    config = LESSON_CONFIG[lesson_num]
    lyrics = load_lyrics(lesson_num)
    previously_taught = get_previously_taught(lesson_num)
    gold = load_gold_standard()

    unit = config["unit"]
    grammar = config["grammarFocus"]
    grammar_meaning = config["grammarMeaning"]
    artist = config["artist"]
    song_title = config["songTitle"]
    vocab = config["vocab"]

    words = [v for v in vocab if v["kind"] == "word"]
    phrases = [v for v in vocab if v["kind"] == "phrase"]

    prev_str = "\n".join(f"  - {t}" for t in previously_taught) if previously_taught else "  (none — this is the first lesson)"

    vocab_str = "\n".join(
        f'  - {v["korean"]} = {v["english"]} ({v["kind"]}, {v.get("pos", "")})'
        for v in vocab
    )

    prompt = f"""You are generating a Korean language lesson for the Songwon app. This lesson teaches the grammar pattern **{grammar}** ({grammar_meaning}) through the song "{song_title}" by {artist}.

## CRITICAL RULES

1. Output ONLY valid JSON. No markdown, no explanation, no code fences.
2. Follow the EXACT screen flow structure shown in the gold standard below.
3. Every word-card and phrase-card MUST be preceded by a context-sentence screen.
4. Quiz distractors must be UNAMBIGUOUS — exactly ONE correct answer per quiz.
5. Quiz distractors must be the same part of speech as the correct answer.
6. Do NOT include a warmup screen.
7. The lesson must have exactly 30 screens.
8. Korean text must be natural and grammatically correct.
9. Context sentences should be simple daily-life sentences using the target word.
10. Do NOT teach ultra-basic words (나, 너, 가다, 오다, 있다) — USE them in sentences, but don't give them word cards.

## LESSON METADATA

- Lesson ID: v5-unit{unit}-lesson{lesson_num}
- Song: {artist} — {song_title}
- Unit: {unit}, Lesson Number: {lesson_num}
- Grammar: {grammar} ({grammar_meaning})
- Song ID: {config["songId"]}
- koreanRatio: 0.6

## VOCABULARY TO TEACH (2 words + 2 phrases)

{vocab_str}

## PREVIOUSLY TAUGHT (do NOT re-teach, but CAN reference in sentences)

{prev_str}

## FULL SONG LYRICS

```
{lyrics}
```

## REQUIRED SCREEN FLOW (30 screens, follow this exactly)

1. **intro** — Grammar-first intro. Korean + English. Mention grammar point, then the song.
2. **lyrics-fullsong** — ALL lyrics as allLines[]. Pick 4 target lines (targetLineIndices) that demonstrate the grammar or contain taught vocab. Empty lines ("") for verse breaks.
3. **line-breakdown** — Break down target line 1. Show each word's meaning. Connect to grammar pattern.
4. **context-sentence** — Simple daily sentence using WORD 1. Highlight the word.
5. **word-card** — Teach WORD 1. Include a songLine where it appears (or related line).
6. **quiz** — tap-meaning quiz for WORD 1. 4 options, same part of speech.
7. **line-breakdown** — Break down target line 2. Reference the grammar.
8. **pattern-spotlight** — Explain {grammar}. Song example + 3 other examples (2 daily + 1 from lyrics).
9. **quiz** — fill-blank quiz testing the grammar pattern.
10. **intro** — Checkpoint breather. "잘 하고 있어요!" with encouragement.
11. **context-sentence** — Sentence using PHRASE 1. Highlight the phrase.
12. **phrase-card** — Teach PHRASE 1. Include phraseNote showing how it's built.
13. **quiz** — tap-meaning quiz for PHRASE 1.
14. **line-breakdown** — Break down target line 3.
15. **quiz** — Lyric comprehension quiz (translate a lyric line).
16. **context-sentence** — Sentence using WORD 2. Highlight the word.
17. **word-card** — Teach WORD 2.
18. **quiz** — tap-meaning quiz for WORD 2.
19. **context-sentence** — Sentence using PHRASE 2. Highlight the phrase.
20. **phrase-card** — Teach PHRASE 2.
21. **quiz** — fill-blank quiz testing PHRASE 2 with the grammar pattern.
22. **line-breakdown** — Break down target line 4. Tie back to grammar.
23. **pair-context** — Two sentences comparing the grammar pattern (positive vs negative, or two uses).
24. **quiz** — Review quiz: meaning of grammar pattern.
25. **quiz** — Review quiz: Korean → English for a taught phrase.
26. **quiz** — Review quiz: fill-blank with the grammar.
27. **quiz** — Review quiz: lyric line translation.
28. **quiz** — Review quiz: vocab recall.
29. **sing-along** — 4 key lyric lines with translations. musicPlaying: true.
30. **recap** — List all 4 taught items. pattern object. xpReward: 25, passThreshold: 0.7, totalQuizScreens: 11.

## GOLD STANDARD (Lesson 1 — follow this structure exactly)

```json
{json.dumps(gold, ensure_ascii=False, indent=2)}
```

## QUIZ QUALITY RULES

- tap-meaning: prompt is Korean word/phrase, 4 English options (or vice versa)
- fill-blank: ONE blank marked with ___, exactly ONE valid completion
- Distractors: same part of speech, plausible but clearly wrong
- Never use a previously taught word as a distractor if it could be correct
- wrongExplanation: brief, helpful, shows the correct answer
- For fill-blank grammar quizzes: distractors are OTHER grammar endings (-지만, -면, -아서, -게, etc.)
- scored: true for all quizzes
- itemIndex on quizzes that test a specific taught item (0-3)

## OUTPUT FORMAT

Output a single JSON object matching the V5Lesson interface. The root keys are: id, meta, screens, generatedAt (ISO string).
"""
    return prompt


def quality_gate(lesson_data):
    """Validate a lesson against quality requirements. Returns (passed, issues)."""
    issues = []
    screens = lesson_data.get("screens", [])
    types = [s["type"] for s in screens]

    # 1. No warmup
    if "warmup" in types:
        issues.append("FAIL: has warmup screen")

    # 2. Has lyrics-fullsong at position 2
    if "lyrics-fullsong" not in types:
        issues.append("FAIL: missing lyrics-fullsong")
    elif types.index("lyrics-fullsong") != 1:
        issues.append("WARN: lyrics-fullsong not at position 2")

    # 3. Context-first: word/phrase cards preceded by context-sentence
    for i, s in enumerate(screens):
        if s["type"] in ("word-card", "phrase-card"):
            if i == 0 or screens[i - 1]["type"] != "context-sentence":
                issues.append(f'FAIL: {s["type"]} at screen {i+1} not preceded by context-sentence')

    # 4. Quiz density <= 40%
    quiz_count = types.count("quiz")
    density = quiz_count / len(types) * 100 if types else 0
    if density > 40:
        issues.append(f"FAIL: quiz density {density:.0f}% > 40%")

    # 5. Screen count
    if len(types) < 25 or len(types) > 35:
        issues.append(f"WARN: screen count {len(types)} outside 25-35 range")

    # 6. Has required screen types
    for required in ["pattern-spotlight", "sing-along", "recap"]:
        if required not in types:
            issues.append(f"FAIL: missing {required}")

    # 7. Checkpoint breather
    checkpoint_positions = [i for i, s in enumerate(screens) if s["type"] == "intro" and i > 0]
    if not checkpoint_positions:
        issues.append("WARN: no checkpoint breather intro")

    # 8. Recap is last
    if types and types[-1] != "recap":
        issues.append("FAIL: last screen is not recap")

    # 9. Quiz validity
    for i, s in enumerate(screens):
        if s["type"] == "quiz":
            q = s.get("quiz", {})
            opts = q.get("options", [])
            correct_count = sum(1 for o in opts if o.get("correct"))
            if correct_count != 1:
                issues.append(f"FAIL: quiz at screen {i+1} has {correct_count} correct answers")
            if len(opts) < 3:
                issues.append(f"FAIL: quiz at screen {i+1} has only {len(opts)} options")

    # 10. Teaches 2 words + 2 phrases
    words = [s for s in screens if s["type"] == "word-card"]
    phrases = [s for s in screens if s["type"] == "phrase-card"]
    if len(words) != 2:
        issues.append(f"WARN: teaches {len(words)} words (expected 2)")
    if len(phrases) != 2:
        issues.append(f"WARN: teaches {len(phrases)} phrases (expected 2)")

    # 11. totalQuizScreens matches
    recap = screens[-1] if screens and screens[-1]["type"] == "recap" else None
    if recap and recap.get("totalQuizScreens") != quiz_count:
        issues.append(f"FAIL: recap.totalQuizScreens={recap.get('totalQuizScreens')} != actual {quiz_count}")

    # 12. fullsong targetLineIndices valid
    for s in screens:
        if s["type"] == "lyrics-fullsong":
            all_lines = s.get("allLines", [])
            targets = s.get("targetLineIndices", [])
            for idx in targets:
                if idx >= len(all_lines):
                    issues.append(f"FAIL: targetLineIndex {idx} out of range")
                elif all_lines[idx].strip() == "":
                    issues.append(f"FAIL: targetLineIndex {idx} points to empty line")

    # 13. Valid JSON structure
    if "id" not in lesson_data or "meta" not in lesson_data:
        issues.append("FAIL: missing id or meta")

    fails = [i for i in issues if i.startswith("FAIL")]
    return len(fails) == 0, issues


def generate_lesson(lesson_num, dry_run=False):
    """Generate a single lesson via the Anthropic API."""
    if lesson_num not in LESSON_CONFIG:
        print(f"Error: Lesson {lesson_num} not in config (valid: 1-20)")
        return False

    config = LESSON_CONFIG[lesson_num]
    unit = config["unit"]

    print(f"\n{'='*60}")
    print(f"Generating Lesson {lesson_num}: {config['artist']} — {config['songTitle']}")
    print(f"Grammar: {config['grammarFocus']} ({config['grammarMeaning']})")
    print(f"Unit: {unit}")
    print(f"{'='*60}\n")

    # Build prompt
    prompt = build_prompt(lesson_num)

    if dry_run:
        print(f"[DRY RUN] Prompt length: {len(prompt)} chars")
        print(f"[DRY RUN] Would call Anthropic API with claude-sonnet-4-20250514 or claude-sonnet-5-20260715")
        print(f"\n--- PROMPT PREVIEW (first 500 chars) ---")
        print(prompt[:500])
        print("...")
        return True

    # Call Anthropic API
    try:
        import anthropic
    except ImportError:
        print("Error: anthropic package not installed. Run: pip3 install anthropic")
        return False

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Try .env.local
        env_path = PROJECT_DIR / ".env.local"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    break

    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in environment or .env.local")
        return False

    client = anthropic.Anthropic(api_key=api_key)

    print("Calling Anthropic API (claude-sonnet-4-20250514)...")
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )

    # Extract JSON from response
    raw = response.content[0].text.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        start = 1
        end = len(lines) - 1
        if lines[-1].strip() == "```":
            raw = "\n".join(lines[start:end])
        else:
            raw = "\n".join(lines[start:])

    try:
        lesson_data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Error: API returned invalid JSON: {e}")
        print(f"Raw response (first 500 chars): {raw[:500]}")
        # Save raw for debugging
        debug_path = LESSONS_DIR / f"_debug_lesson{lesson_num}.txt"
        debug_path.write_text(raw, encoding="utf-8")
        print(f"Raw response saved to: {debug_path}")
        return False

    # Quality gate
    print("\nRunning quality gate...")
    passed, issues = quality_gate(lesson_data)

    for issue in issues:
        print(f"  {issue}")

    if not passed:
        print(f"\n❌ QUALITY GATE FAILED — {len([i for i in issues if i.startswith('FAIL')])} failures")
        # Save anyway for review
        debug_path = LESSONS_DIR / f"_debug_lesson{lesson_num}.json"
        debug_path.write_text(json.dumps(lesson_data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Failed output saved to: {debug_path}")
        return False

    # Save
    output_path = LESSONS_DIR / f"unit{unit}-lesson{lesson_num}.json"
    output_path.write_text(
        json.dumps(lesson_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\n✓ QUALITY GATE PASSED")
    print(f"Saved to: {output_path}")

    # Print summary
    types = [s["type"] for s in lesson_data["screens"]]
    quiz_count = types.count("quiz")
    print(f"Screens: {len(types)}, Quizzes: {quiz_count} ({quiz_count/len(types)*100:.0f}%)")

    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a V5 lesson via Anthropic API")
    parser.add_argument("lesson", type=int, help="Lesson number (1-20)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompt without calling API")
    args = parser.parse_args()

    success = generate_lesson(args.lesson, dry_run=args.dry_run)
    sys.exit(0 if success else 1)
