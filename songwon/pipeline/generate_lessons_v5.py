# generate_lessons_v5.py — Generates V5 interleaved lessons from grammar-first curriculum
# Usage: python3 pipeline/generate_lessons_v5.py
# Reads: pipeline/CURRICULUM_PROGRESSION.md (parsed), pipeline/corpus_analysis.json,
#        pipeline/song_context/*.json, pipeline/lyrics/*.txt
# Writes: pipeline/lessons_v5/*.json, pipeline/lesson_index_v5.json
#
# V5 flow (SESSION_DESIGN.md V5):
#   Warm-up → Intro 1 (music) → Intro 2 (music) → Korean Lyrics (music) →
#   English Translation (music stops) →
#   [Interleaved: word/phrase card → quiz → context sentence → quiz → mix review] →
#   Pattern Spotlight → [grammar phrase teaching] →
#   Final Mix (5 quizzes) → Sing Along (music) → Recap
#
# Gotchas:
# - ONE question per screen — exercises are individual screens, never batched
# - Interleaved: teach 1 item, test it, context sentence, then next item
# - Korean immersion: labels/prompts in Korean, English only for definitions + explanations
# - Phrases over words: 2 words + 2 phrases per lesson
# - Grammar-first: each lesson = one grammar point, songs matched to it

import json
import os
import re
import hashlib
import random
from pathlib import Path

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(PIPELINE_DIR, "corpus_analysis.json")
CONTEXT_DIR = os.path.join(PIPELINE_DIR, "song_context")
LYRICS_DIR = os.path.join(PIPELINE_DIR, "lyrics")
LESSONS_DIR = os.path.join(PIPELINE_DIR, "lessons_v5")
INDEX_OUT = os.path.join(PIPELINE_DIR, "lesson_index_v5.json")

KOREAN_RE = re.compile(r'[가-힣]')

FILLER_WORDS = ["사랑", "행복", "시간", "마음", "사람", "세상", "하늘", "바람",
                "꽃", "별", "바다", "눈", "비", "길", "노래", "꿈"]


# ─── Curriculum definition (from CURRICULUM_PROGRESSION.md) ───

