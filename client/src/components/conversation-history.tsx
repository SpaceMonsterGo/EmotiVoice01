import { format } from "date-fns";
import type { Message } from "@shared/schema";

interface ConversationHistoryProps {
  messages: Message[];
}

export function ConversationHistory({ messages }: ConversationHistoryProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No conversation yet. Start by saying hello!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className="flex items-start space-x-3">
          {message.sender === 'user' ? (
            <div className="flex-1 flex justify-end">
              <div className="bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-2xl px-4 py-2 max-w-xs">
                <p className="text-sm text-foreground">{message.content}</p>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.timestamp), 'h:mm a')}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex justify-start">
              <div className="bg-muted/80 backdrop-blur-sm border border-border rounded-2xl px-4 py-2 max-w-xs">
                <p className="text-sm text-foreground">{message.content}</p>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.timestamp), 'h:mm a')}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
