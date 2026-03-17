// ============================================================
// NxtStep — Health Controller
// ============================================================

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

export const healthCheck = async (req: AuthRequest, res: Response) => {
  const { getConnectionStatus } = await import('../config/database');
  const { redisClient } = await import('../config/redis');

  let redisStatus = 'disconnected';
  try {
    await redisClient.ping();
    redisStatus = 'connected';
  } catch { /* silent */ }

  const dbStatus = getConnectionStatus();
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };

  const allOk = dbStatus.isConnected === true && redisStatus === 'connected';
  res.status(allOk ? 200 : 503).json({ success: true, data: status });
};