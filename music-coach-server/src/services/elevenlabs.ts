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

/** Add WAV header to raw PCM data so browsers can decode it */
function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export async function streamTTS(
  text: string,
  onPcmChunk: (chunk: Buffer, isFinal: boolean) => void,
  onWavComplete: (wav: Buffer) => void
): Promise<TTSResult> {
  const startTime = performance.now();

  try {
    let firstChunkTime = 0;
    const allChunks: Buffer[] = [];

    // Output raw PCM 16kHz mono 16-bit — SpatialReal needs this
    const audioStream = await client.textToSpeech.convertAsStream(VOICE_ID, {
      text,
      model_id: MODEL_ID,
      output_format: 'pcm_16000',
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

    // Send raw PCM chunks to SpatialReal for lip-sync
    const fullPcm = Buffer.concat(allChunks);
    onPcmChunk(fullPcm, true);

    // Convert to WAV for browser playback
    const wav = pcmToWav(fullPcm, 16000, 1, 16);
    onWavComplete(wav);

    console.log(`[TTS] ✓ ${fullPcm.length}b PCM, ${wav.length}b WAV`);

    return {
      chunks: allChunks,
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
