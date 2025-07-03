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

## User Preferences

Preferred communication style: Simple, everyday language.