# Voice Agent Application

## Overview

This is a full-stack voice agent application that enables real-time voice conversations with an AI assistant. The application combines React frontend with Express backend, integrating ElevenLabs for voice synthesis and processing. It features a modern, responsive UI with animated character display and real-time voice interaction capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and build processes
- **UI Framework**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Animation**: Rive for character animations

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ESM modules
- **Real-time Communication**: WebSocket server for voice streaming
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL storage

### Key Components

#### Voice Processing
- **ElevenLabs Integration**: Real-time voice synthesis and processing
- **WebSocket Communication**: Bidirectional voice data streaming
- **Audio Processing**: Voice activity detection and audio streaming

#### Database Schema
- **Users**: Authentication and user management
- **Conversations**: Chat session organization
- **Messages**: Message storage with audio URL support

#### Character System
- **Rive Animation**: Interactive character with emotional states
- **Visual Feedback**: Real-time response to voice activity and conversation state
- **Responsive Design**: Adaptive character display for different screen sizes

## Data Flow

1. **Voice Input**: User speaks into microphone, captured by browser
2. **WebSocket Streaming**: Audio data sent to server via WebSocket
3. **ElevenLabs Processing**: Voice data processed for speech recognition and synthesis
4. **Database Storage**: Conversation messages stored in PostgreSQL
5. **Real-time Updates**: UI updates reflect conversation state and character animations
6. **Voice Output**: Synthesized speech played back to user

## External Dependencies

### Core Dependencies
- **@elevenlabs/react**: ElevenLabs React SDK for voice processing
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **@rive-app/canvas**: Character animation system
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management

### UI Dependencies
- **@radix-ui/react-***: Comprehensive UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variants
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Fast build tool and development server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development
- **Dev Server**: Vite dev server with HMR for frontend
- **Backend**: tsx for TypeScript execution with hot reload
- **Database**: PostgreSQL with Drizzle migrations

### Production
- **Build Process**: Vite builds frontend to `dist/public`
- **Server Bundle**: esbuild bundles server code to `dist/index.js`
- **Static Serving**: Express serves built frontend files
- **Database**: PostgreSQL with connection pooling

### Configuration
- **Environment Variables**: DATABASE_URL required for PostgreSQL connection
- **Drizzle Config**: Automated database migrations and schema management
- **Vite Aliases**: Path mapping for clean imports

## Changelog

Changelog:
- July 03, 2025: Initial setup
- July 03, 2025: Built complete voice agent application with:
  - ElevenLabs conversational AI integration with real API keys
  - Animated SVG character with emotional expressions and lip sync
  - Rive animation support ready for custom character files
  - Real-time WebSocket communication for voice data
  - Modern dark theme with purple/blue gradients
  - Voice activity detection and visual feedback
  - Conversation history and message storage
- July 03, 2025: Fixed Rive integration and real-time processing:
  - Successfully integrated user's visemes.riv file with proper binary handling
  - Mapped state machine inputs: visemes (0-9), isTyping (boolean), emotion (0-3)
  - Fixed UI hanging on processing screen during voice calls
  - Implemented non-blocking voice recording stop for real-time experience
  - Verified ElevenLabs connection and Rive character loading working correctly
- July 07, 2025: Redesigned to pure audio-based conversational system:
  - Removed complex dual-mode architecture (Gemini/ElevenLabs separation)
  - Implemented direct ElevenLabs Conversational AI WebSocket integration
  - Created PhonemeConverter for word-to-viseme mapping without Docker dependency
  - Simplified UI to single large microphone button for voice-only interaction
  - ElevenLabs agent auto-introduces itself when conversation starts
- July 07, 2025: Fixed ElevenLabs Conversational AI implementation:
  - Replaced incorrect recording system with proper real-time WebSocket streaming
  - Implemented proper message protocol for conversation_initiation_client_data
  - Added real-time PCM audio streaming to ElevenLabs Conversational AI
  - Fixed authentication by removing API key exposure on client side
  - Character now animates with proper real-time audio stream integration
  - Fixed audio playback with proper PCM16 to Web Audio conversion
  - Added synchronized viseme generation for natural lip-sync animation
  - Implemented ping/pong heartbeat and emotion detection handling
  - Prevented duplicate connections and improved connection management
- July 07, 2025: Simplified to use ElevenLabs built-in conversation management:
  - Created new useElevenLabsSimple hook following official documentation
  - Removed overengineered conversation state management
  - ElevenLabs handles all conversation flow automatically
  - Uses proper ping/pong responses to maintain connection
  - Simplified audio streaming using 250ms MediaRecorder chunks
  - Conversation continues seamlessly after initial AI greeting
  - Updated viseme mapping to match Rive file: 0=Neutral, 1=F, 2=M, 3=O, 4=U, 5=E, 6=AI, 7=CH, 8=S, 9=L
  - Implemented text-based viseme generation for realistic lip sync matching agent responses
  - Added forced alignment data collection infrastructure for future phoneme-level precision
  - Created ForcedAlignmentProcessor with phoneme-to-viseme mapping system
  - Implemented ElevenLabs forced alignment using TTS WebSocket with character-level timestamps
  - Added precise viseme timing with /api/elevenlabs/align endpoint for perfect lip sync
  - Integrated real-time character-to-viseme conversion matching Rive specification
- July 07, 2025: UI improvements for cleaner interaction:
  - Removed distracting "Listening" text and flashing colored progress bar
  - Simplified character animations to only show activity during AI speech
  - Cleaned up status indicators to reduce visual noise during conversations
  - Removed microphone button pulsing animation for cleaner interaction
  - Eliminated green ring around Rive character animation
  - Removed yellow emotional state indicator dot from character display
  - Removed duplicate connection status indicator from voice controls
  - Removed non-functional settings gear icon from header
  - Changed app title to "Emoti Voice Beta"
  - Fixed ElevenLabs forced alignment fetch error using standard fetch API
- July 07, 2025: Fixed duplicate LLM response issue:
  - Removed duplicate viseme generation from audio events (was generating visemes twice)
  - Added connection attempt debouncing to prevent duplicate WebSocket connections
  - Improved WebSocket error handling and connection state management
  - Added detailed logging to track message events and prevent duplicate processing
  - Now only generates visemes from agent_response text events for precise lip sync
- July 07, 2025: ElevenLabs protocol compliance improvements:
  - Fixed signed URL generation to include proper API key authentication
  - Enhanced WebSocket message handling to match official ElevenLabs documentation
  - Added support for tentative agent responses and improved ping/pong handling
  - Improved conversation initiation with proper config override structure
  - Added better error handling and interruption management with viseme reset
  - Enhanced logging for all ElevenLabs protocol message types
  - Commented out conversation_config_override to use agent's default configuration
- July 07, 2025: Fixed audio playback and deprecated ScriptProcessorNode:
  - Replaced deprecated ScriptProcessorNode with MediaRecorder for audio streaming
  - Enhanced audio event handling with better error logging and state management
  - Fixed audio context management to prevent audio playback issues
  - Added proper cleanup for MediaRecorder in stop conversation function
  - Improved audio debugging with detailed logging for troubleshooting
  - Reverted to ScriptProcessorNode temporarily as MediaRecorder doesn't provide required PCM16 format
  - Enhanced conversation state management to prevent timeouts after first message
  - Added proper state transitions for user transcript and agent response events
- July 07, 2025: Fixed microphone audio processing and voice activity detection:
  - Lowered voice activity threshold from 0.01 to 0.001 for better sensitivity
  - Changed to continuous audio streaming (ElevenLabs handles voice activity detection)
  - Added volume level debugging to troubleshoot microphone input issues
  - Enhanced microphone settings with echo cancellation and noise suppression
  - Added detailed audio track logging for microphone diagnostics
- July 07, 2025: Simplified to use official ElevenLabs React SDK:
  - Replaced complex WebSocket implementation with @elevenlabs/react package
  - Removed over-engineered audio processing and voice activity detection
  - Used useConversation hook from official ElevenLabs SDK for reliable microphone handling
  - Maintained viseme generation through existing forced alignment API
  - Simplified state management using proven SDK patterns
  - Fixed microphone issues by leveraging battle-tested ElevenLabs implementation
- July 08, 2025: Fixed viseme timing to use phoneme-based grouping instead of character-based:
  - Implemented phoneme-like character grouping for natural speech timing
  - Added viseme smoothing to prevent rapid mouth movement changes
  - Introduced dominant viseme selection for character groups
  - Set minimum 100ms duration per viseme for realistic animation
  - Added consecutive identical viseme merging to reduce redundancy
  - Enhanced logging to show phoneme duration and timing information
  - Fixed unnaturally fast lip sync by grouping at vowel/consonant boundaries
- July 08, 2025: Optimized viseme processing to reduce lag:
  - Restricted viseme generation to AI responses only (not user speech input)
  - Added explicit source checking to prevent processing user transcripts
  - Improved logging to distinguish between AI and user messages
  - Eliminated unnecessary alignment API calls for outbound audio
  - Reduced system lag by processing visemes only when needed for character animation
- July 10, 2025: Implemented Phase 1 performance optimizations:
  - **Strict AI-Only Processing**: Enhanced filtering to ensure visemes are never processed for user speech
  - **Duplicate Message Prevention**: Added message deduplication to prevent processing same AI response twice
  - **Timeout Management**: Implemented centralized timeout tracking and cleanup to prevent memory leaks
  - **Connection Debouncing**: Added connection attempt tracking to prevent duplicate WebSocket connections
  - **Performance Logging**: Added detailed timing metrics for alignment API calls and message processing
  - **Server-Side Caching**: Implemented LRU cache for alignment results to reduce redundant API calls
  - **Resource Cleanup**: Added proper cleanup on conversation stop and component unmount
  - **Batch Processing**: Optimized viseme timeout handling with centralized management

## User Preferences

Preferred communication style: Simple, everyday language.