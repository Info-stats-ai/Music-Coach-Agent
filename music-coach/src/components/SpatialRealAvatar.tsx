import { useEffect, useRef, useCallback, useState } from 'react';
import {
  AvatarSDK,
  AvatarManager,
  AvatarView,
  DrivingServiceMode,
  Environment,
} from '@spatialwalk/avatarkit';
import { useAppStore } from '@/store/useAppStore';

type SpatialRealStatus = 'idle' | 'initializing' | 'connecting' | 'connected' | 'error';

export function SpatialRealAvatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarViewRef = useRef<AvatarView | null>(null);
  const [status, setStatus] = useState<SpatialRealStatus>('idle');
  const [error, setError] = useState<string | null>(null);

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

      avatarViewRef.current = view;
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SpatialReal connection failed');
      setStatus('error');
    }
  }, [isConfigured, appId, avatarId, sessionToken, status]);

  // Auto-connect when configured
  useEffect(() => {
    if (isConfigured && status === 'idle') {
      connect();
    }
  }, [isConfigured, status, connect]);

  // Forward TTS audio to SpatialReal for lip-sync
  useEffect(() => {
    const handler = (e: Event) => {
      const { audio, isFinal } = (e as CustomEvent).detail as {
        audio: ArrayBuffer;
        isFinal: boolean;
      };
      if (avatarViewRef.current && status === 'connected') {
        avatarViewRef.current.controller.send(audio, isFinal);
      }
    };
    window.addEventListener('spatialreal:audio', handler);
    return () => window.removeEventListener('spatialreal:audio', handler);
  }, [status]);

  // Cleanup
  useEffect(() => {
    return () => {
      avatarViewRef.current?.controller.close();
      avatarViewRef.current?.dispose();
      avatarViewRef.current = null;
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
          <div className="text-center px-6 space-y-2">
            <p className="text-yellow-400 text-sm">SpatialReal not configured</p>
            <p className="text-gray-500 text-xs">
              Set VITE_SPATIALREAL_APP_ID, VITE_SPATIALREAL_AVATAR_ID, and
              VITE_SPATIALREAL_SESSION_TOKEN in your .env
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
