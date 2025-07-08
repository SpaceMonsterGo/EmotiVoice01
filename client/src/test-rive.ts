// Test script to verify Rive file loading
import { Rive } from "@rive-app/canvas";

export async function testRiveFile() {
  try {
    const response = await fetch('/src/assets/visemes.riv');
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    console.log('Buffer size:', buffer.byteLength);
    
    const uint8Array = new Uint8Array(buffer);
    console.log('First 10 bytes:', Array.from(uint8Array.slice(0, 10)));
    
    // Try to create a simple canvas to test
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    
    const rive = new Rive({
      buffer: uint8Array,
      canvas: canvas,
      onLoad: () => {
        console.log('✅ Rive file loaded successfully!');
        console.log('Available state machines:', rive.stateMachineNames);
      },
      onLoadError: (error) => {
        console.error('❌ Rive load error:', error);
      }
    });
    
    return rive;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}