import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { generateConversationResponse } from "./gemini.js";
import { generateSpeechWithTimestamps } from "./elevenlabs-tts.js";
import { convertTimestampsToVisemes } from "./viseme-converter.js";
import path from "path";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
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
      const agentId = process.env.ELEVENLABS_AGENT_ID || "default_agent";
      const signedUrl = `https://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
      
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

  // New conversation API with Gemini + ElevenLabs TTS
  app.post('/api/conversation/message', async (req, res) => {
    try {
      const { message: userMessage, conversationId } = req.body;
      
      if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get conversation history for context
      const conversation = await storage.getConversation(conversationId);
      const messages = conversationId ? await storage.getMessagesByConversationId(conversationId) : [];
      
      // Generate conversation history for context
      const conversationHistory = messages.slice(-10).map(msg => 
        `${msg.sender === 'user' ? 'Human' : 'Emoti'}: ${msg.content}`
      );

      // Generate response using Gemini
      const aiResponse = await generateConversationResponse(userMessage, conversationHistory);
      
      // Generate speech with timestamps using ElevenLabs
      const speechData = await generateSpeechWithTimestamps(aiResponse);
      
      // Convert timestamps to visemes
      const visemes = convertTimestampsToVisemes(speechData.timestamps);
      
      // Store both messages in conversation
      if (conversationId) {
        await storage.createMessage({
          conversationId,
          sender: 'user',
          content: userMessage,
          timestamp: new Date()
        });
        
        await storage.createMessage({
          conversationId,
          sender: 'ai',
          content: aiResponse,
          timestamp: new Date()
        });
      }
      
      // Return response with audio and viseme data
      res.json({
        response: aiResponse,
        audio: speechData.audio.toString('base64'),
        visemes: visemes,
        timestamps: speechData.timestamps
      });
      
    } catch (error) {
      console.error('Error in conversation:', error);
      res.status(500).json({ error: 'Failed to process conversation' });
    }
  });

  return httpServer;
}
