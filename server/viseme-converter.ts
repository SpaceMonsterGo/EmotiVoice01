// Server-side viseme conversion (simplified version of client-side lib)

export interface VisemeEvent {
  viseme: number;
  start: number;
  end: number;
}

export interface TimestampData {
  char: string;
  start: number;
  end: number;
  word?: string;
}

// Phoneme to viseme mapping for basic conversion
const PHONEME_TO_VISEME: { [key: string]: number } = {
  // Vowels
  'A': 1, 'AH': 1, 'AA': 1,
  'E': 2, 'EH': 2, 'AE': 2,
  'I': 3, 'IH': 3, 'IY': 3,
  'O': 4, 'OH': 4, 'AO': 4, 'OW': 4,
  'U': 5, 'UH': 5, 'UW': 5,
  
  // Consonants
  'M': 6, 'B': 6, 'P': 6,
  'F': 7, 'V': 7,
  'TH': 8, 'DH': 8,
  'T': 9, 'D': 9, 'S': 9, 'Z': 9, 'L': 9, 'N': 9,
  
  // Default
  'SIL': 0, ' ': 0
};

function charToViseme(char: string): number {
  const upperChar = char.toUpperCase();
  
  // Direct character mapping
  if (PHONEME_TO_VISEME[upperChar]) {
    return PHONEME_TO_VISEME[upperChar];
  }
  
  // Vowel approximations
  if ('AEIOU'.includes(upperChar)) {
    switch (upperChar) {
      case 'A': return 1;
      case 'E': return 2;
      case 'I': return 3;
      case 'O': return 4;
      case 'U': return 5;
    }
  }
  
  // Consonant approximations
  if ('MBPLR'.includes(upperChar)) return 6; // Lip sounds
  if ('FV'.includes(upperChar)) return 7; // Lip-teeth
  if ('TDSZNLR'.includes(upperChar)) return 9; // Tongue-teeth
  
  // Silence for punctuation and spaces
  if (/[\s.,!?;:]/.test(char)) return 0;
  
  // Default to slight opening for other sounds
  return 1;
}

export function convertTimestampsToVisemes(timestamps: TimestampData[]): VisemeEvent[] {
  if (!timestamps || timestamps.length === 0) {
    return [];
  }
  
  const visemes: VisemeEvent[] = [];
  
  for (const timestamp of timestamps) {
    const viseme = charToViseme(timestamp.char);
    
    visemes.push({
      viseme,
      start: timestamp.start,
      end: timestamp.end
    });
  }
  
  return visemes;
}