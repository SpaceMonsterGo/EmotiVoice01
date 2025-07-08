import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

export interface GentleWord {
  word: string;
  start: number;
  end: number;
  phones?: Array<{
    phone: string;
    start: number;
    end: number;
  }>;
}

export interface GentleAlignment {
  words: GentleWord[];
  transcript: string;
}

export class GentleAligner {
  private gentleUrl: string;
  private tempDir: string;

  constructor(gentleUrl = 'http://localhost:8765', tempDir = '/tmp') {
    this.gentleUrl = gentleUrl;
    this.tempDir = tempDir;
  }

  async alignText(audioBuffer: Buffer, text: string): Promise<GentleAlignment> {
    const tempId = Date.now().toString();
    const audioPath = path.join(this.tempDir, `audio_${tempId}.wav`);
    const textPath = path.join(this.tempDir, `text_${tempId}.txt`);

    try {
      // Write temporary files
      await writeFile(audioPath, audioBuffer);
      await writeFile(textPath, text);

      // Call Gentle alignment service
      const result = await this.callGentleService(audioPath, textPath);
      
      // Clean up temporary files
      await unlink(audioPath);
      await unlink(textPath);

      return result;
    } catch (error) {
      // Clean up on error
      try {
        await unlink(audioPath);
        await unlink(textPath);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary files:', cleanupError);
      }
      throw error;
    }
  }

  private async callGentleService(audioPath: string, textPath: string): Promise<GentleAlignment> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      
      // Read files and create form data
      const audioStream = fs.createReadStream(audioPath);
      const textContent = fs.readFileSync(textPath, 'utf8');
      
      formData.append('audio', audioStream);
      formData.append('transcript', textContent);

      fetch(`${this.gentleUrl}/transcriptions?async=false`, {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Gentle service error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Parse Gentle response format
        const alignment: GentleAlignment = {
          words: data.words || [],
          transcript: data.transcript || ''
        };
        
        resolve(alignment);
      })
      .catch(error => {
        reject(new Error(`Gentle alignment failed: ${error.message}`));
      });
    });
  }

  // Phoneme to viseme mapping
  static phonemeToViseme(phoneme: string): number {
    const mapping: { [key: string]: number } = {
      // Silence
      'sil': 0,
      'sp': 0,
      
      // Vowels
      'aa': 1, 'ae': 1, 'ah': 1, 'ao': 1, 'aw': 1, 'ay': 1,
      'eh': 2, 'er': 2, 'ey': 2,
      'ih': 3, 'iy': 3,
      'ow': 4, 'oy': 4,
      'uh': 5, 'uw': 5,
      
      // Consonants
      'b': 6, 'p': 6, 'm': 6,
      'f': 7, 'v': 7,
      'th': 8, 'dh': 8,
      't': 9, 'd': 9, 'n': 9, 'l': 9,
      'k': 10, 'g': 10, 'ng': 10,
      'ch': 11, 'jh': 11, 'sh': 11, 'zh': 11,
      'r': 12,
      's': 13, 'z': 13,
      'w': 14, 'y': 14,
      'h': 15
    };
    
    return mapping[phoneme.toLowerCase()] || 0;
  }

  // Convert Gentle alignment to viseme timings
  static alignmentToVisemes(alignment: GentleAlignment): Array<{viseme: number; start: number; end: number}> {
    const visemes: Array<{viseme: number; start: number; end: number}> = [];
    
    alignment.words.forEach(word => {
      if (word.phones) {
        word.phones.forEach(phone => {
          const viseme = GentleAligner.phonemeToViseme(phone.phone);
          visemes.push({
            viseme,
            start: phone.start,
            end: phone.end
          });
        });
      } else {
        // Fallback: use word timing with estimated viseme
        const viseme = GentleAligner.estimateVisemeFromWord(word.word);
        visemes.push({
          viseme,
          start: word.start,
          end: word.end
        });
      }
    });
    
    return visemes;
  }

  // Simple word-to-viseme estimation (fallback)
  private static estimateVisemeFromWord(word: string): number {
    const firstChar = word.toLowerCase().charAt(0);
    
    // Basic mapping based on first character
    if ('aeiou'.includes(firstChar)) return 1;
    if ('bpm'.includes(firstChar)) return 6;
    if ('fv'.includes(firstChar)) return 7;
    if ('td'.includes(firstChar)) return 9;
    if ('kg'.includes(firstChar)) return 10;
    if ('sz'.includes(firstChar)) return 13;
    if ('wy'.includes(firstChar)) return 14;
    
    return 0; // Default to neutral
  }
}

export const gentleAligner = new GentleAligner();