export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  lyrics?: string;
  lyricsSource?: "genius" | "manual";
  createdAt: string;
}

export interface WordBreakdown {
  korean: string;
  romanization: string;
  english: string;
  partOfSpeech: string;
}

export interface LyricLine {
  lineNumber: number;
  korean: string;
  romanization: string;
  words: WordBreakdown[];
}

export interface VocabularyItem {
  id: string;
  korean: string;
  english: string;
  romanization: string;
  partOfSpeech: string;
  frequency: number;
  topikLevel: 1 | 2 | 3 | 4 | 5 | 6;
  exampleSentence: string;
  fromSongId: string;
  fromLine: string;
  srs: SRSData;
}

export interface SRSData {
  interval: number;
  ease: number;
  nextReview: string;
  reviewCount: number;
  strength: number;
}

export interface GrammarPattern {
  pattern: string;
  englishLabel: string;
  explanation: string;
  examples: { korean: string; english: string; fromSong?: boolean }[];
}

export interface SongSection {
  type: "verse" | "chorus" | "bridge" | "intro" | "outro" | "pre-chorus";
  label: string;
  startLine: number;
  endLine: number;
  theme: string;
}

export interface AudioSegment {
  songId: string;
  label: string;
  startTime: number;
  endTime: number;
}

export interface LessonAnalysis {
  songId: string;
  lines: LyricLine[];
  vocabulary: Omit<VocabularyItem, "srs">[];
  grammarPatterns: GrammarPattern[];
  culturalNotes: { reference: string; explanation: string }[];
  sections: SongSection[];
}

export type ExerciseType =
  | "fill-blank"
  | "listening"
  | "match"
  | "order-words"
  | "comprehension";

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctAnswer: string | string[];
  hint?: string;
  audioKey?: string;
}

export interface WordEntry {
  korean: string;
  english: string;
  pos?: string;
  topik?: number;
}

export interface LineBreakdown {
  korean: string;
  english: string;
  words: WordEntry[];
}

export interface FocusLinesData {
  lines: LineBreakdown[];
  contextCard?: string;
}

export type SectionType =
  | "lesson-intro"
  | "lyrics-korean"
  | "lyrics-translation"
  | "word-intro"
  | "word-meaning"
  | "word-context"
  | "line-recall"
  | "pattern-spotlight"
  | "practice"
  | "sing-along"
  | "recap"
  | "hook-a"
  | "hook-b"
  | "immersion-read"
  | "focus-lines"
  | "vocab-drill"
  | "listen"
  | "vocabulary"
  | "grammar"
  | "context";

export interface WordTeachingData {
  word: WordEntry;
  exampleSentence?: { korean: string; english: string };
  songLine?: string;
  dailySentence?: { korean: string; english: string };
}

export interface LessonSection {
  id: string;
  type: SectionType;
  title: string;
  content: string;
  musicPlaying?: boolean;
  autoSpeak?: string;
  lyricLines?: string[];
  lyricTranslations?: string[];
  previewWords?: WordEntry[];
  wordData?: WordTeachingData;
  focusLines?: FocusLinesData;
  patternData?: {
    pattern: string;
    meaning: string;
    songExample: { korean: string; english: string };
    otherExamples: { korean: string; english: string }[];
  };
  recapData?: {
    wordsLearned: WordEntry[];
    patternLearned?: string;
  };
  audioSegment?: AudioSegment;
  exercises?: Exercise[];
  vocabularyIds?: string[];
}

export interface Lesson {
  id: string;
  songId: string;
  level: UserLevel;
  title: string;
  sections: LessonSection[];
  xpReward: number;
  generatedAt: string;
}

export type UserLevel = "beginner" | "intermediate" | "advanced";

export interface UserProgress {
  level: UserLevel;
  xp: number;
  streak: number;
  lastActiveDate: string;
  immersionMinutes: number;
  songsStudied: string[];
  lessonsCompleted: string[];
  dailyGoalMinutes: number;
}

export interface AppState {
  songs: Song[];
  lessons: Lesson[];
  vocabulary: VocabularyItem[];
  progress: UserProgress;
}

// ─── V5 Lesson Types (interleaved teaching, MIA immersion, scoring) ───

export type V5QuizType =
  | "tap-meaning"
  | "fill-blank"
  | "fill-blank-song"
  | "distinguish"
  | "song-comprehension"
  | "grammar-fill"
  | "line-recall"
  | "sentence-order"
  | "pattern-comprehension";

export interface V5QuizOption {
  text: string;
  correct: boolean;
}

export interface V5Quiz {
  type: V5QuizType;
  prompt: string;
  promptTranslation?: string;
  options: V5QuizOption[];
  wrongExplanation: string;
  audioKey?: string;
}

export interface V5SongLine {
  korean: string;
  english: string;
  highlights?: string[];
}

