import { useEffect, useState, useCallback, RefObject } from "react";

interface RiveState {
  speaking: boolean;
  listening: boolean;
  voiceActivity: number;
  emotion: string;
}

export function useRiveCharacter(containerRef: RefObject<HTMLDivElement>) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [riveState, setRiveStateInternal] = useState<RiveState>({
    speaking: false,
    listening: false,
    voiceActivity: 0,
    emotion: 'neutral'
  });

  useEffect(() => {
    let riveInstance: any = null;
    let stateMachine: any = null;

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

        // Initialize Rive with a working sample file
        riveInstance = new Rive({
          src: 'https://cdn.rive.app/animations/vehicles.riv', // Using a working sample file
          canvas: canvas,
          layout: new Layout({
            fit: Fit.Contain,
            alignment: Alignment.Center,
          }),
          stateMachines: 'bumpy_car',
          onLoad: () => {
            console.log('Rive character loaded');
            stateMachine = riveInstance.stateMachineInputs('bumpy_car');
          },
          onLoadError: (error: any) => {
            console.error('Failed to load Rive character:', error);
            // Fall back to placeholder
          }
        });

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
    // This would be implemented based on your specific Rive file structure
    // For example:
    // if (stateMachine) {
    //   const input = stateMachine.find(input => input.name === key);
    //   if (input) {
    //     if (typeof value === 'boolean') {
    //       input.value = value;
    //     } else if (typeof value === 'number') {
    //       input.value = value;
    //     } else if (typeof value === 'string') {
    //       input.fire(); // For trigger inputs
    //     }
    //   }
    // }
  }, []);

  return {
    canvas,
    riveState,
    setRiveState
  };
}
