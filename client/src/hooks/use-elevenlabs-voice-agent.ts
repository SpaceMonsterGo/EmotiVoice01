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
  const isProcessingMessageRef = useRef<boolean>(false); // Track message processing
  const currentVisemeTimeouts = useRef<NodeJS.Timeout[]>([]);
  const isSpeakingRef = useRef<boolean>(false);

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
      const { signedUrl, apiKey } = await signedUrlResponse.json();

      // Create WebSocket connection with API key in URL
      const authenticatedUrl = `${signedUrl}&api_key=${apiKey}`;
      const ws = new WebSocket(authenticatedUrl);

      ws.addEventListener('open', () => {
        console.log('Connected to ElevenLabs Conversational AI');
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isProcessing: false 
        }));

        // Send conversation initiation with proper format
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
          } else if (data.type === 'agent_response' && data.agent_response_event) {
            // Handle agent response for precise viseme timing
            const responseText = data.agent_response_event.agent_response;
            if (responseText && visemeCallbackRef.current) {
              // Clear any existing viseme timeouts to prevent overlapping
              currentVisemeTimeouts.current.forEach(timeout => clearTimeout(timeout));
              currentVisemeTimeouts.current = [];
              
              // Set speaking state
              if (!isSpeakingRef.current) {
                setState(prev => ({ ...prev, isSpeaking: true }));
                isSpeakingRef.current = true;
              }
              
              // Use precise timestamp-based visemes
              generatePreciseVisemes(responseText);
            }
          } else if (data.type === 'audio' && data.audio_event) {
            // ElevenLabs Conversational AI plays audio automatically
            // We don't need to handle audio here, only ensure speaking state is set
            if (!isSpeakingRef.current) {
              setState(prev => ({ ...prev, isSpeaking: true }));
              isSpeakingRef.current = true;
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
        isProcessingMessageRef.current = false;
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

  // Generate precise visemes using ElevenLabs forced alignment
  const generatePreciseVisemes = useCallback(async (text: string) => {
    if (!visemeCallbackRef.current || !text) return;

    try {
      // Use a default voice ID - matches ElevenLabs Conversational AI voice
      const defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella voice (neutral)
      
      console.log('Getting precise viseme alignment for:', text);
      
      // Get precise timing from ElevenLabs alignment API
      const response = await fetch('/api/elevenlabs/align', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voiceId: defaultVoiceId }),
      });

      if (!response.ok) {
        throw new Error(`Alignment API error: ${response.status}`);
      }

      const data = await response.json();
      const visemes = data.visemes;
      
      if (visemes && visemes.length > 0) {
        console.log('Using ElevenLabs forced alignment with', visemes.length, 'visemes');
        
        // Schedule visemes with precise timing
        const startTime = Date.now();
        
        visemes.forEach((viseme: any) => {
          const delay = viseme.start; // Use direct millisecond timing
          
          const timeout = setTimeout(() => {
            if (visemeCallbackRef.current) {
              visemeCallbackRef.current(viseme.viseme);
              console.log(`Viseme ${viseme.viseme} for char '${viseme.char}' at ${viseme.start}ms`);
            }
          }, delay);
          
          currentVisemeTimeouts.current.push(timeout);
        });
        
        // Reset to neutral after sequence
        if (visemes.length > 0) {
          const lastViseme = visemes[visemes.length - 1];
          const resetDelay = lastViseme.end + 100; // Small buffer
          
          const resetTimeout = setTimeout(() => {
            setState(prev => ({ ...prev, isSpeaking: false }));
            isSpeakingRef.current = false;
            if (visemeCallbackRef.current) {
              visemeCallbackRef.current(0); // Neutral
              console.log('Reset to neutral viseme');
            }
            // Clear the timeout array
            currentVisemeTimeouts.current = [];
          }, resetDelay);
          
          currentVisemeTimeouts.current.push(resetTimeout);
        }
      } else {
        // Fallback to estimated timing
        console.log('No visemes received, using fallback');
        generateFallbackVisemes(text);
      }
    } catch (error) {
      console.error('Error with forced alignment, using fallback:', error);
      generateFallbackVisemes(text);
    }
  }, []);

  // Fallback viseme generation for when alignment fails
  const generateFallbackVisemes = useCallback((text: string) => {
    if (!visemeCallbackRef.current || !text) return;
    
    // Simple character-based viseme generation
    const chars = text.split('');
    const charDuration = 100; // 100ms per character
    
    chars.forEach((char, index) => {
      const timeout = setTimeout(() => {
        if (visemeCallbackRef.current) {
          // Simple character to viseme mapping
          let viseme = 0;
          const lowerChar = char.toLowerCase();
          
          if ('aeiou'.includes(lowerChar)) {
            viseme = Math.floor(Math.random() * 5) + 1; // Vowel visemes 1-5
          } else if ('bcdfghjklmnpqrstvwxyz'.includes(lowerChar)) {
            viseme = Math.floor(Math.random() * 5) + 6; // Consonant visemes 6-10
          }
          
          visemeCallbackRef.current(viseme);
        }
      }, index * charDuration);
      
      currentVisemeTimeouts.current.push(timeout);
    });
    
    // Reset after estimated duration
    const totalDuration = chars.length * charDuration + 200;
    const resetTimeout = setTimeout(() => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      isSpeakingRef.current = false;
      if (visemeCallbackRef.current) {
        visemeCallbackRef.current(0);
      }
      currentVisemeTimeouts.current = [];
    }, totalDuration);
    
    currentVisemeTimeouts.current.push(resetTimeout);
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
    
    // Clear all viseme timeouts
    currentVisemeTimeouts.current.forEach(timeout => clearTimeout(timeout));
    currentVisemeTimeouts.current = [];
    
    stopRecording();
    isSpeakingRef.current = false;
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