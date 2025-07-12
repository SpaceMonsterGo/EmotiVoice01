import React, { useRef } from 'react';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import { RiveCharacter } from '@/components/RiveCharacter';

function App() {
  const riveRef = useRef<any>(null);

  // Trigger lip-sync when the agent sends text
  const handleAgentReply = (text: string) => {
    riveRef.current?.playVisemeSequence(text);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* Rive character for lip-sync */}
        <RiveCharacter ref={riveRef} />

        <Switch>
          {/* Pass down the onAgentReply to Home so it can call visemes */}
          <Route
            path="/"
            component={() => <Home onAgentReply={handleAgentReply} />}
          />
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
