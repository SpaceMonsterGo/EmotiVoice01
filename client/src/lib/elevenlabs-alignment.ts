// Client-side integration for ElevenLabs forced alignment
import { apiRequest } from './queryClient';

export interface VisemeTimestamp {
  viseme: number;
  start: number;
  end: number;
  char: string;
}

export interface AlignmentResponse {
  visemes: VisemeTimestamp[];
  alignment: {
    chars: string[];
    charStartTimesMs: number[];
    charDurationsMs: number[];
  };
  normalizedAlignment: {
    chars: string[];
    charStartTimesMs: number[];
    charDurationsMs: number[];
  };
  audioDuration: number;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  fine_tuning: {
    language: string;
  };
}

// Get precise viseme timing using ElevenLabs forced alignment
export async function getVisemeAlignment(text: string, voiceId: string): Promise<VisemeTimestamp[]> {
  try {
    const response = await fetch('/api/elevenlabs/align', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: AlignmentResponse = await response.json();
    return data.visemes;
  } catch (error) {
    console.error('Error getting viseme alignment:', error);
    throw error;
  }
}

// Get available voices for alignment
export async function getAvailableVoices(): Promise<ElevenLabsVoice[]> {
  try {
    const response = await fetch('/api/elevenlabs/voices');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: { voices: ElevenLabsVoice[] } = await response.json();
    return data.voices;
  } catch (error) {
    console.error('Error getting available voices:', error);
    return [];
  }
}

// Play viseme sequence with precise timing
export function playVisemeSequence(
  visemes: VisemeTimestamp[],
  onVisemeChange: (viseme: number) => void,
  speedMultiplier: number = 1.0
): { stop: () => void } {
  const timeouts: NodeJS.Timeout[] = [];
  let startTime = Date.now();

  visemes.forEach((viseme) => {
    const delay = (viseme.start / speedMultiplier);
    
    const timeout = setTimeout(() => {
      onVisemeChange(viseme.viseme);
      console.log(`Viseme ${viseme.viseme} for char '${viseme.char}' at ${viseme.start}ms`);
    }, delay);
    
    timeouts.push(timeout);
  });

  // Reset to neutral after sequence
  if (visemes.length > 0) {
    const lastViseme = visemes[visemes.length - 1];
    const resetDelay = (lastViseme.end / speedMultiplier) + 100; // Small buffer
    
    const resetTimeout = setTimeout(() => {
      onVisemeChange(0); // Neutral
      console.log('Reset to neutral viseme');
    }, resetDelay);
    
    timeouts.push(resetTimeout);
  }

  return {
    stop: () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      onVisemeChange(0); // Reset to neutral immediately
    }
  };
}