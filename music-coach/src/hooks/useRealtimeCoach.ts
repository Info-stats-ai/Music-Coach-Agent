import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/store/useAppStore';
import type { PoseFrame, CoachResponse, EmotionType } from '@/types';
import type { HandMetrics } from '@/hooks/usePoseDetection';

const POSE_SEND_INTERVAL_MS = 100; // 10 Hz
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export interface LearnerProfile {
  totalSessions: number;
  completedLessons: number;
  passedSkills: string[];
  weakSkills: string[];
  nextLesson: { id: string; title: string; level: number } | null;
  instrument: string;
}

// ─── Singleton Socket (survives HMR) ───
function getSocket(): Socket {
  const win = window as unknown as { __musicCoachSocket?: Socket };
  if (!win.__musicCoachSocket || win.__musicCoachSocket.disconnected) {
    if (win.__musicCoachSocket) {
      win.__musicCoachSocket.removeAllListeners();
      win.__musicCoachSocket.disconnect();
    }
    win.__musicCoachSocket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    console.log('[Coach] Socket created →', SERVER_URL);
  }
  return win.__musicCoachSocket;
}

export function useRealtimeCoach() {
  const lastPoseSend = useRef(0);
  const listenersAttached = useRef(false);

  const store = useAppStore;
  const {
    setConnected,
    setListening,
    setSpeaking,
    setEmotion,
    addLatency,
    addMessage,
    setLearnerProfile,
  } = useAppStore();

  // ─── Attach listeners once ───
  useEffect(() => {
    const socket = getSocket();

    if (listenersAttached.current) return;
    listenersAttached.current = true;

    socket.on('connect', () => {
      console.log('[Coach] ✓ Connected:', socket.id);
      useAppStore.getState().setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Coach] Disconnected');
      useAppStore.getState().setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Coach] Connection error:', err.message);
    });

    socket.on('coach_response', (data: CoachResponse) => {
      const s = useAppStore.getState();
      s.setEmotion(data.emotion);
      s.addLatency(data.latency);
      s.addMessage({
        id: crypto.randomUUID(),
        role: 'coach',
        text: data.text,
        timestamp: Date.now(),
        emotion: data.emotion,
      });
    });

    // TTS audio → play locally + forward to SpatialReal for lip-sync
    socket.on('tts_audio_chunk', (chunk: ArrayBuffer) => {
      window.dispatchEvent(
        new CustomEvent('spatialreal:audio', { detail: { audio: chunk, isFinal: false } })
      );
    });

    socket.on('tts_final_chunk', (chunk: ArrayBuffer) => {
      window.dispatchEvent(
        new CustomEvent('spatialreal:audio', { detail: { audio: chunk, isFinal: true } })
      );
    });

    socket.on('tts_start', () => useAppStore.getState().setSpeaking(true));
    socket.on('tts_end', () => useAppStore.getState().setSpeaking(false));

    // Browser TTS fallback when ElevenLabs fails
    socket.on('use_browser_tts', (data: { text: string }) => {
      console.log('[Coach] Browser TTS fallback');
      const s = useAppStore.getState();
      s.setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(data.text);
      utterance.rate = 1.0;
      utterance.onend = () => useAppStore.getState().setSpeaking(false);
      utterance.onerror = () => useAppStore.getState().setSpeaking(false);
      speechSynthesis.speak(utterance);
    });

    socket.on('expression_change', (data: { emotion: EmotionType }) => {
      useAppStore.getState().setEmotion(data.emotion);
    });

    socket.on('learner_profile', (profile: LearnerProfile) => {
      useAppStore.getState().setLearnerProfile(profile);
      console.log('[Coach] Profile:', profile);
    });

    socket.on('user_transcript', (data: { text: string }) => {
      useAppStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        text: data.text,
        timestamp: Date.now(),
      });
    });

    socket.on('coach_error', (data: { message: string }) => {
      console.error('[Coach] Error:', data.message);
    });
  }, []);

  // ─── Send Pose (10Hz) ───
  const sendPoseFrame = useCallback((frame: PoseFrame) => {
    const now = performance.now();
    if (now - lastPoseSend.current >= POSE_SEND_INTERVAL_MS) {
      lastPoseSend.current = now;
      getSocket().emit('pose_update', {
        landmarks: frame.landmarks,
        metrics: frame.metrics,
        timestamp: frame.timestamp,
      });
    }
  }, []);

  // ─── Send Hand Data ───
  const sendHandData = useCallback((hands: HandMetrics[]) => {
    if (hands.length > 0) {
      getSocket().emit('hand_update', hands.map((h) => ({
        handedness: h.handedness,
        fingerCurl: h.fingerCurl,
        fingerSpread: h.fingerSpread,
      })));
    }
  }, []);

  // ─── Audio Capture ───
  const mediaRef = useRef<{ stream: MediaStream; ctx: AudioContext; proc: ScriptProcessorNode } | null>(null);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);

      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)));
        }
        getSocket().emit('audio_chunk', int16.buffer);
      };

      source.connect(proc);
      proc.connect(ctx.destination);
      mediaRef.current = { stream, ctx, proc };
      useAppStore.getState().setListening(true);
      console.log('[Coach] 🎤 Mic started');
    } catch (err) {
      console.error('[Coach] Mic failed:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.proc.disconnect();
      mediaRef.current.ctx.close();
      mediaRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
    }
    useAppStore.getState().setListening(false);
    console.log('[Coach] 🎤 Mic stopped');
  }, []);

  return {
    sendPoseFrame,
    sendHandData,
    startListening,
    stopListening,
    isConnected: useAppStore((s) => s.isConnected),
    isListening: useAppStore((s) => s.isListening),
  };
}
