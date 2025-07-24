import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { useQuery } from '@tanstack/react-query';

interface ConversationState {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  error: string | null;
  transcript: string;
}

interface ElevenLabsConfig {
  agentId: string;
  hasApiKey: boolean;
}

export function useElevenLabsConversation() {
  const [state, setState] = useState<ConversationState>({
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    error: null,
    transcript: ''
  });

  // Add emotional state tracking
  const [emotionalState, setEmotionalState] = useState<string>('neutral');

  // Performance optimization: Track timeouts and connection state
  const visemeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const connectionAttemptRef = useRef<boolean>(false);
  const lastProcessedMessageRef = useRef<string>('');

  // Get ElevenLabs configuration from server
  const { data: config } = useQuery<ElevenLabsConfig>({
    queryKey: ['/api/elevenlabs/config'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    status,
    startSession,
    endSession,
    isSpeaking
  } = useConversation({
    agentId: config?.agentId || '',
    clientTools: {
      emotion_detector: async ({ emotion }: { emotion: string }) => {
        console.log(`Emotion detected: ${emotion}`);
        setEmotionalState(emotion);
        
        // Also update the global emotion callback if available
        if ((window as any).emotionCallback) {
          (window as any).emotionCallback(emotion);
        }
        
        return { success: true, emotion };
      }
    },
    onMessage: async (message) => {
      const startTime = performance.now();
      console.log('✓ AI message received:', message);
      const messageText = typeof message === 'string' ? message : (message as any).message || '';
      
      // STRICT FILTERING: Only process AI messages for visemes, never user input
      if (messageText.trim() && (message as any).source === 'ai') {
        // Prevent duplicate processing of the same message
        if (lastProcessedMessageRef.current === messageText) {
          console.log('Skipping duplicate AI message processing');
          return;
        }
        lastProcessedMessageRef.current = messageText;
        
        // Clear any existing viseme timeouts before processing new ones
        clearAllVisemeTimeouts();
        
        // Generate visemes ONLY for AI responses using ElevenLabs alignment
        if ((window as any).visemeCallback) {
          try {
            const fetchStart = performance.now();
            const response = await fetch('/api/elevenlabs/align', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: messageText,
                voiceId: 'pNInz6obpgDQGcFmaJgB' // Default voice ID
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              const fetchEnd = performance.now();
              console.log(`AI Response Processing: Alignment API took ${fetchEnd - fetchStart}ms for ${data.visemes.length} visemes`);
              
              // Play viseme sequence with timeout tracking
              data.visemes.forEach((viseme: any, index: number) => {
                const timeout = setTimeout(() => {
                  (window as any).visemeCallback(viseme.viseme);
                  console.log(`Viseme ${viseme.viseme} for phoneme '${viseme.char}' at ${viseme.start}ms (duration: ${viseme.end - viseme.start}ms)`);
                }, viseme.start);
                visemeTimeoutsRef.current.add(timeout);
              });
              
              // Reset to neutral after sequence
              const resetTimeout = setTimeout(() => {
                (window as any).visemeCallback(0);
                console.log('Reset to neutral viseme');
              }, data.visemes[data.visemes.length - 1]?.end + 200 || 2000);
              visemeTimeoutsRef.current.add(resetTimeout);
            }
          } catch (error) {
            console.error('Failed to generate visemes:', error);
          }
        }
      } else if ((message as any).source === 'user') {
        // For user messages, NEVER process visemes - just log
        console.log('User transcript (no visemes processed):', messageText);
      } else {
        // Log any other message types without processing
        console.log('Other message type (no visemes):', { source: (message as any).source, text: messageText });
      }
      
      const endTime = performance.now();
      console.log(`Message processing took ${endTime - startTime}ms`);
    },
    onAudioStart: () => {
      console.log('AI started speaking');
      setState(prev => ({ ...prev, isSpeaking: true }));
    },
    onAudioEnd: () => {
      console.log('AI stopped speaking');
      setState(prev => ({ ...prev, isSpeaking: false }));
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Conversation error: ' + error.message,
        isRecording: false,
        isConnected: false
      }));
    }
  });

  // Clear all viseme timeouts helper function
  const clearAllVisemeTimeouts = useCallback(() => {
    visemeTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    visemeTimeoutsRef.current.clear();
    console.log('Cleared all viseme timeouts');
  }, []);

  const startConversation = useCallback(async () => {
    // Prevent duplicate connection attempts
    if (connectionAttemptRef.current) {
      console.log('Connection already in progress, skipping duplicate attempt');
      return;
    }
    
    connectionAttemptRef.current = true;
    try {
      setState(prev => ({ ...prev, error: null }));
      const agentId = config?.agentId || '';
      console.log('Starting conversation with agent ID:', agentId);
      if (!agentId) {
        throw new Error('ElevenLabs Agent ID is not configured on the server');
      }
      
      // Clear any existing timeouts before starting
      clearAllVisemeTimeouts();
      lastProcessedMessageRef.current = '';
      
      await startSession({ agentId });
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        isConnected: true,
        transcript: ''
      }));
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start conversation: ' + (error instanceof Error ? error.message : String(error))
      }));
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [startSession, config, clearAllVisemeTimeouts]);

  const stopConversation = useCallback(async () => {
    try {
      // Clean up all resources before stopping
      clearAllVisemeTimeouts();
      lastProcessedMessageRef.current = '';
      connectionAttemptRef.current = false;
      
      // Reset character to neutral immediately
      if ((window as any).visemeCallback) {
        (window as any).visemeCallback(0);
      }
      
      await endSession();
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isConnected: false,
        transcript: state.transcript
      }));
      console.log('Conversation stopped and resources cleaned up');
    } catch (error) {
      console.error('Failed to stop conversation:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to stop conversation: ' + (error instanceof Error ? error.message : String(error))
      }));
    }
  }, [endSession, clearAllVisemeTimeouts]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllVisemeTimeouts();
      console.log('Hook unmounted, cleaned up all resources');
    };
  }, [clearAllVisemeTimeouts]);

  return {
    ...state,
    isSpeaking: isSpeaking || state.isSpeaking,
    transcript: state.transcript,
    emotionalState,
    status,
    startConversation,
    stopConversation,
    clearError
  };
}