interface ElevenLabsTTSResponse {
  audio: Buffer;
  timestamps: Array<{
    char: string;
    start: number;
    end: number;
    word?: string;
  }>;
}

interface ElevenLabsTTSOptions {
  voice_id?: string;
  model_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export async function generateSpeechWithTimestamps(
  text: string,
  options: ElevenLabsTTSOptions = {}
): Promise<ElevenLabsTTSResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not found');
  }

  const {
    voice_id = 'pNInz6obpgDQGcFmaJgB', // Default voice (Adam)
    model_id = 'eleven_turbo_v2_5',
    voice_settings = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    }
  } = options;

  try {
    // Call ElevenLabs TTS API with timestamps
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id,
          voice_settings,
          enable_logging: false,
          optimize_streaming_latency: 0,
          output_format: 'mp3_44100_128'
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract audio and timestamps
    const audioBuffer = Buffer.from(data.audio_base64, 'base64');
    const timestamps = data.alignment?.chars || [];

    return {
      audio: audioBuffer,
      timestamps: timestamps.map((char: any) => ({
        char: char.character,
        start: char.start_time_ms,
        end: char.end_time_ms,
        word: char.word
      }))
    };
  } catch (error) {
    console.error('Error generating speech with timestamps:', error);
    throw error;
  }
}

export async function getAvailableVoices(): Promise<any[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not found');
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw error;
  }
}