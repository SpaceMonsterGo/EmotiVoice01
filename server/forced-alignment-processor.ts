// Forced alignment processor for generating accurate viseme timestamps
// Collects audio and transcript data for phoneme-level alignment

export interface AlignmentData {
  transcript: string;
  audioBuffer: Buffer;
  timestamp: number;
  type: 'user' | 'agent';
}

export interface PhonemeTimestamp {
  phoneme: string;
  start: number;
  end: number;
  viseme: number;
}

export interface AlignmentResult {
  phonemes: PhonemeTimestamp[];
  words: Array<{
    word: string;
    start: number;
    end: number;
    phonemes: PhonemeTimestamp[];
  }>;
}

export class ForcedAlignmentProcessor {
  private alignmentQueue: AlignmentData[] = [];
  private isProcessing = false;

  // Store audio and transcript data for alignment
  addAlignmentData(data: AlignmentData) {
    this.alignmentQueue.push(data);
    console.log(`Added alignment data: ${data.type} - "${data.transcript.substring(0, 50)}..."`);
  }

  // Process accumulated alignment data
  async processAlignment(): Promise<AlignmentResult | null> {
    if (this.alignmentQueue.length === 0 || this.isProcessing) {
      return null;
    }

    this.isProcessing = true;
    
    try {
      const latestData = this.alignmentQueue[this.alignmentQueue.length - 1];
      
      // For now, return a simple phoneme-to-viseme mapping
      // TODO: Integrate with actual forced alignment service (WhisperX, Gentle, etc.)
      const result = this.generateSimpleAlignment(latestData);
      
      // Clear processed data
      this.alignmentQueue = [];
      
      return result;
    } catch (error) {
      console.error('Forced alignment processing error:', error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  // Generate simple alignment based on text analysis
  private generateSimpleAlignment(data: AlignmentData): AlignmentResult {
    const words = data.transcript.toLowerCase().split(/\s+/);
    const totalDuration = this.estimateAudioDuration(data.audioBuffer);
    const wordDuration = totalDuration / words.length;
    
    const phonemes: PhonemeTimestamp[] = [];
    const wordResults: AlignmentResult['words'] = [];
    
    let currentTime = 0;
    
    words.forEach((word, wordIndex) => {
      const wordStart = currentTime;
      const wordEnd = currentTime + wordDuration;
      
      // Convert word to phonemes using simple rules
      const wordPhonemes = this.wordToPhonemes(word);
      const phonemeDuration = wordDuration / wordPhonemes.length;
      
      const wordPhonemeResults: PhonemeTimestamp[] = [];
      
      wordPhonemes.forEach((phoneme, phonemeIndex) => {
        const phonemeStart = currentTime;
        const phonemeEnd = currentTime + phonemeDuration;
        
        const phonemeResult: PhonemeTimestamp = {
          phoneme,
          start: phonemeStart,
          end: phonemeEnd,
          viseme: this.phonemeToViseme(phoneme)
        };
        
        phonemes.push(phonemeResult);
        wordPhonemeResults.push(phonemeResult);
        
        currentTime += phonemeDuration;
      });
      
      wordResults.push({
        word,
        start: wordStart,
        end: wordEnd,
        phonemes: wordPhonemeResults
      });
    });
    
    return {
      phonemes,
      words: wordResults
    };
  }

  // Estimate audio duration from buffer size
  private estimateAudioDuration(buffer: Buffer): number {
    // Assuming 16kHz, 16-bit mono audio
    const sampleRate = 16000;
    const bytesPerSample = 2;
    const samples = buffer.length / bytesPerSample;
    return samples / sampleRate;
  }

  // Convert word to phonemes using simple English rules
  private wordToPhonemes(word: string): string[] {
    // Simple phoneme mapping - could be enhanced with actual phonetic dictionary
    const phonemeMap: { [key: string]: string[] } = {
      'hello': ['h', 'eh', 'l', 'ow'],
      'how': ['h', 'aw'],
      'are': ['aa', 'r'],
      'you': ['y', 'uw'],
      'i': ['ay'],
      'am': ['ae', 'm'],
      'good': ['g', 'uh', 'd'],
      'fine': ['f', 'ay', 'n'],
      'what': ['w', 'ah', 't'],
      'is': ['ih', 'z'],
      'your': ['y', 'uh', 'r'],
      'name': ['n', 'ey', 'm'],
      'nice': ['n', 'ay', 's'],
      'to': ['t', 'uw'],
      'meet': ['m', 'iy', 't'],
      'the': ['dh', 'ah'],
      'and': ['ae', 'n', 'd'],
      'that': ['dh', 'ae', 't'],
      'this': ['dh', 'ih', 's'],
      'with': ['w', 'ih', 'th'],
      'for': ['f', 'ao', 'r'],
      'can': ['k', 'ae', 'n'],
      'will': ['w', 'ih', 'l'],
      'have': ['h', 'ae', 'v'],
      'be': ['b', 'iy'],
      'do': ['d', 'uw'],
      'go': ['g', 'ow'],
      'see': ['s', 'iy'],
      'get': ['g', 'eh', 't'],
      'make': ['m', 'ey', 'k'],
      'know': ['n', 'ow'],
      'take': ['t', 'ey', 'k'],
      'come': ['k', 'ah', 'm'],
      'give': ['g', 'ih', 'v'],
      'think': ['th', 'ih', 'ng', 'k'],
      'look': ['l', 'uh', 'k'],
      'use': ['y', 'uw', 'z'],
      'work': ['w', 'er', 'k'],
      'time': ['t', 'ay', 'm'],
      'way': ['w', 'ey'],
      'day': ['d', 'ey'],
      'man': ['m', 'ae', 'n'],
      'new': ['n', 'uw'],
      'old': ['ow', 'l', 'd'],
      'great': ['g', 'r', 'ey', 't'],
      'small': ['s', 'm', 'ao', 'l'],
      'big': ['b', 'ih', 'g'],
      'long': ['l', 'ao', 'ng'],
      'little': ['l', 'ih', 't', 'ah', 'l'],
      'right': ['r', 'ay', 't'],
      'left': ['l', 'eh', 'f', 't'],
      'first': ['f', 'er', 's', 't'],
      'last': ['l', 'ae', 's', 't'],
      'next': ['n', 'eh', 'k', 's', 't'],
      'back': ['b', 'ae', 'k'],
      'here': ['h', 'ih', 'r'],
      'there': ['dh', 'eh', 'r'],
      'where': ['w', 'eh', 'r'],
      'when': ['w', 'eh', 'n'],
      'why': ['w', 'ay'],
      'who': ['h', 'uw'],
      'about': ['ah', 'b', 'aw', 't'],
      'over': ['ow', 'v', 'er'],
      'under': ['ah', 'n', 'd', 'er'],
      'through': ['th', 'r', 'uw'],
      'between': ['b', 'ih', 't', 'w', 'iy', 'n'],
      'after': ['ae', 'f', 't', 'er'],
      'before': ['b', 'ih', 'f', 'ao', 'r'],
      'during': ['d', 'uh', 'r', 'ih', 'ng'],
      'without': ['w', 'ih', 'th', 'aw', 't'],
      'within': ['w', 'ih', 'th', 'ih', 'n'],
      'above': ['ah', 'b', 'ah', 'v'],
      'below': ['b', 'ih', 'l', 'ow'],
      'around': ['ah', 'r', 'aw', 'n', 'd'],
      'near': ['n', 'ih', 'r'],
      'far': ['f', 'aa', 'r'],
      'up': ['ah', 'p'],
      'down': ['d', 'aw', 'n'],
      'in': ['ih', 'n'],
      'out': ['aw', 't'],
      'on': ['ao', 'n'],
      'off': ['ao', 'f'],
      'yes': ['y', 'eh', 's'],
      'no': ['n', 'ow'],
      'please': ['p', 'l', 'iy', 'z'],
      'thank': ['th', 'ae', 'ng', 'k'],
      'sorry': ['s', 'ao', 'r', 'iy'],
      'excuse': ['ih', 'k', 's', 'k', 'y', 'uw', 'z'],
      'welcome': ['w', 'eh', 'l', 'k', 'ah', 'm'],
      'goodbye': ['g', 'uh', 'd', 'b', 'ay']
    };
    
    if (phonemeMap[word]) {
      return phonemeMap[word];
    }
    
    // Fallback: simple character-to-phoneme mapping
    return word.split('').map(char => {
      const charMap: { [key: string]: string } = {
        'a': 'ae', 'e': 'eh', 'i': 'ih', 'o': 'ao', 'u': 'ah',
        'b': 'b', 'c': 'k', 'd': 'd', 'f': 'f', 'g': 'g',
        'h': 'h', 'j': 'jh', 'k': 'k', 'l': 'l', 'm': 'm',
        'n': 'n', 'p': 'p', 'q': 'k', 'r': 'r', 's': 's',
        't': 't', 'v': 'v', 'w': 'w', 'x': 'k', 'y': 'y', 'z': 'z'
      };
      return charMap[char] || char;
    });
  }

  // Convert phoneme to viseme using Rive specification
  // 0=Neutral, 1=F, 2=M, 3=O, 4=U, 5=E, 6=AI, 7=CH, 8=S, 9=L
  private phonemeToViseme(phoneme: string): number {
    const phonemeToVisemeMap: { [key: string]: number } = {
      // Silence
      'sil': 0, 'sp': 0, '': 0,
      
      // F sounds (lip-teeth)
      'f': 1, 'v': 1,
      
      // M sounds (lip closure)
      'b': 2, 'p': 2, 'm': 2,
      
      // O sounds (rounded lips)
      'ao': 3, 'ow': 3, 'o': 3,
      
      // U sounds (rounded, high)
      'uw': 4, 'uh': 4, 'u': 4,
      
      // E sounds (mid-front)
      'eh': 5, 'ey': 5, 'e': 5,
      
      // AI sounds (open, front)
      'ae': 6, 'ay': 6, 'aa': 6, 'a': 6, 'ah': 6,
      
      // CH sounds (postalveolar)
      'ch': 7, 'jh': 7, 'sh': 7, 'zh': 7,
      
      // S sounds (sibilant)
      's': 8, 'z': 8, 'th': 8, 'dh': 8,
      
      // L sounds (lateral)
      'l': 9, 'r': 9, 'er': 9,
      
      // Other consonants mapped to closest approximation
      't': 8, 'd': 8, 'n': 8, 'k': 3, 'g': 3, 'ng': 3,
      'w': 4, 'y': 6, 'h': 5, 'ih': 5, 'iy': 5
    };
    
    return phonemeToVisemeMap[phoneme] || 0; // Default to neutral
  }
}

// Singleton instance
export const forcedAlignmentProcessor = new ForcedAlignmentProcessor();