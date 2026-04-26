// ─── Pose Detection ───
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseMetrics {
  wristAngle: number;
  elbowAngle: number;
  shoulderAngle: number;
  postureScore: number;
  handHeight: number;
  timestamp: number;
}

export interface PoseFrame {
  landmarks: PoseLandmark[];
  metrics: PoseMetrics;
  timestamp: number;
}

// ─── Coaching ───
export type EmotionType = 'neutral' | 'happy' | 'concerned' | 'encouraging' | 'thinking';

export interface CoachAction {
  type: 'speak' | 'show_pose_correction' | 'highlight_joints' | 'expression_change';
  payload: Record<string, unknown>;
}

export interface CoachResponse {
  text: string;
  emotion: EmotionType;
  actions: CoachAction[];
  latency: LatencyBreakdown;
}

export interface PoseCorrection {
  userPose: PoseLandmark[];
  targetPose: PoseLandmark[];
  highlightJoints: number[];
  message: string;
}

// ─── Latency ───
export interface LatencyBreakdown {
  sttMs: number;
  llmFirstTokenMs: number;
  llmTotalMs: number;
  ttsFirstChunkMs: number;
  totalMs: number;
}

// ─── Learner Profile ───
export interface LearnerProfileData {
  totalSessions: number;
  completedLessons: number;
  passedSkills: string[];
  weakSkills: string[];
  nextLesson: { id: string; title: string; level: number } | null;
  instrument: string;
}

// ─── Session ───
export interface SessionState {
  sessionId: string;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  currentEmotion: EmotionType;
  latestMetrics: PoseMetrics | null;
  latencyHistory: LatencyBreakdown[];
  coachMessages: CoachMessage[];
  learnerProfile: LearnerProfileData | null;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: number;
  emotion?: EmotionType;
}

// ─── Store ───
export interface AppStore extends SessionState {
  setConnected: (connected: boolean) => void;
  setListening: (listening: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setEmotion: (emotion: EmotionType) => void;
  updateMetrics: (metrics: PoseMetrics) => void;
  addLatency: (latency: LatencyBreakdown) => void;
  addMessage: (message: CoachMessage) => void;
  setLearnerProfile: (profile: LearnerProfileData) => void;
  reset: () => void;
}
