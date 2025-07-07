import { useState, useCallback } from "react";
import { CharacterDisplay } from "@/components/character-display";
import { VoiceControls } from "@/components/voice-controls";
import { ConversationHistory } from "@/components/conversation-history";
import { useElevenLabsConversation } from "@/hooks/use-elevenlabs-conversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, MessageCircle, Mic, Send } from "lucide-react";

export default function Home() {
  const [textInput, setTextInput] = useState("");
  
  // Simplified ElevenLabs conversation system
  const {
    isRecording,
    isProcessing,
    isSpeaking,
    isConnected,
    error,
    messages,
    voiceActivity,
    startRecording,
    stopRecording,
    sendTextMessage,
    setVisemeCallback,
    clearError,
    clearMessages
  } = useElevenLabsConversation();

  // Handle viseme callback from character display
  const handleVisemeCallbackReady = useCallback((callback: (viseme: number) => void) => {
    setVisemeCallback(callback);
  }, [setVisemeCallback]);

  // Handle text message submission
  const handleSendTextMessage = useCallback(async () => {
    if (textInput.trim()) {
      await sendTextMessage(textInput.trim());
      setTextInput("");
    }
  }, [textInput, sendTextMessage]);

  // Handle Enter key in text input
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendTextMessage();
    }
  }, [handleSendTextMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold">ElevenLabs Voice Agent</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-300">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Character Display */}
          <div className="lg:col-span-2">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <CharacterDisplay
                isSpeaking={isSpeaking}
                isListening={isRecording}
                voiceActivity={voiceActivity}
                emotionalState="neutral"
                onVisemeCallbackReady={handleVisemeCallbackReady}
              />
            </div>
          </div>

          {/* Controls & Chat */}
          <div className="space-y-6">
            {/* Voice Controls */}
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4">Voice Controls</h2>
              <VoiceControls
                isRecording={isRecording}
                isProcessing={isProcessing}
                isMuted={false}
                voiceActivity={voiceActivity}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onToggleMute={() => {}}
              />
            </div>

            {/* Text Input */}
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4">Text Message</h2>
              <div className="flex space-x-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 bg-white/5 border-white/20 text-white placeholder-white/50"
                  disabled={isProcessing}
                />
                <Button
                  onClick={handleSendTextMessage}
                  disabled={isProcessing || !textInput.trim()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Button
                  onClick={() => sendTextMessage("Hello! Can you tell me about yourself?")}
                  variant="outline"
                  className="w-full justify-start border-white/20 text-white hover:bg-white/10"
                  disabled={isProcessing}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Introduce Yourself
                </Button>
                <Button
                  onClick={clearMessages}
                  variant="outline"
                  className="w-full justify-start border-white/20 text-white hover:bg-white/10"
                  disabled={isProcessing}
                >
                  Clear Conversation
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation History */}
        <div className="mt-8">
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-4">Conversation History</h2>
            <ConversationHistory messages={messages} />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-300 font-medium">Error</p>
                <p className="text-xs text-red-200">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="text-red-200 hover:text-red-100"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}