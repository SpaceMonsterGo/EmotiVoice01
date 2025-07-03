import { useState, useEffect } from "react";
import { CharacterDisplay } from "@/components/character-display";
import { VoiceControls } from "@/components/voice-controls";
import { ConversationHistory } from "@/components/conversation-history";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { Button } from "@/components/ui/button";
import { Settings, Wifi } from "lucide-react";
import { testRiveFile } from "@/test-rive";

export default function Home() {
  const {
    isConnected,
    isRecording,
    isProcessing,
    isSpeaking,
    messages,
    error,
    startRecording,
    stopRecording,
    toggleMute,
    isMuted,
    voiceActivity,
    agentStatus,
    clearError
  } = useVoiceAgent();

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
          />
        </div>

        {/* Conversation History */}
        <div className="max-h-40 overflow-y-auto px-4 pb-4">
          <ConversationHistory messages={messages} />
        </div>
      </main>

      {/* Voice Controls */}
      <footer className="p-4 bg-muted/30 backdrop-blur-sm border-t border-border">
        <VoiceControls
          isRecording={isRecording}
          isProcessing={isProcessing}
          isMuted={isMuted}
          voiceActivity={voiceActivity}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
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
              onClick={clearError}
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
