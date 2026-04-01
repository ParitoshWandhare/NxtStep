// ============================================================
// NxtStep — Health Controller
// FIX: No longer dynamically imports and pings redisClient on
// every request (which was causing connection leaks). Instead
// uses the exported getRedisStatus() helper which reads the
// already-tracked isConnected flag — zero extra connections.
// ============================================================

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getConnectionStatus } from '../config/database';
import { getRedisStatus } from '../config/redis';

export const healthCheck = async (req: AuthRequest, res: Response) => {
  const dbStatus = getConnectionStatus();
  const redisStatus = getRedisStatus();

  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus.isConnected ? 'connected' : 'disconnected',
    },
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };

  const allOk = dbStatus.isConnected === true && redisStatus.isConnected;
  res.status(allOk ? 200 : 503).json({ success: true, data: status });
};