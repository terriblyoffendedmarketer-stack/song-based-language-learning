"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { KrTip } from "@/components/ui/KrTip";
import { BottomNav } from "@/components/BottomNav";
import {
  type VocabItem,
  type GrammarItem,
  type SongPracticeLine,
  type PracticeQuestion,
  type PracticeStats,
  loadPracticeStats,
  savePracticeStats,
  generateSession,
  updateSRS,
  getMasteryStats,
} from "@/lib/practice-engine";

type SessionState = "lobby" | "quiz" | "feedback" | "results";

export default function PracticePage() {
  const router = useRouter();
  const { speak } = useTTS();

  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [grammar, setGrammar] = useState<GrammarItem[]>([]);
  const [songLines, setSongLines] = useState<SongPracticeLine[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [stats, setStats] = useState<PracticeStats>({
    srs: {},
    sessionsCompleted: 0,
    lastSessionDate: "",
  });
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("lobby");
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const [vocabRes, grammarRes] = await Promise.all([
        fetch("/data/practice/vocab_pool.json"),
        fetch("/data/practice/grammar_pool.json"),
      ]);
      const vocabData: VocabItem[] = await vocabRes.json();
      const grammarData: GrammarItem[] = await grammarRes.json();
      setVocab(vocabData);
      setGrammar(grammarData);

      // Practice is always ungated — all vocab available
      const allLessons = [...new Set(vocabData.map((v) => v.lessonId))];
      setCompletedLessons(allLessons);

      setStats(loadPracticeStats());

      // Load song practice lines for fill-in-blank questions
      try {
        const songIdxRes = await fetch("/data/song_index.json");
        if (songIdxRes.ok) {
          const songIdx = await songIdxRes.json();
          const sample = (songIdx.songs as { id: string }[])
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);
          const lines: SongPracticeLine[] = [];
          await Promise.all(
            sample.map(async (s) => {
              try {
                const res = await fetch(`/data/song_practice/${s.id}.json`);
                if (res.ok) {
                  const data = await res.json();
                  for (const line of data.lines) {
                    lines.push({ songId: s.id, ...line });
                  }
                }
              } catch {}
            })
          );
          setSongLines(lines);
        }
      } catch {}

      setLoading(false);
    }
    init();
  }, []);

  const startSession = useCallback(() => {
    const session = generateSession(vocab, grammar, completedLessons, stats, songLines);
    if (session.length === 0) return;
    setQuestions(session);
    setCurrentIdx(0);
    setSelected(null);
    setSessionCorrect(0);
    setSessionTotal(0);
    setSessionState("quiz");
  }, [vocab, grammar, completedLessons, stats, songLines]);

  const handleAnswer = useCallback(
    (optionIdx: number) => {
      if (selected !== null) return;
      setSelected(optionIdx);

      const q = questions[currentIdx];
      const isCorrect = q.options[optionIdx].correct;

      const updated = updateSRS(stats, q.vocabKey, isCorrect);
      setStats(updated);
      savePracticeStats(updated);

      setSessionTotal((t) => t + 1);
      if (isCorrect) {
        setSessionCorrect((c) => c + 1);
      } else if (!q.id.startsWith("re-")) {
        // Re-exposure: add the same vocab as a new question later in the session
        const reQuestion: PracticeQuestion = {
          ...q,
          id: `re-${q.id}`,
        };
        setQuestions((prev) => {
          const remaining = prev.length - currentIdx - 1;
          if (remaining < 2) return [...prev, reQuestion];
          const insertAt = currentIdx + 2 + Math.floor(Math.random() * Math.min(remaining - 1, 3));
          const copy = [...prev];
          copy.splice(insertAt, 0, reQuestion);
          return copy;
        });
      }
      setSessionState("feedback");
    },
    [selected, questions, currentIdx, stats]
  );

  const advance = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setSessionState("quiz");
    } else {
      const updated = {
        ...stats,
        sessionsCompleted: stats.sessionsCompleted + 1,
        lastSessionDate: new Date().toISOString().split("T")[0],
      };
      setStats(updated);
      savePracticeStats(updated);
      setSessionState("results");
    }
  }, [currentIdx, questions.length, stats]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-2xl animate-pulse">📝</div>
      </div>
    );
  }

  const mastery = getMasteryStats(vocab, completedLessons, stats);
  const hasEnoughVocab = mastery.total >= 4;

  // Lobby
  if (sessionState === "lobby") {
    return (
      <div className="flex-1 flex flex-col min-h-screen pb-20">
        <header className="px-4 py-4 border-b border-border">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-lg">
              <KrTip en="Practice">연습</KrTip>
            </h1>
            <p className="text-xs text-muted mt-1">
              <KrTip en="Review vocab & grammar">배운 단어와 문법 복습</KrTip>
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Mastery overview */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <p className="text-xs uppercase tracking-wider text-faint font-semibold">
                <KrTip en="Vocabulary mastery">단어 숙달도</KrTip>
              </p>

              {mastery.total === 0 ? (
                <p className="text-sm text-muted">
                  <KrTip en="Complete a lesson first to unlock practice!">레슨을 먼저 완료하면 연습할 수 있어요!</KrTip>
                </p>
              ) : (
                <>
                  <div className="flex gap-3">
                    <MasteryBadge
                      label="New"
                      korean="새"
                      count={mastery.new}
                      color="text-faint"
                    />
                    <MasteryBadge
                      label="Learning"
                      korean="학습 중"
                      count={mastery.learning}
                      color="text-amber-500"
                    />
                    <MasteryBadge
                      label="Mastered"
                      korean="숙달"
                      count={mastery.mastered}
                      color="text-green-500"
                    />
                  </div>

                  <div className="h-2 bg-border rounded-full overflow-hidden flex">
                    {mastery.mastered > 0 && (
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(mastery.mastered / mastery.total) * 100}%`,
                        }}
                      />
                    )}
                    {mastery.learning > 0 && (
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: `${(mastery.learning / mastery.total) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Session stats */}
            {stats.sessionsCompleted > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-black">
                    {stats.sessionsCompleted}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-1">
                    <KrTip en="Sessions">연습 횟수</KrTip>
                  </p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-black">{mastery.total}</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-1">
                    <KrTip en="Total words">전체 단어</KrTip>
                  </p>
                </div>
              </div>
            )}

            {/* Start button */}
            <button
              onClick={startSession}
              disabled={!hasEnoughVocab}
              className="w-full py-4 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hasEnoughVocab ? (
                <KrTip en="Start practice">연습 시작</KrTip>
              ) : (
                <KrTip en="Complete a lesson first">
                  레슨을 먼저 완료하세요
                </KrTip>
              )}
            </button>

            {!hasEnoughVocab && mastery.total > 0 && mastery.total < 4 && (
              <p className="text-xs text-muted text-center">
                <KrTip en="Need at least 4 vocab items. Complete more lessons!">단어가 4개 이상 필요해요. 레슨을 더 완료하세요!</KrTip>
              </p>
            )}
          </div>
        </main>

        <BottomNav active="practice" />
      </div>
    );
  }

  // Quiz / Feedback
  if (sessionState === "quiz" || sessionState === "feedback") {
    const q = questions[currentIdx];
    const progress =
      questions.length > 0
        ? ((currentIdx + (sessionState === "feedback" ? 1 : 0)) /
            questions.length) *
          100
        : 0;

    return (
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header with progress */}
        <header className="px-4 py-3 border-b border-border">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setSessionState("lobby")}
                className="text-muted hover:text-foreground text-sm"
              >
                ✕
              </button>
              <span className="text-xs text-faint">
                {currentIdx + 1}/{questions.length}
              </span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="max-w-lg w-full space-y-8">
            {/* Question type label */}
            <p className="text-[10px] uppercase tracking-wider text-faint font-semibold text-center">
              {q.type === "korean-to-english" && (
                <KrTip en="What does this mean?">무슨 뜻일까요?</KrTip>
              )}
              {q.type === "english-to-korean" && (
                <KrTip en="In Korean?">한국어로?</KrTip>
              )}
              {q.type === "grammar-meaning" && (
                <KrTip en="Grammar meaning">문법의 의미는?</KrTip>
              )}
              {q.type === "fill-in-blank" && (
                <KrTip en="Fill in the blank">빈칸을 채우세요</KrTip>
              )}
              {q.type === "listening" && (
                <KrTip en="What did you hear?">들은 단어의 뜻은?</KrTip>
              )}
              {q.type === "grammar-comparison" && (
                <KrTip en="Which grammar fits?">어떤 문법이 맞을까요?</KrTip>
              )}
            </p>

            {/* Prompt */}
            <div className="text-center">
              {q.type === "listening" ? (
                <ListeningPrompt word={q.prompt} speak={speak} />
              ) : (
                <button
                  onClick={() => speak(q.prompt)}
                  className={`text-2xl font-black leading-relaxed hover:text-accent transition-colors ${
                    q.type === "english-to-korean" ? "" : "kr"
                  }`}
                >
                  {q.prompt}
                  {q.type !== "english-to-korean" && (
                    <span className="text-faint text-sm ml-2">🔊</span>
                  )}
                </button>
              )}
            </div>

            {/* Options */}
            <div className="grid gap-3">
              {q.options.map((opt, i) => {
                let optClass =
                  "w-full text-left px-5 py-4 rounded-xl border text-sm font-semibold transition-all";

                if (selected === null) {
                  optClass +=
                    " border-border hover:border-accent/40 bg-card";
                } else if (opt.correct) {
                  optClass +=
                    " border-green-500 bg-green-500/10 text-green-600";
                } else if (i === selected && !opt.correct) {
                  optClass += " border-red-500 bg-red-500/10 text-red-500";
                } else {
                  optClass += " border-border bg-card opacity-50";
                }

                const useKoreanFont = q.type === "english-to-korean" || q.type === "fill-in-blank";
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={selected !== null}
                    className={optClass}
                  >
                    <span className={useKoreanFont ? "kr" : ""}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Discrimination feedback */}
            {sessionState === "feedback" && q.feedback && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-2.5 page-enter">
                {selected !== null && q.options[selected].correct ? (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1"><KrTip en="Correct!">정답!</KrTip></p>
                    <p className="text-xs text-muted">{q.feedback.correctExplanation}</p>
                  </div>
                ) : selected !== null ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-red-500 mb-1"><KrTip en="Not quite">아쉬워요</KrTip></p>
                      <p className="text-xs text-muted">
                        {q.feedback.wrongExplanations[q.options[selected].text] || "That's a different word"}
                      </p>
                    </div>
                    <div className="border-t border-border pt-2">
                      <p className="text-xs font-semibold text-green-600 mb-1"><KrTip en="The answer">정답은</KrTip></p>
                      <p className="text-xs text-muted">{q.feedback.correctExplanation}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Song context on feedback */}
            {sessionState === "feedback" && q.songContext && (
              <div className="bg-card border border-border rounded-xl p-4 text-center page-enter">
                <p className="text-[10px] text-faint uppercase tracking-wider mb-2">
                  <KrTip en="from a song">노래에서</KrTip>
                </p>
                <button
                  onClick={() => speak(q.songContext!.korean)}
                  className="kr text-sm font-medium hover:text-accent transition-colors"
                >
                  {q.songContext.korean}
                  <span className="text-faint text-xs ml-1">🔊</span>
                </button>
                <p className="text-xs text-muted mt-1">
                  {q.songContext.english}
                </p>
              </div>
            )}

            {/* Continue button */}
            {sessionState === "feedback" && (
              <button
                onClick={advance}
                className="w-full py-3.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors page-enter"
              >
                <KrTip en="Continue">계속</KrTip> →
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Results
  if (sessionState === "results") {
    const accuracy =
      sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    const updatedMastery = getMasteryStats(vocab, completedLessons, stats);

    return (
      <div className="flex-1 flex flex-col min-h-screen pb-20">
        <header className="px-4 py-4 border-b border-border">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-lg">
              <KrTip en="Session complete!">연습 완료!</KrTip>
            </h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center space-y-2">
              <p className="text-6xl">
                {accuracy >= 80 ? "🎉" : accuracy >= 60 ? "👍" : "💪"}
              </p>
              <p className="text-3xl font-black">{accuracy}%</p>
              <p className="text-sm text-muted">
                {sessionCorrect}/{sessionTotal} <KrTip en="correct">정답</KrTip>
              </p>
            </div>

            {/* Updated mastery */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="text-xs uppercase tracking-wider text-faint font-semibold">
                <KrTip en="Vocabulary mastery">단어 숙달도</KrTip>
              </p>
              <div className="flex gap-3">
                <MasteryBadge
                  label="New"
                  korean="새"
                  count={updatedMastery.new}
                  color="text-faint"
                />
                <MasteryBadge
                  label="Learning"
                  korean="학습 중"
                  count={updatedMastery.learning}
                  color="text-amber-500"
                />
                <MasteryBadge
                  label="Mastered"
                  korean="숙달"
                  count={updatedMastery.mastered}
                  color="text-green-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSessionState("lobby")}
                className="flex-1 py-3.5 rounded-xl border border-border text-sm font-semibold hover:border-accent/40 transition-colors"
              >
                <KrTip en="Done">완료</KrTip>
              </button>
              <button
                onClick={startSession}
                className="flex-1 py-3.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors"
              >
                <KrTip en="Practice again">다시 연습</KrTip>
              </button>
            </div>
          </div>
        </main>

        <BottomNav active="practice" />
      </div>
    );
  }

  return null;
}

function MasteryBadge({
  label,
  korean,
  count,
  color,
}: {
  label: string;
  korean: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex-1 text-center">
      <p className={`text-xl font-black ${color}`}>{count}</p>
      <p className="text-[10px] text-muted">
        <KrTip en={label}>{korean}</KrTip>
      </p>
    </div>
  );
}

function ListeningPrompt({
  word,
  speak,
}: {
  word: string;
  speak: (text: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => speak(word), 300);
    return () => clearTimeout(timer);
  }, [word, speak]);

  return (
    <button
      onClick={() => speak(word)}
      className="flex flex-col items-center gap-3 hover:text-accent transition-colors"
    >
      <span className="text-5xl">🔊</span>
      <span className="text-xs text-muted"><KrTip en="Tap to replay">다시 듣기</KrTip></span>
    </button>
  );
}
