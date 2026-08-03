"use client";

import { useState, useCallback } from "react";
import type { LessonAnalysis, LessonSection, UserLevel } from "@/lib/types";

interface UseLessonStreamResult {
  sections: LessonSection[];
  xpReward: number;
  isStreaming: boolean;
  error: string | null;
  rawText: string;
  generate: (params: {
    title: string;
    artist: string;
    analysis: LessonAnalysis;
    level: UserLevel;
    sectionIndex: number;
  }) => Promise<void>;
}

export function useLessonStream(): UseLessonStreamResult {
  const [sections, setSections] = useState<LessonSection[]>([]);
  const [xpReward, setXpReward] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");

  const generate = useCallback(
    async (params: {
      title: string;
      artist: string;
      analysis: LessonAnalysis;
      level: UserLevel;
      sectionIndex: number;
    }) => {
      setIsStreaming(true);
      setError(null);
      setRawText("");
      setSections([]);
      setXpReward(0);

      try {
        const response = await fetch("/api/generate-lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  accumulated += parsed.text;
                  setRawText(accumulated);
                }
                if (parsed.error) {
                  setError(parsed.error);
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }

        // Parse the complete JSON from accumulated text
        const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const lesson = JSON.parse(jsonMatch[0]);
          if (lesson.sections) setSections(lesson.sections);
          if (lesson.xpReward) setXpReward(lesson.xpReward);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  return { sections, xpReward, isStreaming, error, rawText, generate };
}
