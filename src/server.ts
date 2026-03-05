import 'dotenv/config';
import http from 'http';
import { createAppWithGraphQL } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { initSocketServer } from './socket';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  await connectDatabase();

  const app = await createAppWithGraphQL();
  const httpServer = http.createServer(app);

  const socketServer = initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`, {
      activeConnections: (httpServer as http.Server & { connections?: number }).connections ?? 0,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
    await socketServer.close();
    httpServer.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      logger.info('Database disconnected — bye!');
      process.exit(0);
    });
    // Force kill after 10s if connections hang
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception — shutting down', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
}

start().catch((err) => {
  process.stderr.write(`Startup failed: ${(err as Error).message}\n`);
  process.exit(1);
});
