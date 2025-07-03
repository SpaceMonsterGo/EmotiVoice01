import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
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

  return httpServer;
}