CURRICULUM = [
    {
        "unit": 1, "lesson": 1,
        "title": "And, And Then",
        "grammar": "-고", "grammar_meaning": "and / and then",
        "concept": "Connecting two actions or states. The simplest way to link ideas.",
        "vocab": [
            {"korean": "꿈", "english": "dream", "kind": "word", "pos": "noun"},
            {"korean": "사랑", "english": "love", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "웃고 울다", "english": "to laugh and cry", "kind": "phrase"},
            {"korean": "사랑하고 싶다", "english": "to want to love", "kind": "phrase"},
        ],
        "songs": ["10cm - Phonecert", "Sogyumo Acacia Band - Butterfly"],
        "primary_song": "10cm - Phonecert",
    },
    {
        "unit": 1, "lesson": 2,
        "title": "I Want To",
        "grammar": "-고 싶다", "grammar_meaning": "want to do",
        "concept": "Expressing desires. One of the first things you need in any language.",
        "vocab": [
            {"korean": "찾다", "english": "to find", "kind": "word", "pos": "verb"},
            {"korean": "사람", "english": "person", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "찾고 싶다", "english": "to want to find", "kind": "phrase"},
            {"korean": "말하고 싶다", "english": "to want to say", "kind": "phrase"},
        ],
        "songs": ["BTS - Save Me", "Gaho - 시작", "DAY6 - Shoot Me"],
        "primary_song": "Gaho - 시작",
    },
    {
        "unit": 1, "lesson": 3,
        "title": "Right Now",
        "grammar": "-고 있다", "grammar_meaning": "progressive / ongoing state",
        "concept": "Describing what's happening right now. \"I'm waiting\" vs \"I wait.\"",
        "vocab": [
            {"korean": "기다리다", "english": "to wait", "kind": "word", "pos": "verb"},
            {"korean": "떠나다", "english": "to leave", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "기다리고 있다", "english": "to be waiting", "kind": "phrase"},
            {"korean": "지키고 있다", "english": "to be protecting", "kind": "phrase"},
        ],
        "songs": ["Punch - Done For Me", "Punch - Stay With Me", "Red Velvet - Psycho"],
        "primary_song": "Punch - Stay With Me",
    },
    {
        "unit": 1, "lesson": 4,
        "title": "If...",
        "grammar": "-(으)면", "grammar_meaning": "if / when",
        "concept": "Conditional statements. \"If you smile, I'm happy.\"",
        "vocab": [
            {"korean": "괜찮다", "english": "to be okay", "kind": "word", "pos": "adjective"},
            {"korean": "하늘", "english": "sky", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "웃으면 괜찮다", "english": "if you smile, it's okay", "kind": "phrase"},
            {"korean": "시간이 지나면", "english": "if time passes", "kind": "phrase"},
        ],
        "songs": ["IVE - XOXZ", "MOMOLAND - BBoom BBoom", "Punch - Stay With Me"],
        "primary_song": "Punch - Stay With Me",
    },
    {
        "unit": 2, "lesson": 5,
        "title": "But",
        "grammar": "-지만", "grammar_meaning": "but, although",
        "concept": "Expressing contrast. \"I want to forget, but I can't.\"",
        "vocab": [
            {"korean": "아프다", "english": "to hurt", "kind": "word", "pos": "adjective"},
            {"korean": "마음", "english": "heart / mind", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "아프지만 괜찮다", "english": "it hurts but it's okay", "kind": "phrase"},
            {"korean": "슬프지만 웃다", "english": "to be sad but smile", "kind": "phrase"},
        ],
        "songs": ["DAY6 - You Were Beautiful", "10cm - Stalker", "MAMAMOO - Mr-Ambiguous"],
        "primary_song": "DAY6 - You Were Beautiful",
    },
    {
        "unit": 2, "lesson": 6,
        "title": "I Can't",
        "grammar": "-지 못하다", "grammar_meaning": "cannot do",
        "concept": "Inability. \"I can't stop thinking about you.\"",
        "vocab": [
            {"korean": "멈추다", "english": "to stop", "kind": "word", "pos": "verb"},
            {"korean": "잊다", "english": "to forget", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "멈추지 못하다", "english": "to be unable to stop", "kind": "phrase"},
            {"korean": "잊지 못하다", "english": "to be unable to forget", "kind": "phrase"},
        ],
        "songs": ["IU - Good Day", "LUCY - I Got U", "Ha Hyun Sang - Lighthouse"],
        "primary_song": "IU - Good Day",
    },
    {
        "unit": 2, "lesson": 7,
        "title": "Not / Don't",
        "grammar": "-지 않다", "grammar_meaning": "not, negation",
        "concept": "Standard negation. \"It doesn't change.\"",
        "vocab": [
            {"korean": "변하다", "english": "to change", "kind": "word", "pos": "verb"},
            {"korean": "끝", "english": "end", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "변하지 않다", "english": "to not change", "kind": "phrase"},
            {"korean": "끝나지 않다", "english": "to not end", "kind": "phrase"},
        ],
        "songs": ["TWICE - Likey", "Lim Jae Beum - 낙인", "Shin In Ryu - Undecided"],
        "primary_song": "TWICE - Likey",
    },
    {
        "unit": 2, "lesson": 8,
        "title": "Because",
        "grammar": "-아/어서", "grammar_meaning": "because / and then",
        "concept": "Giving reasons. \"Because I love you, I'll stay.\"",
        "vocab": [
            {"korean": "보다", "english": "to see", "kind": "word", "pos": "verb"},
            {"korean": "듣다", "english": "to hear", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "좋아해서", "english": "because I like (you)", "kind": "phrase"},
            {"korean": "보고 싶어서", "english": "because I miss (you)", "kind": "phrase"},
        ],
        "songs": ["Punch - Stay With Me", "YOUNGJOO - Smells"],
        "primary_song": "Punch - Stay With Me",
    },
    {
        "unit": 3, "lesson": 9,
        "title": "Please Do It",
        "grammar": "-아/어 줘", "grammar_meaning": "please do ~ for me",
        "concept": "Making requests. Essential for real conversation.",
        "vocab": [
            {"korean": "잡다", "english": "to hold / to grab", "kind": "word", "pos": "verb"},
            {"korean": "안다", "english": "to hug", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "잡아 줘", "english": "hold me (please)", "kind": "phrase"},
            {"korean": "안아 줘", "english": "hug me (please)", "kind": "phrase"},
        ],
        "songs": ["SHAUN - Way Back Home", "JO YURI - GLASSY", "BEN - Just Like a Dream"],
        "primary_song": "SHAUN - Way Back Home",
    },
    {
        "unit": 3, "lesson": 10,
        "title": "I Think...",
        "grammar": "-(으)ㄹ 것 같다", "grammar_meaning": "it seems like / I think",
        "concept": "Expressing opinions softly. Koreans use this constantly.",
        "vocab": [
            {"korean": "빛나다", "english": "to shine", "kind": "word", "pos": "verb"},
            {"korean": "울다", "english": "to cry", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "울 것 같다", "english": "I think I'll cry", "kind": "phrase"},
            {"korean": "좋아할 것 같다", "english": "I think (they'll) like it", "kind": "phrase"},
        ],
        "songs": ["IU - Through the Night(밤편지)", "BTS - Life Goes On", "MOMOLAND - BBoom BBoom"],
        "primary_song": "IU - Through the Night(밤편지)",
    },
    {
        "unit": 3, "lesson": 11,
        "title": "You Know...",
        "grammar": "-잖아", "grammar_meaning": "you know / isn't it / reminding",
        "concept": "Reminding someone of something they already know. Very casual and intimate.",
        "vocab": [
            {"korean": "알다", "english": "to know", "kind": "word", "pos": "verb"},
            {"korean": "보이다", "english": "to be seen", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "알잖아", "english": "you know, right?", "kind": "phrase"},
            {"korean": "보이잖아", "english": "you can see it, can't you?", "kind": "phrase"},
        ],
        "songs": ["BOL4 - Love story", "BTS - Save Me", "LUCY - I Got U", "10cm - Phonecert"],
        "primary_song": "BOL4 - Love story",
    },
    {
        "unit": 3, "lesson": 12,
        "title": "Background Info",
        "grammar": "-는데", "grammar_meaning": "background info / mild contrast",
        "concept": "Setting the scene before your main point. Extremely common in spoken Korean.",
        "vocab": [
            {"korean": "걷다", "english": "to walk", "kind": "word", "pos": "verb"},
            {"korean": "비", "english": "rain", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "비가 오는데", "english": "it's raining, and...", "kind": "phrase"},
            {"korean": "걷고 있는데", "english": "I was walking, and...", "kind": "phrase"},
        ],
        "songs": ["BOL4 - Some", "BEN - Just Like a Dream", "Lundi Blues - Fake"],
        "primary_song": "BOL4 - Some",
    },
    {
        "unit": 4, "lesson": 13,
        "title": "Even Though",
        "grammar": "-아/어도", "grammar_meaning": "even though, even if",
        "concept": "Concession. \"Even if you leave, I'll be okay.\"",
        "vocab": [
            {"korean": "사라지다", "english": "to disappear", "kind": "word", "pos": "verb"},
            {"korean": "곁", "english": "side (of a person)", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "사라져도", "english": "even if (you) disappear", "kind": "phrase"},
            {"korean": "아파도 괜찮다", "english": "even if it hurts, it's okay", "kind": "phrase"},
        ],
        "songs": ["BOL4 - Some", "BTS - FAKE LOVE", "Gaho - 시작", "DAVICHI - 그대니까요"],
        "primary_song": "BTS - FAKE LOVE",
    },
    {
        "unit": 4, "lesson": 14,
        "title": "Becoming",
        "grammar": "-아/어지다", "grammar_meaning": "to become a state",
        "concept": "Describing changes of state. \"It's getting colder.\" \"I'm becoming lonely.\"",
        "vocab": [
            {"korean": "멀어지다", "english": "to grow distant", "kind": "word", "pos": "verb"},
            {"korean": "슬프다", "english": "to be sad", "kind": "word", "pos": "adjective"},
        ],
        "phrases": [
            {"korean": "멀어지고 있다", "english": "to be growing distant", "kind": "phrase"},
            {"korean": "슬퍼지다", "english": "to become sad", "kind": "phrase"},
        ],
        "songs": ["10cm - My Eyes", "BTS - FAKE LOVE", "DAY6 - You Were Beautiful"],
        "primary_song": "DAY6 - You Were Beautiful",
    },
    {
        "unit": 4, "lesson": 15,
        "title": "Like, As If",
        "grammar": "-처럼", "grammar_meaning": "like, as",
        "concept": "Comparisons. \"Like a dream.\" \"Like a star.\"",
        "vocab": [
            {"korean": "별", "english": "star", "kind": "word", "pos": "noun"},
            {"korean": "꽃", "english": "flower", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "꿈처럼", "english": "like a dream", "kind": "phrase"},
            {"korean": "별처럼 빛나다", "english": "to shine like a star", "kind": "phrase"},
        ],
        "songs": ["BEN - Just Like a Dream", "Gaho - 시작", "Girls' Generation - Lion Heart"],
        "primary_song": "BEN - Just Like a Dream",
    },
    {
        "unit": 4, "lesson": 16,
        "title": "Ending Up",
        "grammar": "-게 되다", "grammar_meaning": "to end up ~ing",
        "concept": "Things that happen gradually or beyond your control. \"I ended up loving you.\"",
        "vocab": [
            {"korean": "목소리", "english": "voice", "kind": "word", "pos": "noun"},
            {"korean": "보이다", "english": "to be seen", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "목소리가 들리다", "english": "a voice can be heard", "kind": "phrase"},
            {"korean": "좋아하게 되다", "english": "to end up liking", "kind": "phrase"},
        ],
        "songs": ["10cm - My Eyes", "BTS - FAKE LOVE", "MOMOLAND - BBoom BBoom"],
        "primary_song": "10cm - My Eyes",
    },
    {
        "unit": 5, "lesson": 17,
        "title": "Completely Done",
        "grammar": "-아/어 버리다", "grammar_meaning": "to do completely / with finality",
        "concept": "Something done completely, often with \"dammit, it happened.\"",
        "vocab": [
            {"korean": "지우다", "english": "to erase", "kind": "word", "pos": "verb"},
            {"korean": "떠나다", "english": "to leave", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "잊어 버리다", "english": "to completely forget", "kind": "phrase"},
            {"korean": "떠나 버리다", "english": "to leave for good", "kind": "phrase"},
        ],
        "songs": ["BTS - FAKE LOVE", "10cm - My Eyes"],
        "primary_song": "BTS - FAKE LOVE",
    },
    {
        "unit": 5, "lesson": 18,
        "title": "Before Doing",
        "grammar": "-기 전에", "grammar_meaning": "before doing",
        "concept": "Time sequencing. \"Before you leave.\"",
        "vocab": [
            {"korean": "시작하다", "english": "to start", "kind": "word", "pos": "verb"},
            {"korean": "끝나다", "english": "to end", "kind": "word", "pos": "verb"},
        ],
        "phrases": [
            {"korean": "떠나기 전에", "english": "before leaving", "kind": "phrase"},
            {"korean": "시작하기 전에", "english": "before starting", "kind": "phrase"},
        ],
        "songs": ["Gaho - 시작", "IU - Through the Night(밤편지)"],
        "primary_song": "Gaho - 시작",
    },
    {
        "unit": 5, "lesson": 19,
        "title": "Even While",
        "grammar": "-다가도", "grammar_meaning": "even while in the middle of",
        "concept": "Contradictory simultaneous states. \"Even while laughing, I cry.\"",
        "vocab": [
            {"korean": "생각하다", "english": "to think", "kind": "word", "pos": "verb"},
            {"korean": "혼자", "english": "alone", "kind": "word", "pos": "adverb"},
        ],
        "phrases": [
            {"korean": "웃다가도 울다", "english": "to cry even while laughing", "kind": "phrase"},
            {"korean": "생각하다가도", "english": "even while thinking", "kind": "phrase"},
        ],
        "songs": ["DAY6 - You Were Beautiful", "BTS - FAKE LOVE"],
        "primary_song": "DAY6 - You Were Beautiful",
    },
    {
        "unit": 5, "lesson": 20,
        "title": "The Past",
        "grammar": "-던", "grammar_meaning": "past retrospective modifier",
        "concept": "Describing things as they were. \"The street we used to walk.\"",
        "vocab": [
            {"korean": "추억", "english": "memory / nostalgia", "kind": "word", "pos": "noun"},
            {"korean": "향기", "english": "scent / fragrance", "kind": "word", "pos": "noun"},
        ],
        "phrases": [
            {"korean": "걷던 길", "english": "the road we used to walk", "kind": "phrase"},
            {"korean": "사랑하던 사람", "english": "the person I used to love", "kind": "phrase"},
        ],
        "songs": ["DAY6 - You Were Beautiful", "10cm - Stalker"],
        "primary_song": "DAY6 - You Were Beautiful",
    },
]


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


