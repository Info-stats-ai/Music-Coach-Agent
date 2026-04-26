import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.connect().catch((err) => {
  console.warn('[Redis] Connection failed, running without cache:', err.message);
});

// ─── Session helpers ───

export interface SessionData {
  sessionId: string;
  startedAt: number;
  messageHistory: Array<{ role: string; content: string }>;
  poseHistory: Array<Record<string, unknown>>;
}

const SESSION_TTL = 3600; // 1 hour

export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: SessionData): Promise<void> {
  try {
    await redis.setex(`session:${session.sessionId}`, SESSION_TTL, JSON.stringify(session));
  } catch {
    // Graceful degradation — continue without persistence
  }
}
