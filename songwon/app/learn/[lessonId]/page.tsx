"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { loadState, addXP, updateStreak, markLessonComplete } from "@/lib/storage";
import { loadLessonById, getSongNameForLesson } from "@/lib/seed-loader";
import { useTTS } from "@/hooks/useTTS";
import Confetti from "@/components/gamification/Confetti";
import LevelUpModal from "@/components/gamification/LevelUpModal";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import type { Lesson, LessonSection, Exercise, WordTeachingData } from "@/lib/types";
import { KrTip } from "@/components/ui/KrTip";

const LEVEL_THRESHOLDS = [
  { label: "초급 1", min: 0 },
  { label: "초급 2", min: 100 },
  { label: "초급 3", min: 300 },
  { label: "중급 1", min: 600 },
  { label: "중급 2", min: 1200 },
  { label: "중급 3", min: 2000 },
  { label: "고급 1", min: 3500 },
  { label: "고급 2", min: 5000 },
];

export default function LearnPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [songName, setSongName] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [earnedXP, setEarnedXP] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [completedScreens, setCompletedScreens] = useState<Set<number>>(new Set());
  const { speak, retry, usedFallback } = useTTS();

  useEffect(() => {
    const state = loadState();
    const found = state.lessons.find((l) => l.id === lessonId);
    if (found) {
      setLesson(found);
    } else {
      loadLessonById(lessonId).then((seed) => {
        if (seed) setLesson(seed);
      });
    }
    getSongNameForLesson(lessonId).then((name) => {
      if (name) setSongName(name);
    });
  }, [lessonId]);

  const markScreenCompleted = useCallback((index: number) => {
    setCompletedScreens((prev) => new Set(prev).add(index));
  }, []);

  const handleNext = useCallback(() => {
    if (!lesson) return;
    markScreenCompleted(currentIndex);
    if (currentIndex < lesson.sections.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      const prevXP = loadState().progress.xp;
      addXP(lesson.xpReward);
      updateStreak();
      markLessonComplete(lessonId);

      const newXP = prevXP + lesson.xpReward;
      const prevLevel = [...LEVEL_THRESHOLDS].reverse().find((l) => prevXP >= l.min);
      const newLevel = [...LEVEL_THRESHOLDS].reverse().find((l) => newXP >= l.min);
      if (newLevel && prevLevel && newLevel.label !== prevLevel.label) {
        setLevelUp(newLevel.label);
      }
      setShowComplete(true);
    }
  }, [lesson, currentIndex, lessonId]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  if (!lesson) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-2xl">📖</div>
      </div>
    );
  }

  if (showComplete) {
    return (
      <>
        <LessonComplete lesson={lesson} onHome={() => router.push("/")} />
        {levelUp && <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />}
      </>
    );
  }

  const section = lesson.sections[currentIndex];
  const progress = ((currentIndex + 1) / lesson.sections.length) * 100;

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-muted hover:text-foreground text-sm">
            ← <span className="sr-only">Back</span>
          </button>
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-mono text-faint">
            <KrTip en={`Screen ${currentIndex + 1}`}>화면</KrTip> {currentIndex + 1}/{lesson.sections.length}
          </span>
        </div>
      </div>

      {/* TTS fallback retry */}
      {usedFallback && (
        <div className="px-4 py-1 border-b border-border">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-[10px] text-faint">
              Voice quality was low
            </p>
            <button
              onClick={retry}
              className="text-[10px] text-muted hover:text-accent transition-colors"
            >
              Retry ↻
            </button>
          </div>
        </div>
      )}

      {/* Audio player for music-playing sections */}
      {songName && section.musicPlaying && (
        <div className="px-4 py-2 border-b border-border">
          <div className="max-w-lg mx-auto">
            <AudioPlayer songName={songName} autoPlay />
          </div>
        </div>
      )}

      {/* Section content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto page-enter">
          <SectionRenderer
            key={section.id}
            section={section}
            isCompleted={completedScreens.has(currentIndex)}
            onExerciseCorrect={() => {
              setEarnedXP((x) => x + 5);
              markScreenCompleted(currentIndex);
            }}
            speak={speak}
          />
        </div>
      </main>

      {/* Navigation */}
      <div className="px-4 py-4 border-t border-border bg-card">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentIndex > 0 && (
            <button onClick={handlePrev} className="px-6 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-background transition-colors">
              ←
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors active:scale-[0.98]"
          >
            {currentIndex < lesson.sections.length - 1
              ? <><KrTip en="Next">다음</KrTip> Continue</>
              : <><KrTip en="Complete">완료</KrTip> Finish</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Section Renderer — dispatches to the right component per type
   ================================================================ */

function SectionRenderer({ section, isCompleted, onExerciseCorrect, speak }: {
  section: LessonSection;
  isCompleted: boolean;
  onExerciseCorrect: () => void;
  speak: (text: string, speed?: number) => Promise<void>;
}) {
  switch (section.type) {
    case "lesson-intro":
      return <LessonIntroSection section={section} />;
    case "lyrics-korean":
      return <LyricsKoreanSection section={section} speak={speak} />;
    case "lyrics-translation":
      return <LyricsTranslationSection section={section} speak={speak} />;
    case "word-intro":
      return <WordIntroSection section={section} speak={speak} />;
    case "word-meaning":
      return <WordMeaningSection section={section} speak={speak} />;
    case "word-context":
      return <WordContextSection section={section} speak={speak} />;
    case "line-recall":
      return <ExerciseSection section={section} isCompleted={isCompleted} onCorrect={onExerciseCorrect} speak={speak} title="가사 기억하기" titleEn="Recall the lyrics" icon="🧠" />;
    case "pattern-spotlight":
      return <PatternSpotlightSection section={section} speak={speak} />;
    case "practice":
      return <ExerciseSection section={section} isCompleted={isCompleted} onCorrect={onExerciseCorrect} speak={speak} title="연습해 봐요!" titleEn="Let's practice!" icon="✏️" />;
    case "sing-along":
      return <SingAlongSection section={section} speak={speak} />;
    case "recap":
      return <RecapSection section={section} speak={speak} />;
    default:
      return <FallbackSection section={section} isCompleted={isCompleted} onExerciseCorrect={onExerciseCorrect} speak={speak} />;
  }
}

/* ================================================================
   Shared components
   ================================================================ */

const titleTranslations: Record<string, string> = {
  "가사를 읽어 보세요": "Read the lyrics",
  "무슨 뜻일까요?": "What does it mean?",
  "가사 기억하기": "Recall the lyrics",
  "패턴을 찾아봐요": "Find the pattern",
  "연습해 봐요!": "Let's practice!",
  "따라 불러 봐요!": "Sing along!",
  "오늘 배운 것": "What you learned today",
  "이번에 배울 것": "What you'll learn",
  "새 단어": "New word",
  "새 표현": "New expression",
  "문장 연습": "Sentence practice",
  "복습": "Review",
  "가사 퀴즈": "Lyrics quiz",
  "종합 퀴즈": "Mixed quiz",
  "노래": "Song",
  "결과": "Results",
};

function SectionHeader({ icon, title, titleEn, subtitle }: { icon: string; title: string; titleEn?: string; subtitle?: string }) {
  const en = titleEn || titleTranslations[title];
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="kr font-bold">{en ? <KrTip en={en}>{title}</KrTip> : title}</p>
        {subtitle && <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">{subtitle}</p>}
      </div>
    </div>
  );
}

function TappableLine({ line, speak }: { line: string; speak: (t: string) => void }) {
  return (
    <button onClick={() => speak(line)} className="kr text-lg font-bold leading-relaxed block w-full text-left hover:text-accent transition-colors">
      {line} <span className="text-faint text-xs">🔊</span>
    </button>
  );
}

/* ================================================================
   Phase 1: Intro + Immersion
   ================================================================ */

function LessonIntroSection({ section }: { section: LessonSection }) {
  const isAboutSong = section.title === "About this song" || section.id?.includes("intro2");
  const content = section.content || "";

  if (isAboutSong) {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <p className="text-3xl">🎶</p>
          <h1 className="text-lg font-black"><KrTip en="About this song">이 노래에 대해</KrTip></h1>
        </div>
        <div className="text-sm text-muted leading-relaxed space-y-2">
          {content.split("\n").map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
    );
  }

  // Main intro: reorder to grammar first, song second
  const lines = content.split("\n").filter((l) => l.trim());
  const grammarLines = lines.filter((l) => /grammar|pattern|learn|배울/i.test(l));
  const songLines = lines.filter((l) => !/grammar|pattern|learn|배울/i.test(l));
  const reordered = [...grammarLines, ...songLines];

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-3xl">🎵</p>
        <h1 className="text-xl font-black">{section.title}</h1>
      </div>
      {reordered.length > 0 && (
        <div className="text-sm text-muted leading-relaxed space-y-2">
          {reordered.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
    </div>
  );
}

function LyricsKoreanSection({ section, speak }: { section: LessonSection; speak: (t: string) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <SectionHeader icon="👀" title={section.title} titleEn="Read the lyrics" subtitle="LISTEN & READ" />
      {section.lyricLines && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          {section.lyricLines.map((line, i) => (
            <TappableLine key={i} line={line} speak={(t) => speak(t)} />
          ))}
        </div>
      )}
      <p className="text-xs text-faint text-center"><KrTip en="Read along while the song plays">노래를 들으면서 읽어 보세요</KrTip></p>
    </div>
  );
}

function LyricsTranslationSection({ section, speak }: { section: LessonSection; speak: (t: string) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <SectionHeader icon="📖" title={section.title} titleEn="What does it mean?" subtitle="TRANSLATION" />
      {section.lyricLines && section.lyricTranslations && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {section.lyricLines.map((line, i) => (
            <div key={i} className="space-y-1">
              <TappableLine line={line} speak={(t) => speak(t)} />
              <p className="text-sm text-muted italic pl-1">
                {section.lyricTranslations?.[i] || ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Phase 2: Vocab Teaching (one word at a time)
   ================================================================ */

function WordIntroSection({ section, speak }: { section: LessonSection; speak: (t: string, s?: number) => Promise<void> }) {
  const wd = section.wordData;
  const hasSpoken = useRef(false);

  useEffect(() => {
    if (section.autoSpeak && !hasSpoken.current) {
      hasSpoken.current = true;
      const timer = setTimeout(() => speak(section.autoSpeak!, 0.75), 300);
      return () => clearTimeout(timer);
    }
  }, [section.autoSpeak, speak]);

  if (!wd) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] space-y-6">
      <div className="text-center space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-accent font-semibold"><KrTip en="New word">새 단어</KrTip></p>
      </div>
      <button
        onClick={() => speak(wd.word.korean, 0.75)}
        className="group text-center space-y-2"
      >
        <p className="kr text-5xl font-black group-hover:text-accent transition-colors">
          {wd.word.korean}
        </p>
        <p className="text-lg text-muted">{wd.word.english}</p>
        {wd.word.pos && <p className="text-xs text-faint">{wd.word.pos}</p>}
        <p className="text-accent text-sm">🔊 tap to hear</p>
      </button>

      {wd.exampleSentence && (
        <div className="w-full bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-faint font-semibold"><KrTip en="Example">예문</KrTip></p>
          <TappableLine line={wd.exampleSentence.korean} speak={(t) => speak(t)} />
          {wd.exampleSentence.english && (
            <p className="text-sm text-muted italic">{wd.exampleSentence.english}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WordMeaningSection({ section, speak }: { section: LessonSection; speak: (t: string, s?: number) => Promise<void> }) {
  const wd = section.wordData;
  if (!wd) return null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <button onClick={() => speak(wd.word.korean, 0.75)} className="group">
          <p className="kr text-4xl font-black group-hover:text-accent transition-colors">
            {wd.word.korean} <span className="text-faint text-sm">🔊</span>
          </p>
        </button>
        <p className="text-lg text-muted">{wd.word.english}</p>
        {wd.word.pos && <p className="text-xs text-faint">{wd.word.pos}</p>}
      </div>

      {wd.exampleSentence && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold"><KrTip en="Example">예문</KrTip></p>
          <TappableLine line={wd.exampleSentence.korean} speak={(t) => speak(t)} />
          {wd.exampleSentence.english && (
            <p className="text-sm text-muted italic">{wd.exampleSentence.english}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WordContextSection({ section, speak }: { section: LessonSection; speak: (t: string, s?: number) => Promise<void> }) {
  const wd = section.wordData;
  if (!wd) return null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <button onClick={() => speak(wd.word.korean, 0.75)} className="group">
          <p className="kr text-3xl font-black group-hover:text-accent transition-colors">
            {wd.word.korean} <span className="text-faint text-sm">🔊</span>
          </p>
        </button>
        <p className="text-sm text-muted">{wd.word.english}</p>
      </div>

      {wd.songLine && (
        <div className="bg-accent-light border border-accent/20 rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold"><KrTip en="In the song">노래에서</KrTip></p>
          <TappableLine line={wd.songLine} speak={(t) => speak(t)} />
        </div>
      )}

      {wd.dailySentence && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-faint font-semibold"><KrTip en="Daily usage">일상 표현</KrTip></p>
          <TappableLine line={wd.dailySentence.korean} speak={(t) => speak(t)} />
          {wd.dailySentence.english && (
            <p className="text-sm text-muted italic">{wd.dailySentence.english}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Phase 3-4: Quiz, Pattern, Practice
   ================================================================ */

function ExerciseSection({ section, isCompleted, onCorrect, speak, title, titleEn, icon }: {
  section: LessonSection; isCompleted: boolean; onCorrect: () => void;
  speak: (t: string, s?: number) => Promise<void>;
  title: string; titleEn: string; icon: string;
}) {
  if (isCompleted) {
    return (
      <div className="space-y-5">
        <SectionHeader icon={icon} title={title} titleEn={titleEn} />
        <div className="bg-sage-light border border-sage/30 rounded-xl p-4 text-center">
          <p className="text-sage font-semibold text-sm"><KrTip en="Already completed!">이미 완료했어요!</KrTip> ✓</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={icon} title={title} titleEn={titleEn} />
      {section.exercises && section.exercises.length > 0 && (
        <div className="space-y-4">
          {section.exercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} onCorrect={onCorrect} speak={speak} />
          ))}
        </div>
      )}
    </div>
  );
}

function PatternSpotlightSection({ section, speak }: { section: LessonSection; speak: (t: string, s?: number) => Promise<void> }) {
  const pd = section.patternData;
  if (!pd) return null;

  return (
    <div className="space-y-5">
      <SectionHeader icon="📐" title={section.title} titleEn="Find the pattern" subtitle="GRAMMAR" />
      <div className="bg-accent-light border border-accent/20 rounded-xl p-5 text-center">
        <p className="kr text-2xl font-black text-accent">{pd.pattern}</p>
        <p className="text-sm text-muted mt-1">{pd.meaning}</p>
      </div>
      {pd.songExample.korean && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold"><KrTip en="From the song">노래에서</KrTip></p>
          <TappableLine line={pd.songExample.korean} speak={(t) => speak(t)} />
          {pd.songExample.english && <p className="text-sm text-muted italic">{pd.songExample.english}</p>}
        </div>
      )}
      {pd.otherExamples.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-faint font-semibold"><KrTip en="More examples">더 많은 예문</KrTip></p>
          {pd.otherExamples.map((ex, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3">
              <TappableLine line={ex.korean} speak={(t) => speak(t)} />
              {ex.english && <p className="text-sm text-muted italic">{ex.english}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Phase 5: Payoff
   ================================================================ */

function SingAlongSection({ section, speak }: { section: LessonSection; speak: (t: string, s?: number) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <SectionHeader icon="🎤" title={section.title} titleEn="Sing along!" subtitle="SING ALONG" />
      {section.lyricLines && (
        <div className="bg-card border border-accent/20 rounded-xl p-5 space-y-3">
          {section.lyricLines.map((line, i) => (
            <TappableLine key={i} line={line} speak={(t) => speak(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecapSection({ section, speak }: { section: LessonSection; speak: (t: string, s?: number) => Promise<void> }) {
  const rd = section.recapData;
  return (
    <div className="space-y-5">
      <SectionHeader icon="🏆" title={section.title} titleEn="What you learned today" subtitle="RECAP" />
      {rd?.wordsLearned && rd.wordsLearned.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-accent uppercase tracking-wider"><KrTip en="Words learned">배운 단어</KrTip></p>
          <div className="grid gap-2">
            {rd.wordsLearned.map((w, i) => (
              <button key={i} onClick={() => speak(w.korean, 0.8)}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 text-left hover:border-accent/40 transition-colors">
                <span className="text-accent">🔊</span>
                <span className="kr font-bold">{w.korean}</span>
                <span className="text-sm text-muted">— {w.english}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {rd?.patternLearned && (
        <div className="bg-accent-light border border-accent/20 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1"><KrTip en="Pattern learned">배운 패턴</KrTip></p>
          <p className="kr text-lg font-bold">{rd.patternLearned}</p>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Fallback for legacy section types
   ================================================================ */

function FallbackSection({ section, isCompleted, onExerciseCorrect, speak }: {
  section: LessonSection; isCompleted: boolean; onExerciseCorrect: () => void;
  speak: (t: string, s?: number) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader icon="📖" title={section.title} />
      {section.content && (
        <div className="kr leading-relaxed text-sm space-y-2">
          {section.content.split("\n").map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
      {section.lyricLines && section.lyricLines.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          {section.lyricLines.map((line, i) => (
            <TappableLine key={i} line={line} speak={(t) => speak(t)} />
          ))}
        </div>
      )}
      {section.exercises && section.exercises.length > 0 && !isCompleted && (
        <div className="space-y-4">
          {section.exercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} onCorrect={onExerciseCorrect} speak={speak} />
          ))}
        </div>
      )}
      {section.exercises && section.exercises.length > 0 && isCompleted && (
        <div className="bg-sage-light border border-sage/30 rounded-xl p-4 text-center">
          <p className="text-sage font-semibold text-sm"><KrTip en="Already completed!">이미 완료했어요!</KrTip> ✓</p>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Exercise Card (shared across quiz types)
   ================================================================ */

function ExerciseCard({ exercise, onCorrect, speak }: {
  exercise: Exercise; onCorrect: () => void;
  speak: (text: string, speed?: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [orderedWords, setOrderedWords] = useState<string[]>([]);

  const handleSelect = (option: string) => {
    if (isCorrect !== null) return;
    setSelected(option);
    const correct = Array.isArray(exercise.correctAnswer)
      ? exercise.correctAnswer.includes(option)
      : option === exercise.correctAnswer;
    setIsCorrect(correct);
    if (correct) onCorrect();
    speak(option);
  };

  const handleOrderWord = (word: string) => {
    if (isCorrect !== null) return;
    setOrderedWords((prev) => [...prev, word]);
  };

  const handleRemoveOrdered = (index: number) => {
    if (isCorrect !== null) return;
    setOrderedWords((prev) => prev.filter((_, i) => i !== index));
  };

  const checkOrder = () => {
    const answer = orderedWords.join(" ");
    const correct = Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer.join(" ") : exercise.correctAnswer;
    const result = answer === correct;
    setIsCorrect(result);
    if (result) onCorrect();
  };

  if (exercise.type === "order-words") {
    const allWords = exercise.options || [];
    return (
      <div className="bg-coral-light border border-coral/30 rounded-xl p-4 space-y-3">
        <p className="kr font-semibold text-sm">{exercise.prompt}</p>
        <div className="min-h-[2.5rem] bg-background border-2 border-dashed border-border rounded-lg p-2 flex flex-wrap gap-2">
          {orderedWords.map((word, i) => (
            <button key={i} onClick={() => handleRemoveOrdered(i)}
              className="kr bg-accent-light border border-accent rounded-lg px-3 py-1.5 text-sm hover:opacity-60 transition-opacity">
              {word}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {allWords.map((word, i) => (
            <button key={i} onClick={() => handleOrderWord(word)} disabled={orderedWords.includes(word)}
              className={`kr bg-card border border-border rounded-lg px-3 py-1.5 text-sm transition-all ${orderedWords.includes(word) ? "opacity-30" : "hover:border-accent"}`}>
              {word}
            </button>
          ))}
        </div>
        {orderedWords.length === allWords.length && isCorrect === null && (
          <button onClick={checkOrder} className="w-full py-2.5 rounded-lg bg-coral text-white text-sm font-semibold">
            <KrTip en="Check">확인</KrTip> Check
          </button>
        )}
        {isCorrect !== null && <FeedbackBanner correct={isCorrect} hint={exercise.hint} />}
      </div>
    );
  }

  return (
    <div className={`bg-coral-light border border-coral/30 rounded-xl p-4 space-y-3 ${isCorrect === true ? "correct-pulse" : isCorrect === false ? "shake" : ""}`}>
      <div className="flex items-start gap-2">
        <p className="kr font-semibold text-sm flex-1">{exercise.prompt}</p>
        {/[가-힯]/.test(exercise.prompt) && (
          <button onClick={() => speak(exercise.prompt, 0.8)} className="text-accent text-sm flex-shrink-0 hover:opacity-70">🔊</button>
        )}
      </div>
      <div className="grid gap-2">
        {exercise.options?.map((option) => (
          <button key={option} onClick={() => handleSelect(option)} disabled={isCorrect !== null}
            className={`kr w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
              selected === option && isCorrect ? "bg-sage-light border-sage text-sage"
              : selected === option && !isCorrect ? "bg-coral-light border-coral text-coral line-through opacity-60"
              : isCorrect !== null ? "opacity-40 border-border"
              : "bg-card border-border hover:border-accent active:scale-[0.98]"
            }`}>
            {option}
          </button>
        ))}
      </div>
      {isCorrect !== null && <FeedbackBanner correct={isCorrect} hint={exercise.hint} />}
    </div>
  );
}

function FeedbackBanner({ correct, hint }: { correct: boolean; hint?: string }) {
  return (
    <div className={`rounded-lg p-3 text-sm ${correct ? "bg-sage-light border border-sage/30 text-sage" : "bg-coral-light border border-coral/30 text-coral"}`}>
      <p className="kr font-bold">
        {correct ? <KrTip en="Correct! Great job!">맞아요! 잘했어요! 👏</KrTip> : <KrTip en="Try again!">다시 해 보세요!</KrTip>}
      </p>
      {!correct && hint && <p className="text-xs mt-1 opacity-80 kr">{hint}</p>}
    </div>
  );
}

function LessonComplete({ lesson, onHome }: { lesson: Lesson; onHome: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <Confetti active={true} duration={3000} />
      <div className="max-w-sm w-full text-center space-y-6 page-enter">
        <div className="text-7xl">🎉</div>
        <div className="space-y-2">
          <p className="kr text-2xl font-black"><KrTip en="Great work!">수고했어요!</KrTip></p>
          <p className="text-muted text-sm">Lesson complete!</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-accent-light rounded-xl p-4">
            <p className="text-2xl font-bold text-accent">+{lesson.xpReward}</p>
            <p className="text-[10px] text-accent font-semibold">XP</p>
          </div>
          <div className="bg-amber-light rounded-xl p-4">
            <p className="text-2xl font-bold text-amber">{lesson.sections.length}</p>
            <p className="text-[10px] text-amber font-semibold kr"><KrTip en="Sections done">섹션 완료</KrTip></p>
          </div>
        </div>
        <button onClick={onHome}
          className="w-full py-4 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors active:scale-[0.98]">
          <KrTip en="Back to home">홈으로 돌아가기</KrTip>
        </button>
      </div>
    </div>
  );
}
