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
 * Create a live Deepgram STT connection.
 * Handles reconnection and keepalive.
 */
export function createLiveTranscription(
  onTranscript: (result: TranscriptionResult) => void,
  onError: (err: Error) => void
) {
  const startTime = Date.now();
  let isOpen = false;
  let chunkCount = 0;
  let audioQueue: Buffer[] = [];
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  let connection: ReturnType<typeof deepgram.listen.live> | null = null;

  function createConnection() {
    console.log('[Deepgram] Creating connection...');

    connection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1500,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log('[Deepgram] ✓ Connection opened');
      isOpen = true;

      // Send keepalive every 8 seconds to prevent timeout
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      keepAliveInterval = setInterval(() => {
        if (connection && isOpen) {
          try {
            connection.keepAlive();
          } catch {
            // ignore keepalive errors
          }
        }
      }, 8000);

      // Flush queued audio
      for (const buf of audioQueue) {
        try {
          connection!.send(new Uint8Array(buf) as unknown as ArrayBuffer);
        } catch { /* ignore */ }
      }
      audioQueue = [];
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Deepgram] Connection closed, will reconnect on next audio');
      isOpen = false;
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0];
      if (transcript && transcript.transcript.trim()) {
        console.log(`[Deepgram] "${transcript.transcript}" (final=${data.is_final})`);
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
      isOpen = false;
      onError(new Error(`Deepgram: ${err.message || JSON.stringify(err)}`));
    });
  }

  // Don't create connection immediately — wait for first audio chunk
  // This prevents the connection from timing out before user starts speaking

  return {
    send(audioChunk: ArrayBuffer) {
      const buf = Buffer.from(audioChunk);
      chunkCount++;

      // Create connection on first audio chunk
      if (!connection) {
        createConnection();
      }

      if (chunkCount % 100 === 1) {
        console.log(`[Deepgram] Chunk #${chunkCount} (${buf.length}b, open=${isOpen})`);
      }

      if (isOpen && connection) {
        try {
          connection.send(new Uint8Array(buf) as unknown as ArrayBuffer);
        } catch {
          audioQueue.push(buf);
        }
      } else {
        audioQueue.push(buf);
        // If connection closed, try to reconnect
        if (connection && !isOpen) {
          console.log('[Deepgram] Reconnecting...');
          connection = null;
          createConnection();
        }
      }
    },
    close() {
      console.log(`[Deepgram] Closing (sent ${chunkCount} chunks)`);
      isOpen = false;
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      try {
        connection?.requestClose();
      } catch { /* ignore */ }
      connection = null;
    },
  };
}
