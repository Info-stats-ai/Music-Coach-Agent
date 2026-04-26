import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * SpatialReal Avatar — SDK Mode.
 * Dynamically imports @spatialwalk/avatarkit to avoid crashing if SDK has issues.
 * Receives TTS audio via CustomEvent and forwards to avatar for lip-sync.
 */

type SpatialRealStatus = 'idle' | 'initializing' | 'connecting' | 'connected' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let avatarViewInstance: any = null;

export function SpatialRealAvatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<SpatialRealStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const autoConnectDone = useRef(false);

  const emotion = useAppStore((s) => s.currentEmotion);
  const isSpeaking = useAppStore((s) => s.isSpeaking);

  const appId = import.meta.env.VITE_SPATIALREAL_APP_ID;
  const avatarId = import.meta.env.VITE_SPATIALREAL_AVATAR_ID;
  const sessionToken = import.meta.env.VITE_SPATIALREAL_SESSION_TOKEN;
  const isConfigured = Boolean(appId && avatarId && sessionToken);

  const connect = useCallback(async () => {
    if (!isConfigured || !containerRef.current) return;
    if (status === 'connecting' || status === 'connected') return;

    try {
      setStatus('initializing');

      // Dynamic import to avoid breaking the app if SDK fails
      if (!sdk) {
        sdk = await import('@spatialwalk/avatarkit');
      }

      const { AvatarSDK, AvatarManager, AvatarView, Environment, DrivingServiceMode } = sdk;

      if (!AvatarSDK.isInitialized) {
        await AvatarSDK.initialize(appId, {
          environment: Environment.intl,
          drivingServiceMode: DrivingServiceMode.sdk,
        });
      }
      AvatarSDK.setSessionToken(sessionToken);

      setStatus('connecting');
      const avatar = await AvatarManager.shared.load(avatarId);
      const view = new AvatarView(avatar, containerRef.current);

      view.controller.onConnectionState = (state: string) => {
        if (state === 'connected') setStatus('connected');
        if (state === 'disconnected') setStatus('idle');
      };

      await view.controller.initializeAudioContext();
      await view.controller.start();
      await new Promise((r) => setTimeout(r, 500));

      avatarViewInstance = view;
      setStatus('connected');
      (window as unknown as { __spatialRealConnected: boolean }).__spatialRealConnected = true;
      console.log('[SpatialReal] ✓ Avatar connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      console.error('[SpatialReal] Error:', msg);
      setError(msg);
      setStatus('error');
    }
  }, [isConfigured, appId, avatarId, sessionToken, status]);

  // Auto-connect once
  useEffect(() => {
    if (isConfigured && status === 'idle' && !autoConnectDone.current) {
      autoConnectDone.current = true;
      connect();
    }
  }, [isConfigured, status, connect]);

  // Forward TTS audio to avatar for lip-sync
  useEffect(() => {
    const handler = (e: Event) => {
      const { audio, isFinal } = (e as CustomEvent).detail;
      if (avatarViewInstance && status === 'connected') {
        try {
          avatarViewInstance.controller.send(audio, isFinal);
        } catch {
          // ignore send errors
        }
      }
    };
    window.addEventListener('spatialreal:audio', handler);
    return () => window.removeEventListener('spatialreal:audio', handler);
  }, [status]);

  // Cleanup
  useEffect(() => {
    return () => {
      try {
        avatarViewInstance?.controller?.close();
        avatarViewInstance?.dispose();
      } catch { /* ignore */ }
      avatarViewInstance = null;
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
            onClick={connect}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
          >
            Connect SpatialReal Avatar
          </button>
          {error && <p className="text-red-400 text-xs px-4 text-center">{error}</p>}
        </div>
      )}

      {!isConfigured && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-gray-500 text-xs px-4 text-center">
            SpatialReal not configured — set env vars
          </p>
        </div>
      )}
    </div>
  );
}
