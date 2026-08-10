# V2 Blueprint — Universal Song-Based Language Learning Tool

## Vision

A tool where anyone pastes their Spotify playlist link, picks a language they want to learn, and gets auto-generated immersive lessons built from songs they already love. No children's songs, no textbook dialogues — real music the learner listens to anyway, broken down into teachable moments.

**Prerequisite**: the learner can read the target language's script (even slowly). Reading instruction is out of scope — Hangul takes a few hours, hiragana/katakana a weekend, and Latin-script languages are free for English speakers. The tool assumes literacy and teaches vocabulary, grammar, and comprehension through song lyrics.

**Core insight (Krashen)**: difficulty scaling isn't about finding easier songs — it's about how much of each song you teach per lesson. A beginner lesson pulls 1-2 simple lines from a mainstream track and teaches basic words (I, you, love, go). An advanced lesson breaks down full verses with grammar patterns. Same playlist, different extraction depth.

---

## User Flow

```
1. User lands on the app
2. Picks target language (Korean, Japanese, German, French, Spanish, etc.)
3. Pastes Spotify playlist URL (or uploads MP3s as fallback)
4. Enters their Anthropic API key (BYOK model — no billing infrastructure needed)
5. App extracts playlist → filters target-language songs → shows song list
6. User confirms song selection (can add/remove)
7. Pipeline runs: download audio → fetch lyrics → analyze corpus → generate curriculum → generate lessons → generate TTS
8. User sees progress bar during generation (~2-5 min for 20 lessons)
9. Lessons appear — same interleaved teach/test flow as Songwon V1
10. User studies, progress saves, daily reminders, the whole loop
```

### Returning user flow
- Progress persists in localStorage (or optional account sync later)
- Can add new playlists → generates additional lessons that slot into their curriculum
- Can regenerate lessons at a different difficulty if they've leveled up

---

## Architecture

### What stays the same (inherited from Songwon V1)
- Next.js App Router + TypeScript + Tailwind CSS v4
- Screen-based lesson engine (JSON-driven, ~30 screens per lesson)
- Screen types: intro, lyrics-fullsong, line-breakdown, word-card, phrase-card, quiz, context-sentence, pattern-spotlight, recap
- Interleaved teach/test flow (teach word → test immediately → context → next word)
- Edge TTS for pronunciation (Python `edge-tts` subprocess)
- Progress tracking in localStorage
- Notification system (Web API + Capacitor native)
- PWA + Capacitor APK support

### What's new in V2
- **Language selector** — drives TTS voice, proficiency framework, font stack, corpus analysis prompts
- **Playlist ingestion UI** — paste URL, see extraction progress, confirm songs
- **Pipeline orchestrator** — web-facing wrapper around the Python scripts, with progress streaming
- **BYOK API key input** — user provides Anthropic key, stored in localStorage (never sent to our server)
- **Dynamic curriculum generator** — auto-builds lesson sequence from corpus analysis (no manual Claude conversation)
- **Difficulty calibration** — optional placement quiz or self-assessment to set starting level
- **Multi-playlist support** — add more playlists later, lessons merge into existing curriculum

---

## Pipeline — Step by Step

### Step 1: Playlist Extraction
**What it does**: Takes a Spotify playlist URL, extracts all tracks with metadata.
**Existing script**: `pipeline/extract_playlist.py`
**What needs changing**: Wrap in an API route. Currently reads `.env.local` for Spotify creds — V2 needs the user to provide Spotify access (OAuth or public playlist scraping).
**Output**: Track list with artist, title, ISRC, duration, genres.
**Alternative**: User uploads MP3s directly (skip Spotify entirely). Would need metadata extraction from ID3 tags.

### Step 2: Language Filtering
**What it does**: Filters tracks to the target language.
**Existing script**: `pipeline/filter_korean.py`
**What needs changing**: Generalize detection. Current script uses Korean-specific signals (ISRC "KR" prefix, hangul detection, Korean genre tags, known Korean artist list). V2 needs:
- ISRC country-code mapping for each language
- Script detection per language (hangul → Korean, hiragana/katakana → Japanese, etc.)
- Genre keyword lists per language
- Could also use a lightweight language detection library on track/artist names
**Output**: Filtered song list in the target language.

### Step 3: Song Selection (User Confirmation)
**What it does**: User reviews detected songs, adds/removes as needed.
**Existing script**: `pipeline/select_songs.py` (terminal-based interactive picker)
**What needs changing**: Replace with a web UI component. Show detected songs with checkboxes, let user add songs manually by pasting YouTube/Spotify links.
**Output**: Final song list for lesson generation.

