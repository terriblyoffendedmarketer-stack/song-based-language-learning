import type { SRSData } from "./types";

// SM-2 algorithm adapted for song-based learning
// Quality: 0-5 (0=complete fail, 5=perfect recall)

export function createInitialSRS(): SRSData {
  return {
    interval: 0,
    ease: 2.5,
    nextReview: new Date().toISOString(),
    reviewCount: 0,
    strength: 0,
  };
}

export function reviewCard(srs: SRSData, quality: number): SRSData {
  const q = Math.max(0, Math.min(5, quality));

  let newInterval: number;
  let newEase = srs.ease;

  if (q < 3) {
    // Failed — reset interval
    newInterval = 1;
    newEase = Math.max(1.3, srs.ease - 0.2);
  } else {
    if (srs.reviewCount === 0) {
      newInterval = 1;
    } else if (srs.reviewCount === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(srs.interval * srs.ease);
    }
    newEase = srs.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    newEase = Math.max(1.3, newEase);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  const strengthDelta = q >= 3 ? 10 : -15;
  const newStrength = Math.max(0, Math.min(100, srs.strength + strengthDelta));

  return {
    interval: newInterval,
    ease: newEase,
    nextReview: nextReview.toISOString(),
    reviewCount: srs.reviewCount + 1,
    strength: newStrength,
  };
}

export function getDueVocabulary<T extends { srs: SRSData }>(
  items: T[]
): T[] {
  const now = new Date().toISOString();
  return items
    .filter((item) => item.srs.nextReview <= now)
    .sort((a, b) => a.srs.strength - b.srs.strength);
}

export function getStrengthLabel(strength: number): {
  label: string;
  color: string;
} {
  if (strength >= 80) return { label: "강해요", color: "sage" };
  if (strength >= 50) return { label: "괜찮아요", color: "amber" };
  if (strength >= 20) return { label: "약해요", color: "coral" };
  return { label: "새 단어", color: "faint" };
}
