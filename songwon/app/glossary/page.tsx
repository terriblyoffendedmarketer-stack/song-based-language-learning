"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTTS } from "@/hooks/useTTS";
import { KrTip } from "@/components/ui/KrTip";
import { BottomNav } from "@/components/BottomNav";

interface GlossaryEntry {
  pattern: string;
  meaning: string;
  explanation: string;
  unit: number;
  lesson: number;
  lessonId: string;
  song: string;
  examples: { korean: string; english: string; source: string }[];
}

const UNIT_LABELS: Record<number, string> = {
  1: "Unit 1 — Basics",
  2: "Unit 2 — Negation & Reasons",
  3: "Unit 3 — Requests & Opinions",
  4: "Unit 4 — States & Comparisons",
  5: "Unit 5 — Advanced Patterns",
};

export default function GlossaryPage() {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const { speak } = useTTS();

  useEffect(() => {
    fetch("/data/grammar_glossary.json")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {});
  }, []);

  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.pattern.includes(search) ||
          e.meaning.toLowerCase().includes(search.toLowerCase()) ||
          e.explanation.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const groupedByUnit: Record<number, GlossaryEntry[]> = {};
  for (const e of filtered) {
    (groupedByUnit[e.unit] ??= []).push(e);
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <header className="px-4 py-4 border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-muted hover:text-foreground text-sm">
              ←
            </Link>
            <h1 className="text-lg font-black">
              <KrTip en="Grammar Glossary">문법 사전</KrTip>
            </h1>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patterns or meanings..."
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm placeholder:text-faint focus:outline-none focus:border-accent"
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {Object.entries(groupedByUnit)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([unitStr, unitEntries]) => {
              const unit = Number(unitStr);
              return (
                <div key={unit}>
                  <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-2">
                    {UNIT_LABELS[unit] || `Unit ${unit}`}
                  </p>
                  <div className="space-y-2">
                    {unitEntries.map((entry) => {
                      const idx = entries.indexOf(entry);
                      const isExpanded = expandedIdx === idx;
                      return (
                        <div
                          key={entry.lessonId}
                          className="bg-card border border-border rounded-xl overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setExpandedIdx(isExpanded ? null : idx)
                            }
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-background/50 transition-colors"
                          >
                            <span className="kr text-lg font-black text-accent flex-shrink-0">
                              {entry.pattern}
                            </span>
                            <span className="text-sm text-muted flex-1 truncate">
                              {entry.meaning}
                            </span>
                            <span className="text-faint text-xs">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                              <p className="text-sm text-muted">
                                {entry.explanation}
                              </p>

                              {entry.examples.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] uppercase tracking-wider text-faint font-semibold">
                                    <KrTip en="Examples">예문</KrTip>
                                  </p>
                                  {entry.examples.map((ex, i) => (
                                    <div
                                      key={i}
                                      className={`rounded-lg p-3 space-y-1 ${
                                        ex.source === "song"
                                          ? "bg-accent-light border border-accent/20"
                                          : "bg-background border border-border"
                                      }`}
                                    >
                                      <button
                                        onClick={() => speak(ex.korean)}
                                        className="kr text-sm font-bold block w-full text-left hover:text-accent transition-colors"
                                      >
                                        {ex.korean}{" "}
                                        <span className="text-faint text-xs">
                                          🔊
                                        </span>
                                      </button>
                                      {ex.english && (
                                        <p className="text-xs text-muted italic">
                                          {ex.english}
                                        </p>
                                      )}
                                      {ex.source === "song" && (
                                        <p className="text-[9px] text-accent">
                                          <KrTip en="From the song">
                                            노래에서
                                          </KrTip>
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-faint">
                                  {entry.song}
                                </p>
                                <Link
                                  href={`/learn/v5/${entry.lessonId}`}
                                  className="text-xs text-accent font-semibold hover:underline"
                                >
                                  <KrTip en="Go to lesson">
                                    레슨으로 가기
                                  </KrTip>{" "}
                                  →
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-faint text-sm">No patterns found</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav active="home" />
    </div>
  );
}