export interface V5TeachingItem {
  korean: string;
  english: string;
  kind: "word" | "phrase";
  partOfSpeech?: string;
  grammarNote?: string;
  phraseNote?: string;
  songLine: V5SongLine;
  audioKey?: string;
}

export interface V5ContextSentence {
  korean: string;
  english: string;
  highlights: string[];
  note?: string;
  audioKey?: string;
}

export interface V5PatternSpotlight {
  pattern: string;
  meaning: string;
  explanation: string;
  songExample: V5SongLine;
  examples: { korean: string; english: string; note?: string }[];
}

export interface V5DictionaryEntry {
  word: string;
  romanization: string;
  partOfSpeech: string;
  definition: string;
  example?: { korean: string; english: string };
}

export type V5ScreenType =
  | "warmup"
  | "intro"
  | "lyrics-korean"
  | "lyrics-english"
  | "lyrics-fullsong"
  | "word-card"
  | "phrase-card"
  | "quiz"
  | "context-sentence"
  | "pair-context"
  | "pattern-spotlight"
  | "line-breakdown"
  | "sing-along"
  | "recap";

interface V5ScreenBase {
  id: string;
  type: V5ScreenType;
  label?: string;
  musicPlaying?: boolean;
}

export interface V5WarmupScreen extends V5ScreenBase {
  type: "warmup";
  quiz: V5Quiz;
  scored: false;
}

export interface V5IntroScreen extends V5ScreenBase {
  type: "intro";
  title: string;
  content: string;
  contentEnglish?: string;
  musicPlaying: true;
}

export interface V5LyricsKoreanScreen extends V5ScreenBase {
  type: "lyrics-korean";
  lines: string[];
  musicPlaying: true;
}

export interface V5LyricsEnglishScreen extends V5ScreenBase {
  type: "lyrics-english";
  lines: V5SongLine[];
  musicPlaying: false;
}

export interface V5LyricsFullSongScreen extends V5ScreenBase {
  type: "lyrics-fullsong";
  allLines: string[];
  targetLineIndices: number[];
  musicPlaying: true;
}

export interface V5WordCardScreen extends V5ScreenBase {
  type: "word-card";
  item: V5TeachingItem;
}

export interface V5PhraseCardScreen extends V5ScreenBase {
  type: "phrase-card";
  item: V5TeachingItem;
}

export interface V5QuizScreen extends V5ScreenBase {
  type: "quiz";
  quiz: V5Quiz;
  scored: true;
  itemIndex?: number;
}

export interface V5ContextSentenceScreen extends V5ScreenBase {
  type: "context-sentence";
  sentence: V5ContextSentence;
}

export interface V5PairContextScreen extends V5ScreenBase {
  type: "pair-context";
  sentences: V5ContextSentence[];
  note?: string;
}

export interface V5PatternSpotlightScreen extends V5ScreenBase {
  type: "pattern-spotlight";
  spotlight: V5PatternSpotlight;
}

export interface V5LineBreakdownScreen extends V5ScreenBase {
  type: "line-breakdown";
  lyricLine: string;
  breakdown: string;
  dictionary: V5DictionaryEntry[];
}

export interface V5SingAlongScreen extends V5ScreenBase {
  type: "sing-along";
  lines: V5SongLine[];
  musicPlaying: true;
}

export interface V5RecapScreen extends V5ScreenBase {
  type: "recap";
  items: V5TeachingItem[];
  pattern?: { pattern: string; meaning: string };
  xpReward: number;
  passThreshold: number;
  totalQuizScreens: number;
}

export type V5Screen =
  | V5WarmupScreen
  | V5IntroScreen
  | V5LyricsKoreanScreen
  | V5LyricsEnglishScreen
  | V5LyricsFullSongScreen
  | V5WordCardScreen
  | V5PhraseCardScreen
  | V5QuizScreen
  | V5ContextSentenceScreen
  | V5PairContextScreen
  | V5PatternSpotlightScreen
  | V5LineBreakdownScreen
  | V5SingAlongScreen
  | V5RecapScreen;

export interface V5LessonMeta {
  songId: string;
  songTitle: string;
  artist: string;
  unit: number;
  lessonNumber: number;
  grammarFocus: string;
  grammarMeaning: string;
  koreanRatio: number;
}

export interface V5Lesson {
  id: string;
  meta: V5LessonMeta;
  screens: V5Screen[];
  generatedAt: string;
}

export interface LessonAttempt {
  lessonId: string;
  score: number;
  total: number;
  passed: boolean;
  completedAt: string;
  answers: { screenId: string; correct: boolean }[];
}

export interface UnitProgress {
  unit: number;
  unlocked: boolean;
  lessons: {
    lessonId: string;
    bestScore?: number;
    bestTotal?: number;
    passed: boolean;
    attempts: number;
  }[];
}

export interface V5UserProgress {
  units: UnitProgress[];
  totalCorrect: number;
  totalAnswered: number;
  streak: number;
  lastActiveDate: string;
  xp: number;
}
