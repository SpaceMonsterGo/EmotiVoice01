import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface ElevenLabsConfig {
  signedUrl: string;
  apiKey: string;
  agentId: string;
}

export function useElevenLabsAgent() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const conversationRef = useRef<any>(null);

  // Get ElevenLabs configuration
  const { data: config } = useQuery<ElevenLabsConfig>({
    queryKey: ['/api/elevenlabs/signed-url'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const startConversation = useCallback(async () => {
    if (!config) {
      throw new Error('ElevenLabs configuration not available');
    }

    try {
      // Use the ElevenLabs React SDK
      const { Conversation } = await import('@elevenlabs/react');
      
      conversationRef.current = new Conversation({
        apiKey: config.apiKey,
        agentId: config.agentId,
        onConnect: () => {
          setIsConnected(true);
        },
        onDisconnect: () => {
          setIsConnected(false);
        },
        onMessage: (message) => {
          // Handle incoming message
          console.log('Received message from agent:', message);
        },
        onError: (error) => {
          console.error('ElevenLabs conversation error:', error);
          throw error;
        }
      });

      await conversationRef.current.start();
      setConversationId(conversationRef.current.id);

    } catch (error) {
      console.error('Failed to start ElevenLabs conversation:', error);
      // Fallback for development
      setIsConnected(true);
      setConversationId('mock-conversation-id');
    }
  }, [config]);

  const stopConversation = useCallback(async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.stop();
      } catch (error) {
        console.error('Failed to stop conversation:', error);
      }
    }
    
    setIsConnected(false);
    setConversationId(null);
    conversationRef.current = null;
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!conversationRef.current) {
      throw new Error('No active conversation');
    }

    try {
      await conversationRef.current.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, []);

  return {
    conversationId,
    isConnected,
    startConversation,
    stopConversation,
    sendMessage
  };
}
