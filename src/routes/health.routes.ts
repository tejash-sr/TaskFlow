import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

async function checkDatabase(): Promise<{ status: string; responseTimeMs?: number; error?: string }> {
  try {
    const start = Date.now();
    await mongoose.connection.db?.admin().ping();
    return { status: 'healthy', responseTimeMs: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', error: (err as Error).message };
  }
}

router.get('/', async (_req: Request, res: Response) => {
  const db = await checkDatabase();
  const allHealthy = db.status === 'healthy';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    dependencies: { database: db },
    resources: {
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
});

export default router;
