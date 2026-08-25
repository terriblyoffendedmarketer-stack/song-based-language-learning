@AGENTS.md

# Songwon (송원) — Korean Language Learning Through Songs

## Status — V2 In Progress

**What's live**: 20 V5 lessons + song browser (76 songs) + song practice + vocab/grammar practice with SRS. Deployed on Vercel + Capacitor Android APK.
**V2 done**: All phases complete — practice engine (SRS, mastery, gates), song practice pipeline, Spotify playlist, improved distractors, BottomNav, novel context questions, wrong-answer re-exposure, fill-in-blank dedup, song sentences in lesson practice, per-song progress, TTS for practice lines.
**V2 remaining**: None — all roadmap items complete.
**Deployed**: https://song-based-language-learning.vercel.app
**Repo**: https://github.com/terriblyoffendedmarketer-stack/song-based-language-learning (private)

Read `ROADMAP.md` for V2/V3/Promised Land vision. Read `pipeline/README.md` for all scripts.

## Quick Context
- Korean learning web app: songs → Claude AI generates immersive lessons → Duolingo-style study flow
- Teaching: Krashen's comprehensible input + interleaved teach/test (LingoDeer-style)
- Platforms: Web (Vercel), PWA, Android APK (Capacitor)
- User has ADHD — UX must be addictive, short sessions, clear progress, audio on every interaction

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Anthropic SDK for lesson generation (`claude-sonnet-4-5-20250929`)
- Edge TTS (Microsoft Neural) for Korean pronunciation — Python `edge-tts` via subprocess
- Capacitor for Android APK (WebView pointing to Vercel deployment)
- localStorage for persistence (progress, settings, in-progress state)

## What's Built
- **V5 lesson engine**: 20 lessons, ~30 screens each, JSON-driven screen types (intro, lyrics-fullsong, line-breakdown, word-card, phrase-card, quiz, context-sentence, pattern-spotlight, recap)
- **Interleaved teaching**: teach one word → test immediately → context sentence → next word (never batch)
- **Edge TTS**: ~4,691 pre-cached Korean audio clips + on-demand generation via Python subprocess
- **Progress saving**: lesson progress persists across app restarts (currentIndex + answers in localStorage)
- **Daily reminders**: Korean trivia notifications — native on Capacitor, Web Notification API on PWA
- **Song browser** (`/browse`): 20 lessons organized by 5 curriculum units
- **Grammar glossary** (`/glossary`): searchable grammar reference
- **APK download**: available at `/downloads/songwon.apk` on the web app
- **Vocab underlines**: subtle colored underlines on vocab words in line-breakdown screens

## TTS System
- **Primary**: Edge TTS via Python `edge-tts` subprocess (Microsoft Neural voices, free)
- **Voice**: `ko-KR-SunHiNeural` (female, natural-sounding)
- **Cache**: ~4,691 MP3s in `pipeline/tts_cache/`, served via `/api/tts-cached`
- **On-demand**: cache miss → generates via Python subprocess → saves to cache → serves
- **Fallback**: Web Speech API (robotic, last resort)
- **Regenerate cache**: `python3 pipeline/generate_tts.py`
- **Gotcha**: npm `edge-tts` v1.0.1 gets 403 from Microsoft. Python `edge-tts` works fine.

## Capacitor / Android
- Config: `capacitor.config.ts` → points `server.url` to Vercel deployment
- App ID: `app.songwon.korean`
- Plugins: `@capacitor/local-notifications` for native reminders
- APK: `public/downloads/songwon.apk` (3.9MB debug build)
- Build: `npx cap sync android` then Android Studio → Build → APK

## Song Pipeline — `pipeline/`

Full docs: `pipeline/README.md`. All scripts have headers with usage + gotchas.

### Pipeline Steps (all complete)
1. Spotify extraction → `playlist.spotdl` (495 tracks)
2. Korean filtering → `korean_songs.json` (250 songs)
3. Song selection → `selected_songs.json` (76 songs)
4. YouTube Music download → `pipeline/audio/` (76 MP3s, gitignored)
5. Lyrics fetching → `pipeline/lyrics/` (76 files)
6. Unified manifest → `song_manifest.json`
7. Corpus analysis → `corpus_analysis.json` (1,127 vocab, 320 grammar patterns)
8. Song context → `pipeline/song_context/*.json` (72 files)
9. Curriculum map → `curriculum_map.json` (5 levels)
10. V5 lesson generation → `public/data/lessons_v5/*.json` (20 lessons)
11. TTS cache → `pipeline/tts_cache/` (~4,691 MP3s)
12. Song practice data → `public/data/song_practice/*.json` (76 files, via `generate_song_practice.py`)
13. Song practice audit → `pipeline/audit_song_practice.py` (quantitative quality check)
14. **Add new songs** → `pipeline/add_songs.py` (full pipeline: lyrics → audio → data → practice → TTS). Use `/add-songs` skill.

### Key Pipeline Data
- `pipeline/song_manifest.json` — unified index: 72 songs → MP3s → lyrics
- `pipeline/corpus_analysis.json` — vocabulary + grammar + difficulty ratings
- `pipeline/curriculum_map.json` — songs to 5 learning levels
- `pipeline/song_context/*.json` — verse-by-verse breakdowns
- `public/data/lessons_v5/*.json` — 20 production lesson files

### Design Docs
- `pipeline/SESSION_DESIGN.md` — V4 canonical session flow (interleaved teach/test)
- `pipeline/EXAMPLE_LESSON_10cm_My_Eyes.md` — gold-standard example lesson
- `pipeline/CURRICULUM_PROGRESSION.md` — grammar-first curriculum (20 lessons, 5 units)
- `pipeline/CURRICULUM_DESIGN.md` — how songs become lessons

## Key Web App Files
- `app/learn/v5/[lessonId]/page.tsx` — V5 lesson engine (main lesson UI)
- `app/page.tsx` — home screen (resume, stats, song library CTA, APK download)
- `app/browse/page.tsx` — lesson browser by unit
- `app/songs/page.tsx` — song library browser (all 72 songs, ungated)
- `app/songs/[songId]/practice/page.tsx` — song practice engine (line-by-line)
- `app/progress/page.tsx` — progress dashboard (V5 data)
- `app/glossary/page.tsx` — grammar glossary
- `app/api/tts-cached/route.ts` — TTS API (cache + on-demand generation)
- `app/api/audio/route.ts` — MP3 streaming with range requests
- `hooks/useTTS.ts` — client-side TTS hook (Edge TTS → Web Speech fallback)
- `lib/v5-progress.ts` — progress tracking (save/load/unlock)
- `lib/seed-loader.ts` — data loaders (lesson index, song index, curriculum)
- `lib/notifications.ts` — cross-platform notification service
- `components/BottomNav.tsx` — shared bottom navigation (Home, Lessons, Songs, Progress)
- `components/ReminderSettings.tsx` — reminder toggle + time picker
- `lib/practice-engine.ts` — SRS engine, session generation, mastery tracking, distractor selection
- `app/practice/page.tsx` — vocab/grammar practice session UI (lobby, quiz, results)
- `pipeline/generate_song_practice.py` — generates rich practice data for all 72 songs via Claude API
- `pipeline/create_spotify_playlist.py` — creates Spotify playlist of all 72 study songs

## V2 Files
- `V2_ROADMAP.md` — V2 roadmap (practice mode, song learning, quiz improvements)
- `LEARNING_SCIENCE_AUDIT.md` — audit vs Krashen, Bloom, Ebbinghaus, Justin Sung
- `FINAL_VERSION_BLUEPRINT.md` — universal multi-language version (future)
- `public/data/song_index.json` — 72-song index for song browser
- `public/data/lyrics/*.txt` — raw lyrics files for song practice
- `public/data/song_practice/*.json` — rich practice data (generated, per-song)
- `public/data/practice/vocab_pool.json` — all 80 vocab items across 20 lessons
- `public/data/practice/grammar_pool.json` — all 20 grammar points across 20 lessons

## How to Run
1. `npm install` in `songwon/`
2. Create `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...` (+ Spotify/Genius creds for pipeline)
3. `npx next dev --turbopack` → http://localhost:3000
4. For TTS generation: `pip3 install edge-tts` (Python)

## Past Mistakes — DO NOT REPEAT
1. **YouTube video vs YouTube Music**: Always search music.youtube.com for studio audio
2. **BTS Mic Drop**: Downloaded Steve Aoki Remix — verify duration matches Spotify
3. **SHAUN Way Back Home**: Search "SHAUN 숀 Way Back Home 웨이백홈" for Korean solo version
4. **Korean artist names**: Try Korean names when English fails (가호, 이하이, Agust D)
5. **Genius API**: Skip URLs with "english-translation" or "romanized"
6. **npm edge-tts 403**: Use Python `edge-tts` via subprocess, not npm package
6b. **yt-dlp 403 on YouTube**: Always use `--cookies-from-browser chrome` flag — without it, most YT Music tracks return 403
7. **Audio goes in `public/audio/`, NOT just `pipeline/audio/`**: The app serves audio via Howler.js from `public/audio/` (deployed to Vercel). `pipeline/audio/` is gitignored and only exists locally. Always copy MP3s to BOTH directories. `add_songs.py` handles this automatically.
8. **AI refuses Korean lyrics**: Use placeholder fields + `merge_lyrics_into_context.py`
9. **Colored vocab text is ugly**: Use subtle underlines (decoration-*-400/60), not colored text
10. **Progress hardcoded to 0**: Save actual `currentIndex` and `answers`, not hardcoded values

## Style Rules
- Korean serif font (`.kr` class) for Korean display text
- UI labels: Korean primary, small English hint below (KrTip component)
- No AI clichés, no "it's not X it's Y" — write like a K-pop fan magazine reader
- All colors via CSS custom properties in `globals.css`

## Notes
- Next.js 16: async `params` — must `use(params)` or `await params`
- Tailwind v4: `@import "tailwindcss"` + `@theme inline` (no tailwind.config.js)
- Global git auto-push hook at `~/.git-hooks/post-commit`
- Songs ONLY from user's Spotify playlist — no catalog expansion
