"use client";

import { useState, useEffect, useCallback } from "react";
import { KrTip } from "@/components/ui/KrTip";
import { useTTS } from "@/hooks/useTTS";

interface QuestionEntry {
  type: string;
  prompt: string;
  promptTranslation: string;
  correct: string;
  wrong: string[];
  explanation: string;
  lesson: string;
  grammar: string;
}

const SEEN_KEY = "songwon-startup-seen";

function getSeenIds(): number[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markSeen(id: number) {
  const seen = getSeenIds();
  seen.push(id);
  if (seen.length > 150) seen.splice(0, seen.length - 150);
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

export function StartupQuestion({ onDismiss }: { onDismiss: () => void }) {
  const [question, setQuestion] = useState<QuestionEntry | null>(null);
  const [options, setOptions] = useState<{ text: string; correct: boolean }[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { speak } = useTTS();

  useEffect(() => {
    fetch("/data/question_bank.json")
      .then((r) => r.json())
      .then((bank: QuestionEntry[]) => {
        const seen = new Set(getSeenIds());
        const unseen = bank.map((q, i) => ({ q, i })).filter(({ i }) => !seen.has(i));
        const pool = unseen.length > 0 ? unseen : bank.map((q, i) => ({ q, i }));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        markSeen(pick.i);
        setQuestion(pick.q);

        const shuffled = [
          { text: pick.q.correct, correct: true },
          ...pick.q.wrong.map((w) => ({ text: w, correct: false })),
        ].sort(() => Math.random() - 0.5);
        setOptions(shuffled);
        setLoading(false);
      })
      .catch(() => {
        onDismiss();
      });
  }, [onDismiss]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (selected !== null) return;
      setSelected(idx);
      if (options[idx].correct) {
        const full = question?.prompt.includes("___")
          ? question.prompt.replace("___", question.correct)
          : question?.prompt ?? "";
        speak(full);
      }
    },
    [selected, options, speak, question]
  );

  if (loading || !question) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="animate-pulse text-2xl">🎵</div>
      </div>
    );
  }

  const answered = selected !== null;
  const isCorrect = answered && options[selected].correct;
  const hasBlank = question.type === "fill-blank" || question.type === "grammar-fill";

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
              <KrTip en="Daily question">오늘의 문제</KrTip>
            </p>
            <button
              onClick={() => {
                const promptKorean = /[가-힣]/.test(question.prompt);
                const transKorean = question.promptTranslation && /[가-힣]/.test(question.promptTranslation);
                if (promptKorean) {
                  speak(question.prompt.replace(/_{2,}/g, "").replace(/\s{2,}/g, " ").trim());
                } else if (transKorean) {
                  speak(question.promptTranslation);
                }
              }}
              className="kr text-3xl font-black text-accent mb-2 hover:opacity-80 transition-opacity"
            >
              {question.prompt} <span className="text-faint text-sm">🔊</span>
            </button>
            <p className="text-sm text-muted">
              {hasBlank
                ? question.promptTranslation
                : "무슨 뜻일까요?"}
            </p>
          </div>

          <div className="grid gap-3">
            {options.map((opt, i) => {
              let cls = "border-border bg-card hover:border-accent/40";
              if (answered) {
                if (opt.correct) cls = "border-sage bg-sage-light";
                else if (i === selected) cls = "border-coral bg-coral-light";
                else cls = "border-border bg-card opacity-50";
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                  className={`w-full p-4 rounded-xl border text-left font-semibold text-sm transition-all active:scale-[0.98] ${cls}`}
                >
                  {opt.text}
                  {answered && opt.correct && (
                    <span className="float-right text-sage">✓</span>
                  )}
                  {answered && i === selected && !opt.correct && (
                    <span className="float-right text-coral">✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {answered && (
            <div
              className={`rounded-xl p-4 text-center ${
                isCorrect
                  ? "bg-sage-light border border-sage/30"
                  : "bg-coral-light border border-coral/30"
              }`}
            >
              <p className="text-lg font-bold mb-1">
                {isCorrect ? "맞았어요! 🎉" : "아쉬워요!"}
              </p>
              <p className="text-sm text-muted">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          <button
            onClick={onDismiss}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
              answered
                ? "bg-accent text-white hover:bg-accent-hover"
                : "bg-card border border-border text-muted hover:text-foreground"
            }`}
          >
            {answered ? (
              <KrTip en="Continue">계속하기</KrTip>
            ) : (
              <KrTip en="Skip">건너뛰기</KrTip>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
