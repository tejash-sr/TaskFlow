import { MongoMemoryServer } from 'mongodb-memory-server';
import * as fs from 'fs';
import * as path from 'path';

interface GlobalWithMongo {
  __MONGOD__: MongoMemoryServer;
}

const MONGO_VERSIONS = ['7.0.14', '7.0.4', '6.0.12', '6.0.4', '5.0.21'];

async function tryCreateServer(): Promise<MongoMemoryServer> {
  if (process.env.MONGODB_URI || process.env.MONGO_URI) {
    process.env.MONGO_URI_TEST = process.env.MONGODB_URI || process.env.MONGO_URI;
    return {
      getUri: () => process.env.MONGO_URI_TEST!,
      stop: async () => {},
    } as unknown as MongoMemoryServer;
  }

  let lastError: Error | null = null;
  for (const version of MONGO_VERSIONS) {
    try {
      process.stdout.write(`[globalSetup] Trying MongoDB ${version}...\n`);
      const mongod = await MongoMemoryServer.create({ binary: { version } });
      process.stdout.write(`[globalSetup] MongoDB ${version} started OK\n`);
      return mongod;
    } catch (err) {
      lastError = err as Error;
      process.stdout.write(`[globalSetup] ${version} failed: ${(err as Error).message?.substring(0, 80)}\n`);
    }
  }
  throw new Error(
    `MongoMemoryServer failed all versions. Set MONGODB_URI to use external MongoDB. Last: ${lastError?.message}`,
  );
}

export default async function globalSetup(): Promise<void> {
  const tmpDir = path.join(process.cwd(), '.mongodb-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const mongod = await tryCreateServer();
  (global as unknown as GlobalWithMongo).__MONGOD__ = mongod;
  process.env.MONGO_URI_TEST = mongod.getUri();
}
