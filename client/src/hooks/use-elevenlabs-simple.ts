import { useState, useCallback, useRef, useEffect } from 'react';

interface ConversationalAIState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  conversationId: string | null;
}

export function useElevenLabsSimple() {
  const [state, setState] = useState<ConversationalAIState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    error: null,
    conversationId: null,
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const visemeCallbackRef = useRef<((viseme: number) => void) | null>(null);

  // Set viseme callback
  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallbackRef.current = callback;
  }, []);

  // Simple viseme generation during speech
  const generateVisemes = useCallback((duration: number) => {
    if (!visemeCallbackRef.current) return;
    
    const visemeCount = Math.floor(duration * 8); // 8 visemes per second
    for (let i = 0; i < visemeCount; i++) {
      setTimeout(() => {
        if (visemeCallbackRef.current) {
          const viseme = Math.floor(Math.random() * 15) + 1;
          visemeCallbackRef.current(viseme);
        }
      }, (i * duration * 1000) / visemeCount);
    }
    
    // Reset to neutral after speech
    setTimeout(() => {
      if (visemeCallbackRef.current) {
        visemeCallbackRef.current(0);
      }
    }, duration * 1000);
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'conversation_initiation_metadata':
          setState(prev => ({ 
            ...prev, 
            conversationId: data.conversation_initiation_metadata_event.conversation_id,
            isConnected: true 
          }));
          break;

        case 'audio':
          const audioData = data.audio_event.audio_base_64;
          if (audioData) {
            setState(prev => ({ ...prev, isSpeaking: true }));
            
            try {
              // Convert base64 to PCM16 audio buffer
              const audioBytes = atob(audioData);
              const audioArray = new Uint8Array(audioBytes.length);
              for (let i = 0; i < audioBytes.length; i++) {
                audioArray[i] = audioBytes.charCodeAt(i);
              }
              
              // Create audio context and play PCM16 data
              if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
              }
              
              const audioContext = audioContextRef.current;
              
              // PCM16 to Float32 conversion
              const pcmData = new Int16Array(audioArray.buffer);
              const audioBuffer = audioContext.createBuffer(1, pcmData.length, 16000);
              const channelData = audioBuffer.getChannelData(0);
              
              for (let i = 0; i < pcmData.length; i++) {
                channelData[i] = pcmData[i] / 32768.0; // Convert to float32
              }
              
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              
              // Generate visemes during playback
              const duration = audioBuffer.duration;
              console.log('Playing audio, duration:', duration);
              generateVisemes(duration);
              
              source.onended = () => {
                console.log('Audio playback ended');
                setState(prev => ({ ...prev, isSpeaking: false }));
              };
              
              // Resume audio context if suspended
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  source.start();
                  console.log('Audio started after resume');
                });
              } else {
                source.start();
                console.log('Audio started immediately');
              }
            } catch (error) {
              console.error('Audio playback failed:', error);
              setState(prev => ({ ...prev, isSpeaking: false }));
            }
          }
          break;

        case 'user_transcript':
          console.log('User transcript received:', data.user_transcription_event?.user_transcript);
          break;

        case 'agent_response':
          console.log('Agent response:', data.agent_response_event?.agent_response);
          break;

        case 'ping':
          // Respond to ping to keep connection alive
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'pong',
              event_id: data.ping_event.event_id
            }));
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, [generateVisemes]);

  // Start conversation
  const startConversation = useCallback(async () => {
    if (state.isConnected || websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      
      // Get signed URL from server
      const response = await fetch('/api/elevenlabs/signed-url');
      const { signedUrl } = await response.json();
      
      // Connect to WebSocket
      const ws = new WebSocket(signedUrl);
      websocketRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected, sending conversation initiation');
        // Send conversation initiation
        ws.send(JSON.stringify({
          type: 'conversation_initiation_client_data'
        }));
      };
      
      ws.onmessage = handleMessage;
      
      ws.onclose = () => {
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isListening: false,
          isSpeaking: false 
        }));
      };
      
      ws.onerror = () => {
        setState(prev => ({ ...prev, error: 'Connection failed' }));
      };
      
      // Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1 } 
      });
      streamRef.current = stream;
      
      // Setup audio processing for ElevenLabs (needs PCM16 format)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      processor.onaudioprocess = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          
          // Convert float32 to PCM16
          const pcm16Buffer = new Int16Array(inputBuffer.length);
          for (let i = 0; i < inputBuffer.length; i++) {
            pcm16Buffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
          }
          
          // Convert to base64 and send
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16Buffer.buffer)));
          ws.send(JSON.stringify({
            user_audio_chunk: base64Audio
          }));
        }
      };
      
      console.log('Audio processing started with PCM16 format');
      setState(prev => ({ ...prev, isListening: true }));
      
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to start conversation' }));
    }
  }, [state.isConnected, handleMessage]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isConnected: false,
      isListening: false,
      isSpeaking: false 
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, [stopConversation]);

  return {
    ...state,
    startConversation,
    stopConversation,
    setVisemeCallback,
  };
}