"use client";

import { useCallback, useRef } from "react";
import { getTTSAudio, saveTTSAudio } from "@/lib/storage";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, speed?: number) => {
    if (!text.trim()) return;

    const cacheKey = `${text}__${speed ?? 0.9}`;

    let blob = await getTTSAudio(cacheKey);

    if (!blob) {
      // Try pre-generated Edge TTS cache first
      try {
        const cached = await fetch("/api/tts-cached", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (cached.ok) {
          blob = await cached.blob();
          await saveTTSAudio(cacheKey, blob);
        }
      } catch {
        // cached route unavailable, continue to next fallback
      }
    }

    if (!blob) {
      // Try Google Cloud TTS API
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speed }),
        });
        if (res.ok) {
          blob = await res.blob();
          await saveTTSAudio(cacheKey, blob);
        }
      } catch {
        // API unavailable, continue to browser fallback
      }
    }

    if (!blob) {
      fallbackSpeak(text);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  }, []);

  return { speak };
}

function fallbackSpeak(text: string) {
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }
}
