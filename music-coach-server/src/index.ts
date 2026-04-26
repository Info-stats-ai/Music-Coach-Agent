import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket.js';
import { redis } from './services/redis.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB for audio chunks
});

// Health check
app.get('/health', async (_req, res) => {
  const redisOk = redis.status === 'ready';
  res.json({
    status: redisOk ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    redis: redis.status,
    timestamp: new Date().toISOString(),
  });
});

// Socket.io connection handling
setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[Server] Music Coach backend running on :${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
});
