# Learnings

Debugging knowledge captured during development. Format: `what broke | why | what fixed it`.

## TTS
- npm `edge-tts` v1.0.1 returns 403 from Microsoft servers | Microsoft blocked the npm package's auth flow | Use Python `edge-tts` via `execFile("python3", ...)` subprocess instead
- TTS cache missed ~1,150 Korean texts in new V5 lessons | Initial extraction script only checked specific JSON fields (word, phrase, korean) | Deep recursive walk of ALL JSON fields with hangul regex found 1,733 total texts
- Edge TTS rate parameter format | Web frontend sends speed multiplier (0.8, 1.2) | Convert to Edge TTS format: `+20%` or `-20%` with formula `Math.round((speed - 1) * 100)`
- Buffer type error serving audio | `readFile` returns `Buffer<ArrayBufferLike>` which isn't assignable to `BodyInit` | Wrap in `new Uint8Array(buffer)` before passing to NextResponse

## Progress / State
- Lesson progress always reset to screen 1 | `saveInProgress()` hardcoded `currentIndex: 0` and `answers: {}` | Save actual current values: `saveInProgress({ lessonId, currentIndex, answers })`
- Progress restore needed explicit mount-time load | Component initialized at screen 0 without checking localStorage | Added `loadInProgress()` in `useEffect` mount to restore `currentIndex` and `answers`

## UI
- Colored vocab text in line-breakdown looked ugly | Full-color text on Korean characters is visually overwhelming | Use subtle underlines: `underline underline-offset-4 decoration-2 decoration-{color}/60`
- Tailwind decoration color needs opacity modifier | `decoration-indigo-400` is too strong against dark backgrounds | Add `/60` opacity: `decoration-indigo-400/60`

## Capacitor / Android
- Capacitor plugins work even with remote URL loading | `server.url` pointing to Vercel still allows `@capacitor/local-notifications` to fire native notifications | Capacitor bridge injects into WebView regardless of content source
- PWA vs Capacitor APK: both work simultaneously | PWA installs as Chrome wrapper, APK is a native WebView | Same Vercel URL, different notification mechanisms (Web API vs native)

## Lesson Structure
- Lessons should start with song (lyrics-fullsong) not intro | Users want to hear the song first, intro feels like friction | Swapped screens 1 and 2 across all 20 lesson JSON files

## AI / Content Generation
- AI agents refuse to reproduce Korean song lyrics | Copyright/safety filters block lyric reproduction in context files | Agents write analysis with placeholder `lines` fields, `merge_lyrics_into_context.py` injects Korean text from existing lyrics files
- `generate_lesson_v6.py` quality gate catches bad lessons | Without validation, AI sometimes produces lessons with wrong screen counts or missing fields | `quality_gate()` checks screen count, required types, Korean text presence before saving
- Song practice pipeline V1 pre-extracted lines then sent them to Claude individually | Split sentences (혹시...좋아하게 / 되버린걸까), wrong context-dependent translations (크게=largely vs big for eyes), no grammar notes, missed chorus hooks | V2 sends full lyrics + song_context, lets Claude pick 12-15 study units, join enjambed lines, and add grammar pattern notes
- Always test API-generated content one-at-a-time first | Bulk generation bakes in the first prompt's quality level across all outputs — if the prompt is weak, you get 72 weak files | Run 1 song, audit line-by-line, iterate prompt, test 2 more, then bulk
- Pure English lines slip through Korean song practice generation | Claude includes lines like "Now I don't know me, who are you?" as study units | Post-generation audit catches these — remove any line with 0 word chunks
- Grammar objects sometimes have wrong field names | Claude returns `role` instead of `note` in grammar objects (~1 in 72 songs) | Audit script checks for missing required fields (pattern, meaning, note)
- Song practice "1 word chunk" warnings are mostly benign | Mixed Korean/English lines like "설렌다, me likey" legitimately have only 1 Korean chunk | Validator warns but doesn't fail — correct behavior for bilingual pop songs

## Practice Engine
- Discrimination feedback needs distractor context to be useful | Showing just "Correct!" or "Wrong!" teaches nothing — learner needs to know WHY each option is right or wrong | Pass `VocabItem` metadata through distractors, generate per-option explanations at question build time
- Fill-in-the-blank needs lines with 3+ word chunks | Lines with only 1-2 chunks don't have enough context to make the blank meaningful | Filter `songLines` to `words.length >= 3` before selecting
- Grammar comparison needs pre-defined confusable pairs | Random grammar pairings aren't pedagogically useful — learners confuse specific pairs (-고 vs -지만, -아/어서 vs -고) | Hardcode `GRAMMAR_CONFUSABLES` array of pairs that are actually confused by learners
- Listening questions need auto-play delay | If TTS fires instantly on render, it plays during the page transition animation and sounds broken | 300ms setTimeout before first auto-play
- Wrong-answer re-exposure needs dedup by question ID | Without it, a re-exposure question could itself trigger another re-exposure, creating infinite question growth | Prefix re-exposure IDs with `re-` and skip re-insertion for questions already prefixed
- Fill-in-blank distractors can match words in the same sentence | A word from the blanked line could also be a valid fill-in answer | Exclude all words present in `line.words` from the distractor pool
- Song context enrichment in lesson practice | Vocab items without `songLine` from their lesson still benefit from showing a real song example | `findSongContext()` searches loaded `songLines` for any line containing the vocab word
