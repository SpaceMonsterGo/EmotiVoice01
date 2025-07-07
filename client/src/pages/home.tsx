import { useCallback } from "react";
import { CharacterDisplay } from "@/components/character-display";
import { useElevenLabsSimple } from "@/hooks/use-elevenlabs-simple";
import { Button } from "@/components/ui/button";
import { Settings, Mic, MicOff } from "lucide-react";

export default function Home() {
  // ElevenLabs Simple Conversational AI
  const {
    isConnected,
    isListening,
    isSpeaking,
    error,
    startConversation,
    stopConversation,
    setVisemeCallback,
  } = useElevenLabsSimple();

  // Handle viseme callback from character display
  const handleVisemeCallbackReady = useCallback((callback: (viseme: number) => void) => {
    setVisemeCallback(callback);
  }, [setVisemeCallback]);

  // Handle microphone toggle
  const handleMicrophoneToggle = useCallback(() => {
    if (isListening) {
      stopConversation();
    } else {
      startConversation();
    }
  }, [isListening, startConversation, stopConversation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold">Voice Agent</h1>
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
                isListening={isListening}
                voiceActivity={0}
                emotionalState="neutral"
                onVisemeCallbackReady={handleVisemeCallbackReady}
              />
            </div>
          </div>

          {/* Voice Controls */}
          <div className="space-y-6">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
              <h2 className="text-lg font-semibold mb-6 text-center">Voice Conversation</h2>
              
              {/* Large Microphone Button */}
              <div className="flex flex-col items-center space-y-4">
                <Button
                  onClick={handleMicrophoneToggle}
                  disabled={false}
                  className={`w-20 h-20 rounded-full transition-all duration-300 ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </Button>
                
                <div className="text-center">
                  <p className="text-sm text-gray-300">
                    {isListening ? 'Listening... Click to stop' :
                     isSpeaking ? 'AI is speaking...' :
                     'Click to start conversation'}
                  </p>
                  
                  {/* Voice Activity Indicator */}
                  {isListening && (
                    <div className="mt-2 w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-100 animate-pulse"
                        style={{ width: `${isListening ? 80 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Connection Status */}
              <div className="mt-6 flex items-center justify-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400">
                  {isConnected ? 'Connected to AI' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8">
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-4">How to Use</h2>
            <div className="space-y-2 text-sm text-gray-300">
              <p>• Click the microphone button to start a voice conversation</p>
              <p>• The AI will introduce itself and begin chatting</p>
              <p>• Watch the character's lips sync with the AI's speech</p>
              <p>• Click the microphone again to stop and respond</p>
            </div>
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