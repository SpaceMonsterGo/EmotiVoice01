# Rive Animation Files

## How to Add Your Character:

1. **Upload your Rive file**: Place your `.riv` file in this directory and name it `voice_agent_character.riv`

2. **Required State Machine**: Your Rive file should include a state machine named `Character_State_Machine` with these inputs:
   - `speaking` (boolean) - Controls lip sync animation when agent speaks
   - `listening` (boolean) - Controls listening state when user speaks
   - `voiceActivity` (number) - Voice activity level (0-1) for real-time response
   - `emotion` (string) - Emotional state: "neutral", "happy", "sad", "excited"

3. **Fallback**: If no Rive file is present, the app automatically shows a beautiful SVG character with:
   - Animated eyes that respond to emotional states
   - Mouth animations synchronized with speaking
   - Voice activity visualization
   - Smooth transitions and gradients

## File Path:
- Place file at: `public/animations/voice_agent_character.riv`
- App will automatically detect and load your character
- No code changes needed - just upload and refresh!