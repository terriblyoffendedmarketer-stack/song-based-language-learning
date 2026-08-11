"use client";

import { useCallback, useRef, useState } from "react";
import { getTTSAudio, saveTTSAudio, deleteTTSAudio } from "@/lib/storage";

let ttsLookup: Record<string, string> | null = null;
let ttsLookupPromise: Promise<Record<string, string>> | null = null;

async function loadLookup(): Promise<Record<string, string>> {
  if (ttsLookup) return ttsLookup;
  if (ttsLookupPromise) return ttsLookupPromise;
  ttsLookupPromise = fetch("/tts/lookup.json")
    .then((r) => r.json())
    .then((data) => {
      ttsLookup = data;
      return data;
    })
    .catch(() => {
      ttsLookup = {};
      return {};
    });
  return ttsLookupPromise;
}

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
): Promise<Blob | null> {
  const lookup = await loadLookup();

  // Try cleaned text first, then original
  const hash = lookup[cleaned] || lookup[text];
  if (hash) {
    try {
      const res = await fetch(`/tts/${hash}.mp3`);
      if (res.ok) return await res.blob();
    } catch {}
  }

  // Fallback: try API route (works locally with Python)
  try {
    const res = await fetch("/api/tts-cached", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleaned }),
    });
    if (res.ok) return await res.blob();
  } catch {}

  return null;
}

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const lastTextRef = useRef<string>("");

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

      const cacheKey = `${cleaned}__${speed ?? 0.9}`;

      let blob: Blob | null = (await getTTSAudio(cacheKey)) ?? null;

      if (!blob) {
        blob = await fetchTTSBlob(text, cleaned);
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
    if (!text.trim()) return;

    const cleaned = cleanForTTS(text);
    if (!cleaned) return;

    const cacheKey = `${cleaned}__0.9`;
    await deleteTTSAudio(cacheKey);

    const blob = await fetchTTSBlob(text, cleaned);
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
