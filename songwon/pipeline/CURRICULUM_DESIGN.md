# Curriculum Design — How Songs Become Lessons

Status: DRAFT — needs review before implementation.

## The core problem

63 songs ≠ 63 lessons. A song might have 5 useful vocabulary words or 50. Some songs share the same grammar patterns. Some songs are simple enough for day-1 learners, others require intermediate grammar. We need a framework that turns the combined lyric corpus into a structured learning progression.

## Step 1: Analyze the corpus first

Before generating any lessons, we need to process ALL 63 songs' lyrics together and extract:

1. **Vocabulary inventory** — every unique word across all songs, with:
   - Frequency (how many songs use it)
   - TOPIK level estimate (1-6)
   - Part of speech
   - Which songs contain it

2. **Grammar pattern inventory** — recurring structures across songs:
   - Verb endings (-아/어요, -았/었어요, -(으)ㄹ 거예요, etc.)
   - Connectors (-고, -지만, -(으)면, etc.)
   - Sentence patterns (A는 B예요, A를 V, etc.)
   - Which songs demonstrate each pattern

3. **Difficulty rating per song** — based on:
   - Average TOPIK level of vocabulary
   - Grammar complexity
   - Sentence length
   - Amount of slang/colloquial speech

This gives us a **corpus map** — what the 63 songs teach us as a whole.

## Step 2: Define the progression skeleton

Language learning follows a rough order. Here's a proposed skeleton:

### Level 1: Foundations (초급 1)
- **Target**: Complete beginner, first exposure to Korean
- **Grammar**: 이다/아니다, -아/어요 present tense, 있다/없다, basic particles (은/는, 이/가, 을/를)
- **Vocabulary**: ~50 high-frequency words (pronouns, basic verbs, common nouns from songs)
- **Song approach**: Pick the simplest 2-3 lines from easy songs. One line = one micro-lesson.
- **Lesson format**: Listen → break down each word → rebuild the sentence → quiz

### Level 2: Simple sentences (초급 2)
- **Target**: Can recognize basic sentence structure
- **Grammar**: Past tense -았/었어요, negative 안/못, -고 싶다 (want to), question forms
- **Vocabulary**: ~100 words cumulative, adding adjectives and time words
- **Song approach**: Full verses from simpler songs (BOL4, IU ballads)
- **Lesson format**: Listen to verse → vocabulary from context → grammar spotlight → practice

### Level 3: Expressing feelings (초급 3)
- **Target**: Can understand simple song lyrics with support
- **Grammar**: -(으)ㄹ 거예요 (future), -지 마 (don't), -(으)면 (if), -아/어서 (because)
- **Vocabulary**: ~200 words, emotion vocabulary, relationship words (common in K-pop)
- **Song approach**: Choruses and emotional peaks — K-pop excels here
- **Lesson format**: Full song sections, connecting grammar to emotional meaning

### Level 4: Connected ideas (중급 1)
- **Target**: Can follow along with familiar songs
- **Grammar**: -(으)ㄴ/는 (modifier), -겠- (intention/guess), -든지 (regardless), quoted speech
- **Vocabulary**: ~350 words, abstract concepts, metaphors
- **Song approach**: Verse-chorus-verse narratives, story-driven songs (JANNABI, Sogyumo Acacia Band)
- **Lesson format**: Following the song's story, inferring meaning, less explicit translation

### Level 5: Nuance (중급 2-3)
- **Target**: Understands most lyrics, catches wordplay
- **Grammar**: Advanced connectors, conditional chains, poetic inversions
- **Vocabulary**: ~500+ words, literary/poetic vocabulary
- **Song approach**: Full songs with cultural deep-dives
- **Lesson format**: Primarily Korean explanations, minimal English

## Step 3: Map songs to levels

After the corpus analysis, each song gets mapped:

```
Song: IU - Good Day (좋은 날)
Difficulty: Level 2-3
Key vocabulary: 좋은, 날, 기분, 하늘, 구름 (15 target words)
Key grammar: -ㄴ (adjective modifier), -고 싶어 (want to)
Usable sections:
  - Chorus: Level 2 (simple, repetitive)
  - Verse 1: Level 3 (more complex sentences)
  - Bridge: Level 4 (fast, dense)
```

One song might contribute to lessons across multiple levels:
- Its chorus teaches Level 2 vocabulary
- Its verses demonstrate Level 3 grammar
- Its bridge introduces Level 4 connectors

## Step 4: Build lessons from the map

A lesson is NOT "learn this song." A lesson is:

> "Learn these 3-5 words and this grammar pattern, using lines from these songs as your source material."

Example lesson structure:
```
Lesson: "Wanting things" (-고 싶다)
Source material: 
  - IU "Good Day" chorus line: "좋은 날 좋은 날 좋은 날"
  - TAEYEON "Weekend" verse: "주말이 왔으면 좋겠어"
  - BOL4 "Some" line: "너를 보고 싶어"
Teaches: -고 싶다 pattern + 3 vocabulary words
Exercises: fill-in-blank, listening recognition, sentence building
```

The song is the **context**, not the **unit**. Multiple songs can feed one lesson when they share patterns.

## Step 5: Implementation plan

1. **Fetch all lyrics** → save as `pipeline/lyrics/{safe_name}.txt`
2. **Corpus analysis** (Claude conversation):
   - Feed all lyrics to Claude
   - Get back: vocabulary inventory, grammar inventory, per-song difficulty
   - Save as `pipeline/corpus_analysis.json`
3. **Curriculum mapping** (Claude conversation):
   - Given the corpus analysis, map songs to levels
   - Identify which song sections teach which concepts
   - Define lesson sequence
   - Save as `pipeline/curriculum_map.json`
4. **Lesson generation** (Claude conversation, per-lesson):
   - For each lesson in the curriculum, generate the actual content
   - Exercises, explanations, audio cues
   - Save as `pipeline/lessons/{lesson_id}.json`
5. **Wire into app** — load seed data

## Step 6: Song context enrichment

Every song used in a lesson must carry its story. This is NOT optional decoration — it's pedagogically load-bearing. Emotional connection to content is what makes vocabulary stick, especially for ADHD learners.

For each song, we need:

### Artist profile
- Who they are, their style, what generation of K-pop/indie they represent
- Why they matter in Korean music (e.g. IU = "nation's little sister," MAMAMOO = vocal powerhouse group that broke idol molds)
- Fun facts that make the learner care

### Song context
- What the song is about (the real meaning, not just literal translation)
- Why/when it was written — personal story, drama OST, comeback context
- Cultural moment — did it chart #1? Go viral on TikTok? Become a meme? Associated with a K-drama?
- Musical style and mood — what feeling it captures

### Cultural notes (per lesson, not just per song)
- Korean cultural concepts embedded in the lyrics (e.g. 정 (jeong), 한 (han), aegyo, nunchi)
- Social context — honorific levels used, relationship dynamics
- Seasonal/time references (many Korean songs reference seasons — this matters culturally)
- Wordplay, double meanings, or references a Korean listener would catch

### How this integrates into lessons
- Each lesson opens with a short "context card" about the song/artist being studied
- Cultural notes appear alongside vocabulary when relevant (e.g. teaching 보고 싶다 → explain why Koreans use "I want to see you" instead of "I miss you")
- The "reward" moment (understanding the full song) hits harder when the learner knows the story behind it

This data gets generated during the corpus analysis phase — Claude has strong knowledge of K-pop/Korean music context. Saved per-song in `pipeline/song_context/{safe_name}.json`.

## Key principles

- **Songs are ingredients, not meals.** A chorus from one song + a verse from another can form one lesson if they teach the same concept.
- **Frequency-first vocabulary.** Words that appear across many songs get taught first — the learner encounters them repeatedly across different contexts.
- **Grammar from patterns, not rules.** Show the learner 3 song lines that use -(으)면, let them notice the pattern, then name it.
- **Spiral curriculum.** A word introduced in Level 1 reappears in Level 3 in a new grammatical context. The SRS system reinforces this.
- **The song is the reward.** After learning enough pieces, the learner can listen to the full song and understand it — that's the dopamine hit.
- **Context makes it stick.** A word learned inside a story you care about is 10x stickier than a flashcard. Every lesson connects language to the human story behind the song.
- **i+1 always.** Each lesson should be ~90% comprehensible with ~10% new material. Never overwhelming.

## Open questions

- How many total lessons? (Rough estimate: 100-150 across all levels)
- How long is each lesson? (Target: 3-5 minutes, ADHD-friendly)
- Do we generate all lessons upfront or progressively?
- How do we handle songs where lyrics aren't available?
- Should the user be able to "unlock" a song and see the full analysis even if they haven't done all prerequisite lessons?

## What the next session needs to do

1. ~~Fetch lyrics for all 63 songs~~ — DONE (or close), check `lyrics_status.json`
2. Generate song context enrichment for all 63 songs → `song_context/`
3. Feed the complete lyrics corpus to Claude for analysis
4. Get back the vocabulary/grammar inventory + difficulty ratings
5. Use that to build the curriculum map (incorporating song context)
6. Then generate lessons following the map
