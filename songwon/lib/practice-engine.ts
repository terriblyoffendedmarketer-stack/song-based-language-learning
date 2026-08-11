export interface VocabItem {
  korean: string;
  english: string;
  type: "word" | "phrase";
  partOfSpeech: string;
  lessonId: string;
  unit: number;
  lessonNumber: number;
  songLine: { korean: string; english: string; highlights?: string[] };
}

export interface GrammarItem {
  pattern: string;
  meaning: string;
  lessonId: string;
  unit: number;
  lessonNumber: number;
}

export interface SongPracticeLine {
  songId: string;
  korean: string;
  english: string;
  words: { korean: string; english: string; role: string }[];
  grammar?: { pattern: string; meaning: string; note: string };
}

export type QuestionType =
  | "korean-to-english"
  | "english-to-korean"
  | "grammar-meaning"
  | "fill-in-blank"
  | "listening"
  | "grammar-comparison";

export interface PracticeQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  promptHint?: string;
  promptAudio?: string;
  options: { text: string; correct: boolean; partOfSpeech?: string }[];
  vocabKey: string;
  songContext?: { korean: string; english: string };
  feedback?: {
    correctExplanation: string;
    wrongExplanations: Record<string, string>;
  };
}

export interface SRSEntry {
  key: string;
  interval: number;
  nextDue: number;
  correct: number;
  incorrect: number;
  mastery: "new" | "learning" | "mastered";
}

export interface PracticeStats {
  srs: Record<string, SRSEntry>;
  sessionsCompleted: number;
  lastSessionDate: string;
}

const PRACTICE_STATS_KEY = "songwon-practice-stats";
const SESSION_SIZE = 12;

