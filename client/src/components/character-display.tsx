import { useMemo } from "react";

interface CharacterDisplayProps {
  isSpeaking: boolean;
  isListening: boolean;
  voiceActivity: number;
  emotionalState: string;
}

export function CharacterDisplay({ 
  isSpeaking, 
  isListening, 
  voiceActivity, 
  emotionalState 
}: CharacterDisplayProps) {
  // Calculate mouth animation based on voice activity
  const mouthScale = useMemo(() => {
    if (isSpeaking) {
      return 1 + (voiceActivity * 0.3); // Scale mouth based on voice activity
    }
    return 1;
  }, [isSpeaking, voiceActivity]);

  // Calculate eye expressions based on emotional state
  const eyeExpression = useMemo(() => {
    switch (emotionalState) {
      case 'happy':
        return { scaleY: 0.6, offsetY: -2 }; // Squinted happy eyes
      case 'sad':
        return { scaleY: 1.2, offsetY: 2 }; // Droopy eyes
      case 'excited':
        return { scaleY: 1.3, offsetY: -1 }; // Wide eyes
      default:
        return { scaleY: 1, offsetY: 0 }; // Normal eyes
    }
  }, [emotionalState]);

  return (
    <div className="relative z-10 w-80 h-80 md:w-96 md:h-96 flex items-center justify-center">
      {/* Main Character */}
      <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-primary/30 relative bg-gradient-to-br from-primary/10 to-secondary/10">
        <svg 
          className="w-full h-full" 
          viewBox="0 0 200 200" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background gradient */}
          <defs>
            <radialGradient id="faceGradient" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="hsl(231, 83%, 84%)" />
              <stop offset="100%" stopColor="hsl(231, 83%, 64%)" />
            </radialGradient>
            <linearGradient id="eyeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(210, 40%, 20%)" />
              <stop offset="100%" stopColor="hsl(210, 40%, 10%)" />
            </linearGradient>
          </defs>
          
          {/* Face */}
          <circle cx="100" cy="100" r="90" fill="url(#faceGradient)" />
          
          {/* Eyes */}
          <g transform={`translate(0, ${eyeExpression.offsetY})`}>
            <ellipse 
              cx="75" 
              cy="80" 
              rx="8" 
              ry={12 * eyeExpression.scaleY}
              fill="url(#eyeGradient)"
              className={isListening ? 'animate-pulse' : ''}
            />
            <ellipse 
              cx="125" 
              cy="80" 
              rx="8" 
              ry={12 * eyeExpression.scaleY}
              fill="url(#eyeGradient)"
              className={isListening ? 'animate-pulse' : ''}
            />
            
            {/* Eye highlights */}
            <circle cx="77" cy="76" r="2" fill="hsl(210, 40%, 90%)" opacity="0.8" />
            <circle cx="127" cy="76" r="2" fill="hsl(210, 40%, 90%)" opacity="0.8" />
          </g>
          
          {/* Mouth */}
          <g transform={`translate(100, 130) scale(${mouthScale})`}>
            {isSpeaking ? (
              // Speaking mouth (oval)
              <ellipse 
                cx="0" 
                cy="0" 
                rx="12" 
                ry="8" 
                fill="hsl(210, 40%, 10%)" 
                className="animate-speak"
              />
            ) : (
              // Resting mouth (line)
              <line 
                x1="-8" 
                y1="0" 
                x2="8" 
                y2="0" 
                stroke="hsl(210, 40%, 20%)" 
                strokeWidth="3" 
                strokeLinecap="round"
              />
            )}
          </g>
          
          {/* Cheeks (subtle glow when speaking) */}
          {isSpeaking && (
            <>
              <circle cx="60" cy="110" r="8" fill="hsl(0, 70%, 80%)" opacity="0.3" className="animate-pulse" />
              <circle cx="140" cy="110" r="8" fill="hsl(0, 70%, 80%)" opacity="0.3" className="animate-pulse" />
            </>
          )}
        </svg>
      </div>
      
      {/* Voice Activity Ring */}
      <div className={`absolute inset-0 rounded-full border-4 transition-all duration-300 ${
        isSpeaking ? 'border-green-500/50 opacity-100 animate-pulse' : 
        isListening ? 'border-blue-500/50 opacity-100 animate-pulse' : 'border-transparent opacity-0'
      }`}></div>
      
      {/* Emotional State Indicator */}
      <div className={`absolute top-4 right-4 w-4 h-4 rounded-full animate-bounce-gentle ${
        emotionalState === 'happy' ? 'bg-green-500' :
        emotionalState === 'sad' ? 'bg-blue-500' :
        emotionalState === 'excited' ? 'bg-yellow-500' :
        'bg-amber-500'
      }`}></div>
      
      {/* Speaking Status */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-muted/80 backdrop-blur-sm px-4 py-2 rounded-full">
        <div className={`w-2 h-2 rounded-full transition-colors duration-200 ${
          isListening ? 'bg-green-500 animate-pulse' :
          isSpeaking ? 'bg-blue-500 animate-pulse' :
          'bg-muted-foreground'
        }`}></div>
        <span className="text-sm text-muted-foreground">
          {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready'}
        </span>
      </div>
    </div>
  );
}
