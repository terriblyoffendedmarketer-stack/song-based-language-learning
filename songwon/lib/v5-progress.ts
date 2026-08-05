import type { V5UserProgress, LessonAttempt, UnitProgress } from "./types";

const STORAGE_KEY = "songwon-v5-progress";
const PASS_THRESHOLD = 0.8;
const LESSONS_TO_UNLOCK = 4;
const LESSONS_PER_SET = 5;
const IN_PROGRESS_KEY = "songwon-in-progress";

export function loadV5Progress(): V5UserProgress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultProgress();
}

export function saveV5Progress(progress: V5UserProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function defaultProgress(): V5UserProgress {
  return {
    units: [1, 2, 3, 4, 5].map((unit) => ({
      unit,
      unlocked: unit === 1,
      lessons: [],
    })),
    totalCorrect: 0,
    totalAnswered: 0,
    streak: 0,
    lastActiveDate: "",
    xp: 0,
  };
}

export function recordLessonAttempt(
  attempt: LessonAttempt
): V5UserProgress {
  const progress = loadV5Progress();
  const unitNum = getUnitFromLessonId(attempt.lessonId);
  let unit = progress.units.find((u) => u.unit === unitNum);
  if (!unit) {
    unit = { unit: unitNum, unlocked: unitNum === 1, lessons: [] };
    progress.units.push(unit);
  }

  let lessonEntry = unit.lessons.find(
    (l) => l.lessonId === attempt.lessonId
  );
  if (!lessonEntry) {
    lessonEntry = {
      lessonId: attempt.lessonId,
      passed: false,
      attempts: 0,
    };
    unit.lessons.push(lessonEntry);
  }

  lessonEntry.attempts += 1;
  if (
    attempt.passed &&
    (!lessonEntry.bestScore ||
      attempt.score > lessonEntry.bestScore)
  ) {
    lessonEntry.bestScore = attempt.score;
    lessonEntry.bestTotal = attempt.total;
  }
  if (attempt.passed) {
    lessonEntry.passed = true;
  }

  progress.totalCorrect += attempt.score;
  progress.totalAnswered += attempt.total;

  if (attempt.passed) {
    progress.xp += getXpForLesson(attempt.lessonId);
  }

  // Streak
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .slice(0, 10);
  if (progress.lastActiveDate === yesterday) {
    progress.streak += 1;
  } else if (progress.lastActiveDate !== today) {
    progress.streak = 1;
  }
  progress.lastActiveDate = today;

  // Unlock next unit
  for (let u = 2; u <= 5; u++) {
    const prevUnit = progress.units.find((x) => x.unit === u - 1);
    const thisUnit = progress.units.find((x) => x.unit === u);
    if (prevUnit && thisUnit) {
      const passedCount = prevUnit.lessons.filter((l) => l.passed).length;
      thisUnit.unlocked = passedCount >= LESSONS_TO_UNLOCK;
    }
  }

  saveV5Progress(progress);
  return progress;
}

export function isUnitUnlocked(
  progress: V5UserProgress,
  unitNum: number
): boolean {
  const firstLesson = (unitNum - 1) * 4 + 1;
  return isLessonUnlocked(progress, firstLesson);
}

export function getLessonNumber(lessonId: string): number {
  const match = lessonId.match(/lesson(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

function isLessonPassed(progress: V5UserProgress, lessonNumber: number): boolean {
  for (const unit of progress.units) {
    for (const lesson of unit.lessons) {
      if (getLessonNumber(lesson.lessonId) === lessonNumber && lesson.passed) {
        return true;
      }
    }
  }
  return false;
}

export function isLessonUnlocked(progress: V5UserProgress, lessonNumber: number): boolean {
  const set = Math.ceil(lessonNumber / LESSONS_PER_SET);
  if (set === 1) return true;
  const prevSetStart = (set - 2) * LESSONS_PER_SET + 1;
  const prevSetEnd = (set - 1) * LESSONS_PER_SET;
  for (let n = prevSetStart; n <= prevSetEnd; n++) {
    if (!isLessonPassed(progress, n)) return false;
  }
  return true;
}

export interface InProgressState {
  lessonId: string;
  currentIndex: number;
  answers: Record<string, boolean>;
}

export function saveInProgress(state: InProgressState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(state));
}

export function loadInProgress(): InProgressState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IN_PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function clearInProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(IN_PROGRESS_KEY);
}

function getUnitFromLessonId(lessonId: string): number {
  const match = lessonId.match(/unit(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

function getXpForLesson(lessonId: string): number {
  return 25;
}
