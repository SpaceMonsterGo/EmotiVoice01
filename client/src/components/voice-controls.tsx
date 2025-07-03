import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square, Play } from "lucide-react";

interface VoiceControlsProps {
  isRecording: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  voiceActivity: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleMute: () => void;
}

export function VoiceControls({
  isRecording,
  isProcessing,
  isMuted,
  voiceActivity,
  onStartRecording,
  onStopRecording,
  onToggleMute
}: VoiceControlsProps) {
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-4">
        {/* Mute Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleMute}
          className={`p-3 rounded-full transition-all duration-200 ${
            isMuted ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30' : 'hover:bg-muted'
          }`}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        
        {/* Main Voice Button */}
        <Button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isProcessing}
          className={`relative p-6 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25' 
              : 'bg-gradient-to-br from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 shadow-primary/25'
          }`}
        >
          {/* Recording Ring */}
          <div className={`absolute inset-0 rounded-full border-4 border-green-500 transition-opacity duration-300 ${
            isRecording ? 'opacity-100 animate-pulse' : 'opacity-0'
          }`}></div>
          
          {/* Processing Ring */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/40 transition-opacity duration-300 ${
            isProcessing ? 'opacity-100 animate-spin' : 'opacity-0'
          }`}></div>
          
          {/* Button Icon */}
          {isRecording ? (
            <Square className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </Button>
        
        {/* Stop Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onStopRecording}
          className="p-3 bg-destructive/20 border-destructive/30 hover:bg-destructive/30 rounded-full transition-all duration-200"
        >
          <Square className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      
      {/* Voice Activity Indicator */}
      <div className="flex items-center justify-center space-x-2">
        <div className="flex space-x-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1 bg-green-500 rounded-full animate-speak transition-all duration-200 ${
                voiceActivity > i * 0.2 ? 'opacity-100' : 'opacity-30'
              }`}
              style={{
                height: `${Math.max(16, Math.min(32, 16 + (voiceActivity * 20)))}px`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {voiceActivity > 0.1 ? 'Voice detected' : 'No voice'}
        </span>
      </div>
    </div>
  );
}