### Step 4: Audio Download
**What it does**: Downloads songs from YouTube Music as MP3s.
**Existing script**: `pipeline/download_songs.py`
**What needs changing**: Wrap in API route with progress streaming. Handle errors gracefully (region locks, unavailable songs). Store in user-specific directory or cloud storage.
**Dependencies**: `yt-dlp`, `ffmpeg` — these need to be available on the server, which is a deployment consideration. Options:
- Run pipeline on user's machine (Electron/Tauri app)
- Run on a server with yt-dlp installed (not Vercel — needs persistent storage + CLI tools)
- Skip audio download entirely and link to Spotify/YouTube playback (simpler but worse UX)
**Output**: MP3 files per song.

### Step 5: Lyrics Fetching
**What it does**: Fetches lyrics for each song.
**Existing scripts**: `pipeline/fetch_lyrics.py` (lyrics.ovh) + `pipeline/fetch_lyrics_web.py` (Genius API)
**What needs changing**: Combine into a single multi-source fetcher. Add more sources for non-Korean languages:
- Genius API (good for most languages)
- lyrics.ovh (decent for popular songs)
- Musixmatch API (best coverage but rate-limited)
- User paste fallback (if automated fetch fails, let user paste lyrics manually)
**Output**: Lyrics text per song.

### Step 6: Corpus Analysis ← THE KEY AUTOMATION STEP
**What it does**: Analyzes all lyrics together to extract vocabulary, grammar patterns, and per-song/per-line difficulty ratings.
**Current approach**: Manual Claude conversation — paste all lyrics, ask for structured analysis.
**V2 approach**: Automated Anthropic API call with a language-specific analysis prompt.

**The prompt needs to**:
1. Identify all vocabulary items with frequency, difficulty tier, and English translations
2. Identify grammar patterns with explanations and difficulty ratings
3. Rate each song's overall difficulty (beginner/intermediate/advanced)
4. Rate each LINE's difficulty — this is critical for the "same song, different depth" approach
5. Tag which proficiency level each vocab/grammar item maps to (TOPIK levels for Korean, JLPT for Japanese, CEFR for European languages)

**Language-specific proficiency frameworks**:
| Language | Framework | Levels |
|----------|-----------|--------|
| Korean | TOPIK | 1-6 (1-2 beginner, 3-4 intermediate, 5-6 advanced) |
| Japanese | JLPT | N5-N1 (N5 easiest, N1 hardest) |
| German | Goethe-Zertifikat / CEFR | A1-C2 |
| French | DELF/DALF / CEFR | A1-C2 |
| Spanish | DELE / CEFR | A1-C2 |
| Chinese | HSK | 1-9 (1-3 beginner, 4-6 intermediate, 7-9 advanced) |

**Output**: `corpus_analysis.json` — vocabulary inventory, grammar patterns, difficulty ratings per song and per line.

**Token estimate**: ~50K input tokens (all lyrics + analysis prompt), ~20K output tokens. Cost: ~$0.50-1.00 per playlist on Sonnet.

### Step 7: Curriculum Generation ← ALSO NEEDS AUTOMATION
**What it does**: Maps analyzed content into a lesson sequence — which songs/lines go in which lesson, in what order.
**Existing script**: `pipeline/build_curriculum_map.py`
**What needs changing**: Current script maps songs to 5 hardcoded levels. V2 needs dynamic curriculum generation:

1. **Assess learner level** — placement quiz, self-assessment, or default to absolute beginner
2. **Select target items per lesson** — 2 words + 2 phrases, ordered by proficiency level and frequency
3. **Match songs to lessons** — for each lesson's target items, find the best song lines that contain them
4. **Line selection strategy**:
   - Beginner: pick lines where the target word is the most meaningful word (rest is connective tissue)
   - Intermediate: pick lines with 2-3 known words + the target word
   - Advanced: pick full verses with complex grammar

**This could be**:
- A deterministic algorithm (sort vocab by frequency × level, assign to lessons, find matching lines) — faster, cheaper, more predictable
- An AI call (give Claude the corpus analysis + learner level, ask for lesson sequence) — more creative line pairing but costs tokens
- Hybrid: deterministic lesson assignment, AI for line selection within each lesson

**Output**: `curriculum_map.json` — ordered lesson sequence with target vocab/grammar and song line references per lesson.

