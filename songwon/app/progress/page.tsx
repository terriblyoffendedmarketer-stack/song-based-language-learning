"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadState } from "@/lib/storage";
import { getStrengthLabel } from "@/lib/srs";
import type { AppState } from "@/lib/types";
import { KrTip } from "@/components/ui/KrTip";

export default function ProgressPage() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-2xl">📊</div>
      </div>
    );
  }

  const { progress, vocabulary, songs, lessons } = state;

  const levelThresholds = [
    { label: "초급 1", en: "Beginner 1", min: 0 },
    { label: "초급 2", en: "Beginner 2", min: 100 },
    { label: "초급 3", en: "Beginner 3", min: 300 },
    { label: "중급 1", en: "Intermediate 1", min: 600 },
    { label: "중급 2", en: "Intermediate 2", min: 1200 },
    { label: "중급 3", en: "Intermediate 3", min: 2000 },
    { label: "고급 1", en: "Advanced 1", min: 3500 },
    { label: "고급 2", en: "Advanced 2", min: 5000 },
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

  const strong = vocabulary.filter((v) => v.srs.strength >= 80).length;
  const medium = vocabulary.filter(
    (v) => v.srs.strength >= 20 && v.srs.strength < 80
  ).length;
  const weak = vocabulary.filter((v) => v.srs.strength < 20).length;

  const dueCount = vocabulary.filter(
    (v) => v.srs.nextReview <= new Date().toISOString()
  ).length;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← <KrTip en="Home">홈</KrTip>
          </Link>
          <h1 className="kr font-bold"><KrTip en="My progress">내 기록</KrTip></h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6 page-enter">
          {/* Level + XP */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="kr text-2xl font-black"><KrTip en={currentLevel.en}>{currentLevel.label}</KrTip></p>
                <p className="text-xs text-muted">
                  {progress.xp} XP total
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 bg-amber-light px-3 py-1.5 rounded-full">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-amber">
                    {progress.streak}<KrTip en="days">일</KrTip>
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
            <StatCard value={songs.length} label="노래" sub="Songs" />
            <StatCard
              value={progress.lessonsCompleted.length}
              label="수업 완료"
              sub="Lessons"
            />
            <StatCard value={vocabulary.length} label="단어" sub="Words" />
            <StatCard
              value={progress.immersionMinutes}
              label="분 몰입"
              sub="Minutes"
            />
          </div>

          {/* Vocabulary strength breakdown */}
          {vocabulary.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="kr font-bold"><KrTip en="Word strength">단어 실력</KrTip></p>
                <span className="text-xs text-faint">Vocabulary Strength</span>
              </div>

              {/* Stacked bar */}
              <div className="h-4 rounded-full overflow-hidden flex">
                {strong > 0 && (
                  <div
                    className="bg-sage h-full"
                    style={{
                      width: `${(strong / vocabulary.length) * 100}%`,
                    }}
                  />
                )}
                {medium > 0 && (
                  <div
                    className="bg-amber h-full"
                    style={{
                      width: `${(medium / vocabulary.length) * 100}%`,
                    }}
                  />
                )}
                {weak > 0 && (
                  <div
                    className="bg-coral h-full"
                    style={{
                      width: `${(weak / vocabulary.length) * 100}%`,
                    }}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sage" />
                    <span className="text-sm font-bold">{strong}</span>
                  </div>
                  <p className="text-[10px] text-muted kr"><KrTip en="Strong">강해요</KrTip></p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber" />
                    <span className="text-sm font-bold">{medium}</span>
                  </div>
                  <p className="text-[10px] text-muted kr"><KrTip en="Okay">괜찮아요</KrTip></p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-coral" />
                    <span className="text-sm font-bold">{weak}</span>
                  </div>
                  <p className="text-[10px] text-muted kr"><KrTip en="Weak">약해요</KrTip></p>
                </div>
              </div>

              {dueCount > 0 && (
                <Link
                  href="/review"
                  className="block w-full py-3 rounded-xl bg-coral text-white text-center
                    text-sm font-semibold hover:bg-coral/90 transition-colors"
                >
                  {dueCount}<KrTip en="items to review">개 복습하기</KrTip> Review Now
                </Link>
              )}
            </div>
          )}

          {/* Recent vocabulary */}
          {vocabulary.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="kr font-bold"><KrTip en="Recent words">최근 단어</KrTip></p>
                <span className="text-xs text-faint">Recent Words</span>
              </div>
              <div className="space-y-2">
                {vocabulary.slice(-8).reverse().map((v) => {
                  const strength = getStrengthLabel(v.srs.strength);
                  return (
                    <div
                      key={v.id}
                      className="bg-card border border-border rounded-xl px-4 py-3
                        flex items-center justify-between"
                    >
                      <div>
                        <p className="kr font-bold text-sm">{v.korean}</p>
                        <p className="text-xs text-muted">{v.english}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-semibold text-${strength.color} kr`}
                        >
                          {strength.label}
                        </span>
                        <p className="text-[10px] text-faint">
                          TOPIK {v.topikLevel}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {vocabulary.length === 0 && songs.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <div className="text-6xl">📊</div>
              <p className="kr text-lg font-bold"><KrTip en="No progress yet">아직 기록이 없어요</KrTip></p>
              <p className="text-sm text-muted">
                Upload songs and complete lessons to see your progress
              </p>
              <Link
                href="/upload"
                className="inline-block px-6 py-3 rounded-xl bg-accent text-white
                  text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                <KrTip en="Get started">시작하기</KrTip>
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="border-t border-border bg-card px-4 py-2">
        <div className="max-w-lg mx-auto flex justify-around">
          {[
            { href: "/", icon: "🏠", label: "홈", en: "Home", active: false },
            { href: "/review", icon: "📖", label: "복습", en: "Review", active: false },
            { href: "/progress", icon: "📊", label: "기록", en: "Progress", active: true },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
                item.active ? "text-accent" : "text-faint hover:text-muted"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-semibold kr"><KrTip en={item.en}>{item.label}</KrTip></span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
}: {
  value: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs kr text-muted">{label}</p>
      <p className="text-[10px] text-faint">{sub}</p>
    </div>
  );
}
