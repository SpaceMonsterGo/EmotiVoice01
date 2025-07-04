import { useEffect, useState, useCallback, RefObject } from "react";

interface RiveState {
  visemes: number;
  isTyping: boolean;
  emotion: number;
  voiceActivity: number;
}

export function useRiveCharacter(containerRef: RefObject<HTMLDivElement>) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [riveState, setRiveStateInternal] = useState<RiveState>({
    visemes: 0,
    isTyping: false,
    emotion: 0,
    voiceActivity: 0
  });
  const [stateMachine, setStateMachine] = useState<any>(null);

  useEffect(() => {
    let riveInstance: any = null;

    const initializeRive = async () => {
      try {
        // Dynamically import Rive to avoid SSR issues
        const { Rive, Layout, Fit, Alignment } = await import('@rive-app/canvas');
        
        if (!containerRef.current) return;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        containerRef.current.appendChild(canvas);
        setCanvas(canvas);

        // Try to load the Rive file with better error handling
        try {
          // Import the Rive file as an asset using Vite's asset handling with cache busting
          const riveUrl = `/src/assets/visemes.riv?v=${Date.now()}`;
          const response = await fetch(riveUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch Rive file: ${response.status}`);
          }
          
          // Get the file as an ArrayBuffer for proper binary handling
          const buffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);
          console.log(`Loading new Rive file: ${buffer.byteLength} bytes`);
          
          // Initialize Rive with the binary data
          riveInstance = new Rive({
            buffer: uint8Array,
            canvas: canvas,
            layout: new Layout({
              fit: Fit.Contain,
              alignment: Alignment.Center,
            }),
            stateMachines: 'State Machine 1',
            onLoad: () => {
              console.log('Rive character loaded successfully');
              const sm = riveInstance.stateMachineInputs('State Machine 1');
              setStateMachine(sm);
              console.log('State machine inputs:', sm);
            },
            onLoadError: (error: any) => {
              console.error('Failed to load Rive character:', error);
              // Fall back to placeholder - SVG character will be shown instead
            }
          });
        } catch (error) {
          console.error('Error loading Rive file:', error);
          // Fall back to SVG character
        }

      } catch (error) {
        console.error('Failed to initialize Rive:', error);
        // Rive will gracefully fall back to placeholder in component
      }
    };

    initializeRive();

    return () => {
      if (riveInstance) {
        riveInstance.cleanup();
      }
      if (canvas && containerRef.current?.contains(canvas)) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, [containerRef]);

  const setRiveState = useCallback((key: keyof RiveState, value: any) => {
    setRiveStateInternal(prev => ({ ...prev, [key]: value }));
    
    // Update Rive state machine if available
    if (stateMachine && stateMachine.length > 0) {
      const input = stateMachine.find((input: any) => input.name === key);
      if (input) {
        if (typeof value === 'boolean') {
          input.value = value;
        } else if (typeof value === 'number') {
          input.value = Math.round(value); // Ensure integer for visemes/emotion
        }
        console.log(`Updated Rive input ${key} to ${value}`);
      }
    }
  }, []);

  return {
    canvas,
    riveState,
    setRiveState
  };
}
