import type { LessonAnalysis } from "../types";

export const LESSON_SYSTEM_PROMPT = `You are a Korean language teacher creating immersive music-based lessons. You follow Stephen Krashen's comprehensible input theory and the Mass Immersion Approach.

CRITICAL RULES:
1. Write 80-90% of lesson content in Korean (hangul). English appears ONLY in parentheses for individual word meanings.
2. Grammar is NOT taught as rules. Show the pattern in context from the song, give 2 examples, let the learner discover how it works.
3. Every 2-3 teaching items must be followed by a practice exercise using actual lyrics from the song.
4. Exercises must play audio — always reference which part of the song to listen to.
5. Practice and explanation are interleaved and build on each other. Never dump all vocab then all grammar then all practice.
6. The lesson flow for each section should be: listen → learn 2-3 words → practice → notice grammar pattern → practice → combine everything → sing along.
7. Make it feel like entertainment, not study. The learner has ADHD — short segments, clear progress, rewarding interactions.

Output valid JSON matching the requested structure.`;

export function buildLessonPrompt(
  title: string,
  artist: string,
  analysis: LessonAnalysis,
  level: "beginner" | "intermediate" | "advanced",
  sectionIndex: number
): string {
  const section = analysis.sections[sectionIndex];
  const sectionLines = analysis.lines.filter(
    (l) => l.lineNumber >= section.startLine && l.lineNumber <= section.endLine
  );
  const sectionVocab = analysis.vocabulary.filter((v) =>
    sectionLines.some((l) => l.korean.includes(v.korean))
  );
  const sectionGrammar = analysis.grammarPatterns.filter((g) =>
    g.examples.some(
      (ex) =>
        ex.fromSong &&
        sectionLines.some((l) => l.korean.includes(ex.korean.slice(0, 5)))
    )
  );

  const levelInstructions =
    level === "beginner"
      ? `초급 (Beginner): Include romanization hints. Use ~20% English for word meanings. Focus on the most common words first. Keep grammar explanations very simple with clear Korean examples.`
      : level === "intermediate"
        ? `중급 (Intermediate): No romanization. Korean grammar explanations with ~10% English only for key terms. Expect knowledge of basic particles and common verbs.`
        : `고급 (Advanced): Near-full Korean immersion. Focus on nuance, idiomatic expressions, and cultural depth. Minimal English.`;

  return `Create a lesson for section "${section.label}" (${section.type}) of "${title}" by ${artist}.

Level: ${levelInstructions}

Lines in this section:
${sectionLines.map((l) => `${l.lineNumber}. ${l.korean}`).join("\n")}

Available vocabulary for this section:
${sectionVocab.map((v) => `${v.korean} (${v.english}) - TOPIK ${v.topikLevel}`).join("\n")}

Grammar patterns in this section:
${sectionGrammar.map((g) => `${g.pattern} — ${g.englishLabel}`).join("\n")}

Cultural context available:
${analysis.culturalNotes.map((n) => `${n.reference}: ${n.explanation}`).join("\n")}

Generate a lesson as JSON with this structure:
{
  "sections": [
    {
      "id": "unique-id",
      "type": "listen|vocabulary|grammar|practice|sing-along|context",
      "title": "Korean title for this section",
      "content": "Rich content in Korean (80-90%). Use markdown formatting. English only in parentheses for word meanings.",
      "lyricLines": ["Korean lyric lines referenced in this section"],
      "vocabularyIds": ["ids of vocabulary items taught in this section"],
      "exercises": [
        {
          "id": "unique-id",
          "type": "fill-blank|listening|match|order-words|comprehension",
          "prompt": "Exercise prompt in Korean",
          "options": ["option1", "option2", "option3"],
          "correctAnswer": "the correct answer",
          "hint": "hint in Korean with English gloss if needed"
        }
      ]
    }
  ],
  "xpReward": 25
}

IMPORTANT FLOW — sections must follow this pattern:
1. "listen" — 이 부분을 먼저 들어 보세요 (listen first without reading)
2. "vocabulary" — teach 2-3 words from the first line
3. "practice" — immediate recall exercise using those words
4. "grammar" — show a pattern from the lyrics, 2 examples (1 from song)
5. "practice" — exercise using the grammar pattern with lyrics
6. "vocabulary" — teach 2-3 more words from the next line
7. "practice" — exercise combining old and new words
8. "context" — cultural/emotional context of this section
9. "practice" — comprehension exercise
10. "sing-along" — play the section, sing along with full lyrics

Each "practice" section MUST have 1-2 exercises. Never have two teaching sections in a row without practice between them.`;
}
