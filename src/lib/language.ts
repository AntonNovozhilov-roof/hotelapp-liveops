export interface DetectedLanguage {
  code: string;
  name: string;
  source: "meta" | "guess";
}

const SCRIPT_LANGUAGES: Array<{
  pattern: RegExp;
  code: string;
  name: string;
}> = [
  { pattern: /[\u0400-\u04FF]/, code: "ru", name: "Russian" },
  { pattern: /[\u0600-\u06FF]/, code: "ar", name: "Arabic" },
  { pattern: /[\u0590-\u05FF]/, code: "he", name: "Hebrew" },
  { pattern: /[\u3040-\u30FF]/, code: "ja", name: "Japanese" },
  { pattern: /[\u4E00-\u9FFF]/, code: "zh", name: "Mandarin Chinese" },
  { pattern: /[\uAC00-\uD7AF]/, code: "ko", name: "Korean" },
  { pattern: /[\u0980-\u09FF]/, code: "bn", name: "Bengali" },
  { pattern: /[\u0B80-\u0BFF]/, code: "ta", name: "Tamil" },
  { pattern: /[\u0C00-\u0C7F]/, code: "te", name: "Telugu" },
  { pattern: /[\u0C80-\u0CFF]/, code: "kn", name: "Kannada" },
  { pattern: /[\u0900-\u097F]/, code: "hi", name: "Hindi" },
  { pattern: /[\u0E00-\u0E7F]/, code: "th", name: "Thai" },
];

const WORD_LANGUAGES: Array<{
  code: string;
  name: string;
  words: string[];
}> = [
  {
    code: "en",
    name: "English",
    words: ["the", "and", "please", "bring", "room", "need", "leak", "towels", "bathroom", "is", "there", "water", "help"],
  },
  {
    code: "es",
    name: "Spanish",
    words: ["el", "la", "por", "favor", "traer", "toallas", "baño", "habitación", "agua", "necesito", "una", "hay"],
  },
  {
    code: "fr",
    name: "French",
    words: ["le", "la", "les", "merci", "serviettes", "salle", "chambre", "eau", "fuite", "apportez", "je"],
  },
  {
    code: "de",
    name: "German",
    words: ["der", "die", "das", "bitte", "bringen", "handtücher", "zimmer", "wasser", "und", "ich", "ein"],
  },
  {
    code: "it",
    name: "Italian",
    words: ["il", "di", "per", "favore", "asciugamani", "bagno", "camera", "acqua", "portare", "una"],
  },
  {
    code: "pt",
    name: "Portuguese",
    words: ["o", "a", "por", "favor", "toalhas", "banheiro", "quarto", "água", "trazer", "uma"],
  },
  {
    code: "tr",
    name: "Turkish",
    words: ["bir", "lütfen", "havlu", "banyo", "oda", "su", "getir", "ve", "sızıntı"],
  },
  {
    code: "kk",
    name: "Kazakh",
    words: ["өтінемін", "сүлгі", "бөлме", "су", "әкел", "және"],
  },
];

/**
 * Small language guess from the transcript text.
 * Used only because the Meta transcribe response does not
 * include a detected-language field (checked in the official schema).
 */
export function guessLanguage(text: string): DetectedLanguage {
  const trimmed = text.trim();
  for (const candidate of SCRIPT_LANGUAGES) {
    if (candidate.pattern.test(trimmed)) {
      return { code: candidate.code, name: candidate.name, source: "guess" };
    }
  }

  const words = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  let best: DetectedLanguage = { code: "en", name: "English", source: "guess" };
  let bestScore = 0;
  for (const candidate of WORD_LANGUAGES) {
    const score = words.filter((word) =>
      candidate.words.includes(word),
    ).length;
    if (score > bestScore) {
      bestScore = score;
      best = { code: candidate.code, name: candidate.name, source: "guess" };
    }
  }
  return best;
}

/** Read a language field if a future Meta response includes one. */
export function languageFromMeta(data: Record<string, unknown>): DetectedLanguage | null {
  const raw =
    data.language ?? data.detectedLanguage ?? data.detected_language;
  if (typeof raw === "string" && raw.trim()) {
    return { code: raw.trim(), name: raw.trim(), source: "meta" };
  }
  return null;
}
