import type { Lesson } from "./types";

export interface LessonIndexEntry {
  id: string;
  file: string;
  safe_name: string;
  title: string;
  xpReward: number;
  sections_count: number;
}

export interface LevelInfo {
  name: string;
  lessons: LessonIndexEntry[];
}

export interface LessonIndex {
  levels: Record<string, LevelInfo>;
  total_lessons: number;
}

export interface CurriculumSong {
  safe_name: string;
  level: number;
  difficulty_score: number;
  avg_topik_level: number;
  grammar_complexity: string;
  korean_ratio: number;
  key_grammar: { pattern: string; meaning: string; topik_level: number }[];
  key_vocabulary: { word: string; meaning: string; topik_level: number }[];
  suggested_sections: string[];
}

export interface CurriculumLevel {
  name: string;
  target_grammar: string[];
  high_frequency_vocab: {
    word: string;
    meaning: string;
    frequency: number;
    topik_level: number;
  }[];
  songs: CurriculumSong[];
}

export interface CurriculumMap {
  metadata: {
    total_songs: number;
    songs_per_level: Record<string, number>;
    level_names: Record<string, string>;
  };
  levels: Record<string, CurriculumLevel>;
}

let cachedIndex: LessonIndex | null = null;
let cachedCurriculum: CurriculumMap | null = null;

export async function loadLessonIndex(): Promise<LessonIndex> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch("/data/lesson_index.json");
  cachedIndex = await res.json();
  return cachedIndex!;
}

export async function loadCurriculum(): Promise<CurriculumMap> {
  if (cachedCurriculum) return cachedCurriculum;
  const res = await fetch("/data/curriculum_map.json");
  cachedCurriculum = await res.json();
  return cachedCurriculum!;
}

export async function loadLesson(filename: string): Promise<Lesson> {
  const res = await fetch(`/data/${filename}`);
  return res.json();
}

export async function loadLessonById(
  lessonId: string
): Promise<Lesson | null> {
  const index = await loadLessonIndex();
  for (const level of Object.values(index.levels)) {
    const entry = level.lessons.find((l) => l.id === lessonId);
    if (entry) {
      return loadLesson(entry.file);
    }
  }
  return null;
}

export async function getSongNameForLesson(
  lessonId: string
): Promise<string | null> {
  const index = await loadLessonIndex();
  for (const level of Object.values(index.levels)) {
    const entry = level.lessons.find((l) => l.id === lessonId);
    if (entry) return entry.safe_name;
  }
  return null;
}

// ─── V5 Lesson Loader ───

import type { V5Lesson } from "./types";

export interface V5LessonIndexEntry {
  id: string;
  file: string;
  title: string;
  grammar: string;
  grammarMeaning: string;
  unit: number;
  lessonNumber: number;
  screenCount: number;
  quizCount: number;
}

export interface V5LessonIndex {
  units: Record<string, { lessons: V5LessonIndexEntry[] }>;
  total_lessons: number;
}

let cachedV5Index: V5LessonIndex | null = null;

export async function loadV5LessonIndex(): Promise<V5LessonIndex> {
  if (cachedV5Index) return cachedV5Index;
  const res = await fetch("/data/lesson_index_v5.json");
  cachedV5Index = await res.json();
  return cachedV5Index!;
}

export async function loadV5Lesson(filename: string): Promise<V5Lesson> {
  const res = await fetch(`/data/${filename}`);
  return res.json();
}

export async function loadV5LessonById(
  lessonId: string
): Promise<V5Lesson | null> {
  const index = await loadV5LessonIndex();
  for (const unit of Object.values(index.units)) {
    const entry = unit.lessons.find((l) => l.id === lessonId);
    if (entry) {
      return loadV5Lesson(entry.file);
    }
  }
  return null;
}

// ─── Song Index Loader ───

export interface SongIndexEntry {
  id: string;
  title: string;
  artist: string;
  koreanLines: number;
  uniqueKoreanLines: number;
  totalLines: number;
  youtubeId: string;
  lyricsFile: string;
  lessons?: {
    lessonId: string;
    lessonNumber: number;
    unit: number;
    grammar: string;
  }[];
}

export interface SongIndex {
  totalSongs: number;
  songs: SongIndexEntry[];
}

let cachedSongIndex: SongIndex | null = null;

export async function loadSongIndex(): Promise<SongIndex> {
  if (cachedSongIndex) return cachedSongIndex;
  const res = await fetch("/data/song_index.json");
  cachedSongIndex = await res.json();
  return cachedSongIndex!;
}
