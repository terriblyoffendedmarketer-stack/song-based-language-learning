"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadV5LessonIndex,
  type V5LessonIndex,
  type V5LessonIndexEntry,
} from "@/lib/seed-loader";
import { KrTip } from "@/components/ui/KrTip";
import { loadV5Progress, defaultProgress, isUnitUnlocked, isLessonUnlocked, initTesterMode } from "@/lib/v5-progress";
import type { V5UserProgress } from "@/lib/types";

const UNIT_COLORS: Record<number, string> = {
  1: "bg-sage-light text-sage border-sage/30",
  2: "bg-sage-light text-sage border-sage/30",
  3: "bg-accent-light text-accent border-accent/30",
  4: "bg-amber-light text-amber border-amber/30",
  5: "bg-coral-light text-coral border-coral/30",
};

const UNIT_LABELS: Record<number, string> = {
  1: "초급 1",
  2: "초급 2",
  3: "초급 3",
  4: "중급 1",
  5: "중급 2",
};

const UNIT_TITLES: Record<number, string> = {
  1: "Connecting Ideas",
  2: "Expressing Feelings",
  3: "Nuance & Attitude",
  4: "Complex Emotions",
  5: "Advanced Patterns",
};

function getLessonStatus(
  progress: V5UserProgress,
  lessonId: string
): { passed: boolean; bestScore?: number; bestTotal?: number; attempts: number } {
  for (const unit of progress.units) {
    const lesson = unit.lessons.find((l) => l.lessonId === lessonId);
    if (lesson) return lesson;
  }
  return { passed: false, attempts: 0 };
}

