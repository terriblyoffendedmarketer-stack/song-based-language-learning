"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadV5Progress, defaultProgress, loadInProgress, isLessonUnlocked, getLessonNumber, initTesterMode } from "@/lib/v5-progress";
import { loadV5LessonIndex, type V5LessonIndex } from "@/lib/seed-loader";
import { KrTip } from "@/components/ui/KrTip";
import { BottomNav } from "@/components/BottomNav";
import { StartupQuestion } from "@/components/StartupQuestion";
import { ReminderSettings } from "@/components/ReminderSettings";
import { checkAndShowWebNotification } from "@/lib/notifications";
import type { V5UserProgress } from "@/lib/types";

const UNIT_LABELS: Record<number, string> = {
  1: "초급 1",
  2: "초급 2",
  3: "초급 3",
  4: "중급 1",
  5: "중급 2",
};

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState<V5UserProgress>(defaultProgress());
  const [index, setIndex] = useState<V5LessonIndex | null>(null);
  const [showQuestion, setShowQuestion] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("songwon-question-shown");
  });
  const [resumeLessonId, setResumeLessonId] = useState<string | null>(null);
  const [pendingNavigate, setPendingNavigate] = useState(false);

  useEffect(() => {
    initTesterMode();
    const inProgress = loadInProgress();
    if (inProgress) {
      setResumeLessonId(inProgress.lessonId);
    }
    setProgress(loadV5Progress());
    loadV5LessonIndex().then(setIndex);
    checkAndShowWebNotification();
  }, []);

  const handleQuestionDismiss = () => {
    sessionStorage.setItem("songwon-question-shown", "1");
    setShowQuestion(false);
    if (resumeLessonId) {
      router.replace(`/learn/v5/${resumeLessonId}`);
    } else if (index) {
      const next = findNextLesson(progress, index);
      if (next) router.replace(`/learn/v5/${next.id}`);
    } else {
      setPendingNavigate(true);
    }
  };

  useEffect(() => {
    if (pendingNavigate && index) {
      setPendingNavigate(false);
      const next = findNextLesson(progress, index);
      if (next) router.replace(`/learn/v5/${next.id}`);
    }
  }, [pendingNavigate, index, progress, router]);

  if (showQuestion) {
    return <StartupQuestion onDismiss={handleQuestionDismiss} />;
  }

  const currentUnit = findCurrentUnit(progress);
  const nextLesson = index ? findNextLesson(progress, index) : null;
  const totalPassed = progress.units.reduce(
    (sum, u) => sum + u.lessons.filter((l) => l.passed).length,
    0
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 py-5 border-b border-border">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Songwon Korean
              </h1>
              <p className="text-xs text-muted">
                Learn Korean through songs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-amber-light px-2.5 py-1 rounded-full">
                <span className="text-sm">🔥</span>
                <span className="text-xs font-bold text-amber">
                  {progress.streak}
                  <KrTip en="days">일</KrTip>
                </span>
              </div>
              <div className="flex items-center gap-1 bg-accent-light px-2.5 py-1 rounded-full">
                <span className="text-xs font-bold text-accent">
                  {progress.xp} XP
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Continue learning CTA */}
          {nextLesson ? (
            <Link
              href={`/learn/v5/${nextLesson.id}`}
              className="block bg-accent text-white rounded-2xl p-5 hover:bg-accent-hover transition-colors active:scale-[0.98] shadow-lg shadow-accent/20"
            >
              <p className="text-[10px] uppercase tracking-wider opacity-80">
                {UNIT_LABELS[nextLesson.unit]} · Lesson {nextLesson.lessonNumber}
              </p>
              <p className="text-lg font-bold mt-1">{nextLesson.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="kr text-base font-black opacity-90">
                  {nextLesson.grammar}
                </span>
                <span className="text-sm opacity-70">
                  {nextLesson.grammarMeaning}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold"><KrTip en="Continue learning">계속 학습하기</KrTip> →</span>
                <span className="text-xs opacity-60">
                  {nextLesson.screenCount} screens
                </span>
              </div>
            </Link>
          ) : (
            <div className="bg-sage-light border border-sage/30 rounded-2xl p-5 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="kr text-lg font-bold text-sage">
                <KrTip en="You completed all the lessons!">모든 레슨을 완료했어요!</KrTip>
              </p>
              <p className="text-sm text-muted mt-1">
                All 20 lessons completed
              </p>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                value: totalPassed,
                total: 20,
                label: "완료",
                en: "Completed",
              },
              {
                value: progress.totalCorrect,
                total: progress.totalAnswered,
                label: "정답",
                en: "Correct",
              },
              {
                value: currentUnit,
                total: 5,
                label: "유닛",
                en: "Unit",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-card border border-border rounded-xl p-3 text-center"
              >
                <p className="text-lg font-bold">
                  {stat.value}
                  <span className="text-faint text-sm">/{stat.total}</span>
                </p>
                <p className="text-[10px] text-muted kr">
                  <KrTip en={stat.en}>{stat.label}</KrTip>
                </p>
              </div>
            ))}
          </div>

          {/* Unit progress overview */}
          <div>
            <h2 className="kr font-bold mb-3">
              <KrTip en="Progress">학습 진도</KrTip>
            </h2>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((unitNum) => {
                const unitLessons =
                  index?.units[String(unitNum)]?.lessons ?? [];
                const unitProgress = progress.units.find(
                  (u) => u.unit === unitNum
                );
                const passed =
                  unitProgress?.lessons.filter((l) => l.passed).length ?? 0;
                const unlocked = unitLessons.some((l) =>
                  isLessonUnlocked(progress, l.lessonNumber)
                );

                return (
                  <div
                    key={unitNum}
                    className={`bg-card border border-border rounded-xl p-3 flex items-center gap-3 ${
                      !unlocked ? "opacity-50" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent font-bold text-sm">
                      {unlocked ? unitNum : "🔒"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="kr text-sm font-bold">
                          {UNIT_LABELS[unitNum]}
                        </p>
                        <span className="text-xs text-faint">
                          {passed}/{unitLessons.length}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{
                            width:
                              unitLessons.length > 0
                                ? `${(passed / unitLessons.length) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Song Library CTA */}
          <Link
            href="/songs"
            className="block bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-accent/40 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎵</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">
                  <KrTip en="Song Library">노래 도서관</KrTip>
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Learn any of 72 songs line-by-line — no lessons required
                </p>
              </div>
              <span className="text-accent text-sm">→</span>
            </div>
          </Link>

          {/* Browse + Glossary */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/browse"
              className="block py-4 rounded-xl border border-border bg-card text-center
                font-semibold text-sm hover:border-accent/40 transition-colors
                active:scale-[0.98]"
            >
              <KrTip en="Browse all lessons">모든 레슨 보기</KrTip> →
            </Link>
            <Link
              href="/glossary"
              className="block py-4 rounded-xl border border-border bg-card text-center
                font-semibold text-sm hover:border-accent/40 transition-colors
                active:scale-[0.98]"
            >
              <KrTip en="Grammar Glossary">문법 사전</KrTip> →
            </Link>
          </div>

          {/* Reminder + Android download */}
          <ReminderSettings />

          <a
            href="/downloads/songwon.apk"
            download="Songwon-Korean.apk"
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors active:scale-[0.98]"
          >
            <span className="text-2xl">📱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Android App</p>
              <p className="text-xs text-muted">Download APK (3.9 MB)</p>
            </div>
            <span className="text-accent text-sm font-semibold">↓</span>
          </a>
        </div>
      </main>

      <BottomNav active="home" />
    </div>
  );
}

function findCurrentUnit(progress: V5UserProgress): number {
  for (let u = 5; u >= 1; u--) {
    const unit = progress.units.find((x) => x.unit === u);
    if (unit && unit.lessons.some((l) => l.passed)) return u;
  }
  return 1;
}

function findNextLesson(
  progress: V5UserProgress,
  index: V5LessonIndex
): {
  id: string;
  title: string;
  grammar: string;
  grammarMeaning: string;
  unit: number;
  lessonNumber: number;
  screenCount: number;
} | null {
  for (let u = 1; u <= 5; u++) {
    const lessons = index.units[String(u)]?.lessons ?? [];
    for (const lesson of lessons) {
      if (!isLessonUnlocked(progress, lesson.lessonNumber)) continue;
      const status = progress.units
        .find((x) => x.unit === u)
        ?.lessons.find((l) => l.lessonId === lesson.id);
      if (!status?.passed) return lesson;
    }
  }
  return null;
}
