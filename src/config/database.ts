import mongoose from 'mongoose';
import { env } from './env';

const RECONNECT_DELAY = 5000;

export async function connectDatabase(uri?: string): Promise<void> {
  const connectionUri = uri || env.mongoUri;

  mongoose.connection.on('connected', () => {
    if (!env.isTest) process.stdout.write('MongoDB connected\n');
  });

  mongoose.connection.on('error', (err) => {
    process.stderr.write(`MongoDB error: ${err.message}\n`);
  });

  mongoose.connection.on('disconnected', () => {
    if (!env.isTest) {
      setTimeout(() => connectDatabase(connectionUri), RECONNECT_DELAY);
    }
  });

  await mongoose.connect(connectionUri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}