export default function BrowsePage() {
  const [index, setIndex] = useState<V5LessonIndex | null>(null);
  const [activeUnit, setActiveUnit] = useState(1);
  const [progress, setProgress] = useState<V5UserProgress>(defaultProgress());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initTesterMode();
    loadV5LessonIndex()
      .then(setIndex)
      .catch(() => setError("Failed to load lesson data"));
    setProgress(loadV5Progress());
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-coral">{error}</p>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-2xl animate-pulse">🎵</div>
      </div>
    );
  }

  const currentLessons = index.units[String(activeUnit)]?.lessons ?? [];
  const unitUnlocked = isUnitUnlocked(progress, activeUnit);
  const passedInUnit = currentLessons.filter(
    (l) => getLessonStatus(progress, l.id).passed
  ).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="px-4 py-5 border-b border-border">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="kr text-xl font-black">
                <KrTip en="Lessons">레슨</KrTip>
              </h1>
              <p className="text-xs text-muted">
                {index.total_lessons} lessons · 5 units
              </p>
            </div>
            <Link
              href="/"
              className="text-xs text-accent hover:text-accent-hover"
            >
              <KrTip en="Home">홈</KrTip>
            </Link>
          </div>
        </div>
      </header>

      {/* Unit tabs */}
      <div className="px-4 py-3 border-b border-border overflow-x-auto">
        <div className="max-w-lg mx-auto flex gap-2">
          {[1, 2, 3, 4, 5].map((unit) => {
            const unlocked = isUnitUnlocked(progress, unit);
            const isActive = activeUnit === unit;
            const lessons = index.units[String(unit)]?.lessons ?? [];
            const passed = lessons.filter(
              (l) => getLessonStatus(progress, l.id).passed
            ).length;
            return (
              <button
                key={unit}
                onClick={() => setActiveUnit(unit)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  isActive
                    ? UNIT_COLORS[unit]
                    : unlocked
                    ? "bg-card text-muted border-border hover:border-faint"
                    : "bg-card text-faint border-border opacity-50"
                }`}
              >
                <span className="kr">{UNIT_LABELS[unit]}</span>
                {unlocked && (
                  <span className="ml-1 opacity-70">
                    {passed}/{lessons.length}
                  </span>
                )}
                {!unlocked && <span className="ml-1">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Unit header */}
          <div className={`rounded-xl p-4 border ${UNIT_COLORS[activeUnit]}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="kr font-bold text-sm">
                  Unit {activeUnit}: {UNIT_TITLES[activeUnit]}
                </h2>
                <p className="text-xs mt-0.5 opacity-80">
                  {passedInUnit}/{currentLessons.length} passed
                  {!unitUnlocked && " · Locked"}
                </p>
              </div>
              {unitUnlocked && passedInUnit === currentLessons.length && (
                <span className="text-lg">⭐</span>
              )}
              {!unitUnlocked && <span className="text-lg">🔒</span>}
            </div>

            {/* Progress bar */}
            {unitUnlocked && (
              <div className="mt-3 h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current rounded-full transition-all duration-500"
                  style={{
                    width: `${(passedInUnit / currentLessons.length) * 100}%`,
                  }}
                />
              </div>
            )}

            {!unitUnlocked && (
              <p className="text-xs mt-2 opacity-70">
                Complete the previous 5 lessons to unlock
              </p>
            )}
          </div>

          {/* Lesson cards */}
          <div className="grid gap-3">
            {currentLessons.map((lesson) => {
              const status = getLessonStatus(progress, lesson.id);
              const lessonAvailable = isLessonUnlocked(progress, lesson.lessonNumber);
              return (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  status={status}
                  unitUnlocked={lessonAvailable}
                  unitColor={UNIT_COLORS[activeUnit]}
                />
              );
            })}
          </div>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="border-t border-border bg-card px-4 py-2">
        <div className="max-w-lg mx-auto flex justify-around">
          {[
            { href: "/", icon: "🏠", label: "홈", en: "Home" },
            {
              href: "/browse",
              icon: "📚",
              label: "레슨",
              en: "Lessons",
              active: true,
            },
            { href: "/review", icon: "📖", label: "복습", en: "Review" },
            {
              href: "/progress",
              icon: "📊",
              label: "기록",
              en: "Progress",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
                item.active
                  ? "text-accent"
                  : "text-faint hover:text-muted"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-semibold kr">
                <KrTip en={item.en}>{item.label}</KrTip>
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function LessonCard({
  lesson,
  status,
  unitUnlocked,
  unitColor,
}: {
  lesson: V5LessonIndexEntry;
  status: { passed: boolean; bestScore?: number; bestTotal?: number; attempts: number };
  unitUnlocked: boolean;
  unitColor: string;
}) {
  const score =
    status.bestScore != null && status.bestTotal
      ? Math.round((status.bestScore / status.bestTotal) * 100)
      : null;

  const content = (
    <div
      className={`bg-card border rounded-xl p-4 transition-all ${
        !unitUnlocked
          ? "opacity-50 border-border"
          : status.passed
          ? "border-sage/40 hover:shadow-md hover:border-sage/60"
          : "border-border hover:shadow-md hover:border-accent/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-faint font-mono">
              {lesson.lessonNumber}
            </span>
            {status.passed && <span className="text-sage text-sm">✓</span>}
            <h3 className="font-bold text-sm truncate">{lesson.title}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kr text-base font-black text-accent">
              {lesson.grammar}
            </span>
            <span className="text-xs text-muted">
              {lesson.grammarMeaning}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {score !== null && (
            <span
              className={`text-xs font-bold ${
                status.passed ? "text-sage" : "text-coral"
              }`}
            >
              {score}%
            </span>
          )}
          <span className="text-[10px] text-faint">
            {lesson.screenCount} screens · {lesson.quizCount} quizzes
          </span>
        </div>
      </div>

      {status.attempts > 0 && !status.passed && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] text-coral">
            {status.attempts} attempt{status.attempts > 1 ? "s" : ""} — need 80%
          </span>
        </div>
      )}
    </div>
  );

  if (!unitUnlocked) {
    return content;
  }

  return (
    <Link href={`/learn/v5/${lesson.id}`}>
      {content}
    </Link>
  );
}
