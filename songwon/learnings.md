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
