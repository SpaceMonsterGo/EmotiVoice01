import { useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConversation } from "@elevenlabs/react";
import { convertTimestampsToVisemes, playVisemeSequence, type VisemeEvent } from "./viseme-mapping";

interface ElevenLabsConfig {
  signedUrl: string;
  apiKey: string;
  agentId: string;
}

interface TimestampResponse {
  timestamps: Array<{
    char: string;
    start: number;
    end: number;
    word?: string;
  }>;
}

interface ElevenLabsAgentCallbacks {
  onVisemeChange?: (viseme: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export function useElevenLabsAgent(callbacks?: ElevenLabsAgentCallbacks) {
  // Get ElevenLabs configuration
  const { data: config } = useQuery<ElevenLabsConfig>({
    queryKey: ['/api/elevenlabs/signed-url'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  // Use the ElevenLabs React SDK hook
  const conversation = useConversation({
    apiKey: config?.apiKey,
    agentId: config?.agentId,
    clientTools: {
      emotion_detector: async ({ emotion, confidence = 0.8 }: { emotion: string; confidence?: number }) => {
        console.log(`Emotion detected: ${emotion} (confidence: ${confidence})`);
        // This will be used to update the character's emotional state
        return `Detected emotion: ${emotion} with ${Math.round(confidence * 100)}% confidence`;
      }
    },
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      callbacks?.onSpeechEnd?.();
      // Clean up any running viseme sequences
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log('Received message from agent:', message);
      
      // Don't generate additional speech - ElevenLabs Conversational AI handles audio
      // Only extract viseme timing data if needed for lip sync
      // The built-in audio from the conversational AI will play automatically
    },
    onError: (error) => {
      console.error('ElevenLabs conversation error:', error);
    }
  });

  // Handle speech with timestamp-based viseme animation
  const handleSpeechWithVisemes = useCallback(async (text: string) => {
    if (!config?.apiKey || !callbacks?.onVisemeChange) return;
    
    try {
      callbacks.onSpeechStart?.();
      
      // Generate speech with timestamps using ElevenLabs API
      const response = await fetch('/api/elevenlabs/speech-with-timestamps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, apiKey: config.apiKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech with timestamps');
      }

      const data = await response.json();
      
      if (data.timestamps && data.timestamps.length > 0) {
        // Convert timestamps to viseme events
        const visemeEvents = convertTimestampsToVisemes(data.timestamps);
        console.log('Generated viseme events:', visemeEvents);
        
        // Play the viseme sequence
        const cleanup = playVisemeSequence(
          visemeEvents,
          callbacks.onVisemeChange,
          Date.now()
        );
        
        cleanupRef.current = cleanup;
      }
    } catch (error) {
      console.error('Error generating speech with visemes:', error);
    }
  }, [config, callbacks]);

  const startConversation = useCallback(async () => {
    if (!config) {
      throw new Error('ElevenLabs configuration not available');
    }

    try {
      await conversation.startSession();
    } catch (error) {
      console.error('Failed to start ElevenLabs conversation:', error);
      throw error;
    }
  }, [config, conversation]);

  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to stop conversation:', error);
    }
  }, [conversation]);

  const sendMessage = useCallback(async (message: string) => {
    try {
      conversation.sendUserMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [conversation]);

  return {
    conversationId: conversation.getId(),
    isConnected: conversation.status === 'connected',
    isSpeaking: conversation.isSpeaking,
    startConversation,
    stopConversation,
    sendMessage,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume
  };
}
