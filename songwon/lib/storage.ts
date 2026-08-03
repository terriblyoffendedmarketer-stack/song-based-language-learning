import { openDB, type IDBPDatabase } from "idb";
import type { Song, Lesson, VocabularyItem, UserProgress, AppState } from "./types";

const DB_NAME = "songwon";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("audio")) {
          db.createObjectStore("audio");
        }
        if (!db.objectStoreNames.contains("tts")) {
          db.createObjectStore("tts");
        }
      },
    });
  }
  return dbPromise;
}

const STORAGE_KEY = "songwon_state";

function getDefaultProgress(): UserProgress {
  return {
    level: "beginner",
    xp: 0,
    streak: 0,
    lastActiveDate: new Date().toISOString().split("T")[0],
    immersionMinutes: 0,
    songsStudied: [],
    lessonsCompleted: [],
    dailyGoalMinutes: 15,
  };
}

function getDefaultState(): AppState {
  return {
    songs: [],
    lessons: [],
    vocabulary: [],
    progress: getDefaultProgress(),
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    return JSON.parse(raw) as AppState;
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function updateState(updater: (state: AppState) => AppState): AppState {
  const state = updater(loadState());
  saveState(state);
  return state;
}

export async function saveAudioBlob(songId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("audio", blob, songId);
}

export async function getAudioBlob(songId: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get("audio", songId);
}

export async function deleteAudioBlob(songId: string): Promise<void> {
  const db = await getDB();
  await db.delete("audio", songId);
}

export async function saveTTSAudio(key: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("tts", blob, key);
}

export async function getTTSAudio(key: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get("tts", key);
}

export function addSong(song: Song): AppState {
  return updateState((s) => ({ ...s, songs: [...s.songs, song] }));
}

export function removeSong(songId: string): AppState {
  return updateState((s) => ({
    ...s,
    songs: s.songs.filter((song) => song.id !== songId),
    lessons: s.lessons.filter((l) => l.songId !== songId),
  }));
}

export function updateSong(songId: string, updates: Partial<Song>): AppState {
  return updateState((s) => ({
    ...s,
    songs: s.songs.map((song) =>
      song.id === songId ? { ...song, ...updates } : song
    ),
  }));
}

export function addLesson(lesson: Lesson): AppState {
  return updateState((s) => ({ ...s, lessons: [...s.lessons, lesson] }));
}

export function addVocabulary(items: VocabularyItem[]): AppState {
  return updateState((s) => {
    const existingIds = new Set(s.vocabulary.map((v) => v.id));
    const newItems = items.filter((item) => !existingIds.has(item.id));
    return { ...s, vocabulary: [...s.vocabulary, ...newItems] };
  });
}

export function updateVocabularyItem(
  id: string,
  updates: Partial<VocabularyItem>
): AppState {
  return updateState((s) => ({
    ...s,
    vocabulary: s.vocabulary.map((v) =>
      v.id === id ? { ...v, ...updates } : v
    ),
  }));
}

export function addXP(amount: number): AppState {
  return updateState((s) => ({
    ...s,
    progress: { ...s.progress, xp: s.progress.xp + amount },
  }));
}

export function updateStreak(): AppState {
  const today = new Date().toISOString().split("T")[0];
  return updateState((s) => {
    const lastDate = s.progress.lastActiveDate;
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];
    const newStreak =
      lastDate === yesterday
        ? s.progress.streak + 1
        : lastDate === today
          ? s.progress.streak
          : 1;
    return {
      ...s,
      progress: {
        ...s.progress,
        streak: newStreak,
        lastActiveDate: today,
      },
    };
  });
}

export function markLessonComplete(lessonId: string): AppState {
  return updateState((s) => ({
    ...s,
    progress: {
      ...s.progress,
      lessonsCompleted: s.progress.lessonsCompleted.includes(lessonId)
        ? s.progress.lessonsCompleted
        : [...s.progress.lessonsCompleted, lessonId],
    },
  }));
}
