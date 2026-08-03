import type { Song, Lesson, LessonSection, VocabularyItem, LessonAnalysis } from "./types";
import { createInitialSRS } from "./srs";

const SONG_ID = "iu-good-day";
const LESSON_ID = "iu-good-day-lesson-1";

export const seedSong: Song = {
  id: SONG_ID,
  title: "좋은 날",
  artist: "아이유 (IU)",
  duration: 228,
  lyrics: `어쩌다 마주친 그대 두 눈에
내 얼굴 비친 걸 봤어
놀란 표정 속에 살짝
반가움이 묻어나올 때

나도 모르게 활짝 웃었어
숨기려 해도 안 돼
자꾸만 입꼬리가 올라가
좋은 날이야 오늘

오늘따라 왜 이렇게
하늘도 맑고 바람도 좋고
기분까지 좋아
좋은 날이야 오늘`,
  lyricsSource: "manual",
  createdAt: new Date().toISOString(),
};

export const seedAnalysis: LessonAnalysis = {
  songId: SONG_ID,
  lines: [
    {
      lineNumber: 1,
      korean: "어쩌다 마주친 그대 두 눈에",
      romanization: "eojjeoda majuchin geudae du nune",
      words: [
        { korean: "어쩌다", romanization: "eojjeoda", english: "by chance", partOfSpeech: "adverb" },
        { korean: "마주친", romanization: "majuchin", english: "encountered", partOfSpeech: "verb" },
        { korean: "그대", romanization: "geudae", english: "you (poetic)", partOfSpeech: "pronoun" },
        { korean: "두", romanization: "du", english: "two", partOfSpeech: "number" },
        { korean: "눈", romanization: "nun", english: "eyes", partOfSpeech: "noun" },
      ],
    },
    {
      lineNumber: 2,
      korean: "내 얼굴 비친 걸 봤어",
      romanization: "nae eolgul bichin geol bwasseo",
      words: [
        { korean: "내", romanization: "nae", english: "my", partOfSpeech: "pronoun" },
        { korean: "얼굴", romanization: "eolgul", english: "face", partOfSpeech: "noun" },
        { korean: "비친", romanization: "bichin", english: "reflected", partOfSpeech: "verb" },
        { korean: "걸", romanization: "geol", english: "the thing that (것+을)", partOfSpeech: "particle" },
        { korean: "봤어", romanization: "bwasseo", english: "saw", partOfSpeech: "verb" },
      ],
    },
    {
      lineNumber: 3,
      korean: "놀란 표정 속에 살짝",
      romanization: "nollan pyojeong soge saljjak",
      words: [
        { korean: "놀란", romanization: "nollan", english: "surprised", partOfSpeech: "adjective" },
        { korean: "표정", romanization: "pyojeong", english: "expression", partOfSpeech: "noun" },
        { korean: "속에", romanization: "soge", english: "inside", partOfSpeech: "particle" },
        { korean: "살짝", romanization: "saljjak", english: "slightly", partOfSpeech: "adverb" },
      ],
    },
    {
      lineNumber: 4,
      korean: "반가움이 묻어나올 때",
      romanization: "bangaumi mudeonaut ttae",
      words: [
        { korean: "반가움", romanization: "bangaum", english: "gladness", partOfSpeech: "noun" },
        { korean: "묻어나올", romanization: "mudeonaut", english: "seeping out", partOfSpeech: "verb" },
        { korean: "때", romanization: "ttae", english: "when/time", partOfSpeech: "noun" },
      ],
    },
    {
      lineNumber: 5,
      korean: "나도 모르게 활짝 웃었어",
      romanization: "nado moreuge hwaljjak useosseo",
      words: [
        { korean: "나도", romanization: "nado", english: "me too", partOfSpeech: "pronoun" },
        { korean: "모르게", romanization: "moreuge", english: "without knowing", partOfSpeech: "adverb" },
        { korean: "활짝", romanization: "hwaljjak", english: "broadly/widely", partOfSpeech: "adverb" },
        { korean: "웃었어", romanization: "useosseo", english: "smiled/laughed", partOfSpeech: "verb" },
      ],
    },
  ],
  vocabulary: [
    {
      id: "v-eojjeoda",
      korean: "어쩌다",
      english: "by chance, accidentally",
      romanization: "eojjeoda",
      partOfSpeech: "adverb",
      frequency: 2,
      topikLevel: 3,
      exampleSentence: "어쩌다 친구를 만났어요.",
      fromSongId: SONG_ID,
      fromLine: "어쩌다 마주친 그대 두 눈에",
    },
    {
      id: "v-majuchida",
      korean: "마주치다",
      english: "to encounter, run into",
      romanization: "majuchida",
      partOfSpeech: "verb",
      frequency: 1,
      topikLevel: 3,
      exampleSentence: "길에서 선생님을 마주쳤어요.",
      fromSongId: SONG_ID,
      fromLine: "어쩌다 마주친 그대 두 눈에",
    },
    {
      id: "v-geudae",
      korean: "그대",
      english: "you (poetic/literary)",
      romanization: "geudae",
      partOfSpeech: "pronoun",
      frequency: 1,
      topikLevel: 2,
      exampleSentence: "그대를 사랑합니다.",
      fromSongId: SONG_ID,
      fromLine: "어쩌다 마주친 그대 두 눈에",
    },
    {
      id: "v-eolgul",
      korean: "얼굴",
      english: "face",
      romanization: "eolgul",
      partOfSpeech: "noun",
      frequency: 1,
      topikLevel: 1,
      exampleSentence: "얼굴이 빨개졌어요.",
      fromSongId: SONG_ID,
      fromLine: "내 얼굴 비친 걸 봤어",
    },
    {
      id: "v-bichida",
      korean: "비치다",
      english: "to be reflected, to shine through",
      romanization: "bichida",
      partOfSpeech: "verb",
      frequency: 1,
      topikLevel: 3,
      exampleSentence: "거울에 내 모습이 비쳤어요.",
      fromSongId: SONG_ID,
      fromLine: "내 얼굴 비친 걸 봤어",
    },
    {
      id: "v-pyojeong",
      korean: "표정",
      english: "facial expression",
      romanization: "pyojeong",
      partOfSpeech: "noun",
      frequency: 1,
      topikLevel: 2,
      exampleSentence: "표정이 밝아 보여요.",
      fromSongId: SONG_ID,
      fromLine: "놀란 표정 속에 살짝",
    },
    {
      id: "v-bangaum",
      korean: "반가움",
      english: "gladness, joy of meeting",
      romanization: "bangaum",
      partOfSpeech: "noun",
      frequency: 1,
      topikLevel: 3,
      exampleSentence: "오랜만에 만나서 반가움을 느꼈어요.",
      fromSongId: SONG_ID,
      fromLine: "반가움이 묻어나올 때",
    },
    {
      id: "v-utda",
      korean: "웃다",
      english: "to smile, to laugh",
      romanization: "utda",
      partOfSpeech: "verb",
      frequency: 1,
      topikLevel: 1,
      exampleSentence: "아기가 활짝 웃었어요.",
      fromSongId: SONG_ID,
      fromLine: "나도 모르게 활짝 웃었어",
    },
    {
      id: "v-haneul",
      korean: "하늘",
      english: "sky",
      romanization: "haneul",
      partOfSpeech: "noun",
      frequency: 1,
      topikLevel: 1,
      exampleSentence: "오늘 하늘이 참 맑아요.",
      fromSongId: SONG_ID,
      fromLine: "하늘도 맑고 바람도 좋고",
    },
    {
      id: "v-baram",
      korean: "바람",
      english: "wind",
      romanization: "baram",
      partOfSpeech: "noun",
      frequency: 1,
      topikLevel: 1,
      exampleSentence: "바람이 시원해요.",
      fromSongId: SONG_ID,
      fromLine: "하늘도 맑고 바람도 좋고",
    },
    {
      id: "v-gibun",
      korean: "기분",
      english: "mood, feeling",
      romanization: "gibun",
      partOfSpeech: "noun",
      frequency: 1,
      topikLevel: 1,
      exampleSentence: "기분이 좋아요!",
      fromSongId: SONG_ID,
      fromLine: "기분까지 좋아",
    },
  ],
  grammarPatterns: [
    {
      pattern: "-(으)ㄴ 걸",
      englishLabel: "Expressing discovery/realization",
      explanation: "이 노래에서 '비친 걸 봤어'는 '비치다'에 '-ㄴ 걸'이 붙어서 '비친 것을'이라는 뜻이에요. 무언가를 발견했을 때 써요.",
      examples: [
        { korean: "비친 걸 봤어", english: "I saw that (my face) was reflected", fromSong: true },
        { korean: "맛있는 걸 찾았어", english: "I found something delicious" },
      ],
    },
    {
      pattern: "-도 모르게",
      englishLabel: "Without (someone) knowing",
      explanation: "'나도 모르게'는 '나도 모르는 사이에'라는 뜻이에요. 무의식적인 행동을 표현해요.",
      examples: [
        { korean: "나도 모르게 웃었어", english: "I smiled without realizing", fromSong: true },
        { korean: "나도 모르게 눈물이 났어", english: "Tears came without me knowing" },
      ],
    },
    {
      pattern: "-도 ~고 -도 ~고",
      englishLabel: "Both A and B (listing)",
      explanation: "'하늘도 맑고 바람도 좋고' — 여러 가지를 나열할 때 '-도... -고'를 반복해요.",
      examples: [
        { korean: "하늘도 맑고 바람도 좋고", english: "The sky is clear and the wind is nice", fromSong: true },
        { korean: "음식도 맛있고 사람도 좋고", english: "The food is delicious and the people are nice" },
      ],
    },
  ],
  culturalNotes: [
    {
      reference: "그대",
      explanation: "그대 is a poetic/literary way to say 'you' in Korean. It's rarely used in everyday conversation but very common in songs and poetry. It carries a romantic, tender tone — much softer than 너 (casual) or 당신 (formal).",
    },
  ],
  sections: [
    { type: "verse", label: "1절 (Verse 1)", startLine: 1, endLine: 4, theme: "우연한 만남 (Chance encounter)" },
    { type: "verse", label: "2절 (Verse 2)", startLine: 5, endLine: 8, theme: "감출 수 없는 기쁨 (Joy you can't hide)" },
    { type: "chorus", label: "후렴 (Chorus)", startLine: 9, endLine: 12, theme: "좋은 날 (A good day)" },
  ],
};

export const seedLesson: Lesson = {
  id: LESSON_ID,
  songId: SONG_ID,
  level: "beginner",
  title: "좋은 날 — 1절 첫 번째 수업",
  xpReward: 35,
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: "s1-listen",
      type: "listen",
      title: "먼저 들어 보세요",
      content: "아이유의 '좋은 날' 첫 번째 부분이에요.\n이 노래는 우연히 누군가를 만났을 때의 기쁜 마음을 표현해요.\n가사를 읽어 보세요. 모르는 단어가 있어도 괜찮아요!",
      lyricLines: [
        "어쩌다 마주친 그대 두 눈에",
        "내 얼굴 비친 걸 봤어",
      ],
    },
    {
      id: "s2-vocab1",
      type: "vocabulary",
      title: "새 단어를 배워요",
      content: "어쩌다 (eojjeoda) — by chance, accidentally\n우연히 무언가가 일어났을 때 써요.\n\"어쩌다 친구를 만났어요.\" (I ran into a friend by chance.)\n\n마주치다 (majuchida) — to encounter, to run into\n누군가와 갑자기 만났을 때 써요.\n\"길에서 선생님을 마주쳤어요.\" (I ran into my teacher on the street.)",
      lyricLines: ["어쩌다 마주친 그대 두 눈에"],
      vocabularyIds: ["v-eojjeoda", "v-majuchida"],
    },
    {
      id: "s3-practice1",
      type: "practice",
      title: "연습해 봐요!",
      content: "방금 배운 단어로 연습해 봐요.",
      exercises: [
        {
          id: "ex1",
          type: "fill-blank",
          prompt: "길에서 _____ 친구를 만났어요. (I met a friend by chance on the street.)",
          options: ["어쩌다", "항상", "아직", "빨리"],
          correctAnswer: "어쩌다",
          hint: "'우연히'라는 뜻이에요",
        },
        {
          id: "ex2",
          type: "fill-blank",
          prompt: "카페에서 선생님을 _____. (I ran into my teacher at the cafe.)",
          options: ["마주쳤어요", "먹었어요", "읽었어요", "갔어요"],
          correctAnswer: "마주쳤어요",
          hint: "'만나다'와 비슷하지만, 우연히 만났을 때 써요",
        },
      ],
    },
    {
      id: "s4-vocab2",
      type: "vocabulary",
      title: "더 배워요",
      content: "그대 (geudae) — you (poetic, romantic)\n노래나 시에서 많이 써요. 일상에서는 잘 안 써요.\n\n얼굴 (eolgul) — face\n아주 기본적인 단어예요!\n\"얼굴이 빨개졌어요.\" (My face turned red.)\n\n비치다 (bichida) — to be reflected\n거울이나 물에 모습이 보일 때 써요.\n\"거울에 내 모습이 비쳤어요.\" (My figure was reflected in the mirror.)",
      lyricLines: ["내 얼굴 비친 걸 봤어"],
      vocabularyIds: ["v-geudae", "v-eolgul", "v-bichida"],
    },
    {
      id: "s5-practice2",
      type: "practice",
      title: "다시 연습!",
      content: "가사와 함께 연습해요.",
      exercises: [
        {
          id: "ex3",
          type: "comprehension",
          prompt: "'내 얼굴 비친 걸 봤어'는 무슨 뜻일까요?",
          options: [
            "I saw my face was reflected",
            "I washed my face",
            "I forgot your face",
            "My face turned red",
          ],
          correctAnswer: "I saw my face was reflected",
          hint: "비치다 = to be reflected, 봤어 = saw",
        },
        {
          id: "ex4",
          type: "fill-blank",
          prompt: "노래에서 IU가 '___'라고 했어요. 이것은 'you'의 시적 표현이에요.",
          options: ["그대", "너", "당신", "선생님"],
          correctAnswer: "그대",
          hint: "노래나 시에서 쓰는 표현이에요",
        },
      ],
    },
    {
      id: "s6-grammar",
      type: "grammar",
      title: "패턴을 찾아봐요",
      content: "이 가사를 다시 보세요:\n\"내 얼굴 비친 걸 봤어\"\n\n여기서 '비친 걸'은 '비친 것을'의 줄임말이에요.\n'-ㄴ 걸'은 무언가를 발견했을 때 써요.\n\n다른 예:\n• 맛있는 걸 찾았어 (I found something delicious)\n• 예쁜 걸 봤어 (I saw something pretty)\n\n패턴: [동사]-ㄴ 걸 = the thing that [verb]ed",
      lyricLines: ["내 얼굴 비친 걸 봤어"],
    },
    {
      id: "s7-practice3",
      type: "practice",
      title: "패턴 연습",
      content: "'-ㄴ 걸' 패턴으로 연습해요!",
      exercises: [
        {
          id: "ex5",
          type: "order-words",
          prompt: "'I saw something delicious'을 한국어로 만들어 보세요.",
          options: ["걸", "맛있는", "봤어"],
          correctAnswer: ["맛있는", "걸", "봤어"],
          hint: "패턴: [형용사]-ㄴ 걸 봤어",
        },
        {
          id: "ex6",
          type: "fill-blank",
          prompt: "나도 _____ 웃었어. (I smiled without realizing.)",
          options: ["모르게", "알아서", "빨리", "조금"],
          correctAnswer: "모르게",
          hint: "'나도 모르게' = without me knowing",
        },
      ],
    },
    {
      id: "s8-combine",
      type: "context",
      title: "전체 가사를 이해해요",
      content: "이제 처음 네 줄을 다시 읽어 보세요:\n\n어쩌다 (by chance) 마주친 (encountered) 그대 (you) 두 눈에 (in two eyes)\n→ 우연히 당신의 두 눈을 마주쳤는데\n\n내 얼굴 (my face) 비친 걸 (reflected thing) 봤어 (saw)\n→ 당신의 눈에 내 얼굴이 비친 걸 봤어요\n\n놀란 (surprised) 표정 (expression) 속에 (inside) 살짝 (slightly)\n→ 놀란 표정 안에 살짝\n\n반가움이 (gladness) 묻어나올 때 (when seeping out)\n→ 반가운 마음이 보일 때\n\nIU가 말하는 순간: 우연히 눈이 마주쳤는데, 상대방의 눈에 내 얼굴이 비치고, 놀라면서도 반가워하는 그 순간이에요. 💕",
      lyricLines: [
        "어쩌다 마주친 그대 두 눈에",
        "내 얼굴 비친 걸 봤어",
        "놀란 표정 속에 살짝",
        "반가움이 묻어나올 때",
      ],
    },
    {
      id: "s9-final",
      type: "practice",
      title: "마지막 확인!",
      content: "전체 내용을 확인해 봐요.",
      exercises: [
        {
          id: "ex7",
          type: "comprehension",
          prompt: "이 노래의 첫 네 줄은 어떤 상황을 이야기하고 있어요?",
          options: [
            "우연히 누군가를 만나서 기뻤던 순간",
            "비 오는 날 슬펐던 기억",
            "친구와 싸운 이야기",
            "학교에서 공부한 이야기",
          ],
          correctAnswer: "우연히 누군가를 만나서 기뻤던 순간",
          hint: "어쩌다 마주친... 반가움이 묻어나올 때",
        },
        {
          id: "ex8",
          type: "order-words",
          prompt: "'어쩌다 마주친 그대 두 눈에'를 순서대로 놓으세요.",
          options: ["두", "그대", "마주친", "어쩌다", "눈에"],
          correctAnswer: ["어쩌다", "마주친", "그대", "두", "눈에"],
        },
      ],
    },
    {
      id: "s10-singalong",
      type: "sing-along",
      title: "따라 불러 봐요! 🎤",
      content: "이제 가사의 뜻을 알았으니, 따라 불러 보세요!\n각 줄을 탭하면 발음을 들을 수 있어요.\n\n잘했어요! 오늘 배운 것:\n• 어쩌다, 마주치다, 그대, 얼굴, 비치다\n• '-ㄴ 걸' 패턴 (발견)\n• '나도 모르게' (무의식적 행동)\n\n이 단어들은 복습 시간에 다시 나올 거예요! 🎵",
      lyricLines: [
        "어쩌다 마주친 그대 두 눈에",
        "내 얼굴 비친 걸 봤어",
        "놀란 표정 속에 살짝",
        "반가움이 묻어나올 때",
        "나도 모르게 활짝 웃었어",
      ],
    },
  ],
};

export function getSeedVocabulary(): VocabularyItem[] {
  return seedAnalysis.vocabulary.map((v) => ({
    ...v,
    id: v.id || crypto.randomUUID(),
    fromSongId: v.fromSongId || SONG_ID,
    fromLine: v.fromLine || "",
    srs: createInitialSRS(),
  }));
}
