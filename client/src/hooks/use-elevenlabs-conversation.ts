import { useState, useCallback, useRef } from 'react';
import { useElevenLabsAgent } from '@/lib/elevenlabs';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: number;
  audioUrl?: string;
  visemeTimings?: Array<{
    viseme: number;
    start: number;
    end: number;
  }>;
}

interface ConversationState {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
  error: string | null;
  messages: Message[];
  voiceActivity: number;
}

export function useElevenLabsConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const visemeCallback = useRef<((viseme: number) => void) | null>(null);
  const conversationId = useRef<string | null>(null);

  // ElevenLabs agent integration
  const {
    isConnected,
    isSpeaking,
    startConversation,
    stopConversation,
    getInputVolume,
    getOutputVolume
  } = useElevenLabsAgent({
    onVisemeChange: (viseme: number) => {
      if (visemeCallback.current) {
        visemeCallback.current(viseme);
      }
    },
    onSpeechStart: () => {
      console.log('ElevenLabs speech started');
    },
    onSpeechEnd: () => {
      console.log('ElevenLabs speech ended');
    }
  });

  // Voice activity detection
  const voiceActivity = getInputVolume?.() || 0;

  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallback.current = callback;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      await startConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    }
  }, [startConversation]);

  const stopRecording = useCallback(async () => {
    try {
      await stopConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop conversation');
    }
  }, [stopConversation]);

  const sendTextMessage = useCallback(async (text: string) => {
    try {
      setError(null);
      setIsProcessing(true);
      
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        sender: 'user',
        content: text,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Send to ElevenLabs + Gentle processing endpoint
      const response = await fetch('/api/conversation/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId.current
        })
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Add AI message with viseme timings
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        content: data.response,
        timestamp: Date.now(),
        audioUrl: data.audioUrl,
        visemeTimings: data.visemeTimings
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Play audio with synchronized visemes
      if (data.audioUrl && data.visemeTimings) {
        await playAudioWithVisemes(data.audioUrl, data.visemeTimings);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process message');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const playAudioWithVisemes = useCallback(async (audioUrl: string, visemeTimings: Array<{viseme: number; start: number; end: number}>) => {
    const audio = new Audio(audioUrl);
    
    return new Promise<void>((resolve, reject) => {
      audio.onloadeddata = () => {
        audio.play();
        
        // Schedule viseme changes
        visemeTimings.forEach(({ viseme, start, end }) => {
          setTimeout(() => {
            if (visemeCallback.current) {
              visemeCallback.current(viseme);
            }
          }, start * 1000);
          
          setTimeout(() => {
            if (visemeCallback.current) {
              visemeCallback.current(0); // Reset to neutral
            }
          }, end * 1000);
        });
      };
      
      audio.onended = () => resolve();
      audio.onerror = (err) => reject(err);
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    // State
    isRecording: false, // ElevenLabs handles recording internally
    isProcessing,
    isSpeaking,
    isConnected,
    error,
    messages,
    voiceActivity,
    
    // Actions
    startRecording,
    stopRecording,
    sendTextMessage,
    setVisemeCallback,
    clearError,
    clearMessages
  };
}