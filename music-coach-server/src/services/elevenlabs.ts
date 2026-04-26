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

/**
 * Stream TTS audio from ElevenLabs.
 * Returns timing metrics. If ElevenLabs fails, returns empty with fallback flag.
 */
export async function streamTTS(
  text: string,
  onChunk: (chunk: Buffer, isFinal: boolean) => void
): Promise<TTSResult> {
  const startTime = performance.now();

  try {
    let firstChunkTime = 0;
    const chunks: Buffer[] = [];

    const audioStream = await client.textToSpeech.convertAsStream(VOICE_ID, {
      text,
      model_id: MODEL_ID,
      output_format: 'pcm_16000',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    const allChunks: Buffer[] = [];

    for await (const chunk of audioStream) {
      const buf = Buffer.from(chunk);
      if (!firstChunkTime) firstChunkTime = performance.now() - startTime;
      allChunks.push(buf);
      chunks.push(buf);
    }

    for (let i = 0; i < allChunks.length; i++) {
      onChunk(allChunks[i], i === allChunks.length - 1);
    }

    return {
      chunks,
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