def find_word_in_lines(word, lines):
    for line in lines:
        if word in line:
            return line
    return ""


def find_grammar_in_lines(pattern, lines):
    stem = re.sub(r'^-', '', pattern).split('/')[0].strip()
    for line in lines:
        if stem in line:
            return line
    return ""


def get_distractors(correct, all_options, count=3):
    pool = [w for w in all_options if w != correct]
    if len(pool) < count:
        extras = [w for w in FILLER_WORDS if w != correct and w not in pool]
        pool.extend(extras)
    random.shuffle(pool)
    return pool[:count]


def shuffle_options(options, seed_str):
    random.seed(seed_str)
    shuffled = options[:]
    random.shuffle(shuffled)
    return shuffled


def make_options(correct_text, distractors, seed_str):
    opts = [{"text": correct_text, "correct": True}]
    for d in distractors[:3]:
        opts.append({"text": d, "correct": False})
    random.seed(seed_str)
    random.shuffle(opts)
    return opts


# ─── Screen builders ───

def screen_warmup(lesson_num, prev_lesson):
    """Build warm-up quiz from previous lesson, or curiosity hook for lesson 1."""
    if lesson_num == 1 or not prev_lesson:
        return {
            "id": "s1-warmup",
            "type": "warmup",
            "label": "시작 퀴즈",
            "quiz": {
                "type": "tap-meaning",
                "prompt": "꿈",
                "promptTranslation": None,
                "options": make_options("dream", ["star", "road", "night"], "warmup-1"),
                "wrongExplanation": "꿈 = dream. 곧 배울 거예요!",
            },
            "scored": False,
        }

    prev_word = prev_lesson["vocab"][0]
    return {
        "id": "s1-warmup",
        "type": "warmup",
        "label": "복습",
        "quiz": {
            "type": "tap-meaning",
            "prompt": prev_word["korean"],
            "promptTranslation": "지난 시간에 배운 거예요!",
            "options": make_options(
                prev_word["english"],
                get_distractors(prev_word["english"],
                                ["dream", "love", "star", "road", "night", "sky", "rain", "heart"]),
                f"warmup-{lesson_num}"
            ),
            "wrongExplanation": f"{prev_word['korean']} = {prev_word['english']}.",
        },
        "scored": False,
    }


def screen_intro(lesson_data, context, idx):
    """Build intro screens (2 total). Rich English with bold Korean anchors."""
    artist = context.get("artist", lesson_data["primary_song"].split(" - ")[0]) if context else lesson_data["primary_song"].split(" - ")[0]
    song_title = context.get("song", lesson_data["primary_song"].split(" - ", 1)[1]) if context else lesson_data["primary_song"].split(" - ", 1)[1]
    overview = context.get("song_story", {}).get("overview", "") if context else ""
    grammar = lesson_data["grammar"]
    grammar_meaning = lesson_data["grammar_meaning"]
    concept = lesson_data["concept"]

    if idx == 0:
        parts = []
        parts.append(f"{concept}")
        if overview:
            sentences = overview.split(". ")
            parts.append(". ".join(sentences[:2]) + ("." if not sentences[1].endswith(".") else ""))
        parts.append(f"In this lesson, you'll learn the grammar pattern **{grammar}**, "
                     f"which means \"{grammar_meaning}.\" "
                     f"We'll see how {artist} uses it in \"{song_title}.\"")
        content = "\n\n".join(parts)
        return {
            "id": f"s{2+idx}-intro",
            "type": "intro",
            "label": None,
            "title": f"{artist} — {song_title}",
            "content": content,
            "musicPlaying": True,
        }
    else:
        items = lesson_data["vocab"] + lesson_data["phrases"]
        word_list = "\n".join(f"- **{item['korean']}** — {item['english']}" for item in items)
        content = (f"이번 레슨에서 배울 단어:\n{word_list}\n\n"
                   f"레슨이 끝나면, 이 노래의 가사를 이해할 수 있어요.")
        return {
            "id": f"s{2+idx}-intro",
            "type": "intro",
            "label": None,
            "title": "이번에 배울 것",
            "content": content,
            "musicPlaying": True,
        }


def screen_lyrics_korean(lines, screen_num):
    return {
        "id": f"s{screen_num}-lyrics-kr",
        "type": "lyrics-korean",
        "label": "들어 보세요",
        "lines": lines,
        "musicPlaying": True,
    }


def screen_lyrics_english(lines, translations, highlights, screen_num):
    song_lines = []
    for i, line in enumerate(lines):
        eng = translations[i] if i < len(translations) else ""
        line_highlights = [h for h in highlights if h in line]
        song_lines.append({
            "korean": line,
            "english": eng,
            "highlights": line_highlights,
        })
    return {
        "id": f"s{screen_num}-lyrics-en",
        "type": "lyrics-english",
        "label": "번역",
        "lines": song_lines,
        "musicPlaying": False,
    }


