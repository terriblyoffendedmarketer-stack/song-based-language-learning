# 송원 Songwon — Learn Korean Through Music

## What is this?

A web app that teaches Korean through songs you already love. Instead of boring textbook dialogues, you learn vocabulary, grammar, and comprehension from real Korean music — with the actual songs playing while you study.

Built on two proven language learning theories:
- **Krashen's Comprehensible Input (i+1)**: learn through meaningful content just slightly above your level
- **Mass Immersion Approach**: 80-90% target language, minimal English, grammar emerges from patterns rather than rules

---

## The Two Parts

### Part 1: Song Acquisition Pipeline (runs occasionally)

A standalone script/tool that gets your songs ready for learning. You run it whenever you want to add new songs.

**Flow:**
```
Spotify playlist URL
  → Extract all tracks via Spotify API
  → Auto-filter Korean songs (language metadata)
  → You pick favorites from a checklist (10-50 songs)
  → Download audio from YouTube via yt-dlp
  → Fetch lyrics (Genius API → Namu Wiki → manual paste)
  → You verify lyrics are correct
  → Sync lyrics to audio timing (Whisper alignment)
  → Output: MP3 files + synced lyrics + metadata
```

**What's automatable vs. needs you:**

| Step | Auto? | Notes |
|------|-------|-------|
| Playlist parsing | Yes | Spotify API (public metadata) |
| Korean filtering | ~90% | Language tags + detection |
| Song selection | You | "Songs I vibe with" is subjective |
| YouTube download | Yes | yt-dlp |
| Lyrics fetch | ~80% | APIs + manual fallback |
| Lyrics verification | You | Quick scan for errors |
| Audio-lyric sync | ~70% | Whisper + manual adjust |

**Key design decision:** State is saved as JSON after each step. You can pause, resume, re-run any step, or replicate the whole pipeline for a different language later.

### Part 2: Songwon Web App (the daily learning tool)

Takes the pipeline output and turns it into addictive, immersive Korean lessons.

**Flow:**
```
Import MP3s + lyrics
  → Claude AI analyzes: vocabulary, grammar patterns, cultural context
  → Claude AI generates immersive lessons (80-90% Korean)
  → You study: listen → learn words → practice → grammar → sing along
  → SRS reviews words across songs over time
  → Track streaks, XP, progress
```

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Web app framework | Next.js 16 (App Router, TypeScript) | Fast, modern, works on all browsers |
| Styling | Tailwind CSS v4 | Rapid UI development |
| AI lesson generation | Claude API (Anthropic SDK) | Best at understanding Korean context + generating lessons |
| Audio playback | Howler.js | Segment/sprite support for verse-level playback |
| MP3 metadata | music-metadata | Extract title/artist from files |
| Korean TTS | Google Cloud TTS (Neural2/Chirp 3) | Natural-sounding Korean, pre-generate + cache as MP3s |
| Lyrics API | Genius API (genius-lyrics-api) | Good K-pop coverage |
| Local storage | localStorage + IndexedDB (idb) | Structured data + audio blob storage |
| YouTube download | yt-dlp (pipeline only) | Reliable audio extraction |
| Audio-lyric sync | OpenAI Whisper (pipeline only) | Korean speech recognition for timing alignment |

---

## Teaching Philosophy (baked into every lesson)

These principles come from Stephen Krashen's research and the Mass Immersion Approach. They guide every design decision:

1. **Acquisition > Learning**: People acquire language subconsciously through meaningful exposure, not by memorizing rules. The app prioritizes understanding real song content over drilling grammar tables.

2. **i+1 Comprehensible Input**: Content should be ~90-95% understandable with ~5-10% new material. Too easy = no progress. Too hard = noise. The app adapts to user level.

3. **Low Affective Filter**: Anxiety blocks learning. Fun, low-pressure experience is not nice-to-have — it's a prerequisite. Music inherently lowers anxiety. ADHD-friendly design (short sessions, clear progress, dopamine hits).

4. **Grammar Emerges from Patterns**: Don't teach grammar rules explicitly. Show patterns in song lyrics, give examples, let the user discover the rule. "Here's how IU uses -(으)ㄴ 건 아닐까 in this line" > "The -(으)ㄴ 건 아닐까 pattern is used for..."

5. **SRS on Sentences, Not Words**: Spaced repetition uses full song lines in context, not isolated flashcard words. Context-rich repetition is what makes vocabulary stick.

6. **Music = Free Repetition + Emotion**: Songs are naturally repetitive (chorus!), emotionally engaging, and provide melody/rhythm as scaffolding for meaning. Learners will replay songs outside the app, getting extra exposure for free.

---

## UX Design Principles

The user has ADHD and has abandoned a previous Korean learning app after 3 uses. Every design decision must answer: "Will this make them want to come back tomorrow?"

- **Duolingo/LingoDeer-level addictive UX**: progressive building, nudges, streaks, gamification
- **Audio on every interaction**: tap an answer → hear it in Korean. Never silent
- **Short sessions**: each lesson section = 3-5 minutes. Never overwhelming
- **Interleaved practice**: never more than 2-3 teaching items before a practice exercise. Explanation and practice build on each other contextually
- **Batch lesson generation**: upload 10 songs → get a curriculum across all of them, not one at a time
- **Visible progress**: XP, streak, vocabulary count, immersion minutes. Feel the growth
- **High-quality TTS**: Google Cloud TTS Neural2 Korean voices. Not robotic. Pre-generated and cached for instant playback
- **Korean-first UI**: all labels, headers, instructions primarily in Korean with small English hints

---

## What's Built So Far

### Completed (Phase 1)
- Next.js 16 project with TypeScript + Tailwind CSS v4
- Korean serif font (Noto Serif KR) loaded and configured
- Custom color system (warm paper tones, indigo accent, dark mode support)
- **Data models** (`lib/types.ts`): Song, Lesson, LessonAnalysis, VocabularyItem with SRS, Exercise, UserProgress with XP/streak
- **Storage layer** (`lib/storage.ts`): localStorage for structured data, IndexedDB for audio blobs and TTS cache. Helper functions for CRUD on songs, lessons, vocabulary, progress
- **MP3 metadata extraction** (`lib/metadata.ts`): extracts title, artist, album, duration, album art from MP3 files
- **Song upload flow** (`app/upload/page.tsx`): 3-step flow (upload → confirm → save) with drag-drop, batch support, metadata editing
- **Home screen** (`app/page.tsx`): song library grid, streak counter, XP badge, SRS review nudge, bottom navigation
- **Components**: SongUploader, MetadataEditor, SongCard
- Mobile responsive — tested on desktop and 375px viewport

### Completed (Phase 3 — Claude AI Lesson Generation)
- **Claude API client** (`lib/claude.ts`): Anthropic SDK singleton, reads `ANTHROPIC_API_KEY` from env
- **Analysis prompt** (`lib/prompts/analysis.ts`): system prompt + builder that requests structured JSON (line-by-line word breakdown, vocabulary with TOPIK levels 1-6, grammar patterns, cultural notes, song sections). Level-specific vocabulary prioritization
- **Lesson generation prompt** (`lib/prompts/lesson.ts`): system prompt encoding Krashen/MIA philosophy with strict rules (80-90% Korean, grammar from patterns, interleaved practice, ADHD-friendly). Builder takes analysis + section index, requests lesson flow: listen → vocab → practice → grammar → practice → combine → sing along
- **Analysis API route** (`app/api/analyze/route.ts`): POST route receives {title, artist, lyrics, level}, calls Claude claude-sonnet-4-20250514, returns structured analysis JSON
- **Lesson generation API route** (`app/api/generate-lesson/route.ts`): POST route with SSE streaming via ReadableStream + `client.messages.stream()`
- **Lesson stream hook** (`hooks/useLessonStream.ts`): client-side SSE consumer, accumulates text, parses final JSON for sections and xpReward
- **Song detail page** (`app/songs/[songId]/page.tsx`): multi-step flow — lyrics input → analyzing (calls /api/analyze) → review analysis (shows vocab/grammar/section counts) → generating lesson (streams from /api/generate-lesson) → done (save lesson + vocabulary to storage)

### Completed (Phase 4 — Lesson UI)
- **Lesson flow page** (`app/learn/[lessonId]/page.tsx`): Duolingo-style one-screen-at-a-time lesson with progress bar, forward/back navigation, completion celebration
- **Section renderer**: renders each section type (listen 🎧, vocabulary 📝, grammar 📐, practice ✏️, sing-along 🎤, context 💡) with lyric lines, content, and exercises
- **Exercise cards**: multiple-choice with instant feedback + word-ordering with drag-to-arrange tiles. Korean TTS plays on answer selection (using Web Speech API as placeholder until Google Cloud TTS is integrated)
- **Feedback banners**: green "맞아요! 잘했어요!" for correct, coral "다시 해 보세요!" with hints for incorrect
- **Lesson complete screen**: celebration with XP earned + sections completed stats

### Completed (Phase 5 — SRS)
- **SM-2 algorithm** (`lib/srs.ts`): `createInitialSRS()`, `reviewCard(srs, quality)` with quality 0-5, `getDueVocabulary()`, `getStrengthLabel()`. Intervals: fail=reset to 1 day, first success=1 day, second=6 days, then interval×ease
- **Review page** (`app/review/page.tsx`): flashcard-style review with tap-to-reveal, self-grading (몰라요/어려워요/쉬워요 → quality 1/3/5), progress bar, session stats (cards reviewed + accuracy %). Korean TTS on card flip. Shows song context line for each word

### Completed (Google Cloud TTS)
- **TTS API route** (`app/api/tts/route.ts`): proxies to Google Cloud TTS (ko-KR-Neural2-A female voice), returns MP3
- **TTS client hook** (`hooks/useTTS.ts`): fetches from API, caches in IndexedDB, falls back to Web Speech API if no Google key configured
- Lesson UI lyric lines are tappable (hear pronunciation), exercises use real TTS
- Review page card flip and example sentences use TTS

### Completed (Phase 6 — Gamification + PWA)
- **Confetti animation** (`components/gamification/Confetti.tsx`): canvas-based confetti on lesson completion
- **Level-up modal** (`components/gamification/LevelUpModal.tsx`): celebration when XP crosses level thresholds (초급 1-3, 중급 1-3, 고급 1-2)
- **Progress dashboard** (`app/progress/page.tsx`): level + XP bar, stats grid, vocabulary strength breakdown with stacked bar chart, recent words list
- **Correct/incorrect animations**: pulse on correct, shake on wrong answers
- **PWA**: manifest.json, service worker with offline + TTS caching, Apple Web App meta, SVG app icon
- **Service worker** (`public/sw.js`): caches static pages + TTS audio, network-first for navigation

### Completed (Song Acquisition Pipeline — Steps 1-2)
- **Spotify extraction**: 495 tracks from "Asian - ALL - TXT" playlist via `spotipy` with user's own Spotify API credentials. Data enriched with ISRC codes and artist genres. File: `pipeline/playlist.spotdl`
- **Korean song filtering**: `pipeline/filter_korean.py` auto-detects Korean songs using ISRC country code (KR prefix), hangul detection, artist genre tags, and a known-artist list (~100 artists). Japanese exclusion prevents false positives. **250 Korean songs found** out of 495 total. File: `pipeline/korean_songs.json`
- **Key decision**: Songs come ONLY from the user's Spotify playlist — no catalog expansion. The playlist represents their known/preferred songs
- **Key decision**: Lesson content generated via Claude Code conversation (not runtime API calls) — saved as seed data files

### Not Yet Built (Pipeline — Steps 3-7)
- **Song selection**: User picks which of the 250 Korean songs to build lessons for. Previously built as an interactive widget in Claude Desktop conversation — needs to be rebuilt/used
- **YouTube Music matching**: find correct YT Music versions (not video) for selected songs
- **Download pipeline**: yt-dlp to pull audio files
- **Lyrics extraction**: Genius API + synced lyrics
- **Lesson content generation**: Claude conversation generates structured lesson data, saved as seed files

### Not Yet Built (Web App)
- **Cross-song curriculum planning**: vocabulary ordering across multiple songs, progressive difficulty
- **Howler.js audio player**: song segment playback synced with lesson sections
- **Genius API lyrics fetching**: auto-fetch (manual paste works as fallback)
- **Korean UI hover tooltips**: English translations on hover for Korean interface labels (초급, 홈, 내 기록, etc.)

---

## Build Phases (remaining)

### Pipeline (separate from web app)
Build as `pipeline/` directory. Node.js scripts, each step saves state to JSON.
1. `01-spotify-extract.ts` — parse playlist URL, extract tracks
2. `02-filter-korean.ts` — auto-filter by language
3. `03-select-favorites.ts` — interactive CLI or HTML checklist for user selection
4. `04-youtube-download.ts` — yt-dlp wrapper, download as MP3
5. `05-fetch-lyrics.ts` — Genius API + fallbacks
6. `06-sync-lyrics.ts` — Whisper-based audio-text alignment
7. `07-export.ts` — package everything for Songwon import

### Phase 2: Lyrics Fetching
- Genius API wrapper + server route
- LyricsFetcher component (auto-fetch + manual paste)
- May be simplified if pipeline handles lyrics pre-import

### Phase 3: Lesson Generation (core feature)
- Claude API client setup
- Analysis prompt: structured output for vocabulary, grammar, sections
- Lesson generation prompt: immersive Korean-first content, Krashen-aligned
- Streaming lesson display
- Curriculum planning across multiple songs

### Phase 4: Lesson UI
- Full-screen Duolingo-style lesson flow (one screen at a time)
- Audio on every interaction
- Exercise components: fill-blank, listening, word match, word order, comprehension
- Song segment playback synced with lesson sections
- Google Cloud TTS for word pronunciation

### Phase 5: SRS + Review
- SM-2 spaced repetition algorithm
- Review session page with song-context quizzes
- Cross-song vocabulary reinforcement

### Phase 6: Gamification + Polish
- XP system, streak tracking, daily goals
- Progress dashboard
- Level-up animations, celebration screens
- PWA setup for mobile home screen
- App icon

---

## File Structure

```
songwon/
├── app/
│   ├── layout.tsx              # Root layout, Korean fonts, metadata
│   ├── page.tsx                # Home / song library (BUILT)
│   ├── globals.css             # Design system tokens (BUILT)
│   ├── upload/page.tsx         # Song upload flow (BUILT)
│   ├── songs/[songId]/page.tsx # Song detail + analyze + generate (BUILT)
│   ├── learn/[lessonId]/page.tsx # Duolingo-style lesson flow (BUILT)
│   ├── review/page.tsx         # SRS flashcard review (BUILT)
│   ├── progress/page.tsx       # Progress dashboard (BUILT)
│   └── api/
│       ├── lyrics/route.ts     # Genius API proxy (TODO)
│       ├── analyze/route.ts    # Claude structured analysis (BUILT)
│       ├── generate-lesson/route.ts # Claude lesson gen + SSE streaming (BUILT)
│       └── tts/route.ts        # Google Cloud TTS proxy (BUILT)
├── components/
│   ├── song/                   # SongCard, SongUploader, MetadataEditor (BUILT)
│   ├── audio/                  # AudioPlayer, PlaybackControls (TODO)
│   ├── lesson/                 # (inline in learn page for now)
│   ├── exercise/               # (inline in learn page for now)
│   └── gamification/           # Confetti, LevelUpModal (BUILT)
├── lib/
│   ├── types.ts                # All data models (BUILT)
│   ├── storage.ts              # localStorage + IndexedDB (BUILT)
│   ├── metadata.ts             # MP3 tag extraction (BUILT)
│   ├── claude.ts               # Anthropic SDK client (BUILT)
│   ├── genius.ts               # Genius API wrapper (TODO)
│   ├── tts.ts                  # TTS utilities (TODO)
│   ├── srs.ts                  # SM-2 spaced repetition (BUILT)
│   └── prompts/
│       ├── analysis.ts         # Claude analysis prompt (BUILT)
│       └── lesson.ts           # Claude lesson gen prompt (BUILT)
├── hooks/
│   └── useLessonStream.ts      # SSE stream consumer (BUILT)
├── pipeline/                   # Song acquisition pipeline
│   ├── README.md               # Pipeline status and next steps (BUILT)
│   ├── playlist.spotdl         # Raw Spotify data — 495 tracks with ISRC + genres (BUILT)
│   ├── korean_songs.json       # Filtered Korean songs — 250 songs (BUILT)
│   └── filter_korean.py        # Korean detection script (BUILT)
└── package.json
```

---

## API Keys Needed

| Service | What for | How to get |
|---------|----------|-----------|
| Anthropic (Claude) | Lesson generation | https://console.anthropic.com |
| Genius | Lyrics fetching | https://genius.com/api-clients |
| Google Cloud TTS | Korean pronunciation | https://console.cloud.google.com (enable TTS API) |
| Spotify | Playlist parsing (pipeline) | https://developer.spotify.com/dashboard |

Store in `.env.local` (never committed):
```
ANTHROPIC_API_KEY=sk-ant-...
GENIUS_API_KEY=...
GOOGLE_CLOUD_TTS_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

---

## Lesson Demo

An interactive lesson demo was created as a published artifact showing what a lesson for IU's "좋은 날" (Good Day) looks like. It demonstrates:
- Korean-first instruction with minimal English glosses
- Interleaved practice after every 2-3 teaching items
- Vocabulary cards with TTS pronunciation
- Grammar emerging from song context
- Fill-in-the-blank, sentence ordering, comprehension exercises
- Progressive building (Line 1 → Line 2 → combine → cultural context → sing along)

---

## Research Findings

### Krashen's Theory (applied to app design)
- Present words in real song contexts, never isolated flashcards
- User should understand 90-95% of what they see (i+1)
- Make it feel like entertainment, not study (low affective filter)
- Sentence-level SRS tied to song lines (context-rich repetition)
- Let grammar emerge from patterns, don't teach rules explicitly
- Track comprehension/immersion time as primary metric

### Korean TTS (research summary)
1. **Google Cloud TTS** (recommended): Neural2/Chirp 3 Korean voices, ~$16/M chars, full SSML, pre-generate + cache
2. **ElevenLabs**: Best raw quality, 4-7x more expensive, use for pre-generation if budget allows
3. **Microsoft Azure**: Good alternative, similar pricing to Google
4. **Strategy**: Pre-generate all word/sentence audio at lesson creation time, store as cached MP3s for instant playback (zero latency)

---

## Roadblocks & Solutions Log

| Roadblock | Solution | Date |
|-----------|----------|------|
| Directory name with spaces breaks `create-next-app` | Created project as `songwon/` subdirectory | 2026-07-28 |
| `music-metadata` Uint8Array type incompatibility with Blob | Use `buffer.slice()` with explicit ArrayBuffer cast | 2026-07-28 |
| Next.js dev server CWD issue with launch.json | Use `/bin/sh -c "cd ... && npx next dev"` wrapper | 2026-07-28 |
| Node.js not installed | `brew install node` (v26.5.0) | 2026-07-28 |
| `spotdl save` extremely slow (30+ min for 495 tracks) | Use `spotipy` library with user's own Spotify credentials instead — completes in 3.9s | 2026-07-31 |
| spotdl shared Spotify credentials rate-limited (86400s) | User provided their own Spotify API credentials stored in `.env.local` | 2026-07-31 |
| Korean song filter only found 121/250 songs | Re-fetched playlist with ISRC codes and artist genre data — ISRC "KR" prefix alone catches 222 Korean songs | 2026-07-31 |
| Japanese false positives (LiSA, Eve, RADWIMPS) in Korean filter | Added Japanese character detection regex — if title has Japanese chars + no hangul, skip even if artist matches | 2026-07-31 |

Keep adding to this table as you encounter and solve issues. This is the replication guide.
