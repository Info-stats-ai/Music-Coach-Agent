import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2';

export interface TTSResult {
  chunks: Buffer[];
  firstChunkMs: number;
  totalMs: number;
  usedFallback: boolean;
}

export async function streamTTS(
  text: string,
  onChunk: (chunk: Buffer, isFinal: boolean) => void
): Promise<TTSResult> {
  const startTime = performance.now();

  try {
    let firstChunkTime = 0;
    const allChunks: Buffer[] = [];

    // Use mp3 so browser can decode it directly
    const audioStream = await client.textToSpeech.convertAsStream(VOICE_ID, {
      text,
      model_id: MODEL_ID,
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    for await (const chunk of audioStream) {
      const buf = Buffer.from(chunk);
      if (!firstChunkTime) firstChunkTime = performance.now() - startTime;
      allChunks.push(buf);
    }

    // Combine all chunks into one buffer and send as single chunk
    // (mp3 decoding works better with complete data)
    const fullAudio = Buffer.concat(allChunks);
    onChunk(fullAudio, true);

    console.log(`[TTS] ✓ Generated ${fullAudio.length} bytes mp3`);

    return {
      chunks: [fullAudio],
      firstChunkMs: Math.round(firstChunkTime),
      totalMs: Math.round(performance.now() - startTime),
      usedFallback: false,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[TTS] ElevenLabs failed (${errMsg}), using browser fallback`);

    return {
      chunks: [],
      firstChunkMs: 0,
      totalMs: Math.round(performance.now() - startTime),
      usedFallback: true,
    };
  }
}
