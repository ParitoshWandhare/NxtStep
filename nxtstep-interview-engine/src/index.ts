// ============================================================
// NxtStep Interview Engine — Main Entry Point
// Express app + Socket.IO + BullMQ worker bootstrap
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import interviewRoutes from './routes/interview.routes';
import { createInterviewWorkers } from './workers/interviewWorker';
import { getQueueMetrics } from './queues/index';

const app    = express();
const server = createServer(app);

// ─── Socket.IO setup ──────────────────────────────────────────

const io = new SocketServer(server, {
  cors: { origin: process.env.CLIENT_URL ?? 'http://localhost:3000' },
});

io.on('connection', socket => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('joinSession', (sessionId: string) => {
    socket.join(sessionId);
    console.log(`[Socket.IO] ${socket.id} joined session room: ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// ─── Routes ───────────────────────────────────────────────────

app.use('/api/interview', interviewRoutes);

app.get('/health', async (_req, res) => {
  const metrics = await getQueueMetrics();
  res.json({
    status:  'ok',
    version: '1.0.0',
    queues:  metrics,
  });
});

// ─── Start workers ────────────────────────────────────────────

const workers = createInterviewWorkers(io);
console.log(`[App] Started ${workers.length} BullMQ workers`);

// ─── Listen ───────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 4000);
server.listen(PORT, () => {
  console.log(`[App] NxtStep Interview Engine running on port ${PORT}`);
});

// ─── Graceful shutdown ────────────────────────────────────────

async function shutdown() {
  console.log('[App] Shutting down gracefully...');
  await Promise.all(workers.map(w => w.close()));
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

export { app, io };