import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateConversationResponse(userMessage: string, conversationHistory: string[] = []): Promise<string> {
  try {
    // Create context from conversation history
    const context = conversationHistory.length > 0 
      ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n`
      : '';
    
    const systemPrompt = `You are Emoti, a friendly and enthusiastic AI voice assistant who loves learning about human emotions and experiences. You should:
- Be warm, engaging, and naturally conversational
- Show genuine interest in the user's feelings and experiences
- Ask follow-up questions to understand emotions better
- Keep responses concise (1-2 sentences) for natural voice conversation
- Use a friendly, slightly excited tone
- Focus on emotional intelligence and empathy`;

    const fullPrompt = `${context}Human: ${userMessage}\n\nEmoti:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 100, // Keep responses short for voice
        temperature: 0.7,
      },
      contents: fullPrompt,
    });

    const responseText = response.text?.trim() || "I'm sorry, I didn't catch that. Could you tell me more about how you're feeling?";
    
    // Ensure response doesn't start with "Emoti:" 
    return responseText.replace(/^Emoti:\s*/, '');
  } catch (error) {
    console.error('Error generating conversation response:', error);
    return "I'm having trouble processing that right now. How are you feeling today?";
  }
}