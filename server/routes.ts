import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { generateSpeechWithTimestamps } from "./elevenlabs-tts.js";
import { PhonemeConverter } from "./phoneme-converter.js";
import path from "path";
import fs from "fs";
import multer from "multer";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });
  
  // WebSocket server for real-time voice communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch (data.type) {
          case 'voice_start':
            // Handle voice recording start
            ws.send(JSON.stringify({ type: 'voice_start_ack' }));
            break;
          case 'voice_data':
            // Handle voice data streaming
            // Forward to ElevenLabs API
            break;
          case 'voice_end':
            // Handle voice recording end
            ws.send(JSON.stringify({ type: 'voice_end_ack' }));
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // API Routes
  
  // Get ElevenLabs signed URL
  app.get('/api/elevenlabs/signed-url', async (req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || "";
      
      if (!apiKey) {
        return res.status(500).json({ error: 'ElevenLabs API key not configured' });
      }
      
      // Generate a signed URL for the ElevenLabs conversational AI
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      if (!agentId) {
        return res.status(500).json({ error: 'ElevenLabs Agent ID not configured' });
      }
      const signedUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
      
      res.json({ 
        signedUrl,
        apiKey,
        agentId 
      });
    } catch (error) {
      console.error('Error generating signed URL:', error);
      res.status(500).json({ error: 'Failed to generate signed URL' });
    }
  });

  // Voice processing endpoint
  app.post('/api/voice/process', upload.single('audio'), async (req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'ElevenLabs API key not configured' });
      }

      // Extract audio from form data
      const audioFile = req.file;
      if (!audioFile) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      console.log('Received audio file:', audioFile.originalname, 'Size:', audioFile.size);

      // Convert audio to transcription using ElevenLabs or OpenAI Whisper
      let transcription = "Hello! Thanks for speaking to me."; // Placeholder for now
      
      // Generate AI response (you can integrate with your preferred AI service here)
      const aiResponse = `Hello! I'm responding using ElevenLabs voice synthesis with your actual API key. I received your ${Math.round(audioFile.size / 1024)}KB audio recording. This voice should sound much more natural than the browser's built-in speech synthesis.`;
      
      // Use ElevenLabs TTS with your API key
      console.log('Generating speech with ElevenLabs...');
      const ttsResponse = await generateSpeechWithTimestamps(aiResponse, {
        voice_id: 'pNInz6obpgDQGcFmaJgB', // You can change this to your preferred voice
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      });
      console.log('ElevenLabs TTS response received, audio size:', ttsResponse.audio.length);
      
      // Convert timestamps to visemes
      const visemes = PhonemeConverter.convertWordsToVisemes(
        ttsResponse.timestamps.map(t => ({
          word: t.word || t.char,
          start: t.start,
          end: t.end
        }))
      );
      
      // Create audio data URL with proper ElevenLabs audio
      const audioBuffer = ttsResponse.audio;
      const audioBase64 = audioBuffer.toString('base64');
      const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
      
      res.json({
        transcription,
        message: aiResponse,
        audioUrl: audioDataUrl,
        visemes: visemes,
        timestamps: ttsResponse.timestamps
      });
    } catch (error) {
      console.error('Voice processing error:', error);
      res.status(500).json({ error: 'Failed to process voice: ' + error.message });
    }
  });

  // ElevenLabs speech with timestamps endpoint  
  app.post('/api/elevenlabs/speech-with-timestamps', async (req, res) => {
    try {
      const { text, apiKey } = req.body;
      
      if (!text || !apiKey) {
        return res.status(400).json({ error: 'Text and API key are required' });
      }

      // Use a default voice ID for text-to-speech
      const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default voice
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=audio/mpeg&timestamp_start=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // Handle multipart response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('multipart')) {
        const responseText = await response.text();
        
        // Parse multipart response to extract timestamps
        const parts = responseText.split('\r\n\r\n');
        let timestamps = [];
        
        for (const part of parts) {
          try {
            if (part.includes('timestamps')) {
              const jsonMatch = part.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.timestamps) {
                  timestamps = data.timestamps;
                  break;
                }
              }
            }
          } catch (e) {
            // Continue parsing other parts
          }
        }
        
        res.json({ timestamps });
      } else {
        // Fallback: generate synthetic timestamps based on text length
        const words = text.split(' ');
        const avgWordDuration = 0.5; // seconds per word
        let currentTime = 0;
        
        const timestamps = words.map((word: string) => {
          const start = currentTime;
          const end = currentTime + avgWordDuration;
          currentTime = end + 0.1; // Small gap between words
          
          return {
            word,
            start,
            end,
            char: word[0] || '',
          };
        });
        
        res.json({ timestamps });
      }
    } catch (error) {
      console.error('Error generating speech with timestamps:', error);
      res.status(500).json({ error: 'Failed to generate speech with timestamps' });
    }
  });

  // Create a new conversation
  app.post('/api/conversations', async (req, res) => {
    try {
      const { title } = req.body;
      const userId = 1; // Mock user ID for now
      
      const conversation = await storage.createConversation({ title, userId });
      res.json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  // Get conversation messages
  app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getMessagesByConversationId(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Create a new message
  app.post('/api/messages', async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new_message',
            message
          }));
        }
      });
      
      res.json(message);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });

  // Simplified conversation processing endpoint
  app.post('/api/conversation/process', async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      // For now, use a simple demo response (ElevenLabs Conversational AI requires WebSocket)
      // TODO: Implement proper WebSocket integration with ElevenLabs Conversational AI
      const aiResponse = `Thank you for saying "${message}". I'm a voice agent powered by ElevenLabs and I can see you clearly! I'm excited to demonstrate precise lip synchronization with word-level timing. How can I help you today?`;
      
      // Generate speech with word timestamps using ElevenLabs TTS
      const speechData = await generateSpeechWithTimestamps(aiResponse);
      
      // Convert word timestamps to phoneme-based viseme timing
      const visemeTimings = speechData.timestamps?.length > 0 
        ? PhonemeConverter.convertWordsToVisemes(speechData.timestamps)
        : PhonemeConverter.generateVisemeTimeline(aiResponse, 3.0); // Fallback: 3 second duration
      
      // Save audio as base64 for client playback
      const audioBase64 = `data:audio/wav;base64,${speechData.audio.toString('base64')}`;
      
      res.json({
        response: aiResponse,
        audioUrl: audioBase64,
        visemeTimings: visemeTimings,
        wordTimings: speechData.timestamps || []
      });
      
    } catch (error) {
      console.error('Error processing conversation:', error);
      res.status(500).json({ error: 'Failed to process conversation' });
    }
  });

  return httpServer;
}
