# Songwon Roadmap

Three evolutionary stages of this tool, from what's built to the promised land.

---

## V1 — What's Built (Current)

Korean learning app with 20 hand-curated lessons across 5 units, each tied to a K-pop song. Pre-generated seed data, no API calls at runtime.

**Core loop:** Intro → Lyrics → Vocab/Phrase cards → Quizzes → Reading checkpoints → Sing-along → Recap

**Key features:**
- 20 lessons, 4 per unit, set-based unlocking (complete set of 5 to unlock next 5)
- Reading checkpoints: Korean prose breakdowns of song lyrics with tappable dictionary popup
- Korean-first UI with tap-to-reveal English (KrTip component)
- TTS via Edge TTS cache with fallbacks
- Progress tracking, streaks, XP (localStorage)
- PWA, mobile-first design
- Tester mode (`?tester=1`) to bypass locks
- Grammar glossary, review page, progress dashboard

**Content pipeline (manual, script-assisted):**
- Spotify playlist extraction → Korean filtering → song selection
- YouTube Music download → lyrics fetching (Genius API + lyrics.ovh)
- Corpus analysis → curriculum mapping → lesson generation
- Edge TTS pre-generation for all Korean text
- Song context enrichment (verse-by-verse breakdown)

---

## V2 — Final Version (Korean-Specific, User-Driven Content)

**The shift:** Instead of pre-curated content, any user plugs in their Spotify playlist and gets a personalized Korean learning experience from their own music.

### How It Works

1. **User provides Spotify playlist URL** on first launch
2. **Pipeline auto-runs:**
   - Extract tracks from playlist via Spotify API
   - Filter Korean songs (language detection on track metadata + lyrics)
   - Present filtered songs to user for selection (minimum threshold: e.g., 15+ songs to ensure enough vocabulary coverage)
   - Download audio via YouTube Music (yt-dlp)
   - Fetch lyrics (Genius API → lyrics.ovh fallback)
   - Run corpus analysis on selected songs' lyrics
3. **AI lesson generation:**
   - Claude API analyzes vocabulary and grammar patterns across all selected songs
   - Builds a grammar-first curriculum (like V1's CURRICULUM_PROGRESSION.md)
   - Generates lessons with the interleaved teach/test/context flow
   - Creates reading checkpoints with Korean prose breakdowns
   - Generates dictionary entries with romanization, definitions, examples
4. **Vocabulary gap-filling:**
   - If the user's selected songs don't cover enough vocabulary or grammar for a complete curriculum, the system pulls supplementary material from non-selected songs in their playlist (or from a fallback corpus)
   - Selected songs are always priority — supplementary songs fill gaps only
5. **Audio snippet extraction** (see Promised Land below for the AI-driven version; V2 may use timestamp-based alignment if feasible)
6. **TTS generation** for all Korean text in generated lessons

### Key Technical Requirements

- **Server-side pipeline orchestration:** The download → analyze → generate flow needs a backend (can't run yt-dlp in the browser). Options: serverless functions, a job queue, or a companion CLI tool.
- **Claude API integration at lesson-gen time:** Each user's lessons are generated fresh by Claude based on their songs. This is the most API-intensive step. Caching and batching matter.
- **Incremental generation:** Don't generate all 20 lessons upfront. Generate the first unit (4 lessons) immediately, then generate ahead as the user progresses.
- **Content storage:** Generated lessons stored in IndexedDB or a lightweight backend (Supabase, Firebase). Must support offline use after initial generation.
- **Rate limiting and cost:** Each user's lesson generation costs Claude API credits. Need to handle this — either the user provides their own API key, or there's a hosted tier with usage limits.

### What the App Looks Like

The app UI is identical to V1. Same lesson flow, same components, same progress tracking. The only difference is the content — it comes from the user's playlist instead of pre-curated seed data.

### Existing Pipeline Scripts to Reuse

All scripts in `pipeline/` are designed for this:
- `extract_playlist.py` — Spotify playlist extraction (ready)
- `filter_korean.py` — Korean song detection (ready)
- `select_songs.py` — Interactive song picker (needs UI integration)
- `download_songs.py` — YouTube Music downloader with resume (ready)
- `fetch_lyrics.py` + `fetch_lyrics_web.py` — Lyrics fetching (ready)
- `merge_corpus_analysis.py` — Corpus analysis merge (ready)
- `build_curriculum_map.py` — Curriculum mapping (ready, needs to become grammar-first)
- `generate_lessons.py` — Lesson generation (needs rewrite for V5 format)
- `generate_tts.py` — Edge TTS generation (ready)

### Pipeline Orchestration Sequence

```
User provides Spotify URL
  → extract_playlist.py (get track list)
  → filter_korean.py (identify Korean songs)
  → User selects songs (UI)
  → download_songs.py (get MP3s)
  → fetch_lyrics.py + fetch_lyrics_web.py (get lyrics)
  → Claude API: corpus analysis (vocab + grammar extraction)
  → Claude API: curriculum mapping (grammar-first, which songs teach which patterns)
  → Claude API: lesson generation (interleaved flow, reading checkpoints, dictionary)
  → generate_tts.py (TTS for all Korean text)
  → Lessons ready — user starts learning
```

---

## V3 — Ultimate Final Version (Language-Agnostic)

**The shift:** A language selector on first launch. Learn Japanese, Mandarin, Spanish, French — any language where songs exist.

### What Changes from V2

1. **Language selector on onboarding:** "What language do you want to learn?" dropdown or picker
2. **Language-aware filtering:** Instead of `filter_korean.py`, a generalized `filter_by_language.py` that detects the target language in track metadata and lyrics
3. **Language-specific TTS voices:** Each language needs its own TTS voice (Edge TTS supports many: `ja-JP-NanamiNeural` for Japanese, `zh-CN-XiaoxiaoNeural` for Mandarin, etc.)
4. **Language-specific curriculum design:**
   - Korean: grammar patterns like -고, -지만, -(으)면
   - Japanese: て-form, ない-form, たい
   - Mandarin: tones, measure words, 把 construction
   - European languages: verb conjugation, gender, case
   - The AI (Claude) handles this — it knows the grammar of every major language. The curriculum structure (grammar-first, teach → test → context) stays the same; the grammar points change.
5. **Language-specific dictionary format:**
   - Korean: word + romanization + part of speech + definition + example
   - Japanese: word + furigana + romaji + part of speech + definition + example
   - Mandarin: word + pinyin + part of speech + definition + example
   - European: word + IPA + part of speech + definition + example
6. **Script/writing system handling:**
   - Korean: Hangul (current KrTip component generalizes to TargetLangTip)
   - Japanese: Kanji + Hiragana + Katakana (furigana support needed)
   - Mandarin: Hanzi + Pinyin
   - Latin script languages: simpler, no special rendering needed
7. **Romanization/pronunciation guides** per language

### Architecture Changes

- All Korean-specific components become language-parameterized
- `KrTip` → `LangTip` (target language text with native-language tooltip)
- `.kr` CSS class → `.target-lang` with per-language font choices
- TTS voice selection based on target language
- Dictionary entry schema adds optional fields per language (furigana, pinyin, tone marks)
- Lesson JSON schema stays the same — the `type` field values don't change, only the content language

---

## Promised Land — Song Snippet Extraction

Across V2 and V3, wherever a lyric line appears in a lesson, the user can hear it two ways:

1. **TTS** (what we have now) — synthesized voice reads the line
2. **Actual song snippet** — the exact moment from the MP3 where that line is sung

### How Snippet Extraction Works

1. **Lyrics-audio alignment:** Use an AI model (Whisper, or a forced-alignment tool like `aeneas` or `gentle`) to align each lyric line to its timestamp range in the MP3
2. **Snippet extraction:** ffmpeg slices the MP3 at the aligned timestamps to produce a short clip per lyric line
3. **Storage:** Snippets are small (~2-10 seconds each, ~20-100KB as MP3). Store alongside the TTS cache.
4. **UI:** A toggle or dual-button on each lyric line: "TTS" plays the synthesized voice, "Song" plays the actual snippet

### Technical Approach

```
MP3 + lyrics text
  → Whisper (or forced aligner) produces timestamps per line
  → ffmpeg extracts snippets
  → Snippets stored in snippet_cache/ alongside tts_cache/
  → Lesson UI offers both playback options
```

### Challenges

- **Alignment accuracy:** Background music makes alignment harder than speech. Whisper's word-level timestamps work well for isolated speech but may need tuning for music. Dedicated music-lyrics alignment tools (e.g., `NUSAutoLyrixAlign`, `DSP-based alignment`) may be needed.
- **Copyright/licensing:** Distributing song snippets raises copyright questions. For personal use (user's own playlist) this is likely fair use. For a hosted service, need to consider licensing.
- **Storage size:** If each lesson references ~4 lyric lines × ~4 snippets × ~50KB = ~800KB per lesson. For 20 lessons, ~16MB — manageable.

---

## Summary Table

| Feature | V1 (Current) | V2 (Final) | V3 (Ultimate) | Promised Land |
|---------|-------------|------------|---------------|---------------|
| Content source | Pre-curated seed data | User's Spotify playlist | User's Spotify playlist | Same |
| Language | Korean only | Korean only | Any language | Same |
| Lesson generation | Manual/scripted | Claude API (automated) | Claude API (automated) | Same |
| Audio | TTS only | TTS only | TTS only | TTS + Song snippets |
| Pipeline | Manual scripts | Auto-orchestrated | Auto-orchestrated | Same |
| Vocabulary gaps | N/A | Fill from non-selected songs | Fill from non-selected songs | Same |
| Onboarding | None | Spotify URL input | Language picker + Spotify URL | Same |

---

## Principles That Stay Constant

Across all versions:
- **Same app, different content.** The UI, lesson flow, progress system, and learning methodology don't change. Only the content source changes.
- **Grammar-first curriculum.** Lessons are organized by grammar pattern, not by song. Songs provide the context, grammar provides the structure.
- **Krashen's i+1.** Reading checkpoints use mostly-known vocabulary plus a few new tappable words.
- **Interleaved teach/test.** Never batch all vocab then all quizzes. Teach 2 items → quiz → teach 2 more → mix review.
- **Songs are the hook, not the lesson.** The song makes it fun; the structured teaching makes it effective.
- **Mobile-first, ADHD-friendly.** Short sessions, clear progress, audio on every interaction, confetti on wins.
