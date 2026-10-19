// Robust profanity filter for titles, authors, and text in the music library

// Base roots for Russian profanity (Мат)
const RUSSIAN_MAT_ROOTS = [
  'хуй', 'хуе', 'хуя', 'хую', 'хуи', 'хуем', 'хуев', 'охуе', 'похуй', 'нахуй', 'нихуя',
  'пизд', 'пезд', 'пизда', 'пиздец', 'распизд', 'опизд',
  'ебат', 'ебет', 'ебут', 'ебан', 'ебал', 'ебли', 'ебло', 'выеб', 'заеб', 'перееб', 'подъеб',
  'бля', 'бляд', 'блядь', 'бляди', 'блядск', 'сука', 'сучки', 'сучь',
  'мудак', 'мудил', 'пидор', 'пидар', 'пидорас', 'гондон', 'гандон', 'залуп', 'дроч',
  'шлюх', 'шалав', 'манда', 'елда', 'говн', 'дерьм'
];

// Base roots for English profanity
const ENGLISH_BAD_WORDS = [
  'fuck', 'fucker', 'fucking', 'motherfucker',
  'shit', 'bullshit',
  'bitch', 'bitches',
  'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'whore', 'slut', 'porn', 'xxx'
];

// Mapping for leetspeak and substituted characters
const LEET_REPLACEMENTS: Record<string, string> = {
  '@': 'а', 'a': 'а', '0': 'о', 'o': 'о', '3': 'з', 'e': 'е', '1': 'и', 'i': 'и',
  'y': 'у', 'u': 'у', 'x': 'х', 'c': 'с', 'p': 'р', 'k': 'к', 't': 'т', 'b': 'б',
  '*': '', '$': 'с', '#': '', '!': 'и'
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [char, replacement] of Object.entries(LEET_REPLACEMENTS)) {
    normalized = normalized.split(char).join(replacement);
  }
  // Remove non-alphanumeric except space
  return normalized.replace(/[^a-zа-яё0-9\s]/gi, '');
}

export interface ProfanityCheckResult {
  hasProfanity: boolean;
  detectedWord?: string;
  reason?: string;
}

export function checkTextProfanity(text: string): ProfanityCheckResult {
  if (!text || typeof text !== 'string') return { hasProfanity: false };

  const rawLower = text.toLowerCase();
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(Boolean);

  // Check English exact / root match
  for (const bad of ENGLISH_BAD_WORDS) {
    const regex = new RegExp(`\\b${bad}\\b`, 'i');
    if (regex.test(rawLower) || regex.test(normalized)) {
      return {
        hasProfanity: true,
        detectedWord: bad,
        reason: `Обнаружена ненормативная лексика ("${bad}"). В общей библиотеке запрещены мат и оскорбления.`
      };
    }
  }

  // Check Russian roots
  for (const root of RUSSIAN_MAT_ROOTS) {
    // Check if any word contains or starts with the root
    for (const w of words) {
      if (w.includes(root)) {
        return {
          hasProfanity: true,
          detectedWord: root,
          reason: `Название или имя содержит нецензурное выражение (корень "${root}"). Для публикации в общую библиотеку используйте корректные формулировки.`
        };
      }
    }
    // Also check raw string without spaces (e.g. "н_а_х_у_й" condensed)
    const collapsed = normalized.replace(/\s+/g, '');
    if (collapsed.includes(root)) {
      return {
        hasProfanity: true,
        detectedWord: root,
        reason: `Название содержит недопустимое нецензурное слово. Пожалуйста, измените его перед публикацией.`
      };
    }
  }

  return { hasProfanity: false };
}

export function censorProfanity(text: string): string {
  if (!text) return '';
  let result = text;
  for (const bad of [...RUSSIAN_MAT_ROOTS, ...ENGLISH_BAD_WORDS]) {
    const regex = new RegExp(`(${bad}[а-яa-z]*)`, 'gi');
    result = result.replace(regex, (match) => match[0] + '*'.repeat(Math.max(1, match.length - 1)));
  }
  return result;
}
