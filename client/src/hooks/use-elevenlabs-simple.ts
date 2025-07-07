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
  const connectionAttemptRef = useRef<boolean>(false);
  
  // Refs for forced alignment data collection
  const currentAudioDataRef = useRef<Uint8Array | null>(null);
  const currentTranscriptRef = useRef<{
    text: string;
    type: 'user' | 'agent';
    timestamp: number;
  } | null>(null);

  // Set viseme callback
  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallbackRef.current = callback;
  }, []);

  // Simple viseme generation for generic audio without text
  // Uses Rive file specification: 0=Neutral, 1=F, 2=M, 3=O, 4=U, 5=E, 6=AI, 7=CH, 8=S, 9=L
  const generateVisemes = useCallback((duration: number) => {
    if (!visemeCallbackRef.current) return;
    
    const visemeCount = Math.floor(duration * 8); // 8 visemes per second
    for (let i = 0; i < visemeCount; i++) {
      setTimeout(() => {
        if (visemeCallbackRef.current) {
          // Generate realistic viseme sequence using Rive mapping (0-9)
          const visemeSequence = [6, 5, 3, 1, 2, 8, 9, 7, 4]; // AI, E, O, F, M, S, L, CH, U
          const viseme = visemeSequence[i % visemeSequence.length];
          visemeCallbackRef.current(viseme);
        }
      }, (i * duration * 1000) / visemeCount);
    }
    
    // Reset to neutral after speech
    setTimeout(() => {
      if (visemeCallbackRef.current) {
        visemeCallbackRef.current(0); // Neutral
      }
    }, duration * 1000);
  }, []);

  // Generate visemes based on text content matching Rive file specification
  // 0=Neutral, 1=F, 2=M, 3=O, 4=U, 5=E, 6=AI, 7=CH, 8=S, 9=L
  const generateTextBasedVisemes = useCallback((text: string) => {
    if (!visemeCallbackRef.current || !text) return;

    // Text-to-viseme mapping matching Rive file specification
    const textToVisemeMap: { [key: string]: number } = {
      // Vowels
      'a': 6, 'ai': 6, 'ay': 6,  // AI sound
      'e': 5, 'ea': 5, 'ee': 5,  // E sound
      'i': 6, 'ie': 6,           // AI sound (closest to I)
      'o': 3, 'oo': 4, 'ou': 4,  // O sound / U sound
      'u': 4, 'ue': 4,           // U sound
      
      // Consonants
      'f': 1, 'v': 1, 'ph': 1,   // F sound (lip-teeth)
      'm': 2, 'b': 2, 'p': 2,    // M sound (lip closure)
      'ch': 7, 'sh': 7, 'j': 7,  // CH sound
      's': 8, 'z': 8, 'c': 8,    // S sound
      'l': 9, 'r': 9,            // L sound (tongue position)
      't': 8, 'd': 8, 'n': 8,    // S sound (closest approximation)
      'k': 3, 'g': 3, 'q': 3,    // O sound (back of mouth)
      'h': 5, 'w': 4, 'y': 6     // Various approximations
    };

    const chars = text.toLowerCase().split('');
    const charDuration = 120; // ms per character (slightly faster)
    
    chars.forEach((char, index) => {
      if (char === ' ') return;
      
      const viseme = textToVisemeMap[char] || 5; // Default to E sound
      const delay = index * charDuration;
      
      setTimeout(() => {
        if (visemeCallbackRef.current) {
          visemeCallbackRef.current(viseme);
        }
      }, delay);
    });

    // Reset to neutral after text
    setTimeout(() => {
      if (visemeCallbackRef.current) {
        visemeCallbackRef.current(0); // Neutral
      }
    }, chars.length * charDuration);
  }, []);

  // Generate precise visemes using ElevenLabs forced alignment
  const generatePreciseVisemes = useCallback(async (text: string) => {
    if (!visemeCallbackRef.current || !text) return;

    try {
      // Use a default voice ID - in production, this should be configurable
      const defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella voice (neutral)
      
      const { getVisemeAlignment, playVisemeSequence } = await import('../lib/elevenlabs-alignment');
      
      // Get precise timing from ElevenLabs
      const visemes = await getVisemeAlignment(text, defaultVoiceId);
      
      if (visemes.length > 0) {
        console.log('Using ElevenLabs forced alignment with', visemes.length, 'visemes');
        
        // Play the precise viseme sequence
        playVisemeSequence(visemes, (viseme) => {
          if (visemeCallbackRef.current) {
            visemeCallbackRef.current(viseme);
          }
        });
      } else {
        // Fallback to text-based visemes
        console.log('Fallback to text-based visemes');
        generateTextBasedVisemes(text);
      }
    } catch (error) {
      console.error('Error with forced alignment, using fallback:', error);
      // Fallback to text-based visemes
      generateTextBasedVisemes(text);
    }
  }, [generateTextBasedVisemes]);

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
              
              // Store audio data for potential forced alignment
              currentAudioDataRef.current = audioArray;
              
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
              
              // Only play audio - visemes will be generated from agent_response text
              const duration = audioBuffer.duration;
              console.log('Playing audio, duration:', duration);
              
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
          const userTranscript = data.user_transcription_event?.user_transcript;
          console.log('User transcript received:', userTranscript);
          
          // Store transcript for potential forced alignment
          if (userTranscript) {
            currentTranscriptRef.current = {
              text: userTranscript,
              type: 'user',
              timestamp: Date.now()
            };
          }
          break;

        case 'agent_response':
          const agentText = data.agent_response_event?.agent_response;
          const eventId = data.agent_response_event?.event_id;
          console.log('Agent response:', agentText, 'Event ID:', eventId);
          
          // Store agent response for potential forced alignment
          if (agentText) {
            currentTranscriptRef.current = {
              text: agentText,
              type: 'agent',
              timestamp: Date.now()
            };
            
            // Use forced alignment for precise viseme timing
            console.log('Generating visemes for agent response');
            generatePreciseVisemes(agentText);
          }
          break;

        case 'interruption':
          console.log('Audio interruption detected');
          setState(prev => ({ ...prev, isSpeaking: false }));
          break;

        case 'agent_response_correction':
          console.log('Agent response correction:', data.agent_response_correction_event);
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
    if (state.isConnected || websocketRef.current?.readyState === WebSocket.OPEN || connectionAttemptRef.current) {
      console.log('Conversation already started/connecting, skipping duplicate connection');
      return;
    }
    
    connectionAttemptRef.current = true;

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
        connectionAttemptRef.current = false;
        // Send conversation initiation - only once per connection
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'conversation_initiation_client_data'
          }));
        }
      };
      
      ws.onmessage = handleMessage;
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        connectionAttemptRef.current = false;
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isListening: false,
          isSpeaking: false 
        }));
        websocketRef.current = null;
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        connectionAttemptRef.current = false;
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
      console.error('Error starting conversation:', error);
      connectionAttemptRef.current = false;
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

  // Function to get collected alignment data
  const getAlignmentData = useCallback(() => {
    if (currentAudioDataRef.current && currentTranscriptRef.current) {
      return {
        audioData: currentAudioDataRef.current,
        transcript: currentTranscriptRef.current.text,
        type: currentTranscriptRef.current.type,
        timestamp: currentTranscriptRef.current.timestamp
      };
    }
    return null;
  }, []);

  return {
    ...state,
    startConversation,
    stopConversation,
    setVisemeCallback,
    getAlignmentData
  };
}