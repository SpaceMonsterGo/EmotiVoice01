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
    // Prevent multiple simultaneous connections
    if (websocketRef.current && 
        (websocketRef.current.readyState === WebSocket.CONNECTING || 
         websocketRef.current.readyState === WebSocket.OPEN)) {
      return;
    }
    
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
        
        // Send conversation initiation only once
        const initMessage = {
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            agent: {
              first_message: "Hello! I'm your AI voice assistant. How can I help you today?",
              language: "en"
            }
          }
        };
        ws.send(JSON.stringify(initMessage));
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);
          
          // Handle different ElevenLabs message types
          if (data.type === 'conversation_initiation_metadata') {
            console.log('Conversation initiated:', data.conversation_initiation_metadata_event);
          } else if (data.type === 'audio' && data.audio_event) {
            setState(prev => ({ ...prev, isSpeaking: true }));
            
            // Play the audio and trigger visemes
            const audioData = data.audio_event.audio_base_64;
            if (audioData && visemeCallbackRef.current) {
              // Play audio with visemes inline
              (async () => {
                try {
                  // Convert base64 to audio blob
                  const audioBytes = atob(audioData);
                  const audioArray = new Uint8Array(audioBytes.length);
                  for (let i = 0; i < audioBytes.length; i++) {
                    audioArray[i] = audioBytes.charCodeAt(i);
                  }
                  const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
                  const audioUrl = URL.createObjectURL(audioBlob);
                  
                  const audio = new Audio(audioUrl);
                  
                  // Generate visemes during playback
                  audio.onplay = () => {
                    if (visemeCallbackRef.current) {
                      const duration = audio.duration || 2;
                      const visemeCount = Math.floor(duration * 10);
                      
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
                      visemeCallbackRef.current(0);
                    }
                    URL.revokeObjectURL(audioUrl);
                  };
                  
                  await audio.play();
                } catch (error) {
                  console.error('Error playing audio:', error);
                  setState(prev => ({ ...prev, isSpeaking: false }));
                }
              })();
            }
          } else if (data.type === 'interruption') {
            setState(prev => ({ ...prev, isSpeaking: false }));
          }
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





  // Start voice recording
  const startRecording = useCallback(async () => {
    try {
      // If already connecting or connected, don't create another connection
      if (state.isProcessing || websocketRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      
      if (!state.isConnected && websocketRef.current?.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
        return; // Let the connection establish first
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
  }, [connectWebSocket]);

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