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
          console.log('Conversation initiated, metadata received');
          setState(prev => ({ 
            ...prev, 
            conversationId: data.conversation_initiation_metadata_event?.conversation_id,
            isConnected: true 
          }));
          break;

        case 'audio':
          const audioData = data.audio_event?.audio_base_64;
          console.log('Received audio event, data length:', audioData?.length || 0);
          
          if (audioData) {
            setState(prev => ({ ...prev, isSpeaking: true }));
            
            try {
              // Convert base64 to PCM16 audio buffer
              const audioBytes = atob(audioData);
              const audioArray = new Uint8Array(audioBytes.length);
              for (let i = 0; i < audioBytes.length; i++) {
                audioArray[i] = audioBytes.charCodeAt(i);
              }
              
              console.log('Audio data converted, bytes:', audioArray.length);
              
              // Store audio data for potential forced alignment
              currentAudioDataRef.current = audioArray;
              
              // Create or reuse audio context
              let audioContext = audioContextRef.current;
              if (!audioContext || audioContext.state === 'closed') {
                audioContext = new AudioContext();
                audioContextRef.current = audioContext;
              }
              
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
              console.log('Playing audio, duration:', duration, 'seconds');
              
              source.onended = () => {
                console.log('Audio playback ended');
                setState(prev => ({ ...prev, isSpeaking: false }));
              };
              
              // Ensure audio context is resumed before playing
              if (audioContext.state === 'suspended') {
                console.log('Resuming suspended audio context');
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
          } else {
            console.log('No audio data in audio event');
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
          console.log('Audio interruption detected - stopping speech');
          setState(prev => ({ ...prev, isSpeaking: false }));
          // Reset visemes to neutral on interruption
          if (visemeCallbackRef.current) {
            visemeCallbackRef.current(0);
          }
          break;

        case 'agent_response_correction':
          console.log('Agent response correction received:', data.agent_response_correction_event);
          break;
          
        case 'internal_tentative_agent_response':
          // Handle tentative responses - these are preview responses before final
          console.log('Received tentative agent response:', data.internal_tentative_agent_response_event?.tentative_agent_response);
          break;

        case 'ping':
          // Respond to ping to keep connection alive - critical for ElevenLabs protocol
          console.log('Received ping, sending pong');
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'pong',
              event_id: data.ping_event?.event_id || 'default-event-id'
            }));
          }
          break;

        default:
          console.log('Unknown message type received:', data.type, data);
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
        // Send conversation initiation according to ElevenLabs documentation
        if (ws.readyState === WebSocket.OPEN) {
          const initMessage = {
            type: 'conversation_initiation_client_data'
            // Note: conversation_config_override commented out to use agent's default settings
            // conversation_config_override: {
            //   agent: {
            //     first_message: "Hello! I'm your AI voice assistant. How can I help you today?",
            //     language: "en"
            //   }
            // }
          };
          console.log('Sending conversation initiation:', initMessage);
          ws.send(JSON.stringify(initMessage));
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
      
      // Use MediaRecorder for more reliable audio streaming (replaces deprecated ScriptProcessor)
      const mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 16000,
        mimeType: 'audio/webm;codecs=pcm'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN && state.isConnected) {
          // Convert blob to PCM16 for ElevenLabs
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64Audio = btoa(String.fromCharCode(...uint8Array));
            
            ws.send(JSON.stringify({
              user_audio_chunk: base64Audio
            }));
          };
          reader.readAsArrayBuffer(event.data);
        }
      };
      
      // Start recording in 250ms chunks for real-time streaming
      mediaRecorder.start(250);
      
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    connectionAttemptRef.current = false;
    
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