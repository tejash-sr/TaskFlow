import { ConnectionOptions } from 'bullmq';
import { env } from '@/config/env';

export const redisConnection: ConnectionOptions = {
  host: env.redisHost,
  port: env.redisPort,
  ...(env.redisPassword ? { password: env.redisPassword } : {}),
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: () => null,
};