def screen_word_card(item, song_line, screen_num):
    return {
        "id": f"s{screen_num}-teach",
        "type": "word-card",
        "label": "새 단어",
        "item": {
            "korean": item["korean"],
            "english": item["english"],
            "kind": item["kind"],
            "partOfSpeech": item.get("pos", ""),
            "songLine": {
                "korean": song_line,
                "english": "",
                "highlights": [item["korean"]],
            },
            "audioKey": item["korean"],
        },
    }


def screen_phrase_card(item, song_line, screen_num, phrase_note=None, grammar_note=None):
    return {
        "id": f"s{screen_num}-teach",
        "type": "phrase-card",
        "label": "새 표현",
        "item": {
            "korean": item["korean"],
            "english": item["english"],
            "kind": "phrase",
            "phraseNote": phrase_note or f"이 표현을 통째로 외우세요 — 한국 사람들이 자주 쓰는 표현이에요.",
            "grammarNote": grammar_note,
            "songLine": {
                "korean": song_line,
                "english": "",
                "highlights": [item["korean"]],
            },
            "audioKey": item["korean"],
        },
    }


def screen_quiz(quiz_data, screen_num, item_index=None):
    return {
        "id": f"s{screen_num}-quiz",
        "type": "quiz",
        "label": "퀴즈",
        "quiz": quiz_data,
        "scored": True,
        "itemIndex": item_index,
    }


def screen_context_sentence(sentence_data, screen_num):
    return {
        "id": f"s{screen_num}-context",
        "type": "context-sentence",
        "label": "문장 연습",
        "sentence": sentence_data,
    }


def screen_pair_context(sentences, note, screen_num):
    return {
        "id": f"s{screen_num}-pair",
        "type": "pair-context",
        "label": "비교해 보세요",
        "sentences": sentences,
        "note": note,
    }


def screen_pattern_spotlight(lesson_data, song_lines, screen_num):
    grammar = lesson_data["grammar"]
    grammar_meaning = lesson_data["grammar_meaning"]
    concept = lesson_data["concept"]
    example_line = find_grammar_in_lines(grammar, song_lines)

    return {
        "id": f"s{screen_num}-pattern",
        "type": "pattern-spotlight",
        "label": "패턴을 찾아봐요",
        "spotlight": {
            "pattern": grammar,
            "meaning": grammar_meaning,
            "explanation": concept,
            "songExample": {
                "korean": example_line,
                "english": "",
                "highlights": [grammar.lstrip("-")],
            },
            "examples": [],
        },
    }


def screen_sing_along(lines, highlights, screen_num):
    song_lines = []
    for line in lines:
        line_highlights = [h for h in highlights if h in line]
        song_lines.append({
            "korean": line,
            "english": "",
            "highlights": line_highlights,
        })
    return {
        "id": f"s{screen_num}-singalong",
        "type": "sing-along",
        "label": "노래",
        "lines": song_lines,
        "musicPlaying": True,
    }


def screen_recap(lesson_data, total_quiz_screens, screen_num):
    items = []
    for item in lesson_data["vocab"] + lesson_data["phrases"]:
        items.append({
            "korean": item["korean"],
            "english": item["english"],
            "kind": item["kind"],
            "partOfSpeech": item.get("pos", ""),
            "songLine": {"korean": "", "english": "", "highlights": []},
        })
    return {
        "id": f"s{screen_num}-recap",
        "type": "recap",
        "label": "결과",
        "items": items,
        "pattern": {
            "pattern": lesson_data["grammar"],
            "meaning": lesson_data["grammar_meaning"],
        },
        "xpReward": 25,
        "passThreshold": 0.8,
        "totalQuizScreens": total_quiz_screens,
    }


# ─── Context sentence generators ───

SIMPLE_CONTEXT_SENTENCES = {
    # Words
    "꿈": {"korean": "좋은 꿈 꿨어요.", "english": "I had a nice dream.", "highlights": ["꿈"]},
    "사랑": {"korean": "사랑은 아름다워요.", "english": "Love is beautiful.", "highlights": ["사랑"]},
    "찾다": {"korean": "열쇠를 찾고 있어요.", "english": "I'm looking for my keys.", "highlights": ["찾고"]},
    "사람": {"korean": "좋은 사람이에요.", "english": "They're a good person.", "highlights": ["사람"]},
    "기다리다": {"korean": "친구를 기다려요.", "english": "I'm waiting for a friend.", "highlights": ["기다려요"]},
    "떠나다": {"korean": "내일 떠나요.", "english": "I'm leaving tomorrow.", "highlights": ["떠나요"]},
    "괜찮다": {"korean": "괜찮아요.", "english": "It's okay.", "highlights": ["괜찮아요"]},
    "하늘": {"korean": "하늘이 예뻐요.", "english": "The sky is pretty.", "highlights": ["하늘"]},
    "아프다": {"korean": "머리가 아파요.", "english": "My head hurts.", "highlights": ["아파요"]},
    "마음": {"korean": "마음이 따뜻해요.", "english": "My heart is warm.", "highlights": ["마음"]},
    "멈추다": {"korean": "비가 멈췄어요.", "english": "The rain stopped.", "highlights": ["멈췄어요"]},
    "잊다": {"korean": "이름을 잊었어요.", "english": "I forgot the name.", "highlights": ["잊었어요"]},
    "변하다": {"korean": "계절이 변해요.", "english": "The seasons change.", "highlights": ["변해요"]},
    "끝": {"korean": "끝까지 가요.", "english": "Let's go to the end.", "highlights": ["끝"]},
    "보다": {"korean": "영화를 봐요.", "english": "I watch a movie.", "highlights": ["봐요"]},
    "듣다": {"korean": "노래를 들어요.", "english": "I listen to a song.", "highlights": ["들어요"]},
    "잡다": {"korean": "손을 잡아요.", "english": "I hold your hand.", "highlights": ["잡아요"]},
    "안다": {"korean": "아이를 안아요.", "english": "I hug the child.", "highlights": ["안아요"]},
    "빛나다": {"korean": "별이 빛나요.", "english": "The stars shine.", "highlights": ["빛나요"]},
    "울다": {"korean": "아기가 울어요.", "english": "The baby is crying.", "highlights": ["울어요"]},
    "알다": {"korean": "잘 알아요.", "english": "I know well.", "highlights": ["알아요"]},
    "보이다": {"korean": "바다가 보여요.", "english": "The ocean can be seen.", "highlights": ["보여요"]},
    "걷다": {"korean": "공원에서 걸어요.", "english": "I walk in the park.", "highlights": ["걸어요"]},
    "비": {"korean": "비가 와요.", "english": "It's raining.", "highlights": ["비"]},
    "사라지다": {"korean": "소리가 사라졌어요.", "english": "The sound disappeared.", "highlights": ["사라졌어요"]},
    "곁": {"korean": "내 곁에 있어요.", "english": "You're by my side.", "highlights": ["곁"]},
    "멀어지다": {"korean": "점점 멀어져요.", "english": "It's gradually getting farther.", "highlights": ["멀어져요"]},
    "슬프다": {"korean": "영화가 슬퍼요.", "english": "The movie is sad.", "highlights": ["슬퍼요"]},
    "별": {"korean": "별이 많아요.", "english": "There are many stars.", "highlights": ["별"]},
    "꽃": {"korean": "꽃이 예뻐요.", "english": "The flowers are pretty.", "highlights": ["꽃"]},
    "목소리": {"korean": "엄마 목소리가 좋아요.", "english": "Mom's voice is nice.", "highlights": ["목소리"]},
    "지우다": {"korean": "글씨를 지웠어요.", "english": "I erased the writing.", "highlights": ["지웠어요"]},
    "시작하다": {"korean": "수업이 시작해요.", "english": "Class is starting.", "highlights": ["시작해요"]},
    "끝나다": {"korean": "영화가 끝났어요.", "english": "The movie ended.", "highlights": ["끝났어요"]},
    "생각하다": {"korean": "자주 생각해요.", "english": "I think about it often.", "highlights": ["생각해요"]},
    "혼자": {"korean": "혼자 걸어요.", "english": "I walk alone.", "highlights": ["혼자"]},
    "추억": {"korean": "좋은 추억이에요.", "english": "It's a good memory.", "highlights": ["추억"]},
    "향기": {"korean": "꽃 향기가 좋아요.", "english": "The flower's scent is nice.", "highlights": ["향기"]},
    # Phrases
    "웃고 울다": {"korean": "웃고 울었어요.", "english": "I laughed and cried.", "highlights": ["웃고 울"]},
    "사랑하고 싶다": {"korean": "사랑하고 싶어요.", "english": "I want to love.", "highlights": ["사랑하고 싶"]},
    "찾고 싶다": {"korean": "너를 찾고 싶어요.", "english": "I want to find you.", "highlights": ["찾고 싶"]},
    "말하고 싶다": {"korean": "말하고 싶은 게 있어요.", "english": "There's something I want to say.", "highlights": ["말하고 싶"]},
    "기다리고 있다": {"korean": "아직 기다리고 있어요.", "english": "I'm still waiting.", "highlights": ["기다리고 있"]},
    "지키고 있다": {"korean": "약속을 지키고 있어요.", "english": "I'm keeping my promise.", "highlights": ["지키고 있"]},
    "웃으면 괜찮다": {"korean": "웃으면 괜찮아요.", "english": "If you smile, it's okay.", "highlights": ["웃으면", "괜찮"]},
    "시간이 지나면": {"korean": "시간이 지나면 괜찮아질 거예요.", "english": "If time passes, it'll be okay.", "highlights": ["시간이 지나면"]},
    "아프지만 괜찮다": {"korean": "아프지만 괜찮아요.", "english": "It hurts but it's okay.", "highlights": ["아프지만", "괜찮"]},
    "슬프지만 웃다": {"korean": "슬프지만 웃어요.", "english": "I'm sad but I smile.", "highlights": ["슬프지만", "웃"]},
    "멈추지 못하다": {"korean": "멈추지 못해요.", "english": "I can't stop.", "highlights": ["멈추지 못"]},
    "잊지 못하다": {"korean": "잊지 못해요.", "english": "I can't forget.", "highlights": ["잊지 못"]},
    "변하지 않다": {"korean": "마음은 변하지 않아요.", "english": "My feelings don't change.", "highlights": ["변하지 않"]},
    "끝나지 않다": {"korean": "이야기가 끝나지 않아요.", "english": "The story doesn't end.", "highlights": ["끝나지 않"]},
    "좋아해서": {"korean": "좋아해서 말 못 해요.", "english": "Because I like you, I can't say it.", "highlights": ["좋아해서"]},
    "보고 싶어서": {"korean": "보고 싶어서 전화했어요.", "english": "I called because I missed you.", "highlights": ["보고 싶어서"]},
    "잡아 줘": {"korean": "손 잡아 줘.", "english": "Hold my hand (please).", "highlights": ["잡아 줘"]},
    "안아 줘": {"korean": "안아 줘.", "english": "Hug me (please).", "highlights": ["안아 줘"]},
    "울 것 같다": {"korean": "울 것 같아요.", "english": "I think I'll cry.", "highlights": ["울 것 같"]},
    "좋아할 것 같다": {"korean": "좋아할 것 같아요.", "english": "I think they'll like it.", "highlights": ["좋아할 것 같"]},
    "알잖아": {"korean": "너도 알잖아.", "english": "You know too, right?", "highlights": ["알잖아"]},
    "보이잖아": {"korean": "다 보이잖아.", "english": "You can see everything, can't you?", "highlights": ["보이잖아"]},
    "비가 오는데": {"korean": "비가 오는데 우산이 없어요.", "english": "It's raining and I don't have an umbrella.", "highlights": ["비가 오는데"]},
    "걷고 있는데": {"korean": "걷고 있는데 비가 왔어요.", "english": "I was walking and it started to rain.", "highlights": ["걷고 있는데"]},
    "사라져도": {"korean": "사라져도 기억할 거예요.", "english": "Even if you disappear, I'll remember.", "highlights": ["사라져도"]},
    "아파도 괜찮다": {"korean": "아파도 괜찮아요.", "english": "Even if it hurts, it's okay.", "highlights": ["아파도", "괜찮"]},
    "멀어지고 있다": {"korean": "점점 멀어지고 있어요.", "english": "We're gradually growing apart.", "highlights": ["멀어지고 있"]},
    "슬퍼지다": {"korean": "갑자기 슬퍼졌어요.", "english": "I suddenly became sad.", "highlights": ["슬퍼졌"]},
    "꿈처럼": {"korean": "꿈처럼 느껴져요.", "english": "It feels like a dream.", "highlights": ["꿈처럼"]},
    "별처럼 빛나다": {"korean": "별처럼 빛나요.", "english": "You shine like a star.", "highlights": ["별처럼 빛나"]},
    "목소리가 들리다": {"korean": "친구 목소리가 들려요.", "english": "I can hear my friend's voice.", "highlights": ["목소리가 들려"]},
    "좋아하게 되다": {"korean": "한국 음식을 좋아하게 됐어요.", "english": "I ended up liking Korean food.", "highlights": ["좋아하게 됐"]},
    "잊어 버리다": {"korean": "다 잊어 버렸어요.", "english": "I completely forgot everything.", "highlights": ["잊어 버"]},
    "떠나 버리다": {"korean": "떠나 버렸어요.", "english": "They left for good.", "highlights": ["떠나 버"]},
    "떠나기 전에": {"korean": "떠나기 전에 말해 줘.", "english": "Tell me before you leave.", "highlights": ["떠나기 전에"]},
    "시작하기 전에": {"korean": "시작하기 전에 준비하세요.", "english": "Prepare before starting.", "highlights": ["시작하기 전에"]},
    "웃다가도 울다": {"korean": "웃다가도 울어요.", "english": "I cry even while laughing.", "highlights": ["웃다가도 울"]},
    "생각하다가도": {"korean": "생각하다가도 잊어요.", "english": "Even while thinking about it, I forget.", "highlights": ["생각하다가도"]},
    "걷던 길": {"korean": "같이 걷던 길이에요.", "english": "It's the road we used to walk together.", "highlights": ["걷던 길"]},
    "사랑하던 사람": {"korean": "사랑하던 사람이 떠났어요.", "english": "The person I used to love left.", "highlights": ["사랑하던 사람"]},
}


