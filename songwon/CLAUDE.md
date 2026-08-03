@AGENTS.md

# Songwon (송원) — Korean Language Learning Through Songs

Read PROJECT.md for the full spec, architecture, and current status.

## Quick Context
- Korean learning web app: users upload MP3s of Korean songs → Claude AI generates immersive lessons → Duolingo-style study flow
- Teaching philosophy: Krashen's comprehensible input + Mass Immersion Approach (80-90% Korean, grammar from patterns not rules)
- Target: web app for MacBook + Android browsers, mobile-first
- User has ADHD — UX must be addictive, short sessions, clear progress, audio on every interaction

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Anthropic SDK for lesson generation
- Howler.js for audio, Google Cloud TTS for pronunciation
- localStorage + IndexedDB for persistence (no backend)

## What's Built (Web App)
- Phase 1 complete: project setup, data models, storage layer, upload flow, home screen
- Phase 3 complete: Claude AI lesson generation pipeline (analysis + lesson gen + SSE streaming)
- Phase 4 complete: Duolingo-style lesson UI (one-screen-at-a-time, exercises, feedback, completion)
- Phase 5 complete: SRS spaced repetition (SM-2 algorithm + review page with self-grading)
- Phase 6 complete: gamification (confetti, level-up modal, progress dashboard, PWA)
- Google Cloud TTS complete: Neural2 Korean voice + Web Speech API fallback
- **Song browser** (`/browse`): 72 songs organized by 5 curriculum levels, grammar/vocab tags per song
- **Seed data lessons**: 72 pre-generated lessons loaded from `public/data/` — no Claude API needed
- **Lesson flow from seed**: learn page loads from seed JSON when lesson not in localStorage
- **Audio player**: Howler.js player on listen/sing-along sections, streams MP3s from `pipeline/audio/` via API route
- **Vocab TTS cards**: vocabulary section renders tappable word cards with TTS pronunciation
- **Exercise TTS**: Korean exercise prompts have a speaker button; selecting an answer speaks it

## Song Acquisition Pipeline — CURRENT STATUS

The pipeline lives in `pipeline/`. Read `pipeline/README.md` for scripts and run instructions.

### What's done:
1. **Spotify extraction** — 495 tracks from playlist → `playlist.spotdl`
2. **Korean filtering** — 250 Korean songs → `korean_songs.json`
3. **Song selection** — 72 songs (63 original + 5 user additions + 4 later additions) → `selected_songs.json`
4. **YouTube Music download** — 72 MP3s in `pipeline/audio/` (gitignored)
5. **Lyrics fetching** — 72/72 lyrics → `pipeline/lyrics/`
6. **Unified manifest** — `pipeline/song_manifest.json` links every song → its MP3 → its lyrics
7. **Corpus analysis** — 1,127 vocab items, 320 grammar patterns, 72 songs rated → `pipeline/corpus_analysis.json`
8. **Song context enrichment** — 72 verse-by-verse context files with literal + cultural meaning → `pipeline/song_context/*.json`
9. **Curriculum map** — 72 songs mapped to 5 levels (6/11/27/23/5) → `pipeline/curriculum_map.json`

### What's done (all pipeline steps complete):
10. **Lesson generation** — 72 lessons generated from curriculum + corpus + context → `pipeline/lessons/*.json`
11. **Seed data in web app** — lessons + curriculum map copied to `public/data/` for runtime access
12. **BewhY lyrics fixed** — re-fetched and merged into context file
13. **Audio player** — Howler.js streaming from API route at `/api/audio`
14. **Vocab TTS + exercise TTS** — tappable word cards, speaker buttons on Korean prompts
15. **Edge TTS cache** — pre-generated ~3,349 Korean audio clips via `generate_tts.py` → `pipeline/tts_cache/`
16. **Session structure designed** — `pipeline/SESSION_DESIGN.md` defines the new lesson flow (approved)

### NEXT STEP — Implement V4 lesson flow (interleaved teaching)

**READ THESE FIRST:**
1. `pipeline/SESSION_DESIGN.md` (V4) — the canonical lesson flow with LingoDeer-style interleaving
2. `pipeline/EXAMPLE_LESSON_10cm_My_Eyes.md` — gold-standard example lesson (38 screens, screen-by-screen)
3. `pipeline/CURRICULUM_PROGRESSION.md` — grammar-first curriculum (20 lessons, 5 units)

**What needs to happen:**
1. **Review example lesson with user** — the example lesson doc needs user approval before implementation
2. **Rebuild `generate_lessons.py`** to produce the interleaved flow (teach → test → context sentence → teach next → test → mix review)
3. **Add new section types to `lib/types.ts`**: `vocab-transition`, `word-card`, `context-sentence`, `quiz` (current types are V2, not V4)
4. **Rewrite lesson UI** (`app/learn/[lessonId]/page.tsx`) for V4 section types — word cards with highlighted target words, context sentences with accent-colored highlights, one-question quiz screens, phrase cards
5. **Make UI prettier** — user said "the user interface looks so boring"
6. **Rebuild curriculum map** — currently song-first (each song = one lesson). Needs to be grammar-first (each grammar point = one lesson, pulling lines from multiple songs). See `CURRICULUM_PROGRESSION.md`.

**Key V4 design decisions (approved by user):**
- Interleave teaching and testing — never batch all vocab then all quizzes
- 2 words + 2 phrases per lesson (phrases preferred over individual words)
- Context sentences shown AFTER quizzes as reinforcement (highlighted target word, auto-TTS, not a quiz)
- Mix review quizzes after every 2 items (forces recall of earlier items)
- Escalating exercise types: recognition → fill-blank → distinguish → sentence ordering
- ~37-40 screens per lesson, 8-12 minutes
- Grammar-first curriculum: define grammar progression, then find matching songs

**Known content issues:**
- Song context files have hallucinated literal translations (don't match actual Korean lyrics)
- Current lessons (in `public/data/`) use old V2 flat structure — need regeneration
- Current `generate_lessons.py` has a missing `get_context_card()` function (would error on run)

### Content generation reference files
- `pipeline/SESSION_DESIGN.md` — **READ FIRST** — V4 canonical session flow (interleaved teach/test/context)
- `pipeline/EXAMPLE_LESSON_10cm_My_Eyes.md` — gold-standard example (10cm - My Eyes, 38 screens)
- `pipeline/CURRICULUM_PROGRESSION.md` — grammar-first lesson sequence (20 lessons, 5 units)
- `pipeline/song_context/Gaho - 시작.json` — gold-standard format for context files
- `pipeline/CURRICULUM_DESIGN.md` — how songs become lessons, level definitions
- Writing style: no AI clichés, no "it's not X it's Y", write like a K-pop fan magazine reader (see memory: `feedback_writing-style.md`)

### Key pipeline files
- `pipeline/song_manifest.json` — **START HERE** — unified index: 72 songs with MP3 path, lyrics path, source info
- `pipeline/corpus_analysis.json` — vocabulary inventory (1,127 words), grammar patterns (320), per-song difficulty ratings
- `pipeline/curriculum_map.json` — songs mapped to 5 learning levels with key grammar/vocab per level
- `pipeline/song_context/*.json` — 72 files, each with verse-by-verse breakdown (lines + literal translation + cultural context)
- `pipeline/CURRICULUM_DESIGN.md` — how songs become lessons (READ BEFORE GENERATING CONTENT)
- `pipeline/README.md` — all scripts, run instructions, pipeline status

### Key decisions:
- Songs come ONLY from the user's Spotify playlist — no catalog expansion
- Script-based pipeline for mechanical tasks, AI only for lesson content generation
- YouTube Music (not YouTube video) for studio audio quality
- Lesson content generated via Claude conversation, saved as seed data (not runtime API calls)
- State saved as JSON between steps (pause/resume friendly)
- API credentials in `.env.local` (gitignored): Spotify + Genius

## Past Mistakes — DO NOT REPEAT

1. **YouTube video vs YouTube Music**: Searching youtube.com returns music videos with intros/outros/different versions. ALWAYS search music.youtube.com for studio audio. The download script (`download_songs.py`) already handles this correctly.

2. **BTS Mic Drop wrong version**: Downloaded Steve Aoki Remix instead of original. When downloading, verify the duration matches the Spotify duration. The Aoki remix is longer (~4:02) vs original (~3:38).

3. **SHAUN Way Back Home wrong version**: First download got the Conor Maynard/Sam Feldt remix. Must search "SHAUN 숀 Way Back Home 웨이백홈" to get the solo Korean version. The remix has English vocals.

4. **Korean artist names for search**: When English names fail to find the right song, try Korean names. Examples: "가호" not "Gaho", "이하이" not "LEEHI", "Agust D" not "Suga" for 대취타.

5. **Genius API returns translations first**: Genius search results include English translations and romanizations before the original Korean page. Always skip URLs containing "english-translation" or "romanized".

6. **Google blocks scrapers**: Google returns CAPTCHA/verification pages to automated requests. Don't rely on Google scraping. Use direct site APIs instead (Genius API, lyrics.ovh).

7. **download_status.json had missing file paths**: Songs downloaded in retry batches didn't always get their `file` field updated. The manifest (`song_manifest.json`) has the corrected paths. Always verify with `os.path.exists()`.

8. **lyrics.ovh low hit rate for K-pop**: Only found 26/63 songs. Genius API (via lyricsgenius library) found 29 more. Always use both: `fetch_lyrics.py` (lyrics.ovh) first, then `fetch_lyrics_web.py` (Genius) for the rest.

9. **Widget DOM re-renders reset scroll**: When building interactive selection UIs, don't rebuild the full DOM on each click — use event delegation and toggle classes in-place, or the scroll position resets to the top.

10. **`yt-dlp --print` with `-x` skips download**: Using `--print after_filter:...` together with `-x` (extract audio) causes yt-dlp to print metadata but skip the actual download. Separate the search step (--flat-playlist --print) from the download step (separate yt-dlp call).

11. **AI agents refuse Korean lyrics in context files**: Subagents refuse to reproduce Korean song lyrics in generated context files. Workaround: agents write analysis with placeholder `lines` fields, then `merge_lyrics_into_context.py` injects Korean text from the existing lyrics files.

12. **BewhY lyrics file corrupted**: `pipeline/lyrics/BewhY - OK (Prod. by GRAY).txt` contained a K-pop release calendar instead of actual lyrics. FIXED — user pasted correct lyrics manually.

## What's NOT Built Yet (Web App)
- **V4 interleaved lesson flow** — lessons need to follow SESSION_DESIGN.md V4 (interleaved teach/test/context). Current lessons use old V2 flat structure. See EXAMPLE_LESSON doc.
- **Grammar-first curriculum** — current curriculum is song-first (each song = one lesson). Needs rebuild to grammar-first (each grammar point = one lesson, songs matched). See CURRICULUM_PROGRESSION.md.
- **Prettier UI** — user said "the user interface looks so boring." Needs visual redesign.
- **New section types** — `vocab-transition`, `word-card`, `context-sentence`, `quiz` not yet in types.ts or UI
- Audio segment playback (play specific verse/chorus sections, not just full song)
- Audio line extraction (mapping lyrics lines to timestamps in MP3s)
- User onboarding flow (level placement, song preferences)

## TTS Setup
- **Edge TTS** (Microsoft Neural voices, free) — pre-generated cache in `pipeline/tts_cache/`
- Voice: `ko-KR-SunHiNeural` (female, natural-sounding)
- 3,349 Korean texts cached (vocab words, lyric lines, exercise prompts)
- Served via `/api/tts-cached` route, falls back to Google Cloud TTS then Web Speech API
- Regenerate: `python3 pipeline/generate_tts.py`
- Future: may upgrade to Google Cloud TTS Neural2 for even better quality

## Style Rules
- Korean serif font (`kr` class) for Korean display text
- UI labels: Korean primary, small English hint below
- Lesson content: 80-90% hangul, English only for word translations in parentheses
- All colors via CSS custom properties (see globals.css)

## Key Files
### Web App
- `lib/types.ts` — all data model interfaces
- `lib/storage.ts` — persistence layer (localStorage + IndexedDB)
- `lib/claude.ts` — Anthropic SDK client singleton
- `lib/prompts/analysis.ts` — structured analysis prompt for Claude
- `lib/prompts/lesson.ts` — lesson generation prompt (Krashen/MIA encoded)
- `lib/srs.ts` — SM-2 spaced repetition algorithm
- `lib/metadata.ts` — MP3 tag extraction
- `lib/seed-data.ts` — sample lesson data for IU's "좋은 날"
- `hooks/useLessonStream.ts` — SSE stream consumer for lesson generation
- `app/page.tsx` — home screen
- `app/upload/page.tsx` — song upload flow
- `app/songs/[songId]/page.tsx` — song detail + lyrics + analyze + generate
- `app/learn/[lessonId]/page.tsx` — Duolingo-style lesson flow
- `app/review/page.tsx` — SRS flashcard review
- `app/progress/page.tsx` — progress dashboard
- `app/api/analyze/route.ts` — Claude structured analysis endpoint
- `app/api/generate-lesson/route.ts` — Claude lesson gen with SSE streaming
- `app/api/tts/route.ts` — Google Cloud TTS proxy
- `app/api/audio/route.ts` — streams MP3s from pipeline/audio/ with range request support
- `hooks/useTTS.ts` — TTS client with IndexedDB caching
- `hooks/useAudioPlayer.ts` — Howler.js audio player hook (play/pause/seek/duration)
- `components/audio/AudioPlayer.tsx` — audio player UI component with progress bar
- `app/api/tts-cached/route.ts` — serves pre-generated Edge TTS audio from pipeline/tts_cache/
- `lib/seed-loader.ts` — loads curriculum map and lesson data from public/data/ JSON files
- `app/browse/page.tsx` — song browser organized by curriculum level
- `public/data/lesson_index.json` — index of all 72 generated lessons
- `public/data/curriculum_map.json` — songs mapped to 5 levels with grammar/vocab targets
- `public/data/lessons/*.json` — 72 pre-generated lesson files

### Pipeline Scripts (all reusable — see `pipeline/README.md` for run instructions)
- `pipeline/extract_playlist.py` — Spotify playlist extraction
- `pipeline/filter_korean.py` — Korean song detection
- `pipeline/select_songs.py` — interactive song picker
- `pipeline/download_songs.py` — YouTube Music downloader (resumable)
- `pipeline/fetch_lyrics.py` — lyrics.ovh API fetcher (resumable)
- `pipeline/fetch_lyrics_web.py` — Genius API fetcher for missing lyrics (resumable)
- `pipeline/merge_corpus_analysis.py` — merges batch analysis files into unified corpus
- `pipeline/merge_lyrics_into_context.py` — populates Korean lyrics into context files
- `pipeline/build_curriculum_map.py` — maps songs to 5 learning levels
- `pipeline/generate_lessons.py` — generates lesson seed data from curriculum + corpus + context
- `pipeline/generate_tts.py` — pre-generates Edge TTS MP3s for all Korean text (vocab, lyrics, exercises)

### Pipeline Data
- `pipeline/song_manifest.json` — unified index linking 72 songs → MP3s → lyrics
- `pipeline/corpus_analysis.json` — vocabulary + grammar + difficulty for all 72 songs
- `pipeline/tts_cache/` — pre-generated Edge TTS MP3s (~3,349 files) + manifest.json
- `pipeline/curriculum_map.json` — songs mapped to 5 levels with grammar/vocab targets
- `pipeline/song_context/*.json` — 72 verse-by-verse context files
- `pipeline/selected_songs.json` — user's 72 selected songs
- `pipeline/download_status.json` — YouTube match results per song
- `pipeline/lyrics_status.json` — lyrics fetch results per song
- `pipeline/CURRICULUM_DESIGN.md` — how songs become lessons

## How to Run
1. `npm install` in the `songwon/` directory
2. Create `.env.local` with:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   GENIUS_API_TOKEN=...
   ```
3. `npx next dev --turbopack` to start dev server on port 3000
4. Upload MP3s → paste lyrics → analyze → generate lesson → study

## Important Notes for Contributors
- Next.js 16 uses async `params` — must `use(params)` or `await params` in page components
- Tailwind v4 uses `@import "tailwindcss"` and `@theme inline` (not `tailwind.config.js`)
- All colors are CSS custom properties defined in `globals.css` with dark mode support
- `.kr` class applies Korean serif font (Noto Serif KR)
- Global git auto-push hook at `~/.git-hooks/post-commit` — commits auto-push to origin
- The pipeline is Python-based, the web app is TypeScript/Next.js
- GitHub repo: https://github.com/terriblyoffendedmarketer-stack/song-based-language-learning (private)
