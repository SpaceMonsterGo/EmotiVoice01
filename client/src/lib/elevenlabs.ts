import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConversation } from "@elevenlabs/react";

interface ElevenLabsConfig {
  signedUrl: string;
  apiKey: string;
  agentId: string;
}

export function useElevenLabsAgent() {
  // Get ElevenLabs configuration
  const { data: config } = useQuery<ElevenLabsConfig>({
    queryKey: ['/api/elevenlabs/signed-url'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use the ElevenLabs React SDK hook
  const conversation = useConversation({
    apiKey: config?.apiKey,
    agentId: config?.agentId,
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
    },
    onMessage: (message) => {
      console.log('Received message from agent:', message);
    },
    onError: (error) => {
      console.error('ElevenLabs conversation error:', error);
    }
  });

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
