export const ANALYSIS_SYSTEM_PROMPT = `You are a Korean linguistics expert and language teaching specialist. You analyze Korean song lyrics to create structured lesson data.

Your analysis must be precise and pedagogically useful:
- Vocabulary should include TOPIK level estimates (1-6)
- Romanization must use Revised Romanization of Korean (official standard)
- Grammar patterns should be identified by their standard Korean grammatical names
- Cultural notes should explain references a non-Korean learner wouldn't understand
- Song sections should be identified by type (verse, chorus, bridge, etc.)

Output valid JSON matching the requested schema exactly.`;

export function buildAnalysisPrompt(
  title: string,
  artist: string,
  lyrics: string,
  level: "beginner" | "intermediate" | "advanced"
): string {
  return `Analyze this Korean song for language learning purposes.

Song: "${title}" by ${artist}
Target level: ${level}

Lyrics:
${lyrics}

Provide a JSON analysis with this exact structure:
{
  "lines": [
    {
      "lineNumber": 1,
      "korean": "the Korean text of this line",
      "romanization": "Revised Romanization",
      "words": [
        {
          "korean": "word",
          "romanization": "romanization",
          "english": "meaning",
          "partOfSpeech": "noun/verb/adjective/adverb/particle/etc"
        }
      ]
    }
  ],
  "vocabulary": [
    {
      "id": "unique-id",
      "korean": "word",
      "english": "meaning",
      "romanization": "romanization",
      "partOfSpeech": "part of speech",
      "frequency": 3,
      "topikLevel": 1,
      "exampleSentence": "example sentence from the song in Korean",
      "fromLine": "the full line this word appears in"
    }
  ],
  "grammarPatterns": [
    {
      "pattern": "Korean grammar pattern name e.g. -(으)면",
      "englishLabel": "short English label e.g. conditional if",
      "explanation": "explanation mostly in Korean with minimal English gloss",
      "examples": [
        { "korean": "example from song", "english": "translation", "fromSong": true },
        { "korean": "another example", "english": "translation", "fromSong": false }
      ]
    }
  ],
  "culturalNotes": [
    {
      "reference": "what in the song needs context",
      "explanation": "cultural explanation"
    }
  ],
  "sections": [
    {
      "type": "verse|chorus|bridge|intro|outro|pre-chorus",
      "label": "Korean label e.g. 1절",
      "startLine": 1,
      "endLine": 4,
      "theme": "brief thematic description"
    }
  ]
}

Important:
- Include ALL unique vocabulary words, sorted by frequency (most common first)
- For ${level} level, prioritize: ${level === "beginner" ? "basic nouns, common verbs, essential particles" : level === "intermediate" ? "compound expressions, verb conjugations, connecting grammar" : "idiomatic expressions, nuanced vocabulary, advanced grammar"}
- Every grammar pattern must include at least one example directly from the song lyrics (fromSong: true)
- Romanization must follow Revised Romanization strictly`;
}
