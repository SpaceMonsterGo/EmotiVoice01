import { useState, useCallback, useRef, useEffect } from 'react';

interface ConversationalAIState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error: string | null;
  conversationId: string | null;
}

export function useElevenLabsConversationalAI() {
  const [state, setState] = useState<ConversationalAIState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    error: null,
    conversationId: null
  });

  // Add voiceActivity for compatibility
  const voiceActivity = state.isListening ? 50 : 0;

  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const visemeCallbackRef = useRef<((viseme: number) => void) | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Connect to ElevenLabs Conversational AI
  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      // Get signed URL from server
      const response = await fetch('/api/elevenlabs/signed-url');
      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }
      const { signedUrl } = await response.json();

      // Create WebSocket connection
      const ws = new WebSocket(signedUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to ElevenLabs Conversational AI');
        setState(prev => ({ ...prev, isConnected: true, isProcessing: false }));
        
        // Send conversation initiation - use agent's default config
        const initMessage = {
          type: "conversation_initiation_client_data"
        };
        console.log('Sending conversation initiation:', initMessage);
        ws.send(JSON.stringify(initMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed', 
          isProcessing: false,
          isConnected: false 
        }));
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isListening: false,
          isSpeaking: false
        }));
        
        // Don't auto-reconnect for manual disconnects or normal closes
        if (event.code !== 1000 && event.code !== 1005 && event.code !== 1008) {
          console.log('Unexpected close, attempting to reconnect...');
          setTimeout(() => {
            if (state.isListening) {
              connect();
            }
          }, 2000);
        } else if (event.code === 1008) {
          setState(prev => ({ 
            ...prev, 
            error: 'Configuration error: ' + event.reason 
          }));
        }
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to connect',
        isProcessing: false 
      }));
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('Received message:', data);

    switch (data.type) {
      case 'conversation_initiation_metadata':
        const metadata = data.conversation_initiation_metadata_event;
        setState(prev => ({ ...prev, conversationId: metadata.conversation_id }));
        console.log('Conversation started:', metadata.conversation_id);
        break;

      case 'audio':
        const audioEvent = data.audio_event;
        if (audioEvent?.audio_base_64) {
          console.log('Received audio response, playing...');
          setState(prev => ({ ...prev, isSpeaking: true }));
          playAudioResponse(audioEvent.audio_base_64);
        }
        break;

      case 'audio_start':
        console.log('Audio playback starting');
        setState(prev => ({ ...prev, isSpeaking: true }));
        break;

      case 'audio_end':
        console.log('Audio playback ending');
        setState(prev => ({ ...prev, isSpeaking: false }));
        if (visemeCallbackRef.current) {
          visemeCallbackRef.current(0);
        }
        break;

      case 'user_transcript':
        const transcript = data.user_transcription_event;
        console.log('User transcript:', transcript.user_transcript);
        break;

      case 'agent_response':
        const response = data.agent_response_event;
        console.log('Agent response:', response.agent_response);
        break;

      case 'interruption':
        setState(prev => ({ ...prev, isSpeaking: false }));
        stopCurrentAudio();
        break;

      case 'ping':
        // Respond to ping with pong to keep connection alive
        const pingEvent = data.ping_event;
        if (pingEvent && websocketRef.current) {
          const pongMessage = {
            type: "pong",
            event_id: pingEvent.event_id
          };
          websocketRef.current.send(JSON.stringify(pongMessage));
          console.log('Sent pong response for ping:', pingEvent.event_id);
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }, []);

  // Start listening (microphone input)
  const startListening = useCallback(async () => {
    try {
      console.log('Starting microphone access...');
      
      // First get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      streamRef.current = stream;
      console.log('Microphone access granted');

      // If not connected, connect now
      if (!state.isConnected || !websocketRef.current) {
        setState(prev => ({ ...prev, isListening: true }));
        await connect();
        // Wait a bit for connection to establish
        setTimeout(() => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            startAudioProcessing();
          }
        }, 1000);
      } else {
        setState(prev => ({ ...prev, isListening: true }));
        startAudioProcessing();
      }

    } catch (error) {
      console.error('Failed to start listening:', error);
      setState(prev => ({ ...prev, error: 'Failed to access microphone' }));
    }
  }, [state.isConnected, connect]);

  // Separate function for audio processing
  const startAudioProcessing = useCallback(() => {
    if (!streamRef.current || !websocketRef.current) return;

    try {
      // Setup audio context for real-time processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(streamRef.current);
      
      // Use newer AudioWorklet if available, fallback to ScriptProcessor
      if (audioContext.audioWorklet) {
        console.log('Using AudioWorklet for audio processing');
        // For now, use ScriptProcessor as it's more compatible
        setupScriptProcessor(audioContext, source);
      } else {
        console.log('Using ScriptProcessor for audio processing');
        setupScriptProcessor(audioContext, source);
      }

    } catch (error) {
      console.error('Failed to start audio processing:', error);
    }
  }, []);

  const setupScriptProcessor = (audioContext: AudioContext, source: MediaStreamAudioSourceNode) => {
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputBuffer = event.inputBuffer.getChannelData(0);
      
      // Convert float32 audio to PCM16
      const pcm16Buffer = new Int16Array(inputBuffer.length);
      for (let i = 0; i < inputBuffer.length; i++) {
        pcm16Buffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
      }

      // Convert to base64 and send
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16Buffer.buffer)));
      websocketRef.current.send(JSON.stringify({
        user_audio_chunk: base64Audio
      }));
    };
  };

  // Stop listening
  const stopListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Play audio response
  const playAudioResponse = useCallback(async (base64Audio: string) => {
    try {
      console.log('Processing audio data, length:', base64Audio.length);
      
      // Convert base64 to PCM audio buffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      
      // Convert PCM16 to AudioBuffer
      const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 16000);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert PCM16 bytes to float32
      for (let i = 0; i < channelData.length; i++) {
        const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
        channelData[i] = sample < 32768 ? sample / 32768 : (sample - 65536) / 32768;
      }

      // Play the audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Generate visemes during playback
      const duration = audioBuffer.duration;
      const visemeCount = Math.floor(duration * 8); // 8 visemes per second
      
      // Clear any existing viseme animation
      if (visemeCallbackRef.current) {
        visemeCallbackRef.current(0);
      }
      
      // Start viseme animation
      for (let i = 0; i < visemeCount; i++) {
        setTimeout(() => {
          if (visemeCallbackRef.current && source.context.state === 'running') {
            // Generate realistic viseme sequence based on speech patterns
            const visemeSequence = [1, 3, 5, 7, 9, 11, 13, 2, 4, 6, 8, 10, 12, 14, 15];
            const viseme = visemeSequence[i % visemeSequence.length];
            visemeCallbackRef.current(viseme);
          }
        }, (i * duration * 1000) / visemeCount);
      }
      
      source.onended = () => {
        console.log('Audio playback ended');
        setState(prev => ({ ...prev, isSpeaking: false }));
        if (visemeCallbackRef.current) {
          visemeCallbackRef.current(0);
        }
      };

      console.log('Starting audio playback with viseme animation...');
      source.start();

    } catch (error) {
      console.error('Error playing audio:', error);
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, []);

  // Stop current audio
  const stopCurrentAudio = useCallback(() => {
    // Implementation to stop current audio playback
    if (visemeCallbackRef.current) {
      visemeCallbackRef.current(0);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    stopListening();
    setState(prev => ({
      ...prev,
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      conversationId: null
    }));
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      console.log('Stopping conversation...');
      disconnect();
    } else {
      console.log('Starting conversation...');
      startListening();
    }
  }, [state.isListening, startListening, disconnect]);

  // Set viseme callback
  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallbackRef.current = callback;
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    voiceActivity,
    connect,
    disconnect,
    startListening,
    stopListening,
    toggleListening,
    setVisemeCallback,
    clearError
  };
}