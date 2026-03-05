// Parse Railway's REDIS_URL if present: redis://:password@host:port
function parseRedisUrl(url: string): { host: string; port: number; password: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || '',
    };
  } catch {
    return { host: '127.0.0.1', port: 6379, password: '' };
  }
}

const redisFromUrl = process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : null;

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  // Support both MONGODB_URI (standard) and MONGO_URI (legacy)
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/taskflow',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-please-change',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-please-change',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    // Support both EMAIL_PASS and EMAIL_PASSWORD
    password: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '',
  },
  // Support Railway REDIS_URL or individual REDIS_HOST/PORT/PASSWORD
  redisUrl: process.env.REDIS_URL || null,
  redisHost: redisFromUrl?.host || process.env.REDIS_HOST || '127.0.0.1',
  redisPort: redisFromUrl?.port || parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: redisFromUrl?.password || process.env.REDIS_PASSWORD || '',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
