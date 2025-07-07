// Simple phoneme-to-viseme converter without requiring Gentle
// Uses basic English phonetic rules for word-to-viseme mapping

export interface VisemeEvent {
  viseme: number;
  start: number;
  end: number;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export class PhonemeConverter {
  // Enhanced phoneme-to-viseme mapping
  private static readonly PHONEME_TO_VISEME: { [key: string]: number } = {
    // Silence
    'sil': 0, 'sp': 0, '': 0,
    
    // Vowels (mouth open shapes)
    'a': 1, 'aa': 1, 'ae': 1, 'ah': 1, 'ao': 1, 'aw': 1, 'ay': 1,
    'e': 2, 'eh': 2, 'er': 2, 'ey': 2,
    'i': 3, 'ih': 3, 'iy': 3,
    'o': 4, 'ow': 4, 'oy': 4,
    'u': 5, 'uh': 5, 'uw': 5,
    
    // Bilabial consonants (lips together)
    'b': 6, 'p': 6, 'm': 6,
    
    // Labiodental consonants (lip-teeth contact)
    'f': 7, 'v': 7,
    
    // Dental consonants (tongue-teeth)
    'th': 8, 'dh': 8,
    
    // Alveolar consonants (tongue-alveolar ridge)
    't': 9, 'd': 9, 'n': 9, 'l': 9,
    
    // Velar consonants (tongue-soft palate)
    'k': 10, 'g': 10, 'ng': 10,
    
    // Postalveolar consonants (tongue behind alveolar ridge)
    'ch': 11, 'jh': 11, 'sh': 11, 'zh': 11,
    
    // Rhotic consonants (r-sounds)
    'r': 12,
    
    // Sibilant consonants (s-sounds)
    's': 13, 'z': 13,
    
    // Approximants (w, y sounds)
    'w': 14, 'y': 14,
    
    // Glottal consonants (h-sounds)
    'h': 15
  };

  // Convert phoneme to viseme number
  static phonemeToViseme(phoneme: string): number {
    return this.PHONEME_TO_VISEME[phoneme.toLowerCase()] || 0;
  }

  // Basic word-to-phoneme conversion using English phonetic rules
  static wordToPhonemes(word: string): string[] {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    const phonemes: string[] = [];
    
    for (let i = 0; i < cleanWord.length; i++) {
      const char = cleanWord[i];
      const nextChar = cleanWord[i + 1];
      
      // Handle digraphs and special combinations
      if (char === 't' && nextChar === 'h') {
        phonemes.push('th');
        i++; // Skip next character
      } else if (char === 's' && nextChar === 'h') {
        phonemes.push('sh');
        i++; // Skip next character
      } else if (char === 'c' && nextChar === 'h') {
        phonemes.push('ch');
        i++; // Skip next character
      } else if (char === 'n' && nextChar === 'g') {
        phonemes.push('ng');
        i++; // Skip next character
      } else if ('aeiou'.includes(char)) {
        // Vowel mapping
        switch (char) {
          case 'a': phonemes.push('ae'); break;
          case 'e': phonemes.push('eh'); break;
          case 'i': phonemes.push('ih'); break;
          case 'o': phonemes.push('ao'); break;
          case 'u': phonemes.push('uh'); break;
        }
      } else {
        // Consonant mapping
        switch (char) {
          case 'b': phonemes.push('b'); break;
          case 'c': phonemes.push('k'); break;
          case 'd': phonemes.push('d'); break;
          case 'f': phonemes.push('f'); break;
          case 'g': phonemes.push('g'); break;
          case 'h': phonemes.push('h'); break;
          case 'j': phonemes.push('jh'); break;
          case 'k': phonemes.push('k'); break;
          case 'l': phonemes.push('l'); break;
          case 'm': phonemes.push('m'); break;
          case 'n': phonemes.push('n'); break;
          case 'p': phonemes.push('p'); break;
          case 'q': phonemes.push('k'); break;
          case 'r': phonemes.push('r'); break;
          case 's': phonemes.push('s'); break;
          case 't': phonemes.push('t'); break;
          case 'v': phonemes.push('v'); break;
          case 'w': phonemes.push('w'); break;
          case 'x': phonemes.push('k'); phonemes.push('s'); break;
          case 'y': phonemes.push('y'); break;
          case 'z': phonemes.push('z'); break;
        }
      }
    }
    
    return phonemes;
  }

  // Convert word timings to viseme events
  static convertWordsToVisemes(wordTimings: WordTiming[]): VisemeEvent[] {
    const visemes: VisemeEvent[] = [];
    
    for (const wordTiming of wordTimings) {
      const phonemes = this.wordToPhonemes(wordTiming.word);
      const wordDuration = wordTiming.end - wordTiming.start;
      const phonemeDuration = wordDuration / phonemes.length;
      
      phonemes.forEach((phoneme, index) => {
        const viseme = this.phonemeToViseme(phoneme);
        const start = wordTiming.start + (index * phonemeDuration);
        const end = start + phonemeDuration;
        
        visemes.push({
          viseme,
          start,
          end
        });
      });
    }
    
    return visemes;
  }

  // Generate viseme events from raw text and audio duration
  static generateVisemeTimeline(text: string, audioDuration: number): VisemeEvent[] {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const avgWordDuration = audioDuration / words.length;
    
    const wordTimings: WordTiming[] = words.map((word, index) => ({
      word,
      start: index * avgWordDuration,
      end: (index + 1) * avgWordDuration
    }));
    
    return this.convertWordsToVisemes(wordTimings);
  }
}

export const phonemeConverter = new PhonemeConverter();