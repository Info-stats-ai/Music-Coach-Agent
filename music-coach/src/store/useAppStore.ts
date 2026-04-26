import { create } from 'zustand';
import type { AppStore, EmotionType, PoseMetrics, LatencyBreakdown, CoachMessage, LearnerProfileData } from '@/types';

const initialState = {
  sessionId: '',
  isConnected: false,
  isListening: false,
  isSpeaking: false,
  currentEmotion: 'neutral' as EmotionType,
  latestMetrics: null as PoseMetrics | null,
  latencyHistory: [] as LatencyBreakdown[],
  coachMessages: [] as CoachMessage[],
  learnerProfile: null as LearnerProfileData | null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setConnected: (isConnected) => set({ isConnected }),
  setListening: (isListening) => set({ isListening }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setEmotion: (currentEmotion) => set({ currentEmotion }),
  updateMetrics: (latestMetrics) => set({ latestMetrics }),

  addLatency: (latency) =>
    set((state) => ({
      latencyHistory: [...state.latencyHistory.slice(-49), latency],
    })),

  addMessage: (message) =>
    set((state) => ({
      coachMessages: [...state.coachMessages, message],
    })),

  setLearnerProfile: (learnerProfile) => set({ learnerProfile }),

  reset: () => set(initialState),
}));
