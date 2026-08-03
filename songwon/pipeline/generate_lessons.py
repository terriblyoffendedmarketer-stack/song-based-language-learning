# generate_lessons.py — Generates lesson seed data following SESSION_DESIGN.md V3
# Usage: python3 pipeline/generate_lessons.py
# Reads: pipeline/curriculum_map.json, pipeline/corpus_analysis.json,
#        pipeline/song_context/*.json, pipeline/lyrics/*.txt
# Writes: pipeline/lessons/*.json, pipeline/lesson_index.json
#
# V3 flow:
#   Intro 1 (music) → Intro 2 (music) → Korean Lyrics (music) →
#   English Translation (music stops) → Vocab Transition →
#   [Word Screen] × 3-4 words → [Quiz Screen] × N (one Q each) →
#   Pattern Spotlight → [Practice Screen] × N (one Q each) →
#   Sing Along (music) → Recap
#
# Gotchas:
# - ONE question per screen — exercises are individual sections, never batched
# - Word + meaning + sentence on the SAME screen
# - Intro is a rich English explainer, not a dry word list
# - Phrases preferred over individual words when available

import json
import os
import re
import hashlib
import random
from pathlib import Path

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM = os.path.join(PIPELINE_DIR, "curriculum_map.json")
CORPUS = os.path.join(PIPELINE_DIR, "corpus_analysis.json")
CONTEXT_DIR = os.path.join(PIPELINE_DIR, "song_context")
LYRICS_DIR = os.path.join(PIPELINE_DIR, "lyrics")
LESSONS_DIR = os.path.join(PIPELINE_DIR, "lessons")
INDEX_OUT = os.path.join(PIPELINE_DIR, "lesson_index.json")

KOREAN_RE = re.compile(r'[가-힣]')
FILLER_DISTRACTORS = ["사랑", "행복", "시간", "마음", "사람", "세상", "하늘", "바람"]


def make_id(text):
    return hashlib.md5(text.encode()).hexdigest()[:8]


def slugify(name):
    s = re.sub(r'[^a-z0-9\s]', '', name.lower())
    return re.sub(r'\s+', '-', s).strip('-')


def is_korean_line(line):
    return bool(KOREAN_RE.search(line))


def load_lyrics(safe_name):
    path = os.path.join(LYRICS_DIR, f"{safe_name}.txt")
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()
    return [l.strip() for l in lines if l.strip() and is_korean_line(l)]


def load_context(safe_name):
    path = os.path.join(CONTEXT_DIR, f"{safe_name}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def get_song_vocab(safe_name, corpus):
    return [v for v in corpus["vocabulary"] if safe_name in v.get("songs", [])]


def get_song_grammar(safe_name, corpus):
    return [g for g in corpus["grammar_patterns"] if safe_name in g.get("songs", [])]


def get_verse_sections(context):
    if not context:
        return {}
    return context.get("song_story", {}).get("the_lyrics", {})


def pick_session_lines(korean_lines, verse_sections, session_num=0):
    if verse_sections:
        verse_keys = list(verse_sections.keys())
        if session_num < len(verse_keys):
            key = verse_keys[session_num]
            lines_str = verse_sections[key].get("lines", "")
            parsed = [l.strip() for l in lines_str.split(" / ") if l.strip() and is_korean_line(l)]
            if parsed:
                return parsed[:4]
    start = session_num * 4
    return korean_lines[start:start + 4]


def get_translation_for_verse(verse_sections, verse_idx=0):
    keys = list(verse_sections.keys())
    if verse_idx < len(keys):
        return verse_sections[keys[verse_idx]].get("literal", "")
    return ""


def find_word_in_lines(word, lines):
    for line in lines:
        if word in line:
            return line
    return ""


def build_intro_text(artist, song_title, overview, themes, teaching_vocab, pattern_source, context_card):
    """Build a rich English intro that reads like a textbook chapter opening."""
    parts = []

    # Theme intro
    if themes:
        theme_str = " and ".join(themes[:2])
        parts.append(f"This lesson explores {theme_str} through {artist}'s \"{song_title}.\"")
    else:
        parts.append(f"In this lesson, we'll learn from {artist}'s \"{song_title}.\"")

    # Weave in song context
    if overview:
        # Take first 1-2 sentences of overview
        sentences = overview.split(". ")
        intro_sentences = ". ".join(sentences[:2])
        if not intro_sentences.endswith("."):
            intro_sentences += "."
        parts.append(intro_sentences)

    return " ".join(parts)


def build_intro_text_2(teaching_vocab, pattern_source, context_card):
    """Build the second intro screen — grammar + vocab preview."""
    parts = []

    # Grammar explanation
    if pattern_source:
        g = pattern_source[0]
        pattern = g["pattern"]
        meaning = g.get("meaning", g.get("usage", ""))
        parts.append(f"You'll learn the grammar pattern {pattern}, which means \"{meaning}.\"")

        examples = g.get("examples", [])
        if examples:
            ex = examples[0] if isinstance(examples[0], str) else str(examples[0])
            parts.append(f"Koreans use it all the time — for example, {ex}.")

    # Vocab/phrase preview
    if teaching_vocab:
        word_previews = []
        for v in teaching_vocab[:4]:
            word_previews.append(f"{v['word']} ({v.get('meaning', '')})")
        words_str = ", ".join(word_previews[:-1])
        if len(word_previews) > 1:
            words_str += f", and {word_previews[-1]}"
        else:
            words_str = word_previews[0]
        parts.append(f"We'll learn words like {words_str}.")

    # Context card snippet
    if context_card:
        sentences = context_card.split(". ")
        if sentences:
            parts.append(sentences[0] + ".")

    return " ".join(parts)


def map_level_name(level_num):
    return {1: "beginner", 2: "beginner", 3: "intermediate", 4: "intermediate", 5: "advanced"}[level_num]


def generate_lesson_for_song(song_entry, corpus, level_num):
    safe_name = song_entry["safe_name"]
    context = load_context(safe_name)
    if not context:
        return None

    korean_lines = load_lyrics(safe_name)
    if not korean_lines:
        return None

    song_slug = slugify(safe_name)
    artist = context.get("artist", "")
    song_title = context.get("song", "")
    song_story = context.get("song_story", {})
    overview = song_story.get("overview", "")
    verse_sections = song_story.get("the_lyrics", {})
    themes = context.get("themes", [])

    all_vocab = get_song_vocab(safe_name, corpus)
    all_grammar = get_song_grammar(safe_name, corpus)
    context_grammar = context.get("grammar_highlights", [])

    top_vocab = sorted(all_vocab, key=lambda v: (-v.get("frequency", 0), int(v.get("topik_level", 1))))[:8]

    session_lines = pick_session_lines(korean_lines, verse_sections, session_num=0)
    if not session_lines:
        session_lines = korean_lines[:4]

    # Filter vocab to words in session lines, then fill from top
    teaching_vocab = []
    for v in top_vocab:
        if any(v["word"] in line for line in session_lines):
            teaching_vocab.append(v)
        if len(teaching_vocab) >= 4:
            break
    if len(teaching_vocab) < 3:
        for v in top_vocab:
            if v not in teaching_vocab:
                teaching_vocab.append(v)
            if len(teaching_vocab) >= 3:
                break

    translation = get_translation_for_verse(verse_sections, 0)
    translation_lines = [t.strip() for t in translation.split(" / ") if t.strip()] if translation else []
    context_card = get_context_card(verse_sections, 0)

    pattern_source = context_grammar if context_grammar else all_grammar[:1]

    lesson_id = f"lesson-{song_slug}"
    sections = []
    s_idx = 0

    # ===== PHASE 1: INTRO + IMMERSION =====

    # Screen 1: Lesson Intro
    s_idx += 1
    intro_1 = build_intro_text(artist, song_title, overview, themes, teaching_vocab, pattern_source, context_card)
    sections.append({
        "id": f"s{s_idx}-intro",
        "type": "lesson-intro",
        "title": f"{artist} — {song_title}",
        "content": intro_1,
        "musicPlaying": True,
    })

    # Screen 2: Lesson Intro continued (grammar + vocab preview)
    s_idx += 1
    intro_2 = build_intro_text_2(teaching_vocab, pattern_source, context_card)
    sections.append({
        "id": f"s{s_idx}-intro2",
        "type": "lesson-intro",
        "title": "What you'll learn",
        "content": intro_2,
        "musicPlaying": True,
    })

    # Screen 3: Korean Lyrics
    s_idx += 1
    sections.append({
        "id": f"s{s_idx}-lyrics-kr",
        "type": "lyrics-korean",
        "title": "가사를 읽어 보세요",
        "content": "",
        "musicPlaying": True,
        "lyricLines": session_lines,
    })

    # Screen 4: English Translation (music STOPS)
    s_idx += 1
    sections.append({
        "id": f"s{s_idx}-lyrics-en",
        "type": "lyrics-translation",
        "title": "무슨 뜻일까요?",
        "content": "",
        "musicPlaying": False,
        "lyricLines": session_lines,
        "lyricTranslations": translation_lines[:len(session_lines)],
    })

    # ===== PHASE 2: VOCAB TEACHING =====

    # Screen 5: Vocab Transition
    s_idx += 1
    sections.append({
        "id": f"s{s_idx}-vocab-transition",
        "type": "vocab-transition",
        "title": "새로운 단어",
        "content": "",
        "musicPlaying": False,
        "previewWords": [
            {"korean": v["word"], "english": v.get("meaning", ""), "pos": v.get("pos", "")}
            for v in teaching_vocab[:4]
        ],
    })

    # Individual word screens (one per word, everything on one screen)
    for wi, v in enumerate(teaching_vocab[:4]):
        word = v["word"]
        meaning = v.get("meaning", "")
        pos = v.get("pos", "")
        song_line = find_word_in_lines(word, session_lines) or find_word_in_lines(word, korean_lines)

        # Find a simple example sentence
        example_sentence = None
        for g in all_grammar:
            for ex in g.get("examples", []):
                if isinstance(ex, str) and word in ex:
                    example_sentence = {"korean": ex, "english": ""}
                    break
            if example_sentence:
                break

        s_idx += 1
        sections.append({
            "id": f"s{s_idx}-word-{wi}",
            "type": "word-card",
            "title": "",
            "content": "",
            "musicPlaying": False,
            "autoSpeak": word,
            "wordData": {
                "word": {"korean": word, "english": meaning, "pos": pos, "topik": v.get("topik_level", 1)},
                "exampleSentence": example_sentence,
                "songLine": song_line,
            },
        })

    # ===== PHASE 3: QUIZZES (one question per screen) =====

    # Line Recall exercises — one per screen
    line_exercises = []
    for i, line in enumerate(session_lines[:3]):
        eng = translation_lines[i] if i < len(translation_lines) else ""
        if not eng:
            continue
        other_lines = [l for l in session_lines if l != line][:3]
        while len(other_lines) < 3:
            other_lines.append("...")
        options = [line] + other_lines[:3]
        random.seed(line + "recall")
        random.shuffle(options)
        line_exercises.append({
            "id": f"lr-{i}",
            "type": "comprehension",
            "prompt": eng,
            "options": options,
            "correctAnswer": line,
            "hint": "이 영어 뜻에 맞는 한국어 가사를 골라보세요"
        })

    # Fill-in-blank from lines
    for i, line in enumerate(session_lines[:2]):
        matched = [v for v in teaching_vocab if v["word"] in line]
        if not matched:
            continue
        blank_word = matched[0]["word"]
        blanked = line.replace(blank_word, "___", 1)
        if blanked == line:
            continue
        other_words = [v["word"] for v in teaching_vocab if v["word"] != blank_word][:3]
        while len(other_words) < 3:
            other_words.append(random.choice(FILLER_DISTRACTORS))
        options = [blank_word] + other_words[:3]
        random.seed(line + "blank")
        random.shuffle(options)
        line_exercises.append({
            "id": f"fb-{i}",
            "type": "fill-blank",
            "prompt": blanked,
            "options": options,
            "correctAnswer": blank_word,
        })

    # Each exercise gets its own section
    for ex in line_exercises[:4]:
        s_idx += 1
        sections.append({
            "id": f"s{s_idx}-quiz-{ex['id']}",
            "type": "quiz",
            "title": "가사 기억하기",
            "content": "",
            "musicPlaying": False,
            "exercises": [ex],
        })

    # Pattern Spotlight
    if pattern_source:
        s_idx += 1
        g = pattern_source[0]
        pattern = g["pattern"]
        meaning = g.get("meaning", g.get("usage", ""))

        pattern_stem = re.sub(r'^-', '', pattern).split('/')[0].strip()
        song_example_line = ""
        for line in session_lines + korean_lines:
            if pattern_stem in line:
                song_example_line = line
                break

        examples = g.get("examples", [])
        other_examples = []
        for ex in examples[:3]:
            if isinstance(ex, str):
                other_examples.append({"korean": ex, "english": ""})
            elif isinstance(ex, dict):
                other_examples.append({"korean": ex.get("korean", str(ex)), "english": ex.get("english", "")})

        sections.append({
            "id": f"s{s_idx}-pattern",
            "type": "pattern-spotlight",
            "title": "패턴을 찾아봐요",
            "content": meaning if isinstance(meaning, str) else str(meaning),
            "musicPlaying": False,
            "patternData": {
                "pattern": pattern,
                "meaning": meaning if isinstance(meaning, str) else str(meaning),
                "songExample": {"korean": song_example_line, "english": ""},
                "otherExamples": other_examples[:2],
            },
        })

    # Practice exercises — one per screen
    practice_exercises = []
    for v in teaching_vocab[:3]:
        word = v["word"]
        meaning = v.get("meaning", "")
        distractors = [item["word"] for item in teaching_vocab if item["word"] != word][:3]
        while len(distractors) < 3:
            distractors.append(random.choice(FILLER_DISTRACTORS))
        options = [word] + distractors[:3]
        random.seed(word + "practice")
        random.shuffle(options)
        practice_exercises.append({
            "id": f"pr-{make_id(word)}",
            "type": "fill-blank",
            "prompt": f"'{meaning}'의 한국어는?",
            "options": options,
            "correctAnswer": word,
        })

    if pattern_source:
        g = pattern_source[0]
        meaning = g.get("meaning", "")
        practice_exercises.append({
            "id": f"pr-grammar",
            "type": "comprehension",
            "prompt": f"'{g['pattern']}' 패턴은 어떤 의미예요?",
            "options": [
                meaning or f"{g['pattern']} pattern",
                "always / every time",
                "but / however",
                "because of that"
            ],
            "correctAnswer": meaning or f"{g['pattern']} pattern",
        })

    for ex in practice_exercises:
        s_idx += 1
        sections.append({
            "id": f"s{s_idx}-practice-{ex['id']}",
            "type": "quiz",
            "title": "연습해 봐요!",
            "content": "",
            "musicPlaying": False,
            "exercises": [ex],
        })

    # ===== PHASE 4: PAYOFF =====

    # Sing Along
    s_idx += 1
    singalong_lines = session_lines[:]
    for line in korean_lines:
        if line not in singalong_lines and len(singalong_lines) < 8:
            singalong_lines.append(line)

    sections.append({
        "id": f"s{s_idx}-singalong",
        "type": "sing-along",
        "title": "따라 불러 봐요!",
        "content": "",
        "musicPlaying": True,
        "lyricLines": singalong_lines,
    })

    # Recap
    s_idx += 1
    sections.append({
        "id": f"s{s_idx}-recap",
        "type": "recap",
        "title": "오늘 배운 것",
        "content": "",
        "musicPlaying": False,
        "recapData": {
            "wordsLearned": [
                {"korean": v["word"], "english": v.get("meaning", "")}
                for v in teaching_vocab[:4]
            ],
            "patternLearned": pattern_source[0]["pattern"] if pattern_source else None,
        },
    })

    xp = {1: 20, 2: 25, 3: 30, 4: 40, 5: 50}.get(level_num, 30)

    return {
        "id": lesson_id,
        "songId": song_slug,
        "level": map_level_name(level_num),
        "title": f"{song_title} — 수업",
        "sections": sections,
        "xpReward": xp,
        "generatedAt": "2026-08-03T00:00:00.000Z",
        "metadata": {
            "safe_name": safe_name,
            "artist": artist,
            "song": song_title,
            "curriculum_level": level_num,
        },
    }


def main():
    os.makedirs(LESSONS_DIR, exist_ok=True)

    with open(CURRICULUM, encoding='utf-8') as f:
        curriculum = json.load(f)
    with open(CORPUS, encoding='utf-8') as f:
        corpus = json.load(f)

    all_lessons = []
    index = {"levels": {}, "total_lessons": 0}

    for level_str in ["1", "2", "3", "4", "5"]:
        level_num = int(level_str)
        level_data = curriculum["levels"][level_str]
        songs = level_data["songs"]
        level_lessons = []

        for song in songs:
            lesson = generate_lesson_for_song(song, corpus, level_num)
            if lesson:
                filename = f"{slugify(song['safe_name'])}.json"
                filepath = os.path.join(LESSONS_DIR, filename)
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(lesson, f, ensure_ascii=False, indent=2)
                level_lessons.append({
                    "id": lesson["id"],
                    "file": f"lessons/{filename}",
                    "safe_name": song["safe_name"],
                    "title": lesson["title"],
                    "xpReward": lesson["xpReward"],
                    "sections_count": len(lesson["sections"]),
                })
                all_lessons.append(lesson)

        index["levels"][level_str] = {
            "name": level_data["name"],
            "lessons": level_lessons,
        }
        print(f"Level {level_str}: {len(level_lessons)} lessons generated")

    index["total_lessons"] = len(all_lessons)

    with open(INDEX_OUT, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\nTotal: {len(all_lessons)} lessons")
    print(f"Index: {INDEX_OUT}")
    print(f"Lessons: {LESSONS_DIR}/")


if __name__ == "__main__":
    main()
