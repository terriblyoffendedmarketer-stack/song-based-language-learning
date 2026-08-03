"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { loadState, updateSong, addLesson, addVocabulary } from "@/lib/storage";
import { createInitialSRS } from "@/lib/srs";
import { formatDuration } from "@/lib/metadata";
import { useLessonStream } from "@/hooks/useLessonStream";
import type { Song, LessonAnalysis, Lesson, VocabularyItem, UserLevel } from "@/lib/types";
import { KrTip } from "@/components/ui/KrTip";

export default function SongDetailPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = use(params);
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [level, setLevel] = useState<UserLevel>("beginner");
  const [analysis, setAnalysis] = useState<LessonAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const lessonStream = useLessonStream();
  const [step, setStep] = useState<"lyrics" | "analyzing" | "review" | "generating" | "done">("lyrics");

  useEffect(() => {
    const state = loadState();
    const found = state.songs.find((s) => s.id === songId);
    if (found) {
      setSong(found);
      if (found.lyrics) setLyrics(found.lyrics);
    }
  }, [songId]);

  const handleSaveLyrics = () => {
    if (!lyrics.trim()) return;
    updateSong(songId, { lyrics, lyricsSource: "manual" });
    setSong((s) => (s ? { ...s, lyrics, lyricsSource: "manual" as const } : s));
  };

  const handleAnalyze = async () => {
    if (!song || !lyrics.trim()) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setStep("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: song.title,
          artist: song.artist,
          lyrics,
          level,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      data.songId = songId;
      setAnalysis(data);
      setStep("review");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
      setStep("lyrics");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!song || !analysis) return;
    setStep("generating");

    await lessonStream.generate({
      title: song.title,
      artist: song.artist,
      analysis,
      level,
      sectionIndex: 0,
    });

    if (lessonStream.sections.length > 0) {
      const lesson: Lesson = {
        id: crypto.randomUUID(),
        songId,
        level,
        title: `${song.title} — ${analysis.sections[0]?.label || "수업"}`,
        sections: lessonStream.sections,
        xpReward: lessonStream.xpReward || 25,
        generatedAt: new Date().toISOString(),
      };
      addLesson(lesson);

      const vocabItems: VocabularyItem[] = analysis.vocabulary.map((v) => ({
        ...v,
        id: v.id || crypto.randomUUID(),
        fromSongId: songId,
        fromLine: v.fromLine || "",
        srs: createInitialSRS(),
      }));
      addVocabulary(vocabItems);

      setStep("done");
    }
  };

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-2xl">🎵</p>
          <p className="kr text-muted"><KrTip en="Looking for the song...">노래를 찾고 있어요...</KrTip></p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← <KrTip en="Home">홈</KrTip>
          </button>
          <h1 className="kr font-bold truncate max-w-[200px]">{song.title}</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Song info */}
          <div className="text-center space-y-1">
            <div className="text-4xl mb-2">🎵</div>
            <h2 className="kr text-xl font-bold">{song.title}</h2>
            <p className="text-sm text-muted">{song.artist}</p>
            <p className="text-xs text-faint font-mono">
              {formatDuration(song.duration)}
            </p>
          </div>

          {/* Level selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-faint font-semibold mb-2">
              <KrTip en="Level">수준</KrTip> Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    level === l
                      ? "bg-accent text-white"
                      : "bg-card border border-border hover:border-accent/40"
                  }`}
                >
                  <KrTip en={l === "beginner" ? "Beginner" : l === "intermediate" ? "Intermediate" : "Advanced"}>
                    {l === "beginner" ? "초급" : l === "intermediate" ? "중급" : "고급"}
                  </KrTip>
                </button>
              ))}
            </div>
          </div>

          {/* Step: Lyrics input */}
          {step === "lyrics" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-faint font-semibold mb-2">
                  <KrTip en="Lyrics">가사</KrTip> Lyrics
                </label>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="여기에 한국어 가사를 붙여넣으세요&#10;Paste Korean lyrics here..."
                  rows={12}
                  className="w-full kr bg-card border border-border rounded-xl px-4 py-3
                    text-sm leading-relaxed resize-none
                    focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {lyrics.trim() && (
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveLyrics}
                    className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold
                      hover:bg-card transition-colors"
                  >
                    <KrTip en="Save">저장</KrTip> Save
                  </button>
                  <button
                    onClick={handleAnalyze}
                    className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-semibold
                      hover:bg-accent-hover transition-colors"
                  >
                    <KrTip en="Analyze">분석하기</KrTip> Analyze
                  </button>
                </div>
              )}

              {analyzeError && (
                <div className="bg-coral-light border border-coral/30 rounded-xl p-3 text-sm text-coral">
                  {analyzeError}
                </div>
              )}
            </div>
          )}

          {/* Step: Analyzing */}
          {step === "analyzing" && (
            <div className="text-center py-12 space-y-4">
              <div className="text-5xl animate-pulse">🔍</div>
              <p className="kr text-lg font-bold"><KrTip en="Analyzing lyrics...">가사를 분석하고 있어요...</KrTip></p>
              <p className="text-sm text-muted">
                Finding vocabulary, grammar patterns, and cultural context
              </p>
              <div className="mx-auto h-1.5 w-48 rounded-full bg-border overflow-hidden">
                <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          {/* Step: Review analysis */}
          {step === "review" && analysis && (
            <div className="space-y-4">
              <div className="bg-sage-light border border-sage/30 rounded-xl p-4">
                <p className="kr font-bold text-sm mb-2"><KrTip en="Analysis complete!">분석 완료!</KrTip></p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold">{analysis.vocabulary.length}</p>
                    <p className="text-[10px] text-muted kr"><KrTip en="Words">단어</KrTip></p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {analysis.grammarPatterns.length}
                    </p>
                    <p className="text-[10px] text-muted kr"><KrTip en="Grammar">문법</KrTip></p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{analysis.sections.length}</p>
                    <p className="text-[10px] text-muted kr"><KrTip en="Sections">섹션</KrTip></p>
                  </div>
                </div>
              </div>

              {/* Preview some vocabulary */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint font-semibold mb-2">
                  <KrTip en="Key words">주요 단어</KrTip> Key Vocabulary
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.vocabulary.slice(0, 10).map((v, i) => (
                    <span
                      key={i}
                      className="kr bg-card border border-border rounded-lg px-3 py-1.5 text-sm"
                    >
                      {v.korean}{" "}
                      <span className="text-faint text-xs">({v.english})</span>
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateLesson}
                className="w-full py-4 rounded-xl bg-accent text-white text-sm font-semibold
                  hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                <KrTip en="Create lesson">수업 만들기</KrTip> Generate Lesson
              </button>
            </div>
          )}

          {/* Step: Generating lesson */}
          {step === "generating" && (
            <div className="space-y-4">
              <div className="text-center py-8 space-y-3">
                <div className="text-5xl animate-pulse">📝</div>
                <p className="kr text-lg font-bold"><KrTip en="Creating your lesson...">수업을 만들고 있어요...</KrTip></p>
                <p className="text-sm text-muted">Creating your immersive lesson</p>
              </div>

              {lessonStream.rawText && (
                <div className="bg-card border border-border rounded-xl p-4 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-muted whitespace-pre-wrap font-mono">
                    {lessonStream.rawText.slice(-500)}
                  </pre>
                </div>
              )}

              {lessonStream.error && (
                <div className="bg-coral-light border border-coral/30 rounded-xl p-3 text-sm text-coral">
                  {lessonStream.error}
                </div>
              )}
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-8 space-y-4">
              <div className="text-6xl">🎉</div>
              <p className="kr text-xl font-bold"><KrTip en="Your lesson is ready!">수업이 준비됐어요!</KrTip></p>
              <p className="text-sm text-muted">
                Your lesson is ready — {lessonStream.sections.length} sections,{" "}
                {lessonStream.xpReward} XP
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/")}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold
                    hover:bg-card transition-colors"
                >
                  <KrTip en="Home">홈으로</KrTip>
                </button>
                <button
                  onClick={() => {
                    const state = loadState();
                    const lesson = state.lessons.find(
                      (l) => l.songId === songId
                    );
                    if (lesson) router.push(`/learn/${lesson.id}`);
                  }}
                  className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-semibold
                    hover:bg-accent-hover transition-colors"
                >
                  <KrTip en="Study">공부하기</KrTip> Start
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