def get_context_sentence(key):
    """Look up a context sentence by exact key (word or full phrase)."""
    if key in SIMPLE_CONTEXT_SENTENCES:
        return SIMPLE_CONTEXT_SENTENCES[key]
    # Try first word as fallback for unknown phrases
    first_word = key.split()[0] if " " in key else key
    if first_word in SIMPLE_CONTEXT_SENTENCES:
        return SIMPLE_CONTEXT_SENTENCES[first_word]
    return {
        "korean": f"{key} 좋아요.",
        "english": f"{key} is nice.",
        "highlights": [key],
    }


# ─── Main lesson generation ───

def generate_lesson(lesson_data, prev_lesson, corpus):
    screens = []
    s_num = 0
    quiz_count = 0
    all_items = lesson_data["vocab"] + lesson_data["phrases"]
    all_korean_words = [item["korean"] for item in all_items]
    highlight_words = all_korean_words[:]

    # Load song data
    primary_song = lesson_data["primary_song"]
    context = load_context(primary_song)
    primary_lyrics = load_lyrics(primary_song)

    all_song_lyrics = {}
    for song_name in lesson_data["songs"]:
        all_song_lyrics[song_name] = load_lyrics(song_name)

    # Pick session lines (first 4 Korean lines from primary song)
    session_lines = primary_lyrics[:4] if primary_lyrics else []

    # Get translations from context
    translations = []
    if context:
        verse_sections = context.get("song_story", {}).get("the_lyrics", {})
        if verse_sections:
            first_key = list(verse_sections.keys())[0]
            literal = verse_sections[first_key].get("literal", "")
            translations = [t.strip() for t in literal.split(" / ") if t.strip()]

    # Find song lines containing each teaching item
    item_song_lines = {}
    for item in all_items:
        word = item["korean"]
        line = find_word_in_lines(word, primary_lyrics)
        if not line:
            for song_name, lyrics in all_song_lyrics.items():
                line = find_word_in_lines(word, lyrics)
                if line:
                    break
        item_song_lines[word] = line or ""

    # ── Screen 1: Warm-up ──
    s_num += 1
    screens.append(screen_warmup(lesson_data["lesson"], prev_lesson))

    # ── Screens 2-3: Intro ──
    for i in range(2):
        s_num += 1
        screens.append(screen_intro(lesson_data, context, i))

    # ── Screen 4: Korean Lyrics ──
    s_num += 1
    screens.append(screen_lyrics_korean(session_lines, s_num))

    # ── Screen 5: English Translation ──
    s_num += 1
    screens.append(screen_lyrics_english(session_lines, translations, highlight_words, s_num))

    # ── INTERLEAVED TEACHING ──

    words = lesson_data["vocab"]
    phrases = lesson_data["phrases"]

    # ITEM 1 (word): teach → quiz meaning → context → quiz in context
    item1 = words[0]
    s_num += 1
    screens.append(screen_word_card(item1, item_song_lines.get(item1["korean"], ""), s_num))

    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "tap-meaning",
        "prompt": item1["korean"],
        "promptTranslation": "무슨 뜻일까요?",
        "options": make_options(
            item1["english"],
            get_distractors(item1["english"], [i["english"] for i in all_items] + ["dream", "star", "night"]),
            f"q1-{item1['korean']}"
        ),
        "wrongExplanation": f"{item1['korean']} = {item1['english']}",
    }, s_num, 0))

    ctx1 = get_context_sentence(item1["korean"])
    s_num += 1
    screens.append(screen_context_sentence(ctx1, s_num))

    s_num += 1
    quiz_count += 1
    ctx1_blanked = ctx1["korean"].replace(ctx1["highlights"][0], "___", 1)
    screens.append(screen_quiz({
        "type": "fill-blank",
        "prompt": ctx1_blanked,
        "promptTranslation": ctx1["english"],
        "options": make_options(
            ctx1["highlights"][0],
            get_distractors(ctx1["highlights"][0], all_korean_words + FILLER_WORDS[:4]),
            f"q2-{item1['korean']}"
        ),
        "wrongExplanation": f"{ctx1['korean']} = {ctx1['english']}",
    }, s_num, 0))

    # ITEM 2 (phrase): teach → quiz meaning → context → quiz fill → mix review → song comprehension
    item2 = phrases[0]
    s_num += 1
    screens.append(screen_phrase_card(item2, item_song_lines.get(item2["korean"], ""), s_num))

    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "tap-meaning",
        "prompt": item2["korean"],
        "promptTranslation": "무슨 뜻일까요?",
        "options": make_options(
            item2["english"],
            get_distractors(item2["english"],
                            [i["english"] for i in all_items] + ["to disappear", "to be loud", "to be beautiful"]),
            f"q3-{item2['korean']}"
        ),
        "wrongExplanation": f"{item2['korean']} = {item2['english']}",
    }, s_num, 1))

    ctx2 = get_context_sentence(item2["korean"])
    s_num += 1
    screens.append(screen_context_sentence(ctx2, s_num))

    s_num += 1
    quiz_count += 1
    ctx2_word = ctx2["highlights"][0]
    ctx2_blanked = ctx2["korean"].replace(ctx2_word, "___", 1)
    screens.append(screen_quiz({
        "type": "fill-blank",
        "prompt": ctx2_blanked,
        "promptTranslation": ctx2["english"],
        "options": make_options(
            ctx2_word,
            get_distractors(ctx2_word, all_korean_words + FILLER_WORDS[:4]),
            f"q4-{item2['korean']}"
        ),
        "wrongExplanation": f"{ctx2['korean']} = {ctx2['english']}",
    }, s_num, 1))

    # Mix review: recall item 1 in song line
    song_line_1 = item_song_lines.get(item1["korean"], "")
    if song_line_1:
        s_num += 1
        quiz_count += 1
        blanked_song = song_line_1.replace(item1["korean"], "___", 1)
        screens.append(screen_quiz({
            "type": "fill-blank-song",
            "prompt": blanked_song,
            "promptTranslation": "노래를 완성하세요",
            "options": make_options(
                item1["korean"],
                get_distractors(item1["korean"], all_korean_words + FILLER_WORDS[:4]),
                f"q5-mix-{item1['korean']}"
            ),
            "wrongExplanation": f"{song_line_1}",
        }, s_num, 0))
        screens[-1]["label"] = "복습 퀴즈"

    # Song line comprehension
    if session_lines and translations:
        s_num += 1
        quiz_count += 1
        comp_line = session_lines[0] if session_lines else ""
        comp_trans = translations[0] if translations else ""
        other_trans = translations[1:3] + ["Everything sounds different", "I can hear other things too"]
        screens.append(screen_quiz({
            "type": "song-comprehension",
            "prompt": comp_line,
            "promptTranslation": "무슨 뜻일까요?",
            "options": make_options(comp_trans, other_trans[:3], f"q6-comp"),
            "wrongExplanation": f"{comp_line} = {comp_trans}",
        }, s_num))
        screens[-1]["label"] = "가사 퀴즈"

    # ITEM 3 (word): teach → quiz → context → distinguish → pair context → line recall
    item3 = words[1] if len(words) > 1 else words[0]
    s_num += 1
    screens.append(screen_word_card(item3, item_song_lines.get(item3["korean"], ""), s_num))

    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "tap-meaning",
        "prompt": item3["korean"],
        "promptTranslation": "무슨 뜻일까요?",
        "options": make_options(
            item3["english"],
            get_distractors(item3["english"], [i["english"] for i in all_items] + ["to hide", "to find"]),
            f"q7-{item3['korean']}"
        ),
        "wrongExplanation": f"{item3['korean']} = {item3['english']}",
    }, s_num, 2))

    ctx3 = get_context_sentence(item3["korean"])
    s_num += 1
    screens.append(screen_context_sentence(ctx3, s_num))

    # Distinguish quiz (item1 vs item3)
    s_num += 1
    quiz_count += 1
    distinguish_correct = ctx3["highlights"][0]
    distinguish_distractor = ctx1["highlights"][0]
    screens.append(screen_quiz({
        "type": "distinguish",
        "prompt": ctx3["korean"].replace(distinguish_correct, "___", 1),
        "promptTranslation": ctx3["english"],
        "options": make_options(
            distinguish_correct,
            [distinguish_distractor] + get_distractors(distinguish_correct, FILLER_WORDS[:6], 2),
            f"q8-dist-{item3['korean']}"
        ),
        "wrongExplanation": f"{ctx3['korean']} = {ctx3['english']}",
    }, s_num, 2))

    # Pair context sentence
    s_num += 1
    screens.append(screen_pair_context(
        [ctx1, ctx3],
        f"{item1['korean']} + {item3['korean']} — 둘 다 이번 레슨에서 배운 단어예요.",
        s_num,
    ))

    # Line recall
    if len(session_lines) >= 2 and len(translations) >= 1:
        s_num += 1
        quiz_count += 1
        target_line = session_lines[0]
        target_trans = translations[0]
        other_lines = [l for l in session_lines if l != target_line]
        while len(other_lines) < 3:
            other_lines.append("...")
        screens.append(screen_quiz({
            "type": "line-recall",
            "prompt": target_trans,
            "promptTranslation": "어떤 가사일까요?",
            "options": make_options(target_line, other_lines[:3], f"q9-recall"),
            "wrongExplanation": target_line,
        }, s_num))
        screens[-1]["label"] = "가사 퀴즈"

    # ── PATTERN SPOTLIGHT (before item 4) ──
    s_num += 1
    all_lyrics = primary_lyrics[:]
    for song_name, lyrics in all_song_lyrics.items():
        all_lyrics.extend(lyrics)
    screens.append(screen_pattern_spotlight(lesson_data, all_lyrics, s_num))

    # ITEM 4 (grammar phrase): teach → quiz → context → grammar fill → comprehension → new context
    item4 = phrases[1] if len(phrases) > 1 else phrases[0]
    s_num += 1
    grammar_note = f"{lesson_data['grammar']} = {lesson_data['grammar_meaning']}"
    screens.append(screen_phrase_card(
        item4, item_song_lines.get(item4["korean"], ""), s_num,
        phrase_note=f"이 표현을 통째로 외우세요 — 한국 사람들이 자주 쓰는 표현이에요.",
        grammar_note=grammar_note,
    ))

    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "tap-meaning",
        "prompt": item4["korean"],
        "promptTranslation": "무슨 뜻일까요?",
        "options": make_options(
            item4["english"],
            get_distractors(item4["english"],
                            [i["english"] for i in all_items] + ["to stop liking", "to want to like"]),
            f"q10-{item4['korean']}"
        ),
        "wrongExplanation": f"{item4['korean']} = {item4['english']}",
    }, s_num, 3))

    ctx4 = get_context_sentence(item4["korean"])
    s_num += 1
    screens.append(screen_context_sentence(ctx4, s_num))

    # Grammar fill quiz
    grammar_stem = lesson_data["grammar"].lstrip("-")
    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "grammar-fill",
        "prompt": f"{item4['korean'].replace(grammar_stem, '___', 1)}",
        "promptTranslation": item4["english"],
        "options": make_options(
            grammar_stem,
            get_distractors(grammar_stem, ["고", "지만", "는데", "아서", "게", "처럼", "면"], 3),
            f"q11-grammar"
        ),
        "wrongExplanation": f"패턴은 항상 {lesson_data['grammar']}예요.",
    }, s_num, 3))

    # Pattern comprehension (full Korean options for Unit 3+)
    s_num += 1
    quiz_count += 1
    unit = lesson_data["unit"]
    if unit >= 3:
        screens.append(screen_quiz({
            "type": "pattern-comprehension",
            "prompt": f"{item4['korean']}",
            "promptTranslation": f"여기서 {lesson_data['grammar']}는 무슨 느낌일까요?",
            "options": [
                {"text": "자연스럽게, 선택이 아니라 그렇게 됐어요", "correct": True},
                {"text": "갑자기 일어났다가 멈췄어요", "correct": False},
                {"text": "일부러 그렇게 했어요", "correct": False},
                {"text": "더 이상 그렇지 않아요", "correct": False},
            ],
            "wrongExplanation": f"{lesson_data['grammar']} = {lesson_data['grammar_meaning']} — 선택이 아니라 저절로 된 거예요.",
        }, s_num, 3))
    else:
        screens.append(screen_quiz({
            "type": "pattern-comprehension",
            "prompt": f"What does {lesson_data['grammar']} express?",
            "promptTranslation": None,
            "options": make_options(
                lesson_data["grammar_meaning"],
                get_distractors(lesson_data["grammar_meaning"],
                                ["always / every time", "but / however", "because of that", "not at all"]),
                f"q12-pcomp"
            ),
            "wrongExplanation": f"{lesson_data['grammar']} = {lesson_data['grammar_meaning']}",
        }, s_num, 3))

    # ── FINAL MIX (5 quizzes, all items, new sentences) ──

    # Mix 1: item 1 fill-blank in new sentence
    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "fill-blank",
        "prompt": f"___ 좋아요.",
        "promptTranslation": f"___ is nice.",
        "options": make_options(
            item1["korean"],
            get_distractors(item1["korean"], all_korean_words + FILLER_WORDS[:4]),
            f"qmix1"
        ),
        "wrongExplanation": f"{item1['korean']} = {item1['english']}",
    }, s_num))
    screens[-1]["label"] = "종합 퀴즈"

    # Mix 2: distinguish item1 vs item3
    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "distinguish",
        "prompt": f"___이/가 좋아요.",
        "promptTranslation": f"Which word fits? ({item3['english']})",
        "options": make_options(
            item3["korean"],
            get_distractors(item3["korean"], all_korean_words + FILLER_WORDS[:4]),
            f"qmix2"
        ),
        "wrongExplanation": f"{item3['korean']} = {item3['english']}",
    }, s_num))
    screens[-1]["label"] = "종합 퀴즈"

    # Mix 3: phrase recall
    s_num += 1
    quiz_count += 1
    screens.append(screen_quiz({
        "type": "tap-meaning",
        "prompt": item2["korean"],
        "promptTranslation": f"\"{item2['english']}\" 를 한국어로?",
        "options": make_options(
            item2["korean"],
            get_distractors(item2["korean"], all_korean_words + FILLER_WORDS[:4]),
            f"qmix3"
        ),
        "wrongExplanation": f"{item2['korean']} = {item2['english']}",
    }, s_num))
    screens[-1]["label"] = "종합 퀴즈"

    # Mix 4: grammar fill in new context — uses current lesson's grammar
    s_num += 1
    quiz_count += 1
    grammar_mix_sentences = {
        "-고": {"prompt": "노래하___ 춤춰요.", "translation": "I sing and dance."},
        "-고 싶다": {"prompt": "먹___ 싶어요.", "translation": "I want to eat."},
        "-고 있다": {"prompt": "공부하___ 있어요.", "translation": "I'm studying."},
        "-(으)면": {"prompt": "비가 오___ 집에 있어요.", "translation": "If it rains, I stay home."},
        "-지만": {"prompt": "춥___ 괜찮아요.", "translation": "It's cold but it's okay."},
        "-지 못하다": {"prompt": "잠을 자___ 못해요.", "translation": "I can't sleep."},
        "-지 않다": {"prompt": "걱정하___ 않아요.", "translation": "I don't worry."},
        "-아/어서": {"prompt": "피곤해___ 쉬었어요.", "translation": "I rested because I was tired."},
        "-아/어 줘": {"prompt": "도와___.", "translation": "Help me (please)."},
        "-(으)ㄹ 것 같다": {"prompt": "비가 올 것 ___.", "translation": "I think it'll rain."},
        "-잖아": {"prompt": "알___.", "translation": "You know, right?"},
        "-는데": {"prompt": "비가 오___.", "translation": "It's raining, and..."},
        "-아/어도": {"prompt": "힘들___ 괜찮아요.", "translation": "Even if it's hard, it's okay."},
        "-아/어지다": {"prompt": "날씨가 추워___.", "translation": "The weather is getting cold."},
        "-처럼": {"prompt": "꿈___ 느껴져요.", "translation": "It feels like a dream."},
        "-게 되다": {"prompt": "커피를 좋아하___ 됐어요.", "translation": "I ended up liking coffee."},
        "-아/어 버리다": {"prompt": "다 먹어 ___.", "translation": "I ate it all up."},
        "-기 전에": {"prompt": "자___ 전에 책을 읽어요.", "translation": "I read before sleeping."},
        "-다가도": {"prompt": "웃___도 울어요.", "translation": "I cry even while laughing."},
        "-던": {"prompt": "좋아하___ 노래예요.", "translation": "It's a song I used to like."},
    }
    grammar_key = lesson_data["grammar"]
    mix_sentence = grammar_mix_sentences.get(grammar_key, {"prompt": f"좋아하___ 됐어요.", "translation": "I ended up liking."})
    screens.append(screen_quiz({
        "type": "grammar-fill",
        "prompt": mix_sentence["prompt"],
        "promptTranslation": mix_sentence["translation"],
        "options": make_options(
            grammar_stem,
            get_distractors(grammar_stem, ["고", "지만", "는데", "아서", "게", "처럼", "면"], 3),
            f"qmix4"
        ),
        "wrongExplanation": f"패턴은 항상 {lesson_data['grammar']}!",
    }, s_num))
    screens[-1]["label"] = "종합 퀴즈"

    # Mix 5: sentence ordering (song line)
    s_num += 1
    quiz_count += 1
    if session_lines:
        order_line = session_lines[0]
        order_words = order_line.split()
        random.seed(f"order-{order_line}")
        shuffled_words = order_words[:]
        random.shuffle(shuffled_words)
        screens.append(screen_quiz({
            "type": "sentence-order",
            "prompt": json.dumps(shuffled_words, ensure_ascii=False),
            "promptTranslation": translations[0] if translations else "",
            "options": [{"text": " ".join(order_words), "correct": True}],
            "wrongExplanation": " ".join(order_words),
        }, s_num))
    else:
        screens.append(screen_quiz({
            "type": "tap-meaning",
            "prompt": item1["korean"],
            "promptTranslation": "무슨 뜻일까요?",
            "options": make_options(item1["english"], ["dream", "star", "road"], f"qmix5"),
            "wrongExplanation": f"{item1['korean']} = {item1['english']}",
        }, s_num))
    screens[-1]["label"] = "종합 퀴즈"

    # ── SING ALONG ──
    s_num += 1
    singalong_lines = session_lines[:]
    for line in primary_lyrics:
        if line not in singalong_lines and len(singalong_lines) < 8:
            singalong_lines.append(line)
    screens.append(screen_sing_along(singalong_lines, highlight_words, s_num))

    # ── RECAP ──
    s_num += 1
    screens.append(screen_recap(lesson_data, quiz_count, s_num))

    # Build lesson object
    unit = lesson_data["unit"]
    lesson_num = lesson_data["lesson"]
    korean_ratio = {1: 0.60, 2: 0.65, 3: 0.75, 4: 0.80, 5: 0.85}.get(unit, 0.75)

    artist = primary_song.split(" - ")[0]
    song_title = primary_song.split(" - ", 1)[1] if " - " in primary_song else primary_song

    return {
        "id": f"v5-unit{unit}-lesson{lesson_num}",
        "meta": {
            "songId": slugify(primary_song),
            "songTitle": song_title,
            "artist": artist,
            "unit": unit,
            "lessonNumber": lesson_num,
            "grammarFocus": lesson_data["grammar"],
            "grammarMeaning": lesson_data["grammar_meaning"],
            "koreanRatio": korean_ratio,
        },
        "screens": screens,
        "generatedAt": "2026-08-03T00:00:00.000Z",
    }


