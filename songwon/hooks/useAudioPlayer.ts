import { useState, useEffect, useRef, useCallback } from "react";
import { Howl } from "howler";

interface UseAudioPlayerOptions {
  songName: string;
  autoPlay?: boolean;
  onEnd?: () => void;
}

export function useAudioPlayer({ songName, autoPlay, onEnd }: UseAudioPlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!songName) return;

    const howl = new Howl({
      src: [`/audio/${encodeURIComponent(songName)}.mp3`],
      format: ["mp3"],
      html5: true,
      preload: true,
      onload: () => {
        setDuration(howl.duration());
        setIsLoaded(true);
        if (autoPlay) howl.play();
      },
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => {
        setIsPlaying(false);
        setCurrentTime(0);
      },
      onend: () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onEndRef.current?.();
      },
    });

    howlRef.current = howl;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      howl.unload();
      howlRef.current = null;
    };
  }, [songName]);

  useEffect(() => {
    const tick = () => {
      if (howlRef.current && isPlaying) {
        setCurrentTime(howlRef.current.seek() as number);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const play = useCallback(() => howlRef.current?.play(), []);
  const pause = useCallback(() => howlRef.current?.pause(), []);
  const stop = useCallback(() => howlRef.current?.stop(), []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    howlRef.current?.seek(time);
    setCurrentTime(time);
  }, []);

  return {
    isPlaying,
    isLoaded,
    duration,
    currentTime,
    play,
    pause,
    stop,
    toggle,
    seek,
  };
}
