import { useEffect, useRef, useCallback, useState } from 'react';
import type { PoseFrame, PoseMetrics, PoseLandmark } from '@/types';

// MediaPipe pose landmark indices
const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;

// MediaPipe hand landmark indices (21 per hand)
const HAND = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

// Hand connections for drawing
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],       // thumb
  [0,5],[5,6],[6,7],[7,8],       // index
  [0,9],[9,10],[10,11],[11,12],  // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm
];

function angleBetween(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  const cosAngle = dot / (magAB * magCB + 1e-6);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

function computeFingerCurl(landmarks: PoseLandmark[], mcp: number, pip: number, _dip: number, tip: number): number {
  const angle = angleBetween(landmarks[mcp], landmarks[pip], landmarks[tip]);
  // 180° = fully extended, 0° = fully curled → normalize to 0-1 (1 = curled)
  return Math.max(0, Math.min(1, 1 - angle / 180));
}

export interface HandMetrics {
  handedness: 'Left' | 'Right';
  fingerCurl: {
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
  fingerSpread: number; // average distance between fingertips
  landmarks: PoseLandmark[];
}

function computeHandMetrics(landmarks: PoseLandmark[], handedness: 'Left' | 'Right'): HandMetrics {
  const fingerCurl = {
    thumb: computeFingerCurl(landmarks, HAND.THUMB_CMC, HAND.THUMB_MCP, HAND.THUMB_IP, HAND.THUMB_TIP),
    index: computeFingerCurl(landmarks, HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_DIP, HAND.INDEX_TIP),
    middle: computeFingerCurl(landmarks, HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_DIP, HAND.MIDDLE_TIP),
    ring: computeFingerCurl(landmarks, HAND.RING_MCP, HAND.RING_PIP, HAND.RING_DIP, HAND.RING_TIP),
    pinky: computeFingerCurl(landmarks, HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_DIP, HAND.PINKY_TIP),
  };

  // Finger spread: average distance between adjacent fingertips
  const tips = [HAND.INDEX_TIP, HAND.MIDDLE_TIP, HAND.RING_TIP, HAND.PINKY_TIP];
  let spreadSum = 0;
  for (let i = 0; i < tips.length - 1; i++) {
    const a = landmarks[tips[i]];
    const b = landmarks[tips[i + 1]];
    spreadSum += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
  const fingerSpread = Math.round((spreadSum / (tips.length - 1)) * 1000) / 1000;

  return { handedness, fingerCurl, fingerSpread, landmarks };
}

function computeMetrics(landmarks: PoseLandmark[]): PoseMetrics {
  const ls = landmarks[LANDMARK.LEFT_SHOULDER];
  const rs = landmarks[LANDMARK.RIGHT_SHOULDER];
  const le = landmarks[LANDMARK.LEFT_ELBOW];
  const lw = landmarks[LANDMARK.LEFT_WRIST];

  const wristAngle = angleBetween(ls, le, lw);
  const elbowAngle = angleBetween(ls, le, lw);
  const shoulderAngle = Math.abs(ls.y - rs.y) * 100;
  const postureScore = Math.max(0, 100 - shoulderAngle * 2 - Math.abs(wristAngle - 90));
  const handHeight = (lw.y + landmarks[LANDMARK.RIGHT_WRIST].y) / 2;

  return {
    wristAngle: Math.round(wristAngle * 10) / 10,
    elbowAngle: Math.round(elbowAngle * 10) / 10,
    shoulderAngle: Math.round(shoulderAngle * 10) / 10,
    postureScore: Math.round(Math.max(0, Math.min(100, postureScore))),
    handHeight: Math.round(handHeight * 1000) / 1000,
    timestamp: performance.now(),
  };
}

interface UsePoseDetectionOptions {
  onFrame?: (frame: PoseFrame) => void;
  onHands?: (hands: HandMetrics[]) => void;
  targetFps?: number;
}

export function usePoseDetection({ onFrame, onHands, targetFps = 30 }: UsePoseDetectionOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<unknown>(null);
  const handLandmarkerRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const lastFrameTime = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<PoseMetrics | null>(null);
  const [handData, setHandData] = useState<HandMetrics[]>([]);

  const initCamera = useCallback(async () => {
    try {
      const video = videoRef.current;
      if (!video) return;

      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 30 } },
        audio: false,
      });

      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(`Camera access failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const initDetection = useCallback(async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, HandLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Init pose detection
      const poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Init hand/finger detection
      const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      poseLandmarkerRef.current = poseLandmarker;
      handLandmarkerRef.current = handLandmarker;
      setIsReady(true);
    } catch (err) {
      setError(`Detection init failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const detectFrame = useCallback(() => {
    const now = performance.now();
    const frameInterval = 1000 / targetFps;

    if (now - lastFrameTime.current >= frameInterval) {
      lastFrameTime.current = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      const poseLandmarker = poseLandmarkerRef.current as {
        detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: PoseLandmark[][] };
      } | null;

      const handLandmarker = handLandmarkerRef.current as {
        detectForVideo: (v: HTMLVideoElement, t: number) => {
          landmarks: PoseLandmark[][];
          handedness: Array<Array<{ categoryName: string }>>;
        };
      } | null;

      if (video && canvas && poseLandmarker && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // ─── Pose Detection ───
          const poseResult = poseLandmarker.detectForVideo(video, now);
          if (poseResult.landmarks && poseResult.landmarks.length > 0) {
            const landmarks = poseResult.landmarks[0];
            const metrics = computeMetrics(landmarks);
            setCurrentMetrics(metrics);
            drawSkeleton(ctx, landmarks);
            const frame: PoseFrame = { landmarks, metrics, timestamp: now };
            onFrame?.(frame);
          }

          // ─── Hand Detection ───
          if (handLandmarker) {
            const handResult = handLandmarker.detectForVideo(video, now + 1);
            if (handResult.landmarks && handResult.landmarks.length > 0) {
              const hands: HandMetrics[] = [];
              for (let i = 0; i < handResult.landmarks.length; i++) {
                const hLandmarks = handResult.landmarks[i];
                const handedness = (handResult.handedness?.[i]?.[0]?.categoryName || 'Left') as 'Left' | 'Right';
                drawHand(ctx, hLandmarks, handedness);
                hands.push(computeHandMetrics(hLandmarks, handedness));
              }
              setHandData(hands);
              onHands?.(hands);
            } else {
              setHandData([]);
            }
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(detectFrame);
  }, [targetFps, onFrame, onHands]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await initCamera();
      if (!cancelled) await initDetection();
    };
    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }, [initCamera, initDetection]);

  useEffect(() => {
    if (isReady) {
      animFrameRef.current = requestAnimationFrame(detectFrame);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isReady, detectFrame]);

  return { videoRef, canvasRef, isReady, error, currentMetrics, handData };
}

// ─── Skeleton Drawing ───
const SKELETON_CONNECTIONS = [
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 12],           // shoulders
  [11, 23], [12, 24], // torso
  [23, 24],           // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
];

function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: PoseLandmark[]) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 3;
  for (const [i, j] of SKELETON_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a.visibility > 0.5 && b.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#00ffcc';
  for (const lm of landmarks) {
    if (lm.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

// ─── Hand Drawing ───
function drawHand(ctx: CanvasRenderingContext2D, landmarks: PoseLandmark[], handedness: 'Left' | 'Right') {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const color = handedness === 'Left' ? '#ff6b6b' : '#4ecdc4';

  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const [i, j] of HAND_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  }

  // Draw fingertip dots (larger)
  const tips: number[] = [HAND.THUMB_TIP, HAND.INDEX_TIP, HAND.MIDDLE_TIP, HAND.RING_TIP, HAND.PINKY_TIP];
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const isTip = tips.includes(i);
    ctx.fillStyle = isTip ? '#ffffff' : color;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, isTip ? 5 : 3, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Label
  ctx.fillStyle = color;
  ctx.font = '12px monospace';
  ctx.fillText(`${handedness} Hand`, landmarks[0].x * w - 20, landmarks[0].y * h - 10);
}
