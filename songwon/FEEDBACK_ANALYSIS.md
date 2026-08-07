# Feedback Analysis — Aug 7, 2026

## 6 Issues Identified, with Root Causes and Proposed Fixes

---

### 1. Song Feels Disconnected from Lesson Screens

**Problem:** Song plays in background but the screen content doesn't visually connect to the music. The lyrics-korean screen only shows 4 target lines, not the full song. When the song plays, there's nothing to read/sing along with.

**Root cause:** The `lyrics-korean` screen type only renders the pre-selected target lines (typically 4 from the song). Full song lyrics exist in `pipeline/lyrics/` but aren't loaded into the lesson JSON.

**Krashen alignment:** This is a missed opportunity for massive comprehensible input. Full lyrics = free reading practice. The learner reads familiar words in context (pleasure, not study) while hearing the song — exactly what Krashen's "free voluntary reading" and "comprehensible input" principles prescribe.

**Fix:**
1. Add a `fullLyrics` field to each lesson JSON containing all lyrics from `pipeline/lyrics/{song}.txt`
2. Add a `targetLines` array marking which line indices are being taught in this lesson
3. New screen type `lyrics-singalong` that shows ALL lyrics with target lines highlighted (different color/background)
4. This screen appears when the song starts playing — learner reads/sings the full song, highlighted lines preview what's coming
5. The existing `line-breakdown` screens later deep-dive into those highlighted lines

**Data needed:** Full lyrics already exist at `pipeline/lyrics/*.txt`. Just need to embed them.

---

### 2. Warmup Quiz Flow is Broken (Double Warmup + Bounce to Home)

**Problem:** Two independent warmup systems conflict:
- `StartupQuestion.tsx` shows a random quiz from `question_bank.json` when app opens
- Each lesson JSON has a `type: "warmup"` screen as its first screen

**Current flow:** Startup question → answer → bounced to home (if no in-progress lesson) → tap lesson → hit ANOTHER warmup quiz inside the lesson. Two back-to-back quizzes with no teaching between them.

**Root cause in code:**
- `app/page.tsx` line 40-46: `handleQuestionDismiss()` only navigates to a lesson if `resumeLessonId` exists. Otherwise falls through to home page.
- The startup question and lesson warmup draw from separate data with no coordination.

**Fix:**
- **Option A (recommended):** Remove the `warmup` screen type from lesson JSONs entirely. The startup question on the home page IS the warmup. After answering, navigate directly to the next lesson (not home).
- **Option B:** Keep lesson warmups but skip them if a startup question was just answered (pass a flag via URL param or sessionStorage).
- Either way: the startup question should flow INTO the lesson, not bounce back to home.

---

### 3. Quiz Questions Have Multiple Valid Answers / Bad Distractors

**Problem:** Quiz options include answers that are also correct but not marked as such. Fill-blank questions accept multiple valid completions. Distractors are either trivially wrong (nouns in verb slots) or too plausible (valid alternatives).

**Specific examples found:**
- Lesson 1, s20: "___은 아름다워요." Correct: 사랑. But 꿈 and 마음 are options and both work.
- Lesson 5, s18: "___이 따뜻해요." Correct: 마음. But 사랑 also works perfectly.
- Lesson 5: Romanization concatenated into Korean text (data bug): "지금 이 말이jigeum i mari"
- Lessons 3 & 4: Duplicate song quizzes (identical screens across lessons)
- Many fill-blanks use nouns as distractors for verb slots — trivially obvious

**Root cause:** Quiz generation doesn't validate distractor plausibility. It pulls from the lesson's vocab pool without checking if alternatives are grammatically valid in context.

**Fix:**
1. For fill-blank questions: the sentence + blank must have exactly ONE valid answer from the options. If multiple options work, the sentence needs to be more specific (add context) or use a different sentence.
2. Distractors must match the target's part of speech (noun options for noun blanks, verb for verb).
3. Audit and fix all 20 lessons. Romanization bug in lesson 5 needs data regeneration.
4. Remove duplicate screens between lessons 3 and 4.

---

### 4. Vocab Gaps — Song Corpus Misses Foundational Words

**Problem:** All vocabulary comes from song lyrics. Songs don't use basic daily words. Unit 1 (4 lessons) teaches 16 items — all song-derived. Zero overlap with TOPIK 1 fundamentals.

**Missing from Unit 1 (all 42 checked basics are absent):**
- Pronouns: 나, 너, 우리
- Question words: 뭐, 어디, 언제, 왜, 어떻게
- Greetings: 안녕하세요, 감사합니다
- Core verbs: 가다, 오다, 먹다, 마시다, 하다, 보다, 알다
- Core nouns: 집, 물, 밥, 친구, 학교
- Time words: 오늘, 내일, 어제, 지금
- Existence: 있다, 없다

**Krashen alignment:** The i+1 principle requires 95-98% comprehensible input. If learners don't know basic pronouns and verbs, even simple song lines become incomprehensible. These foundation words ARE the "i" that makes "+1" possible.

**Fix:**
1. Add a `supplementary_vocab` section to each lesson JSON with 4-6 foundation words per lesson
2. These get their own word-card + context-sentence screens, using simple made-up sentences (not from songs)
3. Where possible, find these words IN the full lyrics (나, 너, 우리 appear in nearly every song) and point them out
4. Over 20 lessons, this adds ~80-120 foundation words alongside the song vocab

---

### 5. Lessons Feel Overwhelming (Organization, Not Count)

**Problem:** Not the screen count (37 is fine with checkpoints). The issue is:
- Screens feel mechanical/generated rather than intentional
- Some screens feel redundant (word-card → quiz → context-sentence is always the same rhythm)
- The flow doesn't build momentum — it's flat
- Cold transitions between sections (no narrative thread)

**Krashen alignment:** The "affective filter" goes up when learners feel tested or drilled. The current lesson feels like a test sequence, not a discovery journey. Krashen says: make it feel like reading for pleasure, not studying.

**Fix:**
1. **Vary the rhythm:** Don't always do word → quiz → context. Sometimes show the context sentence FIRST (let them encounter the word in context before seeing the card — this is how Krashen says acquisition works)
2. **Add narrative glue:** Brief transition text between sections ("이 단어는 노래에서 이렇게 나와요" → shows the lyric line) connecting vocab back to the song
3. **Reduce quiz density:** Not every word needs an immediate quiz. Some can be tested in the mix-review section. Krashen: explicit testing raises the affective filter
4. **Group lyric lines:** Instead of scattering line-breakdowns across the lesson, cluster 2-3 consecutive lyric lines together so the narrative of the song builds

---

### 6. Krashen Principles — What We're Getting Right and Wrong

**Getting right:**
- Song-based input is inherently pleasurable (low affective filter)
- Grammar patterns taught through examples, not rules
- Interleaved teach/test (better than batched)

**Getting wrong:**
- Too much explicit testing (quiz screens are ~40% of lesson) — raises affective filter
- Vocab introduced in isolation (word-card) before context — Krashen says encounter in context FIRST
- No free reading opportunity — full lyrics should be the primary reading material
- Insufficient comprehensible base — without basic pronouns/verbs, nothing is comprehensible
- Lessons feel like study, not discovery — need more "encounter and recognize" moments, fewer "recall and prove" moments

**Krashen's prescription for this app:**
1. Full glossed lyrics as the centerpiece (comprehensible reading)
2. Fewer new items per lesson (we have 4-6, which is okay)
3. 95%+ of what's on screen should be already-known material
4. Quizzes framed as "recognition" not "testing" — lower stakes language
5. Context-first: see the word in a sentence → tap to reveal meaning → THEN the word card
6. Songs lower the affective filter naturally — lean into this more

---

## Priority Order for Implementation

1. **Fix warmup flow** (broken navigation, worst UX bug)
2. **Full lyrics with highlighted target lines** (biggest Krashen win, reading practice)
3. **Fix quiz quality** (multiple correct answers, bad distractors, duplicates)
4. **Add foundation vocab** (TOPIK 1 basics gap)
5. **Reorganize screen flow** (context-first, less quiz density, narrative glue)
6. **Context-first vocab introduction** (show in sentence before word card)
