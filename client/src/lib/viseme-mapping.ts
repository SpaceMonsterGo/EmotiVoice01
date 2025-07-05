// Phoneme to viseme mapping for lip sync animation
// Based on standard phoneme-to-viseme mappings

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

// Phoneme to viseme mapping (using numbers 0-9 for your Rive character)
const PHONEME_TO_VISEME: Record<string, number> = {
  // Silence/rest
  'sil': 0,
  'sp': 0,
  
  // Vowels
  'AA': 1, 'AE': 1, 'AH': 1, 'AO': 1, 'AW': 1, 'AY': 1,
  'EH': 2, 'ER': 2, 'EY': 2,
  'IH': 3, 'IY': 3,
  'OW': 4, 'OY': 4,
  'UH': 5, 'UW': 5,
  
  // Consonants
  'B': 6, 'M': 6, 'P': 6, // Bilabial sounds
  'F': 7, 'V': 7, // Labiodental sounds
  'TH': 8, 'DH': 8, // Dental sounds
  'T': 9, 'D': 9, 'S': 9, 'Z': 9, 'N': 9, 'L': 9, 'R': 9, // Alveolar sounds
  'CH': 9, 'JH': 9, 'SH': 9, 'ZH': 9, 'Y': 9, // Postalveolar sounds
  'K': 1, 'G': 1, 'NG': 1, 'W': 1, 'HH': 1, // Back consonants
};

// Simple phoneme dictionary for common English words
const WORD_TO_PHONEMES: Record<string, string[]> = {
  'hello': ['HH', 'AH', 'L', 'OW'],
  'hi': ['HH', 'AY'],
  'how': ['HH', 'AW'],
  'are': ['AA', 'R'],
  'you': ['Y', 'UW'],
  'doing': ['D', 'UW', 'IH', 'NG'],
  'today': ['T', 'AH', 'D', 'EY'],
  'good': ['G', 'UH', 'D'],
  'morning': ['M', 'AO', 'R', 'N', 'IH', 'NG'],
  'afternoon': ['AE', 'F', 'T', 'ER', 'N', 'UW', 'N'],
  'evening': ['IY', 'V', 'N', 'IH', 'NG'],
  'night': ['N', 'AY', 'T'],
  'thanks': ['TH', 'AE', 'NG', 'K', 'S'],
  'thank': ['TH', 'AE', 'NG', 'K'],
  'yes': ['Y', 'EH', 'S'],
  'no': ['N', 'OW'],
  'okay': ['OW', 'K', 'EY'],
  'sure': ['SH', 'UH', 'R'],
  'please': ['P', 'L', 'IY', 'Z'],
  'sorry': ['S', 'AO', 'R', 'IY'],
  'help': ['HH', 'EH', 'L', 'P'],
  'what': ['W', 'AH', 'T'],
  'where': ['W', 'EH', 'R'],
  'when': ['W', 'EH', 'N'],
  'why': ['W', 'AY'],
  'who': ['HH', 'UW'],
  'can': ['K', 'AE', 'N'],
  'will': ['W', 'IH', 'L'],
  'would': ['W', 'UH', 'D'],
  'should': ['SH', 'UH', 'D'],
  'could': ['K', 'UH', 'D'],
  'the': ['DH', 'AH'],
  'and': ['AE', 'N', 'D'],
  'but': ['B', 'AH', 'T'],
  'or': ['AO', 'R'],
  'if': ['IH', 'F'],
  'it': ['IH', 'T'],
  'is': ['IH', 'Z'],
  'was': ['W', 'AH', 'Z'],
  'be': ['B', 'IY'],
  'have': ['HH', 'AE', 'V'],
  'has': ['HH', 'AE', 'Z'],
  'do': ['D', 'UW'],
  'does': ['D', 'AH', 'Z'],
  'did': ['D', 'IH', 'D'],
  'get': ['G', 'EH', 'T'],
  'go': ['G', 'OW'],
  'come': ['K', 'AH', 'M'],
  'see': ['S', 'IY'],
  'know': ['N', 'OW'],
  'think': ['TH', 'IH', 'NG', 'K'],
  'want': ['W', 'AO', 'N', 'T'],
  'need': ['N', 'IY', 'D'],
  'like': ['L', 'AY', 'K'],
  'love': ['L', 'AH', 'V'],
  'make': ['M', 'EY', 'K'],
  'take': ['T', 'EY', 'K'],
  'give': ['G', 'IH', 'V'],
  'put': ['P', 'UH', 'T'],
  'say': ['S', 'EY'],
  'tell': ['T', 'EH', 'L'],
  'ask': ['AE', 'S', 'K'],
  'work': ['W', 'ER', 'K'],
  'play': ['P', 'L', 'EY'],
  'look': ['L', 'UH', 'K'],
  'feel': ['F', 'IY', 'L'],
  'seem': ['S', 'IY', 'M'],
  'find': ['F', 'AY', 'N', 'D'],
  'call': ['K', 'AO', 'L'],
  'try': ['T', 'R', 'AY'],
  'use': ['Y', 'UW', 'Z'],
  'turn': ['T', 'ER', 'N'],
  'move': ['M', 'UW', 'V'],
  'live': ['L', 'IH', 'V'],
  'show': ['SH', 'OW'],
  'hear': ['HH', 'IH', 'R'],
  'talk': ['T', 'AO', 'K'],
  'speak': ['S', 'P', 'IY', 'K'],
  'read': ['R', 'IY', 'D'],
  'write': ['R', 'AY', 'T'],
  'learn': ['L', 'ER', 'N'],
  'study': ['S', 'T', 'AH', 'D', 'IY'],
  'understand': ['AH', 'N', 'D', 'ER', 'S', 'T', 'AE', 'N', 'D'],
  'remember': ['R', 'IH', 'M', 'EH', 'M', 'B', 'ER'],
  'forget': ['F', 'ER', 'G', 'EH', 'T'],
};

// Fallback phoneme generation for unknown words
function generatePhonemes(word: string): string[] {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  
  if (WORD_TO_PHONEMES[cleanWord]) {
    return WORD_TO_PHONEMES[cleanWord];
  }
  
  // Very basic fallback: map common letter patterns to phonemes
  const phonemes: string[] = [];
  const chars = cleanWord.split('');
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];
    
    switch (char) {
      case 'a': phonemes.push('AH'); break;
      case 'e': phonemes.push('EH'); break;
      case 'i': phonemes.push('IH'); break;
      case 'o': phonemes.push('OW'); break;
      case 'u': phonemes.push('UH'); break;
      case 'b': phonemes.push('B'); break;
      case 'c': phonemes.push('K'); break;
      case 'd': phonemes.push('D'); break;
      case 'f': phonemes.push('F'); break;
      case 'g': phonemes.push('G'); break;
      case 'h': phonemes.push('HH'); break;
      case 'j': phonemes.push('JH'); break;
      case 'k': phonemes.push('K'); break;
      case 'l': phonemes.push('L'); break;
      case 'm': phonemes.push('M'); break;
      case 'n': phonemes.push('N'); break;
      case 'p': phonemes.push('P'); break;
      case 'q': phonemes.push('K'); break;
      case 'r': phonemes.push('R'); break;
      case 's': phonemes.push('S'); break;
      case 't': phonemes.push('T'); break;
      case 'v': phonemes.push('V'); break;
      case 'w': phonemes.push('W'); break;
      case 'x': phonemes.push('K'); phonemes.push('S'); break;
      case 'y': phonemes.push('Y'); break;
      case 'z': phonemes.push('Z'); break;
      default: break;
    }
  }
  
  return phonemes.length > 0 ? phonemes : ['AH']; // Fallback to neutral vowel
}

export function convertTimestampsToVisemes(timestamps: TimestampData[]): VisemeEvent[] {
  const visemeEvents: VisemeEvent[] = [];
  
  // Group timestamps by words
  const words = timestamps.filter(t => t.word);
  
  for (const wordTimestamp of words) {
    const phonemes = generatePhonemes(wordTimestamp.word || '');
    const wordDuration = wordTimestamp.end - wordTimestamp.start;
    const phonemeDuration = wordDuration / phonemes.length;
    
    // Create viseme events for each phoneme
    phonemes.forEach((phoneme, index) => {
      const visemeIndex = PHONEME_TO_VISEME[phoneme] || 0;
      const start = wordTimestamp.start + (index * phonemeDuration);
      const end = start + phonemeDuration;
      
      visemeEvents.push({
        viseme: visemeIndex,
        start,
        end
      });
    });
  }
  
  return visemeEvents.sort((a, b) => a.start - b.start);
}

export function playVisemeSequence(
  visemeEvents: VisemeEvent[],
  onVisemeChange: (viseme: number) => void,
  audioStartTime: number = Date.now()
): () => void {
  const timeouts: NodeJS.Timeout[] = [];
  
  visemeEvents.forEach(event => {
    const delay = (event.start * 1000) - (Date.now() - audioStartTime);
    
    if (delay > 0) {
      const timeout = setTimeout(() => {
        onVisemeChange(event.viseme);
      }, delay);
      timeouts.push(timeout);
    }
  });
  
  // Return cleanup function
  return () => {
    timeouts.forEach(timeout => clearTimeout(timeout));
  };
}