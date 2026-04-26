import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

if (!DEEPGRAM_API_KEY) {
  console.error('[Deepgram] ⚠ DEEPGRAM_API_KEY is not set!');
}

const deepgram = createClient(DEEPGRAM_API_KEY);

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  latencyMs: number;
}

/**
 * Create a live Deepgram STT connection for a socket session.
 */
export function createLiveTranscription(
  onTranscript: (result: TranscriptionResult) => void,
  onError: (err: Error) => void
) {
  const startTime = Date.now();
  let isOpen = false;
  let audioQueue: Buffer[] = [];

  console.log('[Deepgram] Creating live transcription connection...');

  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('[Deepgram] ✓ Connection opened');
    isOpen = true;
    // Flush queued audio
    for (const buf of audioQueue) {
      connection.send(new Uint8Array(buf) as unknown as ArrayBuffer);
    }
    audioQueue = [];
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log('[Deepgram] Connection closed');
    isOpen = false;
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel?.alternatives?.[0];
    if (transcript && transcript.transcript.trim()) {
      console.log(`[Deepgram] Transcript: "${transcript.transcript}" (final=${data.is_final}, conf=${transcript.confidence})`);
      onTranscript({
        text: transcript.transcript,
        isFinal: data.is_final ?? false,
        confidence: transcript.confidence ?? 0,
        latencyMs: Date.now() - startTime,
      });
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('[Deepgram] Error:', err);
    onError(new Error(`Deepgram error: ${err.message || JSON.stringify(err)}`));
  });

  let chunkCount = 0;

  return {
    send(audioChunk: ArrayBuffer) {
      const buf = Buffer.from(audioChunk);
      chunkCount++;
      if (chunkCount % 50 === 1) {
        console.log(`[Deepgram] Audio chunk #${chunkCount} (${buf.length} bytes, open=${isOpen})`);
      }

      if (isOpen) {
        connection.send(new Uint8Array(buf) as unknown as ArrayBuffer);
      } else {
        // Queue audio until connection opens
        audioQueue.push(buf);
      }
    },
    close() {
      console.log(`[Deepgram] Closing (sent ${chunkCount} chunks)`);
      isOpen = false;
      connection.requestClose();
    },
  };
}