def main():
    os.makedirs(LESSONS_DIR, exist_ok=True)

    with open(CORPUS, encoding='utf-8') as f:
        corpus = json.load(f)

    all_lessons = []
    index = {"units": {}, "total_lessons": 0}

    prev_lesson = None
    for lesson_data in CURRICULUM:
        unit = lesson_data["unit"]
        lesson_num = lesson_data["lesson"]

        print(f"Generating Unit {unit}, Lesson {lesson_num}: {lesson_data['title']} ({lesson_data['grammar']})...")

        lesson = generate_lesson(lesson_data, prev_lesson, corpus)

        filename = f"unit{unit}-lesson{lesson_num}.json"
        filepath = os.path.join(LESSONS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(lesson, f, ensure_ascii=False, indent=2)

        unit_key = str(unit)
        if unit_key not in index["units"]:
            index["units"][unit_key] = {"lessons": []}
        index["units"][unit_key]["lessons"].append({
            "id": lesson["id"],
            "file": f"lessons_v5/{filename}",
            "title": lesson_data["title"],
            "grammar": lesson_data["grammar"],
            "grammarMeaning": lesson_data["grammar_meaning"],
            "unit": unit,
            "lessonNumber": lesson_num,
            "screenCount": len(lesson["screens"]),
            "quizCount": sum(1 for s in lesson["screens"] if s["type"] == "quiz"),
        })

        all_lessons.append(lesson)
        prev_lesson = lesson_data

    index["total_lessons"] = len(all_lessons)

    with open(INDEX_OUT, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"Total: {len(all_lessons)} lessons generated")
    print(f"Index: {INDEX_OUT}")
    print(f"Lessons: {LESSONS_DIR}/")

    for lesson in all_lessons:
        screens = lesson["screens"]
        quiz_screens = [s for s in screens if s["type"] == "quiz"]
        print(f"  {lesson['id']}: {len(screens)} screens, {len(quiz_screens)} quizzes")


if __name__ == "__main__":
    main()
