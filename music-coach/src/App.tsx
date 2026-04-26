import { useCallback, useState } from 'react';
import { PoseCamera } from '@/components/PoseCamera';
import { Avatar } from '@/components/Avatar';
import { SpatialRealAvatar } from '@/components/SpatialRealAvatar';
import { LatencyDashboard } from '@/components/LatencyDashboard';
import { ChatPanel } from '@/components/ChatPanel';
import { Controls } from '@/components/Controls';
import { LearnerPanel } from '@/components/LearnerPanel';
import { useRealtimeCoach } from '@/hooks/useRealtimeCoach';
import type { PoseFrame } from '@/types';
import type { HandMetrics } from '@/hooks/usePoseDetection';
import { useAppStore } from '@/store/useAppStore';

type AvatarMode = 'spatialreal' | 'threejs';

export default function App() {
  const { sendPoseFrame, sendHandData } = useRealtimeCoach();
  const updateMetrics = useAppStore((s) => s.updateMetrics);

  const hasSpatialReal = Boolean(import.meta.env.VITE_SPATIALREAL_APP_ID);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(
    hasSpatialReal ? 'spatialreal' : 'threejs'
  );

  const handlePoseFrame = useCallback(
    (frame: PoseFrame) => {
      sendPoseFrame(frame);
      updateMetrics(frame.metrics);
    },
    [sendPoseFrame, updateMetrics]
  );

  const handleHands = useCallback(
    (hands: HandMetrics[]) => {
      sendHandData(hands);
    },
    [sendHandData]
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            🎵 AI Music Coach
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Embodied multimodal coaching — voice + vision + presence
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setAvatarMode('spatialreal')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                avatarMode === 'spatialreal'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              SpatialReal
            </button>
            <button
              onClick={() => setAvatarMode('threejs')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                avatarMode === 'threejs'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Three.js
            </button>
          </div>
          <Controls />
        </div>
      </header>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-sm text-gray-400 mb-2 font-mono">📷 Your Camera</h2>
          <PoseCamera onFrame={handlePoseFrame} onHands={handleHands} />
        </div>
        <div>
          <h2 className="text-sm text-gray-400 mb-2 font-mono">
            🤖 Coach Avatar
            <span className="ml-2 text-gray-600">
              ({avatarMode === 'spatialreal' ? 'SpatialReal' : 'Three.js'})
            </span>
          </h2>
          {avatarMode === 'spatialreal' ? <SpatialRealAvatar /> : <Avatar />}
        </div>
      </div>

      {/* Bottom row: chat + learner + latency */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <ChatPanel />
        </div>
        <div>
          <LearnerPanel />
        </div>
        <div>
          <LatencyDashboard />
        </div>
      </div>
    </div>
  );
}
