"use client";

import { useCallback, useRef, useState } from "react";
import { getTTSAudio, saveTTSAudio, deleteTTSAudio } from "@/lib/storage";

function cleanForTTS(text: string): string {
  return text
    .replace(/[_]{2,}/g, "")
    .replace(/[-]{3,}/g, "")
    .replace(/[─]{1,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchTTSBlob(
  text: string,
  cleaned: string,
  speed?: number
): Promise<Blob | null> {
  // Try pre-generated Edge TTS cache
  try {
    const cached = await fetch("/api/tts-cached", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleaned }),
    });
    if (cached.ok) return await cached.blob();
  } catch {
    // continue
  }

  // Try original text in cache if different
  if (cleaned !== text) {
    try {
      const cachedOrig = await fetch("/api/tts-cached", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (cachedOrig.ok) return await cachedOrig.blob();
    } catch {
      // continue
    }
  }

  // Try Google Cloud TTS API
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleaned, speed }),
    });
    if (res.ok) return await res.blob();
  } catch {
    // continue
  }

  return null;
}

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const lastTextRef = useRef<string>("");
  const lastSpeedRef = useRef<number | undefined>(undefined);

  const playBlob = useCallback((blob: Blob) => {
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

  const speak = useCallback(
    async (text: string, speed?: number) => {
      if (!text.trim()) return;

      const cleaned = cleanForTTS(text);
      if (!cleaned) return;

      lastTextRef.current = text;
      lastSpeedRef.current = speed;

      const cacheKey = `${cleaned}__${speed ?? 0.9}`;

      let blob: Blob | null = (await getTTSAudio(cacheKey)) ?? null;

      if (!blob) {
        blob = await fetchTTSBlob(text, cleaned, speed);
        if (blob) {
          await saveTTSAudio(cacheKey, blob);
        }
      }

      if (!blob) {
        setUsedFallback(true);
        fallbackSpeak(cleaned);
        return;
      }

      setUsedFallback(false);
      playBlob(blob);
    },
    [playBlob]
  );

  const retry = useCallback(async () => {
    const text = lastTextRef.current;
    const speed = lastSpeedRef.current;
    if (!text.trim()) return;

    const cleaned = cleanForTTS(text);
    if (!cleaned) return;

    const cacheKey = `${cleaned}__${speed ?? 0.9}`;

    // Clear bad cached entry
    await deleteTTSAudio(cacheKey);

    // Fetch fresh
    const blob = await fetchTTSBlob(text, cleaned, speed);
    if (blob) {
      await saveTTSAudio(cacheKey, blob);
      setUsedFallback(false);
      playBlob(blob);
    } else {
      setUsedFallback(true);
      fallbackSpeak(cleaned);
    }
  }, [playBlob]);

  return { speak, retry, usedFallback };
}

function fallbackSpeak(text: string) {
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }
}