### Step 8: Lesson Generation
**What it does**: Generates the actual lesson JSON (30 screens per lesson) for each curriculum slot.
**Existing script**: `pipeline/generate_lesson_v6.py`
**What needs changing**: 
- Make the generation prompt language-aware (currently hardcoded for Korean)
- Feed in the curriculum map slot (target words, phrases, grammar, song lines) as context
- Quality gate validation still applies (check screen count, required types, target language text presence)

**The prompt template needs**:
- Target language + English labels
- Proficiency level context ("this learner is at JLPT N4" or "CEFR A2")
- Target vocabulary with translations
- Song lines with translations and context
- Screen type specifications (same as V1 — word-card, quiz, line-breakdown, etc.)

**Token estimate**: ~3K input + ~3K output per lesson. 20 lessons ≈ $1-2 on Sonnet.

### Step 9: TTS Cache Generation
**What it does**: Pre-generates audio for all target-language text in lessons.
**Existing script**: `pipeline/generate_tts.py`
**What needs changing**: Voice selection per language.

**Edge TTS voices (free, neural quality)**:
| Language | Voice | Notes |
|----------|-------|-------|
| Korean | `ko-KR-SunHiNeural` | Already using this |
| Japanese | `ja-JP-NanamiNeural` | Female, natural |
| German | `de-DE-KatjaNeural` | Female, natural |
| French | `fr-FR-DeniseNeural` | Female, natural |
| Spanish | `es-ES-ElviraNeural` | Castilian Spanish |
| Chinese | `zh-CN-XiaoxiaoNeural` | Mandarin, female |

**Output**: `tts_cache/` directory with MP3s for every target-language string in lessons.

### Step 10: Publish Lessons
**What it does**: Makes generated lessons available in the web app.
**Current approach**: Copy JSON files to `public/data/lessons_v5/`.
**V2 approach**: Write to a user-specific data directory (or IndexedDB for fully client-side). No hardcoded lesson files — everything is dynamically generated.

---

## Language Adaptation Layer

Each supported language needs a config file defining:

```json
{
  "code": "ko",
  "name": "Korean",
  "nativeName": "한국어",
  "scriptDetection": "hangul",
  "proficiencyFramework": "TOPIK",
  "proficiencyLevels": ["1", "2", "3", "4", "5", "6"],
  "beginnerLevels": ["1", "2"],
  "ttsVoice": "ko-KR-SunHiNeural",
  "fontClass": "kr",
  "fontFamily": "Noto Serif KR",
  "isrcCountryCodes": ["KR"],
  "genreKeywords": ["k-pop", "korean", "hanguk"],
  "corpusAnalysisPrompt": "...",
  "lessonGenerationPrompt": "...",
  "readingDirection": "ltr",
  "hasSpaces": true,
  "needsWordSegmentation": false
}
```

**Language-specific considerations**:
- **Japanese**: needs word segmentation (no spaces between words). MeCab or similar tokenizer. Has 3 scripts (hiragana, katakana, kanji) — lessons should introduce kanji readings.
- **Chinese**: also needs word segmentation. Tonal language — TTS pronunciation is even more critical. Pinyin romanization helpful for beginners.
- **German**: compound words need decomposition for teaching. Gendered nouns (der/die/das) should be taught with the article.
- **Arabic**: RTL text rendering. Different letter forms (initial/medial/final). Reading prerequisite is higher barrier.
- **Thai**: no spaces, tonal, unique script — highest reading prerequisite barrier.

---

## What Exists vs What Needs Building

### Already built (copy from Songwon)
| Component | Files | Status |
|-----------|-------|--------|
| Lesson engine (screen renderer) | `app/learn/v5/[lessonId]/page.tsx` | Ready — needs minor generalization (Korean-specific strings) |
| Screen types (word-card, quiz, etc.) | Same file + `lib/types.ts` | Ready |
| TTS hook | `hooks/useTTS.ts` | Ready — voice param already configurable |
| TTS API route | `app/api/tts-cached/route.ts` | Ready — accepts voice parameter |
| TTS generator | `pipeline/generate_tts.py` | Ready — voice param already configurable |
| Progress tracking | `lib/v5-progress.ts` | Ready |
| Notification system | `lib/notifications.ts` | Ready |
| Home screen shell | `app/page.tsx` | Needs redesign for multi-language |
| Spotify extraction | `pipeline/extract_playlist.py` | Ready |
| Audio download | `pipeline/download_songs.py` | Ready |
| Lyrics fetch (2 sources) | `pipeline/fetch_lyrics.py`, `fetch_lyrics_web.py` | Ready |
| Lesson generator | `pipeline/generate_lesson_v6.py` | Needs language-generic prompts |
| Corpus merger | `pipeline/merge_corpus_analysis.py` | Ready |
| Curriculum builder | `pipeline/build_curriculum_map.py` | Needs dynamic level assignment |

### Needs building from scratch
| Component | What it does | Complexity |
|-----------|-------------|------------|
| Language selector UI | Pick target language, see config | Small |
| Playlist ingestion UI | Paste URL, see progress, confirm songs | Medium |
| BYOK API key input | Securely store Anthropic key in localStorage | Small |
| Pipeline orchestrator | Web-facing wrapper that runs Python scripts with progress streaming | Large |
| Generalized language filter | Multi-language version of `filter_korean.py` | Medium |
| Corpus analysis automation | API call replacing manual Claude conversation | Medium |
| Dynamic curriculum generator | Auto-sequence lessons from corpus analysis | Medium-Large |
| Language config files | Per-language settings (voice, font, proficiency, prompts) | Medium |
| Placement quiz | Optional — assess learner level before generating curriculum | Medium |
| Song line difficulty picker | Select appropriate lines per learner level from each song | Medium |
| Multi-playlist management | Add playlists later, merge into existing curriculum | Medium |

---

## Deployment Considerations

### The yt-dlp problem
The biggest deployment wrinkle: `yt-dlp` and `ffmpeg` are CLI tools that need to run on a server. Options:

1. **Desktop app (Electron/Tauri)** — pipeline runs locally on user's machine. Full access to CLI tools. Best UX for power users. Hardest to distribute.
2. **Server with persistent storage** — run on a VPS (Railway, Fly.io, DigitalOcean) where you can install yt-dlp. NOT Vercel (no persistent filesystem, no CLI tools beyond Node/Python).
3. **Hybrid** — web app on Vercel for the lesson UI, separate "pipeline server" on Railway for audio/lyrics processing. Pipeline server generates lessons and pushes results to the client.
4. **Skip audio download** — embed Spotify/YouTube player instead of downloaded MP3s. Simpler deployment but worse UX (needs internet, can't control playback precisely, ads on YouTube).

**Recommendation**: Start with option 3 (hybrid). Vercel serves the learning UI (it's already deployed there). A small Railway/Fly.io instance runs the pipeline. The pipeline server exposes a REST API:
- `POST /pipeline/start` — kick off playlist processing
- `GET /pipeline/status/:id` — poll progress
- `GET /pipeline/result/:id` — download generated lesson JSONs + TTS cache

### Storage
- Generated lessons: small JSONs, can live in client localStorage or be served from the pipeline server
- TTS cache: ~5-10MB per 20 lessons, can be served from pipeline server or uploaded to Vercel Blob
- Audio files: 200-500MB per playlist — too big for localStorage. Serve from pipeline server, or use Spotify/YouTube embeds

### Cost estimate per user (BYOK model)
| Step | API cost | Notes |
|------|----------|-------|
| Spotify extraction | Free | Spotify API is free |
| Language filtering | Free | Local processing |
| Audio download | Free | yt-dlp is free |
| Lyrics fetching | Free | Genius API free tier |
| Corpus analysis | ~$0.50-1.00 | One Sonnet call for all lyrics |
| Curriculum generation | ~$0.10-0.20 | Deterministic + small AI assist |
| Lesson generation (20) | ~$1.00-2.00 | 20 Sonnet calls |
| TTS generation | Free | Edge TTS is free |
| **Total** | **~$1.50-3.50** | For 20 lessons from one playlist |

---

## Prompt Templates Needed

### 1. Corpus Analysis Prompt
**Input**: all lyrics concatenated, target language, proficiency framework
**Output**: structured JSON with vocabulary, grammar, difficulty ratings
**Key requirement**: rate EACH LINE's difficulty, not just each song — this enables the "same song, different extraction depth" approach

### 2. Curriculum Sequencing Prompt (optional, could be deterministic)
**Input**: corpus analysis, learner level, number of lessons to generate
**Output**: ordered lesson slots with target vocab/grammar and specific song lines

### 3. Lesson Generation Prompt
**Input**: lesson slot (target items, song lines, translations), language config, proficiency level
**Output**: 30-screen lesson JSON following the interleaved teach/test structure
**Existing**: `generate_lesson_v6.py` has a working version for Korean — needs language variables injected

### 4. Line Difficulty Assessment Prompt (part of corpus analysis)
**Input**: a song's lyrics with vocabulary annotations
**Output**: per-line difficulty score + which vocab/grammar items each line exercises
**This is the secret sauce** — a beginner and advanced learner study the same BTS song, but the beginner's lesson picks the chorus line with 사랑 while the advanced lesson picks the verse with conditional grammar

---

## Data Model Changes

### New: Language Config
```typescript
interface LanguageConfig {
  code: string;           // "ko", "ja", "de", etc.
  name: string;           // "Korean"
  nativeName: string;     // "한국어"
  ttsVoice: string;       // Edge TTS voice ID
  fontClass: string;      // CSS class for native script
  proficiency: {
    framework: string;    // "TOPIK", "JLPT", "CEFR"
    levels: string[];     // ["N5","N4","N3","N2","N1"] for JLPT
    beginnerCutoff: number; // index into levels
  };
  scriptDetection: RegExp; // /[가-힯]/ for hangul
  isrcPrefixes: string[]; // ["KR"] for Korean
  genreKeywords: string[];
  needsSegmentation: boolean; // true for Japanese, Chinese
}
```

### New: User Profile
```typescript
interface UserProfile {
  targetLanguage: string;
  proficiencyLevel: string;
  apiKey: string;         // Anthropic key, localStorage only
  playlists: PlaylistMeta[];
}
```

### Modified: Lesson JSON
Same structure as V5, but with language metadata:
```typescript
interface Lesson {
  id: string;
  language: string;       // "ko"
  proficiencyLevel: string; // "TOPIK-2"
  // ... rest same as current V5 lesson structure
}
```

---

## Implementation Order

### Phase 1 — Korean V2 (automate the pipeline)
1. Build pipeline orchestrator API (wraps existing Python scripts)
2. Automate corpus analysis (API call replacing manual conversation)
3. Build playlist ingestion UI (paste URL → see songs → confirm)
4. Add BYOK API key input
5. Connect orchestrator to lesson engine (generated lessons → playable)
6. Deploy: Vercel (frontend) + Railway (pipeline server)

### Phase 2 — Multi-language support
7. Create language config files (start with Japanese + one European language)
8. Generalize language filter (replace Korean-specific detection)
9. Generalize corpus analysis prompt (inject proficiency framework)
10. Generalize lesson generation prompt (language variables)
11. Add font stacks and script rendering per language
12. Test with Japanese playlist end-to-end

### Phase 3 — Polish
13. Placement quiz (assess level before generating)
14. Multi-playlist support (add more songs later)
15. Difficulty recalibration (user levels up → regenerate harder lessons from same songs)
16. Account sync (optional — save progress across devices)

---

## Files to Bring from Songwon V1

When cloning the repo to start V2, these are the files that transfer directly:

**Lesson engine (copy as-is)**:
- `app/learn/v5/[lessonId]/page.tsx` — screen renderer
- `lib/types.ts` — data models
- `lib/v5-progress.ts` — progress tracking
- `hooks/useTTS.ts` — TTS client hook
- `app/api/tts-cached/route.ts` — TTS API with on-demand generation
- `components/ui/KrTip.tsx` — hover translation component (rename to LangTip)
- `lib/notifications.ts` — reminder system
- `components/ReminderSettings.tsx` — reminder UI

**Pipeline scripts (copy + modify)**:
- `pipeline/extract_playlist.py` — Spotify extraction (as-is)
- `pipeline/download_songs.py` — YouTube Music download (as-is)
- `pipeline/fetch_lyrics.py` — lyrics.ovh (as-is)
- `pipeline/fetch_lyrics_web.py` — Genius API (as-is)
- `pipeline/generate_lesson_v6.py` — lesson generator (needs language-generic prompts)
- `pipeline/generate_tts.py` — TTS cache generator (needs voice parameter from config)
- `pipeline/build_curriculum_map.py` — curriculum builder (needs dynamic level assignment)
- `pipeline/merge_corpus_analysis.py` — corpus merger (as-is)

**Design docs (reference)**:
- `pipeline/SESSION_DESIGN.md` — lesson flow spec
- `pipeline/CURRICULUM_PROGRESSION.md` — curriculum structure
- `pipeline/EXAMPLE_LESSON_10cm_My_Eyes.md` — gold-standard lesson example
- `learnings.md` — debugging knowledge

**Styles + config**:
- `app/globals.css` — CSS custom properties, dark mode
- `tailwind.config.ts` (if any) or Tailwind v4 theme config
- `capacitor.config.ts` — Android wrapper config (update URLs)
