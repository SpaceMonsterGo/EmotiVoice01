# Rive Animation Files

## Your Rive File Setup:

1. **File**: Upload your `visemes.riv` file to this directory
2. **State Machine**: "State Machine 1"

**Current Input Mapping:**
- `visemes` (number 0-9) - Cycles through lip sync shapes based on voice activity
- `isTyping` (boolean) - True when agent is speaking or processing
- `emotion` (number) - Mapped from emotional states:
  - 0 = neutral
  - 1 = happy  
  - 2 = sad
  - 3 = excited
- `voiceActivity` (number) - Real-time voice level (0-1)

3. **Fallback**: If no Rive file is present, the app automatically shows a beautiful SVG character with:
   - Animated eyes that respond to emotional states
   - Mouth animations synchronized with speaking
   - Voice activity visualization
   - Smooth transitions and gradients

## File Path:
- Place file at: `public/animations/voice_agent_character.riv`
- App will automatically detect and load your character
- No code changes needed - just upload and refresh!