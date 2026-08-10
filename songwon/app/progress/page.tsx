"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadV5Progress,
  defaultProgress,
  initTesterMode,
  getLessonNumber,
} from "@/lib/v5-progress";
import { loadV5LessonIndex, type V5LessonIndex } from "@/lib/seed-loader";
import type { V5UserProgress } from "@/lib/types";
import { KrTip } from "@/components/ui/KrTip";
import { BottomNav } from "@/components/BottomNav";

const UNIT_LABELS: Record<number, string> = {
  1: "초급 1",
  2: "초급 2",
  3: "초급 3",
  4: "중급 1",
  5: "중급 2",
};

export default function ProgressPage() {
  const [progress, setProgress] = useState<V5UserProgress>(defaultProgress());
  const [index, setIndex] = useState<V5LessonIndex | null>(null);

  useEffect(() => {
    initTesterMode();
    setProgress(loadV5Progress());
    loadV5LessonIndex().then(setIndex).catch(() => {});
  }, []);

  const totalPassed = progress.units.reduce(
    (sum, u) => sum + u.lessons.filter((l) => l.passed).length,
    0
  );
  const totalAttempts = progress.units.reduce(
    (sum, u) => sum + u.lessons.reduce((s, l) => s + l.attempts, 0),
    0
  );
  const accuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  const levelThresholds = [
    { label: "초급 1", en: "Beginner 1", min: 0 },
    { label: "초급 2", en: "Beginner 2", min: 100 },
    { label: "초급 3", en: "Beginner 3", min: 250 },
    { label: "중급 1", en: "Intermediate 1", min: 500 },
    { label: "중급 2", en: "Intermediate 2", min: 800 },
  ];

  const currentLevel =
    [...levelThresholds].reverse().find((l) => progress.xp >= l.min) ??
    levelThresholds[0];
  const nextLevel =
    levelThresholds[levelThresholds.indexOf(currentLevel) + 1];
  const xpInLevel = progress.xp - currentLevel.min;
  const xpForNext = nextLevel ? nextLevel.min - currentLevel.min : 1;
  const levelProgress = nextLevel
    ? Math.min(100, (xpInLevel / xpForNext) * 100)
    : 100;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="px-4 py-4 border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← <KrTip en="Home">홈</KrTip>
          </Link>
          <h1 className="kr font-bold">
            <KrTip en="My progress">내 기록</KrTip>
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6 page-enter">
          {/* Level + XP */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="kr text-2xl font-black">
                  <KrTip en={currentLevel.en}>{currentLevel.label}</KrTip>
                </p>
                <p className="text-xs text-muted">{progress.xp} XP total</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 bg-amber-light px-3 py-1.5 rounded-full">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-amber">
                    {progress.streak}
                    <KrTip en="days">일</KrTip>
                  </span>
                </div>
              </div>
            </div>

            {nextLevel && (
              <div>
                <div className="flex justify-between text-[10px] text-faint mb-1">
                  <span>{currentLevel.label}</span>
                  <span>{nextLevel.label}</span>
                </div>
                <div className="h-3 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-faint mt-1 text-right">
                  {nextLevel.min - progress.xp} XP to next level
                </p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={totalPassed}
              total={20}
              label="완료"
              sub="Lessons Passed"
            />
            <StatCard
              value={accuracy}
              suffix="%"
              label="정확도"
              sub="Quiz Accuracy"
            />
            <StatCard
              value={totalAttempts}
              label="시도"
              sub="Total Attempts"
            />
            <StatCard
              value={progress.totalAnswered}
              label="문제"
              sub="Questions Answered"
            />
          </div>

          {/* Per-unit breakdown */}
          <div className="space-y-3">
            <h2 className="kr font-bold">
              <KrTip en="Unit progress">유닛별 진도</KrTip>
            </h2>
            {progress.units.map((unit) => {
              const unitLessons =
                index?.units[String(unit.unit)]?.lessons ?? [];
              const passed = unit.lessons.filter((l) => l.passed).length;
              const totalInUnit = unitLessons.length || 4;

              return (
                <div
                  key={unit.unit}
                  className={`bg-card border border-border rounded-xl p-4 ${
                    !unit.unlocked ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="kr text-sm font-bold">
                      {unit.unlocked ? "" : "🔒 "}
                      {UNIT_LABELS[unit.unit]}
                    </p>
                    <span className="text-xs text-faint">
                      {passed}/{totalInUnit} passed
                    </span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage rounded-full transition-all"
                      style={{
                        width: `${(passed / totalInUnit) * 100}%`,
                      }}
                    />
                  </div>
                  {unit.lessons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {unit.lessons.map((lesson) => {
                        const num = getLessonNumber(lesson.lessonId);
                        const score =
                          lesson.bestScore != null && lesson.bestTotal
                            ? Math.round(
                                (lesson.bestScore / lesson.bestTotal) * 100
                              )
                            : null;
                        return (
                          <div
                            key={lesson.lessonId}
                            className={`text-[10px] px-2 py-1 rounded-md border ${
                              lesson.passed
                                ? "bg-sage-light border-sage/30 text-sage"
                                : "bg-coral-light border-coral/30 text-coral"
                            }`}
                          >
                            L{num}
                            {score !== null && (
                              <span className="ml-1 font-bold">{score}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {totalPassed === 0 && totalAttempts === 0 && (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl">📊</div>
              <p className="kr text-lg font-bold">
                <KrTip en="No progress yet">아직 기록이 없어요</KrTip>
              </p>
              <p className="text-sm text-muted">
                Complete lessons to see your stats here
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                <KrTip en="Start learning">학습 시작</KrTip>
              </Link>
            </div>
          )}
        </div>
      </main>

      <BottomNav active="progress" />
    </div>
  );
}

function StatCard({
  value,
  total,
  suffix,
  label,
  sub,
}: {
  value: number;
  total?: number;
  suffix?: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-2xl font-bold">
        {value}
        {suffix && <span className="text-lg">{suffix}</span>}
        {total != null && (
          <span className="text-faint text-sm">/{total}</span>
        )}
      </p>
      <p className="text-xs kr text-muted">{label}</p>
      <p className="text-[10px] text-faint">{sub}</p>
    </div>
  );
}
