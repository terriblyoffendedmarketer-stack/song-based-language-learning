"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { loadSongIndex, type SongIndexEntry } from "@/lib/seed-loader";
import { useTTS } from "@/hooks/useTTS";
import { KrTip } from "@/components/ui/KrTip";

interface PracticeLine {
  korean: string;
  index: number;
}

interface PracticeData {
  songId: string;
  lines: {
    korean: string;
    english: string;
    words: { korean: string; english: string; role: string }[];
  }[];
}

type PracticeState = "line" | "breakdown" | "translation";

const SONG_PROGRESS_KEY = "songwon-song-progress";

function loadSongProgress(songId: string): { completedLines: number[] } {
  if (typeof window === "undefined") return { completedLines: [] };
  try {
    const raw = localStorage.getItem(SONG_PROGRESS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      return all[songId] || { completedLines: [] };
    }
  } catch {}
  return { completedLines: [] };
}

function saveSongProgress(songId: string, completedLines: number[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SONG_PROGRESS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[songId] = { completedLines };
    localStorage.setItem(SONG_PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}

export default function SongPracticePage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = use(params);
  const router = useRouter();
  const { speak } = useTTS();

  const [song, setSong] = useState<SongIndexEntry | null>(null);
  const [practiceData, setPracticeData] = useState<PracticeData | null>(null);
  const [lines, setLines] = useState<PracticeLine[]>([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [state, setState] = useState<PracticeState>("line");
  const [completedLines, setCompletedLines] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    async function init() {
      const idx = await loadSongIndex();
      const found = idx.songs.find((s) => s.id === songId);
      if (!found) {
        setLoading(false);
        return;
      }
      setSong(found);

      // Try loading rich practice data
      try {
        const res = await fetch(`/data/song_practice/${songId}.json`);
        if (res.ok) {
          const data: PracticeData = await res.json();
          setPracticeData(data);
          setLines(
            data.lines.map((l, i) => ({ korean: l.korean, index: i }))
          );
          const saved = loadSongProgress(songId);
          setCompletedLines(saved.completedLines);
          const firstUncompleted = data.lines.findIndex(
            (_, i) => !saved.completedLines.includes(i)
          );
          setCurrentLineIdx(firstUncompleted >= 0 ? firstUncompleted : 0);
          setLoading(false);
          return;
        }
      } catch {}

      // Fallback: load raw lyrics
      setUseFallback(true);
      try {
        const res = await fetch(
          `/data/lyrics/${encodeURIComponent(found.lyricsFile)}`
        );
        if (res.ok) {
          const text = await res.text();
          const rawLines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("["));

          // Deduplicate and filter Korean lines
          const seen = new Set<string>();
          const koreanLines: PracticeLine[] = [];
          for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            const hasKorean = /[가-힣]/.test(line);
            if (hasKorean && !seen.has(line)) {
              seen.add(line);
              koreanLines.push({ korean: line, index: koreanLines.length });
            }
          }

          // Cap at ~15 lines
          setLines(koreanLines.slice(0, 15));
          const saved = loadSongProgress(songId);
          setCompletedLines(saved.completedLines);
          const firstUncompleted = koreanLines.findIndex(
            (_, i) => !saved.completedLines.includes(i)
          );
          setCurrentLineIdx(firstUncompleted >= 0 ? firstUncompleted : 0);
        }
      } catch {}
      setLoading(false);
    }
    init();
  }, [songId]);

  const currentLine = lines[currentLineIdx];
  const currentPractice = practiceData?.lines[currentLineIdx];
  const totalLines = lines.length;
  const progress = totalLines > 0 ? (completedLines.length / totalLines) * 100 : 0;

  const markCompleted = useCallback(() => {
    if (!currentLine) return;
    const updated = [...new Set([...completedLines, currentLineIdx])];
    setCompletedLines(updated);
    saveSongProgress(songId, updated);
  }, [currentLine, completedLines, currentLineIdx, songId]);

  const goNext = useCallback(() => {
    markCompleted();
    if (currentLineIdx < totalLines - 1) {
      setCurrentLineIdx((i) => i + 1);
      setState("line");
    }
  }, [markCompleted, currentLineIdx, totalLines]);

  const goPrev = useCallback(() => {
    if (currentLineIdx > 0) {
      setCurrentLineIdx((i) => i - 1);
      setState("line");
    }
  }, [currentLineIdx]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-2xl animate-pulse">🎵</div>
      </div>
    );
  }

  if (!song || lines.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg">Song not found</p>
        <button
          onClick={() => router.push("/songs")}
          className="text-accent text-sm"
        >
          ← Back to songs
        </button>
      </div>
    );
  }

  // Done screen
  if (completedLines.length >= totalLines) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="px-4 py-4 border-b border-border">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => router.push("/songs")}
              className="text-muted hover:text-foreground text-sm"
            >
              ←
            </button>
            <h1 className="font-bold text-sm truncate">
              {song.artist} — {song.title}
            </h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <div className="text-6xl">🎉</div>
          <div className="text-center">
            <p className="kr text-xl font-black">
              <KrTip en="Song complete!">노래 완료!</KrTip>
            </p>
            <p className="text-sm text-muted mt-2">
              You learned {totalLines} lines from {song.title}
            </p>
          </div>

          {/* Show all learned lines */}
          <div className="w-full max-w-lg space-y-2 mt-4">
            <p className="text-xs text-faint uppercase tracking-wider font-semibold">
              <KrTip en="Lines you learned">배운 가사</KrTip>
            </p>
            {lines.map((line, i) => (
              <button
                key={i}
                onClick={() => speak(line.korean)}
                className="block w-full text-left kr text-sm p-3 bg-card border border-border rounded-lg hover:border-accent/40 transition-colors"
              >
                <span className="text-faint text-xs mr-2">{i + 1}</span>
                {line.korean}
                <span className="text-faint text-xs ml-1">🔊</span>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCompletedLines([]);
                saveSongProgress(songId, []);
                setCurrentLineIdx(0);
                setState("line");
              }}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:border-accent/40 transition-colors"
            >
              <KrTip en="Start over">다시 하기</KrTip>
            </button>
            <button
              onClick={() => router.push("/songs")}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              <KrTip en="More songs">다른 노래</KrTip> →
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => router.push("/songs")}
              className="text-muted hover:text-foreground text-sm"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <p className="text-xs text-muted truncate">
                {song.artist} — {song.title}
              </p>
            </div>
            <span className="text-xs text-faint">
              {currentLineIdx + 1}/{totalLines}
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

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-lg w-full space-y-8">
          {/* The Korean line */}
          <div className="text-center space-y-4">
            <p className="text-faint text-xs">
              <KrTip en={`Line ${currentLineIdx + 1}`}>
                {currentLineIdx + 1}번째 줄
              </KrTip>
            </p>
            <button
              onClick={() => speak(currentLine.korean)}
              className="kr text-2xl font-black leading-relaxed hover:text-accent transition-colors"
            >
              {currentLine.korean}
              <span className="text-faint text-sm ml-2">🔊</span>
            </button>
          </div>

          {/* Rich practice data: word breakdown */}
          {currentPractice && state !== "line" && (
            <div className="space-y-4 page-enter">
              {/* Word breakdown */}
              {state === "breakdown" && (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-faint font-semibold">
                    <KrTip en="Word breakdown">단어 분석</KrTip>
                  </p>
                  <div className="grid gap-2">
                    {currentPractice.words.map((word, i) => (
                      <button
                        key={i}
                        onClick={() => speak(word.korean)}
                        className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 text-left hover:border-accent/40 transition-colors"
                      >
                        <span className="kr font-bold text-sm">
                          {word.korean}
                        </span>
                        <span className="text-xs text-muted flex-1">
                          {word.english}
                        </span>
                        <span className="text-[9px] text-faint">
                          {word.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Translation */}
              {state === "translation" && (
                <div className="bg-accent-light border border-accent/20 rounded-xl p-5 text-center">
                  <p className="text-xs text-accent font-semibold mb-2">
                    <KrTip en="Translation">번역</KrTip>
                  </p>
                  <p className="text-sm text-foreground">
                    {currentPractice.english}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Fallback: no practice data */}
          {useFallback && state !== "line" && (
            <div className="bg-card border border-border rounded-xl p-5 text-center page-enter">
              <p className="text-xs text-faint mb-2">
                Practice data coming soon
              </p>
              <p className="text-sm text-muted">
                Tap the line to hear it, then move to the next one
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {currentPractice && state === "line" && (
              <button
                onClick={() => setState("breakdown")}
                className="w-full py-3.5 rounded-xl bg-card border border-border text-sm font-semibold hover:border-accent/40 transition-colors"
              >
                <KrTip en="Show breakdown">단어 분석 보기</KrTip>
              </button>
            )}
            {currentPractice && state === "breakdown" && (
              <button
                onClick={() => setState("translation")}
                className="w-full py-3.5 rounded-xl bg-card border border-border text-sm font-semibold hover:border-accent/40 transition-colors"
              >
                <KrTip en="Show translation">번역 보기</KrTip>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Bottom navigation */}
      <div className="px-4 py-4 border-t border-border">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={goPrev}
            disabled={currentLineIdx === 0}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold disabled:opacity-30 hover:border-faint transition-colors"
          >
            ← <KrTip en="Previous">이전</KrTip>
          </button>
          <button
            onClick={goNext}
            className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            {currentLineIdx === totalLines - 1 ? (
              <KrTip en="Finish">완료</KrTip>
            ) : (
              <>
                <KrTip en="Next">다음</KrTip> →
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
