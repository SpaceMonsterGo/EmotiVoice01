import { useState, useCallback, useRef, useEffect } from 'react';

interface VoiceAgentState {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error: string | null;
  voiceActivity: number;
}

export function useSimpleVoiceAgent() {
  const [state, setState] = useState<VoiceAgentState>({
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    isProcessing: false,
    error: null,
    voiceActivity: 0
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visemeCallbackRef = useRef<((viseme: number) => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Voice activity detection
  const setupVoiceActivityDetection = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 256;
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const detectActivity = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const activity = Math.min(average / 128, 1);
      
      setState(prev => ({ ...prev, voiceActivity: activity }));
      
      // Update Rive character
      if (visemeCallbackRef.current) {
        // Simple mouth movement based on voice activity
        if (activity > 0.1) {
          const viseme = Math.floor(Math.random() * 10) + 5; // Random mouth shapes 5-15
          visemeCallbackRef.current(viseme);
        } else {
          visemeCallbackRef.current(0); // Neutral
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(detectActivity);
    };
    
    detectActivity();
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1 
        } 
      });
      
      // Setup voice activity detection
      setupVoiceActivityDetection(stream);
      
      // Setup media recorder
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        await processAudioInput(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        isProcessing: false,
        isConnected: true 
      }));
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to access microphone',
        isProcessing: false 
      }));
    }
  }, [setupVoiceActivityDetection]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    // Stop voice activity detection
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isRecording: false,
      voiceActivity: 0 
    }));
    
    // Reset viseme to neutral
    if (visemeCallbackRef.current) {
      visemeCallbackRef.current(0);
    }
  }, [state.isRecording]);

  // Process audio input
  const processAudioInput = useCallback(async (audioBlob: Blob) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      // Convert blob to form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      // Send to our backend for processing
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to process audio');
      }
      
      const result = await response.json();
      
      // Play response audio and animate visemes
      if (result.audioUrl) {
        console.log('Playing ElevenLabs audio response');
        await playResponseAudio(result.audioUrl, result.visemes || []);
      } else {
        console.log('No audio URL in response:', result);
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to process voice input' 
      }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, []);

  // Play response audio with visemes
  const playResponseAudio = useCallback(async (audioUrl: string, visemes: any[]) => {
    try {
      setState(prev => ({ ...prev, isSpeaking: true }));
      
      const audio = new Audio(audioUrl);
      
      // Generate viseme animation
      audio.onplay = () => {
        if (visemeCallbackRef.current && visemes.length > 0) {
          // Play visemes with timing
          visemes.forEach((viseme, index) => {
            setTimeout(() => {
              if (visemeCallbackRef.current) {
                visemeCallbackRef.current(viseme.viseme || 0);
              }
            }, viseme.start * 1000);
          });
        } else if (visemeCallbackRef.current) {
          // Simple animation if no visemes
          const duration = audio.duration || 2;
          const visemeCount = Math.floor(duration * 8); // 8 visemes per second
          
          for (let i = 0; i < visemeCount; i++) {
            setTimeout(() => {
              if (visemeCallbackRef.current) {
                const viseme = Math.floor(Math.random() * 15) + 1;
                visemeCallbackRef.current(viseme);
              }
            }, (i * duration * 1000) / visemeCount);
          }
        }
      };
      
      audio.onended = () => {
        setState(prev => ({ ...prev, isSpeaking: false }));
        if (visemeCallbackRef.current) {
          visemeCallbackRef.current(0); // Reset to neutral
        }
      };
      
      await audio.play();
      
    } catch (error) {
      console.error('Error playing response audio:', error);
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, []);

  // Set viseme callback
  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallbackRef.current = callback;
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    setVisemeCallback,
    clearError
  };
}