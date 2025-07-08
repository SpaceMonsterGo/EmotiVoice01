// ElevenLabs forced alignment using TTS WebSocket with character-level timing data
import WebSocket from 'ws';

export interface ElevenLabsAlignment {
  chars: string[];
  charStartTimesMs: number[];
  charDurationsMs: number[];
}

export interface ElevenLabsAlignmentResult {
  audio: Buffer;
  alignment: ElevenLabsAlignment;
  normalizedAlignment: ElevenLabsAlignment;
}

export interface VisemeTimestamp {
  viseme: number;
  start: number;
  end: number;
  char: string;
}

export class ElevenLabsAligner {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Get precise character-level alignment using ElevenLabs TTS WebSocket
  async getAlignmentData(text: string, voiceId: string): Promise<ElevenLabsAlignmentResult | null> {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2&enable_ssml_parsing=true`;
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      let audioChunks: Buffer[] = [];
      let alignmentData: ElevenLabsAlignment | null = null;
      let normalizedAlignment: ElevenLabsAlignment | null = null;

      ws.on('open', () => {
        console.log('ElevenLabs TTS WebSocket connected for alignment');
        
        // Send text for alignment
        ws.send(JSON.stringify({
          text: text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 250]
          },
          enable_ssml_parsing: true,
          enable_chunk_alignment: true // Enable alignment data for each chunk
        }));

        // Signal end of input
        ws.send(JSON.stringify({
          text: ""
        }));
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.audio) {
            // Collect audio chunks
            const audioBuffer = Buffer.from(response.audio, 'base64');
            audioChunks.push(audioBuffer);
          }

          if (response.alignment) {
            // Store alignment data
            alignmentData = response.alignment;
          }

          if (response.normalizedAlignment) {
            // Store normalized alignment data
            normalizedAlignment = response.normalizedAlignment;
          }

          if (response.isFinal) {
            // All data received, combine and return
            const fullAudio = Buffer.concat(audioChunks);
            
            if (alignmentData && normalizedAlignment) {
              resolve({
                audio: fullAudio,
                alignment: alignmentData,
                normalizedAlignment: normalizedAlignment
              });
            } else {
              reject(new Error('No alignment data received'));
            }
            
            ws.close();
          }
        } catch (error) {
          console.error('Error parsing ElevenLabs alignment response:', error);
          reject(error);
        }
      });

      ws.on('error', (error) => {
        console.error('ElevenLabs alignment WebSocket error:', error);
        reject(error);
      });

      ws.on('close', () => {
        console.log('ElevenLabs alignment WebSocket closed');
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          reject(new Error('ElevenLabs alignment timeout'));
        }
      }, 30000);
    });
  }

  // Convert character-level alignment to viseme timestamps with phoneme-based grouping
  convertAlignmentToVisemes(alignment: ElevenLabsAlignment): VisemeTimestamp[] {
    const visemes: VisemeTimestamp[] = [];
    
    // Group characters into phoneme-like units
    const phonemeGroups = this.groupCharactersIntoPhonemes(alignment);
    
    for (const group of phonemeGroups) {
      // Use the dominant viseme for the group
      const dominantViseme = this.getDominantViseme(group.chars);
      
      visemes.push({
        viseme: dominantViseme,
        start: group.startTime,
        end: group.endTime,
        char: group.chars.join('')
      });
    }
    
    // Apply smoothing to reduce rapid changes
    return this.smoothVisemeSequence(visemes);
  }

  // Group characters into phoneme-like units for more natural timing
  private groupCharactersIntoPhonemes(alignment: ElevenLabsAlignment): Array<{
    chars: string[];
    startTime: number;
    endTime: number;
  }> {
    const groups: Array<{
      chars: string[];
      startTime: number;
      endTime: number;
    }> = [];
    
    let currentGroup: string[] = [];
    let groupStartTime = 0;
    let groupEndTime = 0;
    
    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i];
      const startTime = alignment.charStartTimesMs[i];
      const duration = alignment.charDurationsMs[i];
      const endTime = startTime + duration;
      
      // Skip whitespace and punctuation
      if (char === ' ' || char === '\n' || char === '\t' || /[.,!?;:]/.test(char)) {
        // Finish current group if it exists
        if (currentGroup.length > 0) {
          groups.push({
            chars: currentGroup,
            startTime: groupStartTime,
            endTime: groupEndTime
          });
          currentGroup = [];
        }
        continue;
      }
      
      // Start new group or continue current one
      if (currentGroup.length === 0) {
        groupStartTime = startTime;
      }
      
      currentGroup.push(char);
      groupEndTime = endTime;
      
      // Break groups at vowel boundaries or after consonant clusters
      const isVowel = /[aeiouAEIOU]/.test(char);
      const nextChar = i + 1 < alignment.chars.length ? alignment.chars[i + 1] : '';
      const nextIsVowel = /[aeiouAEIOU]/.test(nextChar);
      
      // End group after vowel + consonant, or after consonant cluster
      const shouldEndGroup = currentGroup.length >= 2 && (
        (isVowel && nextChar && !nextIsVowel) || // Vowel followed by consonant
        (currentGroup.length >= 3) || // Limit group size
        (nextChar === '' || nextChar === ' ') // End of word
      );
      
      if (shouldEndGroup) {
        groups.push({
          chars: currentGroup,
          startTime: groupStartTime,
          endTime: groupEndTime
        });
        currentGroup = [];
      }
    }
    
    // Add final group if exists
    if (currentGroup.length > 0) {
      groups.push({
        chars: currentGroup,
        startTime: groupStartTime,
        endTime: groupEndTime
      });
    }
    
    return groups;
  }

  // Get the dominant viseme for a group of characters
  private getDominantViseme(chars: string[]): number {
    const visemeCounts: Record<number, number> = {};
    
    // Count visemes for each character
    for (const char of chars) {
      const viseme = this.charToViseme(char.toLowerCase());
      visemeCounts[viseme] = (visemeCounts[viseme] || 0) + 1;
    }
    
    // Find the most frequent viseme (excluding neutral)
    let dominantViseme = 0;
    let maxCount = 0;
    
    for (const [viseme, count] of Object.entries(visemeCounts)) {
      const visemeNum = parseInt(viseme);
      if (visemeNum !== 0 && count > maxCount) {
        maxCount = count;
        dominantViseme = visemeNum;
      }
    }
    
    return dominantViseme;
  }

  // Apply smoothing to reduce rapid viseme changes
  private smoothVisemeSequence(visemes: VisemeTimestamp[]): VisemeTimestamp[] {
    if (visemes.length <= 1) return visemes;
    
    const smoothed: VisemeTimestamp[] = [];
    const minDuration = 100; // Minimum 100ms per viseme
    
    for (let i = 0; i < visemes.length; i++) {
      const current = visemes[i];
      const duration = current.end - current.start;
      
      // Skip very short visemes or merge with previous
      if (duration < minDuration && smoothed.length > 0) {
        // Extend previous viseme
        const previous = smoothed[smoothed.length - 1];
        previous.end = current.end;
        previous.char += current.char;
        continue;
      }
      
      // Skip consecutive identical visemes
      if (smoothed.length > 0 && smoothed[smoothed.length - 1].viseme === current.viseme) {
        // Extend previous viseme
        const previous = smoothed[smoothed.length - 1];
        previous.end = current.end;
        previous.char += current.char;
        continue;
      }
      
      smoothed.push({
        viseme: current.viseme,
        start: current.start,
        end: current.end,
        char: current.char
      });
    }
    
    return smoothed;
  }

  // Convert character to viseme using Rive specification  
  // Based on standard viseme mapping: 0=Neutral, 1-9=Different mouth shapes
  private charToViseme(char: string): number {
    const charToVisemeMap: { [key: string]: number } = {
      // Vowels - distinct mouth shapes
      'a': 1, // Open mouth (A sound)
      'e': 2, // Medium open (E sound)  
      'i': 3, // Narrow opening (I sound)
      'o': 4, // Rounded lips (O sound)
      'u': 5, // Very rounded (U sound)
      'y': 3, // Similar to I
      
      // Consonants - lip/tongue positions
      'f': 6, 'v': 6, // Lip-teeth contact
      'b': 7, 'p': 7, 'm': 7, // Lip closure
      'w': 5, // Lip rounding (like U)
      
      // Dental/alveolar sounds
      't': 8, 'd': 8, 'n': 8, 's': 8, 'z': 8,
      'th': 8, // Tongue-teeth
      
      // Postalveolar sounds  
      'c': 9, 'ch': 9, 'sh': 9, 'j': 9, 'g': 9, 'k': 9,
      
      // Lateral/rhotic
      'l': 2, 'r': 2, // Tongue movement
      
      // Other consonants
      'h': 1, // Slight opening
      'x': 8, 'q': 9,
      
      // Punctuation and whitespace - neutral
      ' ': 0, '.': 0, ',': 0, '!': 0, '?': 0, ':': 0, ';': 0,
      '\n': 0, '\t': 0,
      
      // Numbers - map to vowel-like shapes
      '0': 4, '1': 1, '2': 2, '3': 3, '4': 1, '5': 2,
      '6': 3, '7': 2, '8': 4, '9': 4
    };
    
    return charToVisemeMap[char] || 1; // Default to slight opening instead of neutral
  }

  // Get available voices for alignment
  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error getting ElevenLabs voices:', error);
      return [];
    }
  }
}

// Initialize with environment variable
export const elevenLabsAligner = new ElevenLabsAligner(process.env.ELEVENLABS_API_KEY || '');