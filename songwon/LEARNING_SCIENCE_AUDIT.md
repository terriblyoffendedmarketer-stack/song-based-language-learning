# Learning Science Audit — Songwon V1

An honest evaluation of the current app against five learning science frameworks. For each: what we're doing right, what's broken, and what V2 must fix.

---

## 1. Krashen's Input Hypothesis

**The theory:** Language is acquired (not learned) through exposure to comprehensible input at i+1 — just above the learner's current level. Conscious grammar study helps monitor output but doesn't drive acquisition. The Affective Filter (anxiety, boredom, frustration) blocks acquisition even when good input is present.

### What we're doing right
- **Songs as comprehensible input.** Lyrics from music the user already loves = high-interest reading material. This is Krashen's free voluntary reading applied to music.
- **Full-song lyrics screen.** Showing all lyrics with target lines highlighted gives context-rich exposure.
- **Context sentences.** Vocabulary introduced with Korean example sentences, not isolated word lists.
- **i+1 curriculum ordering.** Grammar progression from simple (-고) to complex (-던) follows a natural order.

### What's broken
- **Only 4 lines per song.** Krashen says volume of input matters. Four lines is a tasting menu, not a meal. The learner never gets enough exposure to develop intuition for the patterns.
- **Explicit testing dominates.** 10 out of 30 screens are quizzes. Krashen argues acquisition happens through understanding messages, not through drilling. The quiz-heavy structure raises the affective filter — it feels like a test, not exploration.
- **Grammar-first framing.** Each lesson is titled by its grammar point (-고, -지만). Krashen would say: show the grammar in context first, let the learner notice it, then name it. Currently we name it, then show examples — backwards.
- **No free reading mode.** There's no way to just read glossed lyrics without being tested. Krashen's most powerful recommendation — free voluntary reading with occasional lookups — doesn't exist in the app.

### V2 fix
- Song practice covers 12-15 lines per song = 3-4x more input
- Song practice is ungated = low affective filter (no stakes, just exploration)
- Line-by-line breakdowns = comprehensible input with glosses
- Reduce quiz density in lessons; add more reading/listening screens

---

## 2. Spaced Repetition (Ebbinghaus / Leitner)

**The theory:** Memory decays exponentially (the forgetting curve). Reviewing material at increasing intervals — just before you'd forget it — is dramatically more efficient than massed practice. The Leitner box system and SM-2 algorithm are practical implementations.

### What we're doing right
- **The types exist.** `SRSData` interface has interval, ease, nextReview, strength fields. The data model is ready.
- **Daily reminders.** Push notifications with Korean trivia = a recall trigger.

### What's broken
- **SRS is completely disconnected from V5.** The SRS system lives in the old `AppState` (IndexedDB). V5 lessons never write to it. The progress page reading SRS data shows nothing because nothing was ever written. This is the single biggest gap — the retention engine exists in code but has zero connection to the actual learning flow.
- **No review sessions.** The `/review` page reads from the old system. There are zero spaced repetition review sessions in the current app.
- **No forgetting curve at all.** A user who completes Lesson 1 and comes back a week later has zero prompts to review 꿈 (dream) or 사랑 (love). Those words are just gone.
- **Lesson vocabulary never enters a pool.** Words taught in lessons vanish after the recap screen. They're not tracked, not scheduled for review, not surfaced again.

### V2 fix
- Vocab/grammar practice mode builds the SRS pool from completed lessons
- Practice sessions pull from this pool with spacing intervals
- Words answered wrong appear sooner; mastered words appear less
- Cross-song context: review 사랑 using a line from a different song than where it was taught

---

## 3. Bloom's Mastery Learning

**The theory:** All students can achieve mastery given adequate time and appropriate instruction. Learners must demonstrate 80-90% accuracy before advancing. Those who don't pass get additional support and re-testing. The cycle continues until mastery is achieved.

### What we're doing right
- **80% pass threshold.** `PASS_THRESHOLD = 0.8` in v5-progress.ts. Lessons require 80% quiz accuracy to pass.
- **Retry mechanism.** Failed lessons can be retried, and best score is tracked.
- **Set-based unlocking.** Must pass current set before advancing.

### What's broken
- **No remediation.** When a user fails a quiz, they get `wrongExplanation` — a one-liner like "꿈 = dream". There's no re-teaching, no alternative explanation, no additional practice on the failed concept. Bloom's model requires corrective instruction before re-testing.
- **Quiz failure = lesson failure, not concept failure.** The system tracks "did you pass the lesson" but not "which specific words/patterns do you struggle with." Bloom says: identify the exact gap, remediate that gap, re-test that specific concept.
- **No formative assessment.** All quizzes are summative (scored, gates progression). Bloom distinguishes between formative (diagnostic, guides instruction) and summative (evaluative, gates advancement). Every quiz screen in the app is scored — there's no low-stakes diagnostic check.
- **Trivial assessments.** With 2 words + 2 phrases per lesson, the tap-meaning quizzes have only 4 possible correct answers. The user can pass through elimination, not mastery. Screen 28 asks "What does 꿈 mean?" with options: dream, singer, audience, clothes. That's not testing mastery — that's testing whether you can eliminate obviously wrong answers.

### V2 fix
- Practice mode = formative assessment (low-stakes, diagnostic)
- Track per-concept mastery, not just per-lesson pass/fail
- Better distractors from a cross-lesson pool (꿈 vs 사랑 vs 마음 vs 길 — all nouns from different lessons)
- Wrong answer → targeted re-exposure in next practice session

---

## 4. Justin Sung's Higher-Order Learning / Encoding Quality

**The theory:** Active recall and spaced repetition are necessary but insufficient — they're lower-order techniques. Higher-order learning requires: comparing ideas against each other, identifying relationships, applying knowledge in new contexts, and building networks of connected information. Flashcard-style isolated fact recall actually inhibits forming new memory cues. The best learners use Spaced Interleaved Retrieval (SIR) — spacing + mixing different topics + higher-order retrieval tasks.

### What we're doing right
- **Interleaved teaching.** We teach word → test → context → next word, not batch all words then batch all tests. This is interleaving within a lesson.
- **Context sentences.** Words shown in sentence context, not isolation.
- **Pattern spotlight.** Grammar patterns shown with multiple examples across contexts.

### What's broken
- **All retrieval is lower-order.** Every quiz is "what does X mean?" or "fill in the blank with the grammar point." These are direct recall — the lowest tier. There's no: "How is -고 different from -지만?" (comparison). No: "Which pattern would you use here, and why?" (judgment). No: "Read this new sentence and figure out what it means" (application).
- **Zero interleaving across lessons.** Lesson 1 only tests Lesson 1 material. Lesson 5 only tests Lesson 5. Sung's SIR principle says: mix retrieval across topics. A quiz in Lesson 5 should sometimes ask about Lesson 1-4 material to force discrimination.
- **No knowledge networks.** Words exist as isolated Korean→English pairs. There's no connecting 꿈 (dream) to 꿈을 꾸다 (to have a dream) to 꿈꾸다 (to dream) — no morphological networks, no semantic maps.
- **Flashcard-equivalent quizzes.** tap-meaning is literally a flashcard with 4 options. Sung specifically warns this creates an illusion of mastery without deep encoding.

### V2 fix
- Practice sessions mix material from multiple lessons (interleaving)
- Add comparison quizzes: "-고 vs -지만 — which fits?" (requires understanding both)
- Add application quizzes: "Read this new song line and pick what it means" (novel context)
- Song practice naturally creates knowledge networks (same word in different song lines = varied context)
- Distractor explanations teach discrimination: "B would mean 'but', which contradicts the happy tone"

---

## 5. Incidental / Contextual Vocabulary Learning

**The theory:** Most vocabulary in a first language is learned incidentally — through repeated exposure in meaningful contexts, not through explicit study. For L2, research shows: frequency of exposure matters most, varied contexts deepen encoding, and multimodal input (text + audio + visual) enhances acquisition. Incidental learning happens when focus is on meaning/message, not on the vocabulary itself.

### What we're doing right
- **Song context.** Words come from real songs = authentic context.
- **Multimodal.** Korean text + TTS audio + English translation = three channels.
- **Line breakdowns.** Seeing how words function within a real sentence.

### What's broken
- **Exposure frequency is catastrophically low.** Each word appears in ~3-4 screens total (word card, quiz, maybe a context sentence, recap). Research says 10-15 encounters minimum for retention. We're at 20-30% of what's needed.
- **Zero contextual diversity.** 꿈 appears only in 10cm's "Phonecert" context. Never in another song, never in a different sentence structure. Research specifically shows contextual diversity drives retention.
- **Explicit focus, not incidental.** Every word introduction is explicitly flagged: "Here's the word. Here's what it means. Now we'll test you." This is the opposite of incidental learning. The user never discovers a word through context — they're always told first.
- **No extensive reading/listening.** There's no mode where the user just reads or listens to Korean with glosses available on-demand. Everything is structured instruction.

### V2 fix
- Song practice = semi-incidental learning (focus is on understanding the song line, vocabulary acquisition is a side effect)
- Words from lessons reappear in different song contexts during practice
- Ungated song browsing = extensive reading with line-by-line support
- 12-15 lines per song = 3-4x more encounters per word in natural context

---

## Summary Scorecard

| Framework | Current Score | After V2 | Key Gap |
|-----------|:---:|:---:|---------|
| Krashen (Comprehensible Input) | 4/10 | 7/10 | Not enough input, too much testing |
| Spaced Repetition | 1/10 | 7/10 | SRS exists in code but is completely disconnected |
| Bloom (Mastery Learning) | 4/10 | 7/10 | No remediation, trivial assessments |
| Justin Sung (Higher-Order) | 3/10 | 6/10 | All retrieval is lower-order, no interleaving across lessons |
| Incidental/Contextual Learning | 3/10 | 7/10 | Too few encounters, zero contextual diversity |

## The Pattern

Every framework points to the same two problems:

1. **Not enough practice / exposure.** Lessons deliver information once. There's no mechanism for repeated, varied, spaced encounters with the material. This violates Krashen (not enough input), Ebbinghaus (no spacing), Bloom (no re-teaching), Sung (no interleaving), and incidental learning research (too few encounters).

2. **Testing is too easy and too frequent.** Quizzes test recognition of the thing-you-just-learned with obviously-wrong distractors. This violates Bloom (not real mastery assessment), Sung (lower-order retrieval only), and Krashen (raises affective filter without driving acquisition).

V2's practice mode directly addresses both problems. Song practice provides volume and contextual diversity. Vocab/grammar practice provides spaced, interleaved, higher-order retrieval. Better distractors make assessment meaningful.