export function loadPracticeStats(): PracticeStats {
  if (typeof window === "undefined") return { srs: {}, sessionsCompleted: 0, lastSessionDate: "" };
  try {
    const raw = localStorage.getItem(PRACTICE_STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { srs: {}, sessionsCompleted: 0, lastSessionDate: "" };
}

export function savePracticeStats(stats: PracticeStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRACTICE_STATS_KEY, JSON.stringify(stats));
}

function getSRSEntry(stats: PracticeStats, key: string): SRSEntry {
  return stats.srs[key] || {
    key,
    interval: 0,
    nextDue: 0,
    correct: 0,
    incorrect: 0,
    mastery: "new" as const,
  };
}

export function updateSRS(stats: PracticeStats, key: string, correct: boolean): PracticeStats {
  const entry = getSRSEntry(stats, key);
  const now = Date.now();

  if (correct) {
    entry.correct++;
    entry.interval = entry.interval === 0 ? 1 : Math.min(entry.interval * 2, 30);
  } else {
    entry.incorrect++;
    entry.interval = 0;
  }

  entry.nextDue = now + entry.interval * 24 * 60 * 60 * 1000;

  const total = entry.correct + entry.incorrect;
  const ratio = total > 0 ? entry.correct / total : 0;
  if (total >= 5 && ratio >= 0.8 && entry.interval >= 4) {
    entry.mastery = "mastered";
  } else if (total > 0) {
    entry.mastery = "learning";
  }

  return {
    ...stats,
    srs: { ...stats.srs, [key]: entry },
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface DistractorInfo {
  text: string;
  item: VocabItem;
}

function pickDistractorsWithInfo(
  correctItem: VocabItem,
  allVocab: VocabItem[],
  field: "korean" | "english",
  count: number
): DistractorInfo[] {
  const correctVal = correctItem[field];
  const pool = allVocab.filter((v) => v[field] !== correctVal);

  const sameType = pool.filter((v) => v.type === correctItem.type);
  const samePOS = sameType.filter(
    (v) => v.partOfSpeech && v.partOfSpeech === correctItem.partOfSpeech
  );

  const preferred = samePOS.length >= count ? samePOS : sameType.length >= count ? sameType : pool;
  return shuffle(preferred)
    .slice(0, count)
    .map((v) => ({ text: v[field], item: v }));
}

function buildFeedback(
  type: "korean-to-english" | "english-to-korean",
  correctItem: VocabItem,
  distractors: DistractorInfo[]
): { correctExplanation: string; wrongExplanations: Record<string, string> } {
  const wrongExplanations: Record<string, string> = {};

  if (type === "korean-to-english") {
    for (const d of distractors) {
      if (d.item.partOfSpeech !== correctItem.partOfSpeech) {
        wrongExplanations[d.text] = `"${d.item.korean}" means "${d.text}" — it's a ${d.item.partOfSpeech}, not a ${correctItem.partOfSpeech}`;
      } else {
        wrongExplanations[d.text] = `"${d.item.korean}" means "${d.text}" — different word, similar type`;
      }
    }
    return {
      correctExplanation: `${correctItem.korean} → "${correctItem.english}" (${correctItem.partOfSpeech})`,
      wrongExplanations,
    };
  } else {
    for (const d of distractors) {
      wrongExplanations[d.text] = `${d.text} means "${d.item.english}" — not "${correctItem.english}"`;
    }
    return {
      correctExplanation: `"${correctItem.english}" → ${correctItem.korean} (${correctItem.partOfSpeech})`,
      wrongExplanations,
    };
  }
}

const GRAMMAR_CONFUSABLES: [string, string][] = [
  ["-고", "-지만"],
  ["-아/어서", "-고"],
  ["-(으)면", "-다면"],
  ["-지 못하다", "-지 않다"],
  ["-고 싶다", "-고 있다"],
  ["-(으)ㄹ 것 같다", "-나 보다"],
];

function generateFillInBlank(
  songLines: SongPracticeLine[],
  allVocab: VocabItem[]
): PracticeQuestion | null {
  const candidates = songLines.filter((l) => l.words.length >= 3);
  if (candidates.length === 0) return null;

  const line = candidates[Math.floor(Math.random() * candidates.length)];
  const blankIdx = Math.floor(Math.random() * line.words.length);
  const blankWord = line.words[blankIdx];

  const prompt = line.korean.replace(blankWord.korean, "___");
  if (prompt === line.korean) return null;

  const lineWords = new Set(line.words.map((w) => w.korean));
  const sameRole = allVocab.filter(
    (v) => v.partOfSpeech === blankWord.role && v.korean !== blankWord.korean && !lineWords.has(v.korean)
  );
  const pool = sameRole.length >= 3 ? sameRole : allVocab.filter((v) => v.korean !== blankWord.korean && !lineWords.has(v.korean));
  const distractors = shuffle(pool).slice(0, 3).map((v) => v.korean);
  if (distractors.length < 3) return null;

  const wrongExplanations: Record<string, string> = {};
  for (const d of distractors) {
    const match = allVocab.find((v) => v.korean === d);
    wrongExplanations[d] = match
      ? `${d} means "${match.english}" — doesn't fit this sentence`
      : `${d} doesn't fit this context`;
  }

  return {
    id: `fib-${line.korean.slice(0, 20)}`,
    type: "fill-in-blank",
    prompt,
    promptHint: "빈칸에 들어갈 단어는?",
    options: shuffle([
      { text: blankWord.korean, correct: true },
      ...distractors.map((d) => ({ text: d, correct: false })),
    ]),
    vocabKey: blankWord.korean,
    songContext: { korean: line.korean, english: line.english },
    feedback: {
      correctExplanation: `${blankWord.korean} (${blankWord.english}) — "${line.english}"`,
      wrongExplanations,
    },
  };
}

function generateListening(
  v: VocabItem,
  available: VocabItem[]
): PracticeQuestion | null {
  const distractorInfos = pickDistractorsWithInfo(v, available, "english", 3);
  if (distractorInfos.length < 3) return null;

  const wrongExplanations: Record<string, string> = {};
  for (const d of distractorInfos) {
    wrongExplanations[d.text] = `That's "${d.item.korean}" — not what you heard`;
  }

  return {
    id: `listen-${v.korean}`,
    type: "listening",
    prompt: v.korean,
    promptHint: "들은 단어의 뜻은?",
    promptAudio: v.korean,
    options: shuffle([
      { text: v.english, correct: true, partOfSpeech: v.partOfSpeech },
      ...distractorInfos.map((d) => ({ text: d.text, correct: false, partOfSpeech: d.item.partOfSpeech })),
    ]),
    vocabKey: v.korean,
    songContext: v.songLine?.korean ? v.songLine : undefined,
    feedback: {
      correctExplanation: `${v.korean} → "${v.english}" (${v.partOfSpeech})`,
      wrongExplanations,
    },
  };
}

function generateNovelContext(
  songLines: SongPracticeLine[],
  allVocab: VocabItem[]
): PracticeQuestion | null {
  const candidates = songLines.filter((l) => l.words.length >= 3 && l.english.length > 10);
  if (candidates.length < 4) return null;

  const line = candidates[Math.floor(Math.random() * candidates.length)];
  const others = candidates.filter((l) => l.korean !== line.korean);
  const distractorLines = shuffle(others).slice(0, 3);
  if (distractorLines.length < 3) return null;

  const wrongExplanations: Record<string, string> = {};
  for (const d of distractorLines) {
    wrongExplanations[d.english] = `That translates "${d.korean.slice(0, 25)}..." — a different line`;
  }

  return {
    id: `novel-${line.korean.slice(0, 20)}`,
    type: "korean-to-english",
    prompt: line.korean,
    promptHint: "이 노래 가사의 뜻은?",
    options: shuffle([
      { text: line.english, correct: true },
      ...distractorLines.map((d) => ({ text: d.english, correct: false })),
    ]),
    vocabKey: line.korean,
    songContext: { korean: line.korean, english: line.english },
    feedback: {
      correctExplanation: `"${line.korean.slice(0, 30)}..." → "${line.english}"`,
      wrongExplanations,
    },
  };
}

function generateGrammarComparison(
  grammar: GrammarItem[],
  songLines: SongPracticeLine[]
): PracticeQuestion | null {
  const available = grammar.map((g) => g.pattern);
  const matchingPairs = GRAMMAR_CONFUSABLES.filter(
    ([a, b]) => available.includes(a) && available.includes(b)
  );
  if (matchingPairs.length === 0) return null;

  const [patternA, patternB] = matchingPairs[Math.floor(Math.random() * matchingPairs.length)];
  const grammarA = grammar.find((g) => g.pattern === patternA)!;
  const grammarB = grammar.find((g) => g.pattern === patternB)!;

  const lineWithPattern = songLines.find(
    (l) => l.grammar && l.grammar.pattern === patternA
  );

  const context = lineWithPattern
    ? `"${lineWithPattern.korean}" — ${lineWithPattern.english}`
    : `Which pattern means "${grammarA.meaning}"?`;

  return {
    id: `compare-${patternA}-${patternB}`,
    type: "grammar-comparison",
    prompt: context,
    promptHint: "어떤 문법이 맞을까요?",
    options: shuffle([
      { text: `${patternA} — ${grammarA.meaning}`, correct: true },
      { text: `${patternB} — ${grammarB.meaning}`, correct: false },
    ]),
    vocabKey: patternA,
    feedback: {
      correctExplanation: `${patternA} means "${grammarA.meaning}"`,
      wrongExplanations: {
        [`${patternB} — ${grammarB.meaning}`]: `${patternB} means "${grammarB.meaning}" — similar but different usage`,
      },
    },
  };
}

export function generateSession(
  vocab: VocabItem[],
  grammar: GrammarItem[],
  completedLessons: string[],
  stats: PracticeStats,
  songLines: SongPracticeLine[] = []
): PracticeQuestion[] {
  const available = vocab.filter((v) => completedLessons.includes(v.lessonId));
  if (available.length < 4) return [];

  const now = Date.now();
  const findSongContext = (koreanWord: string): { korean: string; english: string } | undefined => {
    if (!hasSongLines) return undefined;
    const match = songLines.find((l) => l.words.some((w) => w.korean === koreanWord));
    if (match) return { korean: match.korean, english: match.english };
    return undefined;
  };

  const scored = available.map((v) => {
    const entry = getSRSEntry(stats, v.korean);
    let priority = 0;
    if (entry.mastery === "new") priority = 3;
    else if (entry.mastery === "learning") priority = 2;
    else priority = 1;
    if (entry.nextDue <= now) priority += 1;
    if (entry.incorrect > entry.correct) priority += 1;
    return { vocab: v, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);

  const selected = scored.slice(0, SESSION_SIZE);
  const questions: PracticeQuestion[] = [];
  const availableGrammar = grammar.filter((g) => completedLessons.includes(g.lessonId));
  const hasSongLines = songLines.length > 0;

  for (let qi = 0; qi < selected.length; qi++) {
    const v = selected[qi].vocab;
    const qType = Math.random();

    // Mix in new question types
    if (hasSongLines && qType < 0.10) {
      const fib = generateFillInBlank(songLines, available);
      if (fib) { questions.push(fib); continue; }
    }

    if (qType < 0.20) {
      const listening = generateListening(v, available);
      if (listening) { questions.push(listening); continue; }
    }

    if (availableGrammar.length >= 2 && qType < 0.25) {
      const comparison = generateGrammarComparison(availableGrammar, songLines);
      if (comparison) { questions.push(comparison); continue; }
    }

    if (hasSongLines && qType < 0.30) {
      const novel = generateNovelContext(songLines, available);
      if (novel) { questions.push(novel); continue; }
    }

    // Existing question types
    if (qType < 0.55) {
      const distractorInfos = pickDistractorsWithInfo(v, available, "english", 3);
      const feedback = buildFeedback("korean-to-english", v, distractorInfos);
      const options = shuffle([
        { text: v.english, correct: true, partOfSpeech: v.partOfSpeech },
        ...distractorInfos.map((d) => ({ text: d.text, correct: false, partOfSpeech: d.item.partOfSpeech })),
      ]);
      questions.push({
        id: `kr2en-${v.korean}`,
        type: "korean-to-english",
        prompt: v.korean,
        promptHint: "무슨 뜻일까요?",
        options,
        vocabKey: v.korean,
        songContext: v.songLine?.korean ? v.songLine : findSongContext(v.korean),
        feedback,
      });
    } else if (qType < 0.9) {
      const distractorInfos = pickDistractorsWithInfo(v, available, "korean", 3);
      const feedback = buildFeedback("english-to-korean", v, distractorInfos);
      const options = shuffle([
        { text: v.korean, correct: true, partOfSpeech: v.partOfSpeech },
        ...distractorInfos.map((d) => ({ text: d.text, correct: false, partOfSpeech: d.item.partOfSpeech })),
      ]);
      questions.push({
        id: `en2kr-${v.korean}`,
        type: "english-to-korean",
        prompt: v.english,
        promptHint: "한국어로?",
        options,
        vocabKey: v.korean,
        songContext: findSongContext(v.korean),
        feedback,
      });
    } else if (availableGrammar.length >= 2) {
      const g = availableGrammar[Math.floor(Math.random() * availableGrammar.length)];
      const grammarPool = availableGrammar.filter((x) => x.pattern !== g.pattern);
      const grammarDistractors = shuffle(grammarPool).slice(0, 3);
      const wrongExplanations: Record<string, string> = {};
      for (const gd of grammarDistractors) {
        wrongExplanations[gd.meaning] = `"${gd.pattern}" means "${gd.meaning}" — different pattern`;
      }
      const options = shuffle([
        { text: g.meaning, correct: true },
        ...grammarDistractors.map((d) => ({ text: d.meaning, correct: false })),
      ]);
      questions.push({
        id: `grammar-${g.pattern}`,
        type: "grammar-meaning",
        prompt: g.pattern,
        promptHint: "이 문법의 의미는?",
        options,
        vocabKey: g.pattern,
        feedback: {
          correctExplanation: `${g.pattern} → "${g.meaning}"`,
          wrongExplanations,
        },
      });
    } else {
      const distractorInfos = pickDistractorsWithInfo(v, available, "english", 3);
      const feedback = buildFeedback("korean-to-english", v, distractorInfos);
      const options = shuffle([
        { text: v.english, correct: true, partOfSpeech: v.partOfSpeech },
        ...distractorInfos.map((d) => ({ text: d.text, correct: false, partOfSpeech: d.item.partOfSpeech })),
      ]);
      questions.push({
        id: `kr2en-${v.korean}`,
        type: "korean-to-english",
        prompt: v.korean,
        promptHint: "무슨 뜻일까요?",
        options,
        vocabKey: v.korean,
        songContext: v.songLine?.korean ? v.songLine : findSongContext(v.korean),
        feedback,
      });
    }
  }

  return shuffle(questions);
}

export function getMasteryStats(
  vocab: VocabItem[],
  completedLessons: string[],
  stats: PracticeStats
): { new: number; learning: number; mastered: number; total: number } {
  const available = vocab.filter((v) => completedLessons.includes(v.lessonId));
  let newCount = 0;
  let learning = 0;
  let mastered = 0;

  for (const v of available) {
    const entry = getSRSEntry(stats, v.korean);
    if (entry.mastery === "mastered") mastered++;
    else if (entry.mastery === "learning") learning++;
    else newCount++;
  }

  return { new: newCount, learning, mastered, total: available.length };
}
