"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { loadV5LessonById } from "@/lib/seed-loader";
import { useTTS } from "@/hooks/useTTS";
import Confetti from "@/components/gamification/Confetti";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import type {
  V5Lesson,
  V5Screen,
  V5Quiz,
  V5TeachingItem,
  V5ContextSentence,
  V5SongLine,
  V5PatternSpotlight,
  LessonAttempt,
} from "@/lib/types";
import { recordLessonAttempt, saveInProgress, loadInProgress, clearInProgress } from "@/lib/v5-progress";
import { KrTip } from "@/components/ui/KrTip";
import Link from "next/link";

export default function V5LearnPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<V5Lesson | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [canAdvance, setCanAdvance] = useState(false);
  const [saved, setSaved] = useState(false);
  const [restored, setRestored] = useState(false);
  const { speak, retry, usedFallback } = useTTS();

  useEffect(() => {
    loadV5LessonById(lessonId).then((l) => {
      if (l) {
        setLesson(l);
        const progress = loadInProgress();
        if (progress && progress.lessonId === lessonId && progress.currentIndex < l.screens.length) {
          setCurrentIndex(progress.currentIndex);
          setAnswers(progress.answers);
          setRestored(true);
        }
      }
    });
  }, [lessonId]);

  useEffect(() => {
    const s = lesson?.screens[currentIndex];
    if (!s) return;
    if ((s.type === "quiz" || s.type === "warmup") && answers[s.id] === undefined) {
      setCanAdvance(false);
    } else {
      setCanAdvance(true);
    }
  }, [lesson, currentIndex, answers]);

  const handleQuizAnswered = useCallback(
    (screenId: string, correct: boolean) => {
      setAnswers((prev) => ({ ...prev, [screenId]: correct }));
      setCanAdvance(true);
    },
    []
  );

  const handleNext = useCallback(() => {
    if (!lesson || !canAdvance) return;
    if (currentIndex < lesson.screens.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [lesson, currentIndex, canAdvance]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  const screen = lesson?.screens[currentIndex];
  const scoredQuizzes = lesson?.screens.filter(
    (s) => s.type === "quiz" && s.scored
  ) ?? [];
  const totalQuizzes = scoredQuizzes.length;
  const correctCount = scoredQuizzes.filter((s) => answers[s.id] === true).length;

  // Persist in-progress state for resume
  useEffect(() => {
    if (!lesson) return;
    if (screen?.type === "recap") return;
    saveInProgress({ lessonId, currentIndex, answers });
  }, [lesson, lessonId, currentIndex, answers, screen?.type]);

  // Save progress when reaching the recap screen
  useEffect(() => {
    if (!lesson || saved) return;
    if (screen?.type !== "recap") return;
    const passed = totalQuizzes > 0 && correctCount / totalQuizzes >= 0.8;
    const attempt: LessonAttempt = {
      lessonId: lesson.id,
      score: correctCount,
      total: totalQuizzes,
      passed,
      completedAt: new Date().toISOString(),
      answers: Object.entries(answers).map(([screenId, correct]) => ({
        screenId,
        correct,
      })),
    };
    recordLessonAttempt(attempt);
    clearInProgress();
    setSaved(true);
  }, [screen?.type, lesson, saved, correctCount, totalQuizzes, answers]);

  if (!lesson) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse text-2xl">📖</div>
      </div>
    );
  }

  const totalScreens = lesson.screens.length;
  const progress = ((currentIndex + 1) / totalScreens) * 100;
  const isLastScreen = currentIndex === totalScreens - 1;
  const wrongCount = scoredQuizzes.filter((s) => answers[s.id] === false).length;
  const answeredCount = correctCount + wrongCount;
  const songName = lesson.meta.artist + " - " + lesson.meta.songTitle;

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => { clearInProgress(); router.push("/"); }}
            className="text-muted hover:text-foreground text-sm"
          >
            ✕
          </button>
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-faint">
            {currentIndex + 1}/{totalScreens}
            {answeredCount > 0 && (
              <span className="text-sage ml-2">{correctCount}/{answeredCount}</span>
            )}
          </span>
        </div>
      </div>

      {/* TTS fallback retry */}
      {usedFallback && (
        <div className="px-4 py-1.5 border-b border-coral/30 bg-coral-light">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-xs text-coral">
              <KrTip en="Voice quality was low">음성 품질이 낮았어요</KrTip>
            </p>
            <button
              onClick={retry}
              className="text-xs text-coral font-semibold hover:underline"
            >
              <KrTip en="Retry">다시 시도</KrTip> ↻
            </button>
          </div>
        </div>
      )}

      {/* Audio player */}
      {screen?.musicPlaying && (
        <div className="px-4 py-2 border-b border-border">
          <div className="max-w-lg mx-auto">
            <AudioPlayer songName={songName} autoPlay />
          </div>
        </div>
      )}

      {/* Screen content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto page-enter" key={screen?.id}>
          {screen && (
            <ScreenRenderer
              screen={screen}
              speak={speak}
              onQuizAnswered={handleQuizAnswered}
              answered={answers[screen.id]}
              lesson={lesson}
              correctCount={correctCount}
              totalQuizzes={totalQuizzes}
            />
          )}
        </div>
      </main>

      {/* Navigation */}
      {!isLastScreen && (
        <div className="px-4 py-4 border-t border-border bg-card sticky bottom-0">
          <div className="max-w-lg mx-auto flex gap-3">
            {currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-background transition-colors"
              >
                ←
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canAdvance}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                canAdvance
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "bg-border text-faint cursor-not-allowed"
              }`}
            >
              <KrTip en="Continue">계속</KrTip>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Screen Renderer
   ================================================================ */

function ScreenRenderer({
  screen,
  speak,
  onQuizAnswered,
  answered,
  lesson,
  correctCount,
  totalQuizzes,
}: {
  screen: V5Screen;
  speak: (text: string, speed?: number) => Promise<void>;
  onQuizAnswered: (screenId: string, correct: boolean) => void;
  answered?: boolean;
  lesson: V5Lesson;
  correctCount: number;
  totalQuizzes: number;
}) {
  switch (screen.type) {
    case "warmup":
      return (
        <QuizScreenView
          screen={screen}
          quiz={screen.quiz}
          speak={speak}
          onAnswered={(correct) => onQuizAnswered(screen.id, correct)}
          answered={answered}
          label={screen.label}
        />
      );
    case "intro":
      return <IntroScreen screen={screen} />;
    case "lyrics-korean":
      return <LyricsKoreanScreen screen={screen} speak={speak} />;
    case "lyrics-english":
      return <LyricsEnglishScreen screen={screen} speak={speak} />;
    case "word-card":
      return <WordCardScreen item={screen.item} speak={speak} />;
    case "phrase-card":
      return <PhraseCardScreen item={screen.item} speak={speak} />;
    case "quiz":
      return (
        <QuizScreenView
          screen={screen}
          quiz={screen.quiz}
          speak={speak}
          onAnswered={(correct) => onQuizAnswered(screen.id, correct)}
          answered={answered}
          label={screen.label}
        />
      );
    case "context-sentence":
      return (
        <ContextSentenceScreen sentence={screen.sentence} speak={speak} />
      );
    case "pair-context":
      return (
        <PairContextScreen
          sentences={screen.sentences}
          note={screen.note}
          speak={speak}
        />
      );
    case "pattern-spotlight":
      return (
        <PatternSpotlightScreen spotlight={screen.spotlight} speak={speak} />
      );
    case "sing-along":
      return <SingAlongScreen lines={screen.lines} speak={speak} />;
    case "recap":
      return (
        <RecapScreen
          screen={screen}
          correctCount={correctCount}
          totalQuizzes={totalQuizzes}
        />
      );
    default:
      return <div className="text-muted text-sm">Unknown screen type</div>;
  }
}

/* ================================================================
   Highlighted Korean text
   ================================================================ */

function HighlightedText({
  text,
  highlights,
  className = "",
}: {
  text: string;
  highlights?: string[];
  className?: string;
}) {
  if (!highlights || highlights.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: { text: string; highlighted: boolean }[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliestIdx = remaining.length;
    let matchedHighlight = "";

    for (const h of highlights) {
      const idx = remaining.indexOf(h);
      if (idx !== -1 && idx < earliestIdx) {
        earliestIdx = idx;
        matchedHighlight = h;
      }
    }

    if (!matchedHighlight) {
      parts.push({ text: remaining, highlighted: false });
      break;
    }

    if (earliestIdx > 0) {
      parts.push({ text: remaining.slice(0, earliestIdx), highlighted: false });
    }
    parts.push({ text: matchedHighlight, highlighted: true });
    remaining = remaining.slice(earliestIdx + matchedHighlight.length);
  }

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.highlighted ? (
          <span key={i} className="text-accent font-bold">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

/* ================================================================
   Intro Screen
   ================================================================ */

function IntroScreen({ screen }: { screen: { title: string; content: string } }) {
  const lines = screen.content.split("\n").filter((l) => l.trim());
  // Reorder: grammar/lesson lines first, song description after
  const grammarLines = lines.filter((l) => /grammar|pattern|learn|배울|-(으)|you'll/i.test(l));
  const songLines = lines.filter((l) => !/grammar|pattern|learn|배울|-(으)|you'll/i.test(l));
  const reordered = [...grammarLines, ...songLines];

  function renderLine(p: string, i: number) {
    if (p.startsWith("- **")) {
      const match = p.match(/^- \*\*(.+?)\*\* — (.+)$/);
      if (match) {
        return (
          <div key={i} className="flex items-baseline gap-2 pl-2">
            <span className="kr font-bold text-foreground">{match[1]}</span>
            <span className="text-muted">— {match[2]}</span>
          </div>
        );
      }
    }
    if (p.includes("**")) {
      const parts = p.split(/\*\*(.+?)\*\*/g);
      return (
        <p key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="kr text-foreground">{part}</strong>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
        </p>
      );
    }
    return <p key={i}>{p}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-3xl">🎵</p>
        <h1 className="text-xl font-black">{screen.title}</h1>
      </div>
      <div className="text-sm text-muted leading-relaxed space-y-3">
        {reordered.map(renderLine)}
      </div>
    </div>
  );
}

/* ================================================================
   Lyrics Screens
   ================================================================ */

function LyricsKoreanScreen({
  screen,
  speak,
}: {
  screen: { lines: string[]; label?: string };
  speak: (t: string) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">👀</span>
        <div>
          <p className="kr font-bold"><KrTip en="Read the lyrics">가사를 읽어 보세요</KrTip></p>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            <KrTip en={screen.label ? screen.label : "Listen"}>{screen.label || "들어 보세요"}</KrTip>
          </p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        {screen.lines.map((line, i) => (
          <button
            key={i}
            onClick={() => speak(line)}
            className="kr text-lg font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
          >
            {line} <span className="text-faint text-xs">🔊</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-faint text-center kr">
        <KrTip en="By the end you'll understand these lyrics">끝까지 하면 이 가사를 이해할 수 있어요</KrTip>
      </p>
    </div>
  );
}

function LyricsEnglishScreen({
  screen,
  speak,
}: {
  screen: { lines: V5SongLine[] };
  speak: (t: string) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📖</span>
        <div>
          <p className="kr font-bold"><KrTip en="What does it mean?">무슨 뜻일까요?</KrTip></p>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            <KrTip en="Translation">번역</KrTip>
          </p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {screen.lines.map((line, i) => (
          <div key={i} className="space-y-1">
            <button
              onClick={() => speak(line.korean)}
              className="kr text-lg font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
            >
              <HighlightedText
                text={line.korean}
                highlights={line.highlights}
              />{" "}
              <span className="text-faint text-xs">🔊</span>
            </button>
            <p className="text-sm text-muted italic pl-1">{line.english}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-faint text-center kr">
        <KrTip en="Words you'll learn are highlighted">배울 단어는 하이라이트 되어 있어요</KrTip>
      </p>
    </div>
  );
}

/* ================================================================
   Word / Phrase Cards
   ================================================================ */

function WordCardScreen({
  item,
  speak,
}: {
  item: V5TeachingItem;
  speak: (t: string, s?: number) => Promise<void>;
}) {
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (!hasSpoken.current) {
      hasSpoken.current = true;
      const timer = setTimeout(() => speak(item.korean, 0.75), 300);
      return () => clearTimeout(timer);
    }
  }, [item.korean, speak]);

  return (
    <div className="space-y-6">
      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold text-center">
        <KrTip en="New word">새 단어</KrTip>
      </p>
      <button
        onClick={() => speak(item.korean, 0.75)}
        className="group text-center w-full space-y-2"
      >
        <p className="kr text-5xl font-black group-hover:text-accent transition-colors">
          {item.korean}
        </p>
        <p className="text-lg text-muted">{item.english}</p>
        {item.partOfSpeech && (
          <p className="text-xs text-faint">{item.partOfSpeech}</p>
        )}
        <p className="text-accent text-xs">🔊 <KrTip en="Tap to hear again">탭하면 다시 들을 수 있어요</KrTip></p>
      </button>

      {item.songLine.korean && (
        <div className="bg-accent-light border border-accent/20 rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            <KrTip en="In the song">노래에서</KrTip>
          </p>
          <button
            onClick={() => speak(item.songLine.korean)}
            className="kr text-base font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
          >
            <HighlightedText
              text={item.songLine.korean}
              highlights={item.songLine.highlights}
            />{" "}
            <span className="text-faint text-xs">🔊</span>
          </button>
          {item.songLine.english && (
            <p className="text-sm text-muted italic">{item.songLine.english}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PhraseCardScreen({
  item,
  speak,
}: {
  item: V5TeachingItem;
  speak: (t: string, s?: number) => Promise<void>;
}) {
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (!hasSpoken.current) {
      hasSpoken.current = true;
      const timer = setTimeout(() => speak(item.korean, 0.75), 300);
      return () => clearTimeout(timer);
    }
  }, [item.korean, speak]);

  return (
    <div className="space-y-6">
      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold text-center">
        <KrTip en="New expression">새 표현</KrTip>
      </p>
      <button
        onClick={() => speak(item.korean, 0.75)}
        className="group text-center w-full space-y-2"
      >
        <p className="kr text-4xl font-black group-hover:text-accent transition-colors">
          {item.korean}
        </p>
        <p className="text-lg text-muted">{item.english}</p>
        <p className="text-accent text-xs">🔊 <KrTip en="Tap to hear again">탭하면 다시 들을 수 있어요</KrTip></p>
      </button>

      {item.phraseNote && (
        <p className="text-sm text-muted text-center kr">{item.phraseNote}</p>
      )}

      {item.grammarNote && (
        <div className="bg-amber-light border border-amber/20 rounded-xl p-3 text-center">
          <p className="text-sm kr text-amber">{item.grammarNote}</p>
        </div>
      )}

      {item.songLine.korean && (
        <div className="bg-accent-light border border-accent/20 rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            <KrTip en="In the song">노래에서</KrTip>
          </p>
          <button
            onClick={() => speak(item.songLine.korean)}
            className="kr text-base font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
          >
            <HighlightedText
              text={item.songLine.korean}
              highlights={item.songLine.highlights}
            />{" "}
            <span className="text-faint text-xs">🔊</span>
          </button>
          {item.songLine.english && (
            <p className="text-sm text-muted italic">{item.songLine.english}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Quiz Screen
   ================================================================ */

function QuizScreenView({
  screen,
  quiz,
  speak,
  onAnswered,
  answered,
  label,
}: {
  screen: V5Screen;
  quiz: V5Quiz;
  speak: (t: string, s?: number) => Promise<void>;
  onAnswered: (correct: boolean) => void;
  answered?: boolean;
  label?: string;
}) {
  const alreadyAnswered = answered !== undefined;
  const [selected, setSelected] = useState<number | null>(
    alreadyAnswered ? quiz.options.findIndex((o) => o.correct) : null
  );
  const [revealed, setRevealed] = useState(alreadyAnswered);

  const isSentenceOrder = quiz.type === "sentence-order";

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    const correct = quiz.options[idx].correct;
    onAnswered(correct);
    if (quiz.options[idx].text && /[가-힣]/.test(quiz.options[idx].text)) {
      speak(quiz.options[idx].text);
    }
  };

  if (isSentenceOrder) {
    return (
      <SentenceOrderQuiz
        quiz={quiz}
        speak={speak}
        onAnswered={onAnswered}
        label={label}
        alreadyAnswered={alreadyAnswered}
      />
    );
  }

  const correctIdx = quiz.options.findIndex((o) => o.correct);

  return (
    <div className="space-y-5">
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
          {label}
        </p>
      )}

      <div className="space-y-2">
        {quiz.prompt && /[가-힣]/.test(quiz.prompt) ? (
          <button
            onClick={() => speak(quiz.prompt)}
            className="kr text-2xl font-black hover:text-accent transition-colors"
          >
            {quiz.prompt} <span className="text-faint text-sm">🔊</span>
          </button>
        ) : (
          <p className="text-lg font-bold">{quiz.prompt}</p>
        )}
        {quiz.promptTranslation && (
          <p className="text-sm text-muted">{quiz.promptTranslation}</p>
        )}
      </div>

      <div className="grid gap-2">
        {quiz.options.map((option, idx) => {
          let style = "bg-card border-border hover:border-accent";
          if (revealed) {
            if (idx === correctIdx) {
              style = "bg-sage-light border-sage text-sage";
            } else if (idx === selected && !option.correct) {
              style = "bg-coral-light border-coral text-coral line-through";
            } else {
              style = "opacity-40 border-border";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={revealed}
              className={`kr w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${style}`}
            >
              {option.text}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          className={`rounded-xl p-4 text-sm ${
            selected !== null && quiz.options[selected]?.correct
              ? "bg-sage-light border border-sage/30"
              : "bg-coral-light border border-coral/30"
          }`}
        >
          <p className="font-bold kr">
            {selected !== null && quiz.options[selected]?.correct
              ? <><KrTip en="Correct!">맞아요!</KrTip> 👏</>
              : <KrTip en="Wrong">틀렸어요</KrTip>}
          </p>
          {selected !== null &&
            !quiz.options[selected]?.correct &&
            quiz.wrongExplanation && (
              <p className="text-xs mt-1 opacity-80 kr">
                {quiz.wrongExplanation}
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function SentenceOrderQuiz({
  quiz,
  speak,
  onAnswered,
  label,
  alreadyAnswered,
}: {
  quiz: V5Quiz;
  speak: (t: string) => Promise<void>;
  onAnswered: (correct: boolean) => void;
  label?: string;
  alreadyAnswered?: boolean;
}) {
  const correctAnswer = quiz.options[0]?.text || "";
  const [orderedWords, setOrderedWords] = useState<string[]>(
    alreadyAnswered ? correctAnswer.split(" ") : []
  );
  const [revealed, setRevealed] = useState(!!alreadyAnswered);
  const [isCorrect, setIsCorrect] = useState(!!alreadyAnswered);

  let availableWords: string[] = [];
  try {
    availableWords = JSON.parse(quiz.prompt);
  } catch {
    availableWords = quiz.prompt.split(" ");
  }

  const handleAdd = (word: string) => {
    if (revealed) return;
    setOrderedWords((prev) => [...prev, word]);
  };

  const handleRemove = (index: number) => {
    if (revealed) return;
    setOrderedWords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCheck = () => {
    const answer = orderedWords.join(" ");
    const correct = answer === correctAnswer;
    setIsCorrect(correct);
    setRevealed(true);
    onAnswered(correct);
    if (correct) speak(correctAnswer);
  };

  return (
    <div className="space-y-5">
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
          {label}
        </p>
      )}
      <div>
        <p className="kr text-lg font-bold"><KrTip en="Put in order">순서대로 나열하세요</KrTip></p>
        {quiz.promptTranslation && (
          <p className="text-sm text-muted mt-1">{quiz.promptTranslation}</p>
        )}
      </div>

      <div className="min-h-[3rem] bg-card border-2 border-dashed border-border rounded-xl p-3 flex flex-wrap gap-2">
        {orderedWords.map((word, i) => (
          <button
            key={i}
            onClick={() => handleRemove(i)}
            className="kr bg-accent-light border border-accent rounded-lg px-3 py-1.5 text-sm hover:opacity-60 transition-opacity"
          >
            {word}
          </button>
        ))}
        {orderedWords.length === 0 && (
          <span className="text-faint text-sm"><KrTip en="Tap the words">단어를 탭하세요</KrTip></span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {availableWords.map((word, i) => {
          const used = orderedWords.filter((w) => w === word).length;
          const available =
            availableWords.filter((w) => w === word).length - used;
          return (
            <button
              key={i}
              onClick={() => handleAdd(word)}
              disabled={available <= 0 || revealed}
              className={`kr bg-card border border-border rounded-lg px-3 py-1.5 text-sm transition-all ${
                available <= 0
                  ? "opacity-30"
                  : "hover:border-accent active:scale-95"
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>

      {orderedWords.length === availableWords.length && !revealed && (
        <button
          onClick={handleCheck}
          className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          <KrTip en="Check">확인</KrTip>
        </button>
      )}

      {revealed && (
        <div
          className={`rounded-xl p-4 text-sm ${
            isCorrect
              ? "bg-sage-light border border-sage/30"
              : "bg-coral-light border border-coral/30"
          }`}
        >
          <p className="font-bold kr">{isCorrect ? "맞아요! 👏" : "틀렸어요"}</p>
          {!isCorrect && (
            <p className="text-xs mt-1 opacity-80 kr">
              <KrTip en="Correct answer">정답</KrTip>: {correctAnswer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Context Sentence
   ================================================================ */

function ContextSentenceScreen({
  sentence,
  speak,
}: {
  sentence: V5ContextSentence;
  speak: (t: string, s?: number) => Promise<void>;
}) {
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (!hasSpoken.current) {
      hasSpoken.current = true;
      const timer = setTimeout(() => speak(sentence.korean), 300);
      return () => clearTimeout(timer);
    }
  }, [sentence.korean, speak]);

  return (
    <div className="space-y-5">
      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
        <KrTip en="Sentence practice">문장 연습</KrTip>
      </p>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <button
          onClick={() => speak(sentence.korean)}
          className="kr text-xl font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
        >
          <HighlightedText
            text={sentence.korean}
            highlights={sentence.highlights}
          />{" "}
          <span className="text-faint text-sm">🔊</span>
        </button>
        <p className="text-sm text-muted italic">{sentence.english}</p>
      </div>

      {sentence.note && (
        <p className="text-xs text-muted kr text-center">{sentence.note}</p>
      )}
    </div>
  );
}

function PairContextScreen({
  sentences,
  note,
  speak,
}: {
  sentences: V5ContextSentence[];
  note?: string;
  speak: (t: string) => Promise<void>;
}) {
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (!hasSpoken.current && sentences.length > 0) {
      hasSpoken.current = true;
      const timer = setTimeout(() => {
        sentences.forEach((s, i) => {
          setTimeout(() => speak(s.korean), i * 1500);
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sentences, speak]);

  return (
    <div className="space-y-5">
      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
        <KrTip en="Compare">비교해 보세요</KrTip>
      </p>

      <div className="space-y-3">
        {sentences.map((s, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-4 space-y-1"
          >
            <button
              onClick={() => speak(s.korean)}
              className="kr text-lg font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
            >
              <HighlightedText
                text={s.korean}
                highlights={s.highlights}
              />{" "}
              <span className="text-faint text-xs">🔊</span>
            </button>
            <p className="text-sm text-muted italic">{s.english}</p>
          </div>
        ))}
      </div>

      {note && <p className="text-xs text-muted kr text-center">{note}</p>}
    </div>
  );
}

/* ================================================================
   Pattern Spotlight
   ================================================================ */

function PatternSpotlightScreen({
  spotlight,
  speak,
}: {
  spotlight: V5PatternSpotlight;
  speak: (t: string) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold text-center">
        <KrTip en="Find the pattern">패턴을 찾아봐요</KrTip>
      </p>

      <div className="bg-accent-light border border-accent/20 rounded-xl p-5 text-center space-y-2">
        <p className="kr text-3xl font-black text-accent">{spotlight.pattern}</p>
        <p className="text-sm text-muted">{spotlight.meaning}</p>
      </div>

      <p className="text-sm text-muted kr text-center">{spotlight.explanation}</p>

      {spotlight.songExample.korean && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            <KrTip en="In the song">노래에서</KrTip>
          </p>
          <button
            onClick={() => speak(spotlight.songExample.korean)}
            className="kr text-base font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
          >
            <HighlightedText
              text={spotlight.songExample.korean}
              highlights={spotlight.songExample.highlights}
            />{" "}
            <span className="text-faint text-xs">🔊</span>
          </button>
          {spotlight.songExample.english && (
            <p className="text-sm text-muted italic">
              {spotlight.songExample.english}
            </p>
          )}
        </div>
      )}

      {spotlight.examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-faint font-semibold">
            <KrTip en="More examples">더 많은 예문</KrTip>
          </p>
          {spotlight.examples.map((ex, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-3"
            >
              <button
                onClick={() => speak(ex.korean)}
                className="kr text-sm font-bold block w-full text-left hover:text-accent transition-colors"
              >
                {ex.korean} <span className="text-faint text-xs">🔊</span>
              </button>
              {ex.english && (
                <p className="text-xs text-muted italic mt-1">{ex.english}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Sing Along
   ================================================================ */

function SingAlongScreen({
  lines,
  speak,
}: {
  lines: V5SongLine[];
  speak: (t: string) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎤</span>
        <div>
          <p className="kr font-bold"><KrTip en="Sing along!">따라 불러 봐요!</KrTip></p>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            <KrTip en="Song">노래</KrTip>
          </p>
        </div>
      </div>
      <div className="bg-card border border-accent/20 rounded-xl p-5 space-y-3">
        {lines.map((line, i) => (
          <button
            key={i}
            onClick={() => speak(line.korean)}
            className="kr text-lg font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors"
          >
            <HighlightedText
              text={line.korean}
              highlights={line.highlights}
            />{" "}
            <span className="text-faint text-xs">🔊</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-faint text-center kr">
        배운 단어는 하이라이트 되어 있어요
      </p>
    </div>
  );
}

/* ================================================================
   Recap
   ================================================================ */

function RecapScreen({
  screen,
  correctCount,
  totalQuizzes,
}: {
  screen: {
    items: V5TeachingItem[];
    pattern?: { pattern: string; meaning: string };
    xpReward: number;
    passThreshold: number;
    totalQuizScreens: number;
  };
  correctCount: number;
  totalQuizzes: number;
}) {
  const router = useRouter();
  const passed = totalQuizzes > 0 && correctCount / totalQuizzes >= screen.passThreshold;
  const percentage = totalQuizzes > 0 ? Math.round((correctCount / totalQuizzes) * 100) : 0;

  return (
    <div className="space-y-6">
      <Confetti active={passed} duration={3000} />

      <div className="text-center space-y-2">
        <p className="text-5xl">{passed ? "🎉" : "📚"}</p>
        <p className="kr text-2xl font-black">
          {passed ? <KrTip en="Great work!">수고했어요!</KrTip> : <KrTip en="Try again!">다시 도전해 보세요!</KrTip>}
        </p>
      </div>

      {/* Score */}
      <div className={`rounded-xl p-5 text-center ${passed ? "bg-sage-light border border-sage/30" : "bg-coral-light border border-coral/30"}`}>
        <p className={`text-3xl font-black ${passed ? "text-sage" : "text-coral"}`}>
          {correctCount}/{totalQuizzes}
        </p>
        <p className={`text-sm font-semibold ${passed ? "text-sage" : "text-coral"}`}>
          {percentage}% — {passed ? <KrTip en="Passed!">통과!</KrTip> : <KrTip en="Need 80%">80% 필요</KrTip>}
        </p>
      </div>

      {/* XP */}
      {passed && (
        <div className="bg-accent-light rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-accent">+{screen.xpReward} XP</p>
        </div>
      )}

      {/* Words learned */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider">
          <KrTip en="Words and expressions learned">배운 단어와 표현</KrTip>
        </p>
        <div className="grid gap-2">
          {screen.items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
            >
              <span className="text-[10px] uppercase tracking-wider text-faint w-8">
                {item.kind === "phrase" ? <KrTip en="Expression">표현</KrTip> : <KrTip en="Word">단어</KrTip>}
              </span>
              <span className="kr font-bold">{item.korean}</span>
              <span className="text-sm text-muted">— {item.english}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pattern */}
      {screen.pattern && (
        <div className="bg-accent-light border border-accent/20 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">
            <KrTip en="Pattern learned">배운 패턴</KrTip>
          </p>
          <p className="kr text-lg font-bold">{screen.pattern.pattern}</p>
          <p className="text-sm text-muted">{screen.pattern.meaning}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {!passed && (
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors active:scale-[0.98]"
          >
            <KrTip en="Try again">다시 하기</KrTip>
          </button>
        )}
        <button
          onClick={() => router.push("/")}
          className={`w-full py-4 rounded-xl font-semibold transition-colors active:scale-[0.98] ${
            passed
              ? "bg-accent text-white hover:bg-accent-hover"
              : "border border-border text-muted hover:bg-card"
          }`}
        >
          {passed ? <KrTip en="Back to home">홈으로 돌아가기</KrTip> : <KrTip en="Try again later">나중에 다시 하기</KrTip>}
        </button>
      </div>
    </div>
  );
}
