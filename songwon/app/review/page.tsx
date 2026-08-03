"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadState, updateVocabularyItem } from "@/lib/storage";
import { reviewCard, getDueVocabulary, getStrengthLabel } from "@/lib/srs";
import { useTTS } from "@/hooks/useTTS";
import type { VocabularyItem } from "@/lib/types";
import { KrTip } from "@/components/ui/KrTip";

export default function ReviewPage() {
  const router = useRouter();
  const [dueItems, setDueItems] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [done, setDone] = useState(false);
  const { speak } = useTTS();

  useEffect(() => {
    const state = loadState();
    const due = getDueVocabulary(state.vocabulary);
    setDueItems(due);
    if (due.length === 0) setDone(true);
  }, []);

  const current = dueItems[currentIndex];

  const handleGrade = (quality: number) => {
    if (!current) return;
    const newSRS = reviewCard(current.srs, quality);
    updateVocabularyItem(current.id, { srs: newSRS });

    setSessionStats((s) => ({
      reviewed: s.reviewed + 1,
      correct: quality >= 3 ? s.correct + 1 : s.correct,
    }));

    if (currentIndex < dueItems.length - 1) {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
    } else {
      setDone(true);
    }
  };


  if (done) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6 page-enter">
          {sessionStats.reviewed === 0 ? (
            <>
              <div className="text-6xl">✨</div>
              <p className="kr text-xl font-bold"><KrTip en="No words to review!">복습할 단어가 없어요!</KrTip></p>
              <p className="text-sm text-muted">No words due for review right now.</p>
            </>
          ) : (
            <>
              <div className="text-6xl">🎯</div>
              <p className="kr text-xl font-bold"><KrTip en="Review complete!">복습 완료!</KrTip></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent-light rounded-xl p-4">
                  <p className="text-2xl font-bold text-accent">
                    {sessionStats.reviewed}
                  </p>
                  <p className="text-[10px] text-accent font-semibold kr"><KrTip en="Reviews done">복습 완료</KrTip></p>
                </div>
                <div className="bg-sage-light rounded-xl p-4">
                  <p className="text-2xl font-bold text-sage">
                    {sessionStats.reviewed > 0
                      ? Math.round(
                          (sessionStats.correct / sessionStats.reviewed) * 100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-[10px] text-sage font-semibold kr"><KrTip en="Accuracy">정확도</KrTip></p>
                </div>
              </div>
            </>
          )}
          <button
            onClick={() => router.push("/")}
            className="w-full py-4 rounded-xl bg-accent text-white font-semibold
              hover:bg-accent-hover transition-colors"
          >
            <KrTip en="Back to home">홈으로 돌아가기</KrTip>
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const strength = getStrengthLabel(current.srs.strength);

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-muted hover:text-foreground text-sm"
          >
            ✕
          </button>
          <p className="kr text-sm font-semibold">
            <KrTip en="Review">복습</KrTip> {currentIndex + 1}/{dueItems.length}
          </p>
          <div className="flex items-center gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full bg-${strength.color}`}
            />
            <span className="text-xs text-faint kr">{strength.label}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="max-w-lg mx-auto mt-2">
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / dueItems.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-lg w-full page-enter">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 text-center">
            {/* Korean word */}
            <div>
              <button
                onClick={() => speak(current.korean)}
                className="hover:opacity-70 transition-opacity"
              >
                <p className="kr text-4xl font-black">{current.korean}</p>
              </button>
              <p className="text-xs text-faint mt-1">{current.romanization}</p>
              <p className="text-[10px] text-faint mt-0.5">
                {current.partOfSpeech} · TOPIK {current.topikLevel}
              </p>
            </div>

            {/* Song context */}
            {current.fromLine && (
              <div className="bg-background rounded-xl p-3">
                <p className="kr text-sm leading-relaxed">{current.fromLine}</p>
              </div>
            )}

            {/* Reveal area */}
            {!revealed ? (
              <button
                onClick={() => {
                  setRevealed(true);
                  speak(current.korean);
                }}
                className="w-full py-4 rounded-xl bg-accent text-white font-semibold
                  hover:bg-accent-hover transition-colors"
              >
                <KrTip en="Show meaning">뜻 보기</KrTip> Show Meaning
              </button>
            ) : (
              <div className="space-y-4 page-enter">
                <div className="bg-accent-light rounded-xl p-4">
                  <p className="text-lg font-bold text-accent">
                    {current.english}
                  </p>
                  {current.exampleSentence && (
                    <button
                      onClick={() => speak(current.exampleSentence)}
                      className="kr text-sm text-muted mt-2 block hover:opacity-70"
                    >
                      {current.exampleSentence}
                    </button>
                  )}
                </div>

                {/* Self-grading */}
                <div>
                  <p className="text-[10px] text-faint uppercase tracking-wider mb-2">
                    <KrTip en="How well did you remember?">얼마나 잘 기억했나요?</KrTip>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleGrade(1)}
                      className="py-3 rounded-xl bg-coral-light border border-coral/30
                        text-coral text-sm font-semibold hover:bg-coral/10 transition-colors"
                    >
                      <KrTip en="Don't know">몰라요</KrTip>
                    </button>
                    <button
                      onClick={() => handleGrade(3)}
                      className="py-3 rounded-xl bg-amber-light border border-amber/30
                        text-amber text-sm font-semibold hover:bg-amber/10 transition-colors"
                    >
                      <KrTip en="Hard">어려워요</KrTip>
                    </button>
                    <button
                      onClick={() => handleGrade(5)}
                      className="py-3 rounded-xl bg-sage-light border border-sage/30
                        text-sage text-sm font-semibold hover:bg-sage/10 transition-colors"
                    >
                      <KrTip en="Easy">쉬워요</KrTip>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
