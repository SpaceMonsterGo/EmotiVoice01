// src/services/visemeService.ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface VisemeEvent {
  time: number;   // in ms
  viseme: string; // one of: Neutral, F, M, O, U, E, AI, CH, S, L
  value: number;  // intensity
}

export class VisemeService {
  private speechConfig: sdk.SpeechConfig;

  constructor() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      import.meta.env.VITE_AZURE_SPEECH_KEY,
      import.meta.env.VITE_AZURE_SPEECH_REGION
    );
    // we only need viseme data
    this.speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm;
  }

  async generateVisemes(text: string): Promise<VisemeEvent[]> {
    return new Promise((resolve, reject) => {
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      const visemeEvents: VisemeEvent[] = [];

      synthesizer.visemeReceived = (_s, e) => {
        visemeEvents.push({
          time: e.audioOffset / 10000,           // 100-ns to ms
          viseme: this.mapAzureVisemeToRive(e.visemeId),
          value: 100
        });
      };

      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="en-US-AriaNeural">${text}</voice>
        </speak>`;

      synthesizer.speakSsmlAsync(
        ssml,
        () => { synthesizer.close(); resolve(visemeEvents); },
        (err) => { synthesizer.close(); reject(err); }
      );
    });
  }

  private mapAzureVisemeToRive(id: number): string {
    const map: Record<number,string> = {
      0: 'Neutral',
      1: 'F',
      2: 'M',
      3: 'O',
      4: 'U',
      5: 'E',
      6: 'AI',
      7: 'CH',
      8: 'S',
      9: 'L'
    };
    return map[id] || 'Neutral';
  }
}
