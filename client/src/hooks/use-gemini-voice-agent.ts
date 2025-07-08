import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '../lib/queryClient';
import { playVisemeSequence, type VisemeEvent } from '../lib/viseme-mapping';

interface ConversationResponse {
  response: string;
  audio: string; // Base64 encoded audio
  visemes: VisemeEvent[];
  timestamps: Array<{
    char: string;
    start: number;
    end: number;
    word?: string;
  }>;
}

export function useGeminiVoiceAgent() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; content: string }>>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentConversationId = useRef<number | null>(null);
  const visemeCallbackRef = useRef<((viseme: number) => void) | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const setVisemeCallback = useCallback((callback: (viseme: number) => void) => {
    visemeCallbackRef.current = callback;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioInput(audioBlob);
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const processAudioInput = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      
      // Convert audio to text using Web Speech API (fallback)
      const userMessage = await transcribeAudio(audioBlob);
      
      if (!userMessage) {
        throw new Error('No speech detected');
      }
      
      // Add user message to conversation
      setMessages(prev => [...prev, { sender: 'user', content: userMessage }]);
      
      // Send to conversation API
      const response = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConversationId.current
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const responseData: ConversationResponse = await response.json();
      
      // Add AI response to conversation
      setMessages(prev => [...prev, { sender: 'ai', content: responseData.response }]);
      
      // Play audio with synchronized visemes
      await playAudioWithVisemes(responseData.audio, responseData.visemes);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      console.error('Audio processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
    // For now, return a placeholder message since speech recognition needs user interaction
    // In a real implementation, you would use a speech-to-text service
    return "Hello, how are you feeling today?";
  }, []);

  const playAudioWithVisemes = useCallback(async (base64Audio: string, visemes: VisemeEvent[]) => {
    return new Promise<void>((resolve) => {
      try {
        // Create audio element
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        currentAudioRef.current = audio;
        
        let visemeTimeout: NodeJS.Timeout;
        
        audio.onplay = () => {
          setIsSpeaking(true);
          
          // Start viseme sequence
          if (visemeCallbackRef.current) {
            playVisemeSequence(visemes, visemeCallbackRef.current, (timeout) => {
              visemeTimeout = timeout;
            });
          }
        };
        
        audio.onended = () => {
          setIsSpeaking(false);
          if (visemeCallbackRef.current) {
            visemeCallbackRef.current(0); // Close mouth
          }
          if (visemeTimeout) {
            clearTimeout(visemeTimeout);
          }
          resolve();
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          setError('Failed to play audio');
          resolve();
        };
        
        audio.play();
      } catch (err) {
        setError('Failed to play audio');
        setIsSpeaking(false);
        resolve();
      }
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendTextMessage = useCallback(async (message: string) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // Add user message to conversation
      setMessages(prev => [...prev, { sender: 'user', content: message }]);
      
      // Send to conversation API
      const response = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          conversationId: currentConversationId.current
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const responseData: ConversationResponse = await response.json();
      
      // Add AI response to conversation
      setMessages(prev => [...prev, { sender: 'ai', content: responseData.response }]);
      
      // Play audio with synchronized visemes
      await playAudioWithVisemes(responseData.audio, responseData.visemes);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Text message error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [playAudioWithVisemes]);

  return {
    isRecording,
    isProcessing,
    isSpeaking,
    error,
    messages,
    startRecording,
    stopRecording,
    sendTextMessage,
    clearError,
    setVisemeCallback
  };
}