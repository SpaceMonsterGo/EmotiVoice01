import { useEffect, useState, useCallback, RefObject } from "react";

interface RiveState {
  Neutral: number;
  F: number;
  M: number;
  O: number;
  U: number;
  E: number;
  AI: number;
  CH: number;
  S: number;
  L: number;
  isTyping: boolean;
  emotion: number;
  voiceActivity: number;
}

export function useRiveCharacter(containerRef: RefObject<HTMLDivElement>) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [riveState, setRiveStateInternal] = useState<RiveState>({
    Neutral: 100,
    F: 0,
    M: 0,
    O: 0,
    U: 0,
    E: 0,
    AI: 0,
    CH: 0,
    S: 0,
    L: 0,
    isTyping: false,
    emotion: 0,
    voiceActivity: 0,
  });
  const [stateMachine, setStateMachine] = useState<any>(null);

  useEffect(() => {
    let riveInstance: any = null;

    const initializeRive = async () => {
      try {
        const { Rive, Layout, Fit, Alignment } = await import('@rive-app/canvas');
        if (!containerRef.current) return;

        const canvasEl = document.createElement('canvas');
        canvasEl.width = containerRef.current.clientWidth;
        canvasEl.height = containerRef.current.clientHeight;
        containerRef.current.appendChild(canvasEl);
        setCanvas(canvasEl);

        const riveUrl = `/animations/visemes.riv?v=${Date.now()}`;
        const response = await fetch(riveUrl);
        if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        riveInstance = new Rive({
          buffer: uint8,
          canvas: canvasEl,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
          stateMachines: 'State Machine 1',
          onLoad: () => {
            const inputs = riveInstance.stateMachineInputs('State Machine 1');
            setStateMachine(inputs);
            if (!riveInstance.isPlaying) riveInstance.play();
          },
          onLoadError: (err: any) => console.error('Rive load error:', err)
        });
      } catch (err) {
        console.error('Rive init failed:', err);
      }
    };

    initializeRive();
    return () => {
      if (riveInstance) riveInstance.cleanup();
      if (canvas && containerRef.current?.contains(canvas)) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, [containerRef]);

  const setRiveState = useCallback((key: keyof RiveState, value: any) => {
    setRiveStateInternal(prev => ({ ...prev, [key]: value } as RiveState));
    if (stateMachine) {
      const input = stateMachine.find((i: any) => i.name === key);
      if (input) {
        try { input.value = typeof value === 'number' ? Math.round(value) : value; }
        catch (e) { console.error(`Failed to set Rive input ${key}:`, e); }
      }
    }
  }, [stateMachine]);

  const playVisemeSequence = async (text: string) => {
    if (!stateMachine) return;
    
    // Reset all viseme inputs to 0
    (['Neutral','F','M','O','U','E','AI','CH','S','L'] as (keyof RiveState)[])  
      .forEach(k => setRiveState(k, k === 'Neutral' ? 100 : 0));

    // Simple viseme generation based on text characters
    // This is a basic implementation - the real viseme data comes from ElevenLabs
    console.log('Playing viseme sequence for text:', text);
    
    // For now, just animate the mouth opening and closing for speaking
    setRiveState('isTyping', true);
    setTimeout(() => {
      setRiveState('isTyping', false);
      setRiveState('Neutral', 100);
    }, text.length * 50); // Rough timing based on text length
  };

  return { canvas, riveState, setRiveState, playVisemeSequence };
}
