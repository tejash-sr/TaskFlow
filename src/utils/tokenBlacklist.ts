/**
 * Token Blacklist — Redis-backed JWT invalidation
 *
 * When a user logs out, their JWT is added to Redis with a TTL equal to
 * the token's remaining lifetime.  isAuth middleware checks this list so
 * that stolen/reused tokens after logout are rejected.
 *
 * Falls back gracefully when Redis is unavailable (no crash, just skips
 * the blacklist check — acceptable trade-off for availability).
 */

import Redis from 'ioredis';
import { env } from '@/config/env';

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (env.isTest) return null; // don't use Redis in tests
  if (_redis) return _redis;
  try {
    _redis = new Redis({
      host: env.redisHost,
      port: env.redisPort,
      ...(env.redisPassword ? { password: env.redisPassword } : {}),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    _redis.on('error', () => { /* suppress — graceful degradation */ });
    return _redis;
  } catch {
    return null;
  }
}

const PREFIX = 'bl:';

/**
 * Add a JWT to the blacklist.
 * @param jti  Unique identifier for the token (we use the raw token string as key).
 * @param ttlSeconds  How many seconds until the token expires (so we can auto-expire from Redis).
 */
export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (ttlSeconds > 0) {
      await redis.set(`${PREFIX}${jti}`, '1', 'EX', ttlSeconds);
    }
  } catch { /* ignore */ }
}

/**
 * Check whether a JWT has been blacklisted.
 * Returns true if the token should be rejected.
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const val = await redis.get(`${PREFIX}${jti}`);
    return val !== null;
  } catch {
    return false; // fail-open: allow the token if Redis check fails
  }
}
