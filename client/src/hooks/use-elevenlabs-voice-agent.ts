import { useState, useCallback, useRef, useEffect } from 'react';

interface VisemeEvent {
  viseme: number;
  start: number;
  end: number;
}

interface VoiceAgentState {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error: string | null;
  voiceActivity: number;
}

export function useElevenLabsVoiceAgent() {
  const [state, setState] = useState<VoiceAgentState>({
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    isProcessing: false,
    error: null,
    voiceActivity: 0
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visemeCallbackRef = useRef<((viseme: number) => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Connect to ElevenLabs Conversational AI WebSocket
  const connectWebSocket = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      // Get signed URL for WebSocket connection
      const signedUrlResponse = await fetch('/api/elevenlabs/signed-url');
      if (!signedUrlResponse.ok) {
        throw new Error('Failed to get signed URL');
      }
      const { signedUrl } = await signedUrlResponse.json();

      const ws = new WebSocket(signedUrl);
      
      ws.addEventListener('open', () => {
        console.log('Connected to ElevenLabs Conversational AI');
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isProcessing: false 
        }));
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed', 
          isConnected: false,
          isProcessing: false 
        }));
      });

      ws.addEventListener('close', () => {
        console.log('WebSocket connection closed');
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isRecording: false,
          isSpeaking: false 
        }));
      });

      websocketRef.current = ws;

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to connect', 
        isProcessing: false 
      }));
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('Received WebSocket message:', data);
    
    // Handle ElevenLabs Agent messages
    if (data.source === 'ai' && data.message) {
      setState(prev => ({ ...prev, isSpeaking: true }));
      
      // Trigger viseme animation based on message content
      if (visemeCallbackRef.current) {
        simulateVisemeAnimation(data.message);
      }
      
      // Auto-stop speaking after a delay
      setTimeout(() => {
        setState(prev => ({ ...prev, isSpeaking: false }));
      }, data.message.length * 50); // Rough estimation
    }
  }, []);

  // Simulate viseme animation for demo purposes
  const simulateVisemeAnimation = useCallback((message: string) => {
    if (!visemeCallbackRef.current) return;
    
    const words = message.split(' ');
    let delay = 0;
    
    words.forEach((word, index) => {
      setTimeout(() => {
        if (visemeCallbackRef.current) {
          // Generate pseudo-random visemes based on word
          const viseme = (word.charCodeAt(0) % 10) + 1;
          visemeCallbackRef.current(viseme);
          
          // Reset to neutral after word
          setTimeout(() => {
            if (visemeCallbackRef.current) {
              visemeCallbackRef.current(0);
            }
          }, 200);
        }
      }, delay);
      
      delay += 300; // 300ms per word
    });
  }, []);

  // Start voice recording
  const startRecording = useCallback(async () => {
    try {
      if (!state.isConnected) {
        await connectWebSocket();
        // Wait a moment for connection to establish
        setTimeout(() => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            startRecording();
          }
        }, 1000);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1 
        } 
      });
      
      // Setup voice activity detection
      setupVoiceActivityDetection(stream);
      
      setState(prev => ({ ...prev, isRecording: true }));
      
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start recording' 
      }));
    }
  }, [state.isConnected, connectWebSocket]);

  // Stop voice recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isRecording: false, 
      voiceActivity: 0 
    }));
  }, []);

  // Setup voice activity detection
  const setupVoiceActivityDetection = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const detectActivity = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const activity = Math.min(average / 128, 1);
      
      setState(prev => ({ ...prev, voiceActivity: activity }));
      
      animationFrameRef.current = requestAnimationFrame(detectActivity);
    };
    
    detectActivity();
  }, []);

  // Set viseme callback
  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallbackRef.current = callback;
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    stopRecording();
    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isRecording: false, 
      isSpeaking: false 
    }));
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    startRecording,
    stopRecording,
    setVisemeCallback,
    clearError,
    disconnect
  };
}