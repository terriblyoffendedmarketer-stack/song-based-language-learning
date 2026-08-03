# Session Design — The Lesson Flow

Status: V5 — added warm-up activation, progression gating, wrong-answer handling (2026-08-03).
Reference: `EXAMPLE_LESSON_10cm_My_Eyes.md` is the gold-standard example lesson (~38 screens).

## Theoretical grounding

Built on Krashen's Input Hypothesis + interleaved spaced repetition research:

- **Acquisition > Learning**: People acquire language by understanding messages, not studying rules.
- **i+1**: Input slightly above current level. 3-4 new words/phrases per session.
- **Affective filter**: Music playing = emotional engagement = low filter.
- **One thing per screen**: Never overload. One word, one question, one concept.
- **Phrases over words**: Phrases give immediate practical value and teach grammar implicitly. 목소리가 들리다 > 목소리 + 들리다 separately.
- **Simplest possible sentences**: Example sentences use only basic words so the new word stands out.
- **Interleaved teaching**: Teach one item → test immediately → context sentence → next item → test → mix review of previous items. Never batch all teaching before all testing.
- **Context sentences as reinforcement**: After testing a word, show it highlighted in a simple sentence. Not a quiz — just exposure with TTS.
- **Grammar-first curriculum**: Lesson sequence follows proven grammar progression (TOPIK/King Sejong), then songs are matched to grammar points. See `CURRICULUM_PROGRESSION.md`.
- **Immediate activation**: First interaction within 5 seconds of opening a lesson. Never start with passive reading.
- **Mass Immersion (MIA)**: 80%+ Korean across the lesson. English only for grammar intros, word definitions, and wrong-answer explanations. Korean ratio increases across units (60% Unit 1 → 90% Unit 5).

## Korean immersion rules (MIA)

### What's in Korean
- All screen labels: 퀴즈, 새 단어, 새 표현, 문장 연습, 복습, 가사 퀴즈, 종합 퀴즈, 노래, 결과
- Quiz prompts: 무슨 뜻일까요?, 노래를 완성하세요, 순서대로 나열하세요
- Navigation: 계속 (continue), 다시 하기 (retry)
- Context sentence notes and grammar observations
- Fill-in-blank quiz options (all Korean)
- Wrong-answer explanations (Korean-first at Unit 3+)
- Recap screen chrome

### What stays English
- Intro prose (grammar explanations for beginners)
- Word/phrase definitions ("voice · noun")
- Meaning-recall quiz options (tests Korean→English understanding)
- English translations below Korean sentences (small, secondary)

### Graduation across units
- **Units 1-2 (~60-65% Korean)**: English hints on quizzes, English wrong-answer explanations, some English labels
- **Units 3-4 (~75-80% Korean)**: Korean quiz prompts, Korean wrong-answer explanations, Korean labels
- **Unit 5 (~85-90% Korean)**: Near-full immersion — English only for new grammar intro and word definitions

### Comprehension quizzes in Korean (key innovation)
By Unit 3+, some quizzes have ALL options in Korean — testing whether the learner can read and distinguish Korean nuances, not just translate to English. Example: "여기서 -게 되다는 무슨 느낌일까요?" with Korean answer options describing the nuance.

## Progression & scoring

### Per-lesson scoring

Every quiz screen is scored. The lesson tracks correct/total answers throughout.

- **Pass threshold: 80%** — e.g., 14/17 correct answers
- If you score below 80%, the lesson shows as "attempted, not passed" — you can redo it
- Wrong answers don't block forward progress WITHIN a lesson — you always see all screens
- At the recap screen: "14/17 correct — Passed!" or "9/17 — Try again to pass"

### Wrong answer handling

When the user picks the wrong answer:
- Wrong choice turns red, correct choice turns green (simultaneously)
- A brief explanation appears at the bottom (one line max)
- User taps "Continue" to move to the next screen — no retry on the same question
- No lives system, no penalties — just correction and forward momentum
- The wrong answer DOES count against the lesson score

### Unit gating

- **5 lessons per unit** (4 grammar lessons + 1 review lesson)
- **Need 4 out of 5 passed to unlock the next unit**
- This gives wiggle room — skip one tough lesson, still progress
- But can't skip two — forces going back to actually learn
- Lessons within an unlocked unit can be done in any order

### Scorecard (background tracking)

Tracked in localStorage, displayed later:
- Lessons completed (with score per attempt)
- Total questions answered / correct (lifetime)
- Current streak (consecutive days with a lesson completed)
- Per-word/phrase mastery (how often correctly answered across lessons)

## The session flow

### Phase 0: Warm-Up Activation (1 screen)

#### Screen 1: Warm-up Quiz

**For lessons 2+:** A recall question from the previous lesson. One tap, instant feedback. Gets the brain active before any reading.

**For Lesson 1 (first ever):** A curiosity-hook question — zero-stakes, learn-something-either-way. Example:
> "Do you know what 꿈 means?"
> - star / dream / road / I have no idea!

Wrong? "꿈 means dream — you'll learn this soon!" Right? "Nice, you already know this one." Either way, you've interacted within 5 seconds.

The warm-up question does NOT count toward the lesson score.

### Phase 1: Intro + Immersion (music auto-plays)

#### Screens 2-3: Lesson Introduction (music playing)

Rich English explainer, NOT a dry word list. Reads like a textbook chapter opening:
- Introduce the THEME in human terms
- Explain the grammar point with examples
- Weave in song context naturally (no separate "About the song" screen)
- Preview what vocab/phrases are coming
- Split across 2 screens
- **Scannable**: bold Korean examples inline, short paragraphs, visual anchors

Music auto-plays the moment the lesson loads — zero friction.

#### Screen 4: Korean Lyrics (music continues)

- 3-4 Korean lyric lines — Korean text only, no English
- Karaoke-style line highlighting if synced to music (V2 goal)
- Each line tappable to hear it spoken (TTS)
- Prompt: "Just listen — you'll understand these by the end"
- Pure exposure — no expectation to understand

#### Screen 5: English Translation (music STOPS)

- Same 3-4 lines with English translations
- Target words/phrases highlighted in accent color
- Music stops here — cognition starts

### Phase 2: Interleaved Teaching + Testing (silent)

This is the core of the lesson. Each word/phrase follows the same micro-cycle, but items are interleaved — you never learn all items before being tested.

**No vocab preview screen** — the translation screen (Screen 5) already highlights the targets, giving a soft preview. Jump straight into teaching.

#### Per-item micro-cycle:

1. **Word/Phrase Card** — Korean displayed large, auto-TTS speaks it, English meaning, song line with target highlighted
2. **Quiz — Recognition** — "What does X mean?" (easiest exercise type)
3. **Context Sentence** — Simple sentence with target highlighted in accent color, auto-TTS, English translation. NOT a quiz — reinforcement only.
4. **Quiz — Use in context** — Fill-in-blank in a sentence, or recognize in a new context

#### After every 2 items:

5. **Mix Review** — Quiz that requires distinguishing or recalling earlier items alongside the new one. Uses song lines when possible.

#### After all items:

6. **Cumulative line recall** — Match English translation to the correct Korean song line

#### Item selection rules:

- 2 words + 2 phrases (or 1 word + 3 phrases) per lesson
- Phrases build on the words taught earlier in the same lesson when possible
- Grammar pattern phrase always included (e.g., 좋아하게 되다 for -게 되다 lesson)
- One phrase should come from the actual song line

#### Pattern Spotlight (1 screen, right before the grammar phrase item):

- The grammar pattern, its meaning, song example, 2 more real examples
- Appears right before the phrase card that uses the pattern (NOT a separate phase)
- "Here's how Koreans actually use this"

### Phase 3: Final Mixed Review

- 4-5 quiz screens mixing ALL items from the lesson
- Varied exercise types: fill-blank, distinguish, sentence ordering, pattern application
- Uses NEW sentences (not repeats from teaching phase)
- Escalating difficulty: recognition → fill-blank → sentence ordering

### Phase 4: Payoff (music returns)

#### Sing Along (music plays)

- Song plays, lyrics appear with all learned words highlighted in accent color
- The learner now understands what they're hearing

#### Recap

- Words/phrases learned
- Pattern learned
- Score: "15/17 correct — Passed!" or "9/17 — Try again to pass"
- XP earned (only on pass)

## Exercise type inventory

| Type | Example | Difficulty | When to use |
|------|---------|-----------|-------------|
| Tap meaning | "What does 목소리 mean?" → [voice] | Easy | First quiz after word card |
| Fill blank (sentence) | "엄마 ___가 좋아요" → [목소리] | Medium | Second quiz, use in context |
| Fill blank (song line) | "너의 ___만 넘나 크게 들려" | Medium | Mix review |
| Distinguish similar | "음악이 ___" (들려요 vs 보여요) | Medium-Hard | After 2+ similar items taught |
| Song line comprehension | "다른건 아무것도 안들리고 means..." | Medium | Mix review |
| Grammar fill | "좋아하___ 됐어요" → [-게] | Medium-Hard | After pattern spotlight |
| Line recall | "Which line means 'Only your voice...'" | Hard | Cumulative review |
| Sentence ordering | Arrange words into Korean sentence | Hard | Final mix only |
| Pattern comprehension | "What does -게 되다 express?" | Medium | After pattern spotlight |

## Context sentence rules

Context sentences appear as reinforcement AFTER quizzes (not as quizzes themselves):
- Simplest possible — grade-school vocabulary, only the target word/phrase is new
- Target highlighted in accent color — visually distinct from rest of sentence
- English translation always shown below
- Auto-TTS on entry — speaks the Korean automatically
- Brief grammar/usage note when useful
- Tap to replay TTS

## Phrase design rules

- Phrases are preferred over individual words when possible
- A phrase should be an immediately usable chunk (목소리가 들리다, not just 들리다)
- Phrases teach particles and conjugation implicitly
- When a word and phrase share a root, teach the word first, then the phrase that builds on it
- Grammar pattern phrases (좋아하게 되다) always show the pattern highlighted

## Key design principles

1. **Immediate activation** — warm-up quiz within 5 seconds, before any reading
2. **Interleave teaching and testing** — teach 1 item, test it, show context, teach next item, test, mix review
3. **One thing per screen** — one word, one question, one concept
4. **Phrases over words** — phrases teach grammar implicitly and give practical value
5. **Context sentences as reinforcement** — after testing, show the word highlighted in a sentence (not a quiz)
6. **Highlighted target word everywhere** — accent color in sentences, song lines, sing-along
7. **Auto-TTS on every teaching screen** — word/phrase speaks when you land on it
8. **Music auto-plays** — zero friction, intro/lyrics/sing-along, stops for teaching
9. **Escalating exercise difficulty** — recognition → fill-blank → distinguish → sentence ordering
10. **Mix reviews after every 2 items** — forces recall before moving on
11. **One question per screen** — exercises NEVER batched
12. **Rich English intro** — reads like a textbook chapter opening, scannable with bold Korean
13. **Grammar-first curriculum** — lesson sequence follows grammar progression, songs matched to it
14. **Wrong answers move forward** — show correct answer, explain briefly, keep momentum
15. **Progression gating** — 80% to pass a lesson, 4/5 lessons to unlock next unit

## Typical screen count

With 4 teaching items (2 words + 2 phrases), a typical lesson has ~38 screens.
Each screen takes 5-15 seconds. Session length: 8-12 minutes.

## Screen flow summary

```
WARM-UP QUIZ (1 screen) — recall from previous lesson or curiosity hook
INTRO (2 screens, music) — scannable prose with bold Korean inline
LYRICS KR (music, tappable lines) — listen & watch, karaoke highlight (V2)
LYRICS EN (music stops) — same lines with translation, targets highlighted

ITEM 1 (word): teach → quiz → context sentence → quiz
ITEM 2 (phrase, builds on item 1): teach → quiz → context sentence → quiz → mix review → song comprehension
ITEM 3 (word): teach → quiz → context sentence → quiz → distinguish × 2-3 → pair sentence → line recall
PATTERN SPOTLIGHT (1 screen, right before item 4)
ITEM 4 (grammar phrase): teach → quiz → context sentence → grammar quiz → comprehension → new context

FINAL MIX (4-5 screens, all items, new sentences, escalating difficulty)
SING ALONG (music, highlighted lyrics)
RECAP (score, pass/fail, XP)
```
