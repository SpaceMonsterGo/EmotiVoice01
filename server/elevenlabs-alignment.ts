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

  // Convert character-level alignment to viseme timestamps
  convertAlignmentToVisemes(alignment: ElevenLabsAlignment): VisemeTimestamp[] {
    const visemes: VisemeTimestamp[] = [];
    
    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i];
      const startTime = alignment.charStartTimesMs[i];
      const duration = alignment.charDurationsMs[i];
      const endTime = startTime + duration;
      
      // Skip whitespace
      if (char === ' ' || char === '\n' || char === '\t') {
        continue;
      }
      
      const viseme = this.charToViseme(char.toLowerCase());
      
      visemes.push({
        viseme,
        start: startTime,
        end: endTime,
        char
      });
    }
    
    return visemes;
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