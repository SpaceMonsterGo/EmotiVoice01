import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useElevenLabsAgent } from "@/lib/elevenlabs";
import type { Message } from "@shared/schema";

export function useVoiceAgent() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState("Ready to chat");
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const { 
    startConversation, 
    stopConversation, 
    sendMessage, 
    isConnected: elevenLabsConnected,
    isSpeaking: elevenLabsSpeaking,
    getInputVolume
  } = useElevenLabsAgent();

  // Use ElevenLabs speaking state
  useEffect(() => {
    setIsSpeaking(elevenLabsSpeaking);
  }, [elevenLabsSpeaking]);

  // Update voice activity from ElevenLabs input volume
  useEffect(() => {
    if (!getInputVolume) return;
    
    const interval = setInterval(() => {
      const volume = getInputVolume();
      setVoiceActivity(volume / 100); // Normalize to 0-1 range
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, [getInputVolume]);

  // Get messages for current conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('POST', '/api/conversations', { title });
      return response.json();
    },
    onSuccess: (conversation) => {
      setCurrentConversationId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error) => {
      setError(`Failed to create conversation: ${error.message}`);
    }
  });

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (messageData: { conversationId: number; sender: string; content: string; audioUrl?: string }) => {
      const response = await apiRequest('POST', '/api/messages', messageData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', currentConversationId, 'messages'] });
    },
    onError: (error) => {
      setError(`Failed to send message: ${error.message}`);
    }
  });

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setAgentStatus("Connected and ready");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setAgentStatus("Disconnected");
    };

    ws.onerror = (error) => {
      setError("WebSocket connection error");
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'voice_start_ack':
            setIsRecording(true);
            setAgentStatus("Listening...");
            break;
          case 'voice_end_ack':
            // Recording stop is handled immediately in stopRecording function
            // No processing state needed for real-time conversation
            break;
          case 'agent_speaking':
            setIsSpeaking(true);
            setIsProcessing(false);
            setAgentStatus("Speaking...");
            break;
          case 'agent_finished':
            setIsSpeaking(false);
            setAgentStatus("Ready to chat");
            break;
          case 'new_message':
            // Message will be refetched automatically due to query invalidation
            break;
          case 'voice_activity':
            setVoiceActivity(data.level || 0);
            break;
          case 'error':
            setError(data.message);
            setIsProcessing(false);
            setIsRecording(false);
            setIsSpeaking(false);
            setAgentStatus("Error occurred");
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Start a new conversation if one doesn't exist
  useEffect(() => {
    if (isConnected && !currentConversationId) {
      createConversationMutation.mutate('New Voice Conversation');
    }
  }, [isConnected, currentConversationId]);

  const startRecording = useCallback(async () => {
    if (!isConnected || isMuted) return;
    
    try {
      setError(null);
      
      // Send WebSocket message to start recording
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'voice_start' }));
      }
      
      // Start ElevenLabs conversation
      await startConversation();
      
    } catch (error) {
      setError(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [isConnected, isMuted, startConversation]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    
    try {
      // Immediately update UI state for responsive feedback
      setIsRecording(false);
      setIsProcessing(false);
      setAgentStatus("Ready to chat");
      
      // Send WebSocket message to stop recording
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'voice_end' }));
      }
      
      // Stop ElevenLabs conversation without awaiting (non-blocking)
      stopConversation().catch(error => {
        console.error('Error stopping conversation:', error);
      });
      
    } catch (error) {
      setError(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [isRecording, stopConversation]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isConnected,
    isRecording,
    isProcessing,
    isSpeaking,
    isMuted,
    voiceActivity,
    error,
    agentStatus,
    messages,
    currentConversationId,
    startRecording,
    stopRecording,
    toggleMute,
    clearError
  };
}
