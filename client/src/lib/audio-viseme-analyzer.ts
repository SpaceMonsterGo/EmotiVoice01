// Real-time audio analysis for viseme generation
// This analyzes audio output to generate appropriate mouth shapes

export class AudioVisemeAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animationFrame: number | null = null;
  private onVisemeChange: ((viseme: number) => void) | null = null;
  private isAnalyzing = false;
  private silenceCounter = 0;
  private lastViseme = 0;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async startAnalysis(stream: MediaStream, onVisemeChange: (viseme: number) => void) {
    this.onVisemeChange = onVisemeChange;
    
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Create analyser node
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.7;

    // Connect audio stream to analyser
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);

    this.isAnalyzing = true;
    this.analyze();
  }

  private analyze = () => {
    if (!this.isAnalyzing || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume and frequency distribution
    let sum = 0;
    let lowFreqSum = 0;
    let midFreqSum = 0;
    let highFreqSum = 0;

    const lowBoundary = Math.floor(bufferLength * 0.2);
    const midBoundary = Math.floor(bufferLength * 0.6);

    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
      
      if (i < lowBoundary) {
        lowFreqSum += dataArray[i];
      } else if (i < midBoundary) {
        midFreqSum += dataArray[i];
      } else {
        highFreqSum += dataArray[i];
      }
    }

    const avgVolume = sum / bufferLength;
    const lowFreqAvg = lowFreqSum / lowBoundary;
    const midFreqAvg = midFreqSum / (midBoundary - lowBoundary);
    const highFreqAvg = highFreqSum / (bufferLength - midBoundary);

    // Determine viseme based on frequency analysis
    let viseme = 0;

    if (avgVolume < 10) {
      // Silence
      this.silenceCounter++;
      if (this.silenceCounter > 5) {
        viseme = 0; // Closed mouth
      } else {
        viseme = this.lastViseme; // Keep previous viseme briefly
      }
    } else {
      this.silenceCounter = 0;
      
      // Map frequency patterns to visemes
      if (lowFreqAvg > midFreqAvg * 1.5 && lowFreqAvg > highFreqAvg * 1.5) {
        // Low frequencies dominant - likely vowels like O, U
        viseme = avgVolume > 100 ? 4 : 5;
      } else if (midFreqAvg > lowFreqAvg * 1.2 && midFreqAvg > highFreqAvg * 1.2) {
        // Mid frequencies dominant - likely vowels like A, E
        viseme = avgVolume > 100 ? 1 : 2;
      } else if (highFreqAvg > lowFreqAvg * 1.2 && highFreqAvg > midFreqAvg * 1.2) {
        // High frequencies dominant - likely consonants
        viseme = avgVolume > 100 ? 9 : 8;
      } else {
        // Balanced frequencies - neutral vowels or consonants
        if (avgVolume > 120) {
          viseme = 6; // Bilabial (M, B, P)
        } else if (avgVolume > 80) {
          viseme = 3; // I sounds
        } else {
          viseme = 7; // F, V sounds
        }
      }
    }

    // Smooth transitions
    if (viseme !== this.lastViseme) {
      this.onVisemeChange?.(viseme);
      this.lastViseme = viseme;
    }

    this.animationFrame = requestAnimationFrame(this.analyze);
  };

  stopAnalysis() {
    this.isAnalyzing = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    // Set mouth to closed
    this.onVisemeChange?.(0);
  }

  destroy() {
    this.stopAnalysis();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioVisemeAnalyzer = new AudioVisemeAnalyzer();