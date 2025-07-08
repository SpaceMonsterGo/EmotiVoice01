import { useState, useCallback } from 'react';
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

  // Get ElevenLabs configuration from server
  const { data: config } = useQuery<ElevenLabsConfig>({
    queryKey: ['/api/elevenlabs/config'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    status,
    startSession,
    endSession,
    isSpeaking,
    transcript
  } = useConversation({
    agentId: config?.agentId || '',
    onMessage: async (message) => {
      console.log('✓ AI message received:', message);
      const messageText = message.text || message.message || '';
      
      // Only process AI messages for visemes, not user transcripts
      if (messageText.trim() && message.source === 'ai') {
        // Generate visemes ONLY for AI responses using ElevenLabs alignment
        if (window.visemeCallback) {
          try {
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
              console.log('Using ElevenLabs forced alignment with', data.visemes.length, 'visemes');
              
              // Play viseme sequence
              data.visemes.forEach((viseme: any, index: number) => {
                setTimeout(() => {
                  window.visemeCallback(viseme.viseme);
                  console.log(`Viseme ${viseme.viseme} for phoneme '${viseme.char}' at ${viseme.start}ms (duration: ${viseme.end - viseme.start}ms)`);
                }, viseme.start);
              });
              
              // Reset to neutral after sequence
              setTimeout(() => {
                window.visemeCallback(0);
                console.log('Reset to neutral viseme');
              }, data.visemes[data.visemes.length - 1]?.end || 2000);
            }
          } catch (error) {
            console.error('Failed to generate visemes:', error);
          }
        }
      } else if (message.source === 'user') {
        // For user messages, just log without processing visemes
        console.log('User transcript (no visemes):', messageText);
      }
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

  const startConversation = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      const agentId = config?.agentId || '';
      console.log('Starting conversation with agent ID:', agentId);
      if (!agentId) {
        throw new Error('ElevenLabs Agent ID is not configured on the server');
      }
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
    }
  }, [startSession, config]);

  const stopConversation = useCallback(async () => {
    try {
      await endSession();
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isConnected: false,
        transcript: transcript || ''
      }));
    } catch (error) {
      console.error('Failed to stop conversation:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to stop conversation: ' + (error instanceof Error ? error.message : String(error))
      }));
    }
  }, [endSession, transcript]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    isSpeaking: isSpeaking || state.isSpeaking,
    transcript: transcript || state.transcript,
    status,
    startConversation,
    stopConversation,
    clearError
  };
}