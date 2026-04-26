import { usePoseDetection, type HandMetrics } from '@/hooks/usePoseDetection';
import type { PoseFrame } from '@/types';

interface PoseCameraProps {
  onFrame?: (frame: PoseFrame) => void;
  onHands?: (hands: HandMetrics[]) => void;
}

export function PoseCamera({ onFrame, onHands }: PoseCameraProps) {
  const { videoRef, canvasRef, isReady, error, currentMetrics, handData } = usePoseDetection({
    onFrame,
    onHands,
    targetFps: 30,
  });

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full object-cover" />

      {/* Status badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${isReady ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
        <span className="text-xs text-white/80 font-mono">
          {isReady ? 'Pose + Hands Active' : 'Initializing...'}
        </span>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-red-400 text-sm px-4 text-center">{error}</p>
        </div>
      )}

      {/* Pose metrics */}
      {currentMetrics && (
        <div className="absolute bottom-3 left-3 bg-black/60 rounded px-3 py-2 font-mono text-xs space-y-1">
          <div className="text-green-300">Posture: {currentMetrics.postureScore}/100</div>
          <div className="text-blue-300">Wrist: {currentMetrics.wristAngle}°</div>
          <div className="text-purple-300">Shoulder tilt: {currentMetrics.shoulderAngle}°</div>
        </div>
      )}

      {/* Hand/finger metrics */}
      {handData.length > 0 && (
        <div className="absolute bottom-3 right-3 bg-black/60 rounded px-3 py-2 font-mono text-xs space-y-2 max-w-[200px]">
          {handData.map((hand) => (
            <div key={hand.handedness}>
              <div className={`font-semibold ${hand.handedness === 'Left' ? 'text-red-300' : 'text-teal-300'}`}>
                {hand.handedness} Hand
              </div>
              <div className="flex gap-1 mt-1">
                {(['thumb', 'index', 'middle', 'ring', 'pinky'] as const).map((f) => {
                  const curl = hand.fingerCurl[f];
                  const barH = Math.round(curl * 100);
                  return (
                    <div key={f} className="flex flex-col items-center gap-0.5">
                      <div className="w-3 h-8 bg-gray-700 rounded-sm relative overflow-hidden">
                        <div
                          className="absolute bottom-0 w-full bg-yellow-400 rounded-sm transition-all"
                          style={{ height: `${barH}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400">{f[0].toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-gray-400 mt-1">Spread: {hand.fingerSpread}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
