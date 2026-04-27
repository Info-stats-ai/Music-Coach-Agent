import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * SpatialReal Avatar — follows their Speech-to-Avatar quickstart exactly.
 * SDK init → set token → load avatar → create AvatarView → start controller → send PCM
 */

type Status = 'idle' | 'initializing' | 'loading' | 'connecting' | 'connected' | 'error';

// Module-level so it persists across re-renders
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let avatarView: any = null;
let isConnectedFlag = false;

export function SpatialRealAvatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const connectAttempted = useRef(false);

  const emotion = useAppStore((s) => s.currentEmotion);
  const isSpeaking = useAppStore((s) => s.isSpeaking);

  const appId = import.meta.env.VITE_SPATIALREAL_APP_ID;
  const avatarId = import.meta.env.VITE_SPATIALREAL_AVATAR_ID;
  const sessionToken = import.meta.env.VITE_SPATIALREAL_SESSION_TOKEN;
  const isConfigured = Boolean(appId && avatarId && sessionToken);

  const connect = useCallback(async () => {
    if (!containerRef.current || !isConfigured) return;
    if (status === 'connecting' || status === 'connected') return;

    try {
      setStatus('initializing');
      console.log('[SpatialReal] Starting connection...');

      // Dynamic import
      const sdk = await import('@spatialwalk/avatarkit');
      const { AvatarSDK, AvatarManager, AvatarView, Environment, DrivingServiceMode } = sdk;

      if (!AvatarSDK.isInitialized) {
        console.log('[SpatialReal] Initializing SDK...');
        await AvatarSDK.initialize(appId, {
          environment: Environment.intl,
          drivingServiceMode: DrivingServiceMode.sdk,
        });
      }

      AvatarSDK.setSessionToken(sessionToken);

      // Wait a tick for DOM to be ready (matching their Vue nextTick pattern)
      await new Promise((r) => requestAnimationFrame(r));

      const mountEl = containerRef.current;
      if (!mountEl) throw new Error('Container not ready');

      if (!avatarView) {
        setStatus('loading');
        console.log('[SpatialReal] Loading avatar:', avatarId);
        const avatar = await AvatarManager.shared.load(avatarId);

        avatarView = new AvatarView(avatar, mountEl);
        avatarView.controller.onConnectionState = (state: string) => {
          console.log('[SpatialReal] Connection state:', state);
          isConnectedFlag = state === 'connected';
          if (state === 'connected') setStatus('connected');
        };
      }

      setStatus('connecting');
      console.log('[SpatialReal] Starting controller...');
      await avatarView.controller.initializeAudioContext();
      await avatarView.controller.start();

      // Wait for connection like their demo does
      await new Promise((r) => setTimeout(r, 300));

      if (!isConnectedFlag) {
        throw new Error('Failed to connect to animation channel');
      }

      setStatus('connected');
      console.log('[SpatialReal] ✓ Connected!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      console.error('[SpatialReal] Error:', msg, err);
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [isConfigured, appId, avatarId, sessionToken, status]);

  // Auto-connect once after mount
  useEffect(() => {
    if (isConfigured && !connectAttempted.current && containerRef.current) {
      connectAttempted.current = true;
      // Small delay to ensure container is rendered
      setTimeout(() => connect(), 500);
    }
  }, [isConfigured, connect]);

  // Forward TTS PCM audio to avatar
  useEffect(() => {
    const handler = (e: Event) => {
      const { audio, isFinal } = (e as CustomEvent).detail;
      if (!avatarView || !isConnectedFlag) return;

      let pcm: ArrayBuffer;
      if (audio instanceof ArrayBuffer) {
        pcm = audio;
      } else if (ArrayBuffer.isView(audio)) {
        pcm = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength);
      } else {
        pcm = new Uint8Array(audio).buffer;
      }

      try {
        avatarView.controller.send(pcm, isFinal);
        console.log(`[SpatialReal] Sent ${pcm.byteLength}b, final=${isFinal}`);
      } catch (err) {
        console.error('[SpatialReal] Send failed:', err);
      }
    };
    window.addEventListener('spatialreal:audio', handler);
    return () => window.removeEventListener('spatialreal:audio', handler);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      try {
        avatarView?.controller?.close();
        avatarView?.dispose();
      } catch { /* ignore */ }
      avatarView = null;
      isConnectedFlag = false;
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: 320 }} />

      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${
          status === 'connected' ? 'bg-green-400'
            : status === 'error' ? 'bg-red-400'
            : 'bg-yellow-400 animate-pulse'
        }`} />
        <span className="text-xs text-white/80 font-mono capitalize">{status}</span>
      </div>

      <div className="absolute top-3 right-3 bg-black/50 rounded-full px-3 py-1 text-xs font-mono capitalize">
        {emotion} {isSpeaking && '🔊'}
      </div>

      {(status === 'idle' || status === 'error') && isConfigured && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
          <button
            onClick={() => { connectAttempted.current = false; connect(); }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
          >
            {status === 'error' ? 'Retry Connection' : 'Connect Avatar'}
          </button>
          {errorMsg && <p className="text-red-400 text-xs px-4 text-center">{errorMsg}</p>}
        </div>
      )}

      {!isConfigured && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-gray-500 text-xs">SpatialReal not configured</p>
        </div>
      )}
    </div>
  );
}
