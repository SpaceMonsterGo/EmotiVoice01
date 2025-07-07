import { useState, useCallback } from "react";
import { CharacterDisplay } from "@/components/character-display";
import { VoiceControls } from "@/components/voice-controls";
import { ConversationHistory } from "@/components/conversation-history";
import { useElevenLabsConversation } from "@/hooks/use-elevenlabs-conversation";
import { Button } from "@/components/ui/button";
import { Settings, MessageCircle, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [visemeCallback, setVisemeCallback] = useState<((viseme: number) => void) | null>(null);
  const [useGeminiMode, setUseGeminiMode] = useState(false);
  
  // ElevenLabs agent with timestamp-based viseme callbacks
  const {
    isConnected: elevenLabsConnected,
    isSpeaking: elevenLabsSpeaking,
    startConversation,
    stopConversation,
    getInputVolume,
    getOutputVolume
  } = useElevenLabsAgent({
    onVisemeChange: visemeCallback || undefined,
    onSpeechStart: () => {
      console.log('ElevenLabs speech started');
    },
    onSpeechEnd: () => {
      console.log('ElevenLabs speech ended');
    }
  });

  // Gemini + ElevenLabs TTS agent
  const {
    isRecording: geminiIsRecording,
    isProcessing: geminiIsProcessing,
    isSpeaking: geminiIsSpeaking,
    error: geminiError,
    messages: geminiMessages,
    startRecording: geminiStartRecording,
    stopRecording: geminiStopRecording,
    sendTextMessage: geminiSendTextMessage,
    clearError: geminiClearError,
    setVisemeCallback: geminiSetVisemeCallback
  } = useGeminiVoiceAgent();

  // Voice agent state (for UI management)
  const {
    isRecording: legacyIsRecording,
    isProcessing: legacyIsProcessing,
    messages: legacyMessages,
    error: legacyError,
    startRecording: legacyStartRecording,
    stopRecording: legacyStopRecording,
    toggleMute,
    isMuted,
    voiceActivity,
    agentStatus,
    clearError: legacyClearError
  } = useVoiceAgent();

  // Use current mode states
  const isConnected = useGeminiMode ? true : elevenLabsConnected;
  const isSpeaking = useGeminiMode ? geminiIsSpeaking : elevenLabsSpeaking;
  const isRecording = useGeminiMode ? geminiIsRecording : legacyIsRecording;
  const isProcessing = useGeminiMode ? geminiIsProcessing : legacyIsProcessing;
  const messages = useGeminiMode ? geminiMessages : legacyMessages;
  const error = useGeminiMode ? geminiError : legacyError;
  
  // Debug speaking state
  useEffect(() => {
    console.log('Speaking state changed:', isSpeaking);
  }, [isSpeaking]);

  // Handle viseme callback from character display
  const handleVisemeCallbackReady = useCallback((callback: (viseme: number) => void) => {
    setVisemeCallback(() => callback);
    // Also set callback for Gemini agent
    geminiSetVisemeCallback(callback);
    console.log('Viseme callback ready');
  }, [geminiSetVisemeCallback]);

  // Manual test function for visemes
  const testVisemeSequence = useCallback(() => {
    if (!visemeCallback) {
      console.log('No viseme callback available');
      return;
    }
    
    // Create a test sequence that cycles through all visemes
    const testSequence = [
      { viseme: 1, delay: 0 },     // A
      { viseme: 2, delay: 300 },   // E
      { viseme: 3, delay: 600 },   // I
      { viseme: 4, delay: 900 },   // O
      { viseme: 5, delay: 1200 },  // U
      { viseme: 6, delay: 1500 },  // M/B/P
      { viseme: 7, delay: 1800 },  // F/V
      { viseme: 8, delay: 2100 },  // TH
      { viseme: 9, delay: 2400 },  // T/D/S/Z
      { viseme: 0, delay: 2700 },  // Closed
    ];
    
    console.log('Starting manual test viseme sequence...');
    
    testSequence.forEach(({ viseme, delay }) => {
      setTimeout(() => {
        visemeCallback(viseme);
        console.log(`Manual test viseme: ${viseme}`);
      }, delay);
    });
  }, [visemeCallback]);

  // Test viseme animation based on speaking state
  useEffect(() => {
    if (!visemeCallback) return;
    
    if (isSpeaking) {
      console.log('AI is speaking, starting viseme test...');
      testVisemeSequence();
    } else {
      // Not speaking - closed mouth
      visemeCallback(0);
    }
  }, [isSpeaking, visemeCallback, testVisemeSequence]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-muted/30 backdrop-blur-sm border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold">Voice Agent</h1>
            <p className="text-xs text-muted-foreground">{agentStatus}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setUseGeminiMode(!useGeminiMode)}
            className="rounded-full text-xs flex items-center gap-1"
          >
            {useGeminiMode ? <Zap className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            {useGeminiMode ? 'Gemini' : 'ElevenLabs'}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={testVisemeSequence}
            className="rounded-full text-xs"
          >
            Test Lips
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Character Display */}
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-3xl"></div>
          <CharacterDisplay 
            isSpeaking={isSpeaking}
            isListening={isRecording}
            voiceActivity={voiceActivity}
            emotionalState="neutral"
            onVisemeCallbackReady={handleVisemeCallbackReady}
          />
        </div>

        {/* Conversation History */}
        <div className="max-h-40 overflow-y-auto px-4 pb-4">
          <ConversationHistory messages={messages} />
        </div>
        
        {/* Test button for Gemini mode */}
        {useGeminiMode && (
          <div className="px-4 pb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => geminiSendTextMessage("Hello, how are you feeling today?")}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : 'Test Gemini Conversation'}
            </Button>
          </div>
        )}
      </main>

      {/* Voice Controls */}
      <footer className="p-4 bg-muted/30 backdrop-blur-sm border-t border-border">
        <VoiceControls
          isRecording={isRecording}
          isProcessing={isProcessing}
          isMuted={isMuted}
          voiceActivity={voiceActivity}
          onStartRecording={useGeminiMode ? geminiStartRecording : legacyStartRecording}
          onStopRecording={useGeminiMode ? geminiStopRecording : legacyStopRecording}
          onToggleMute={toggleMute}
        />
      </footer>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-muted/90 backdrop-blur-sm border border-border rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
              <svg className="w-6 h-6 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p className="text-foreground mb-2">Processing voice...</p>
            <p className="text-xs text-muted-foreground">Please wait while I think</p>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-destructive/20 backdrop-blur-sm border border-destructive/30 rounded-lg p-4 z-50">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-destructive" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16v-2h2v2h-2zm0-4V8h2v4h-2z"/>
            </svg>
            <div>
              <p className="text-sm text-destructive-foreground font-medium">Voice Error</p>
              <p className="text-xs text-destructive-foreground/80">{error}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={useGeminiMode ? geminiClearError : legacyClearError}
              className="text-destructive-foreground/80 hover:text-destructive-foreground"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </Button>
          </div>
        </div>
      )}


    </div>
  );
}
