import { MongoMemoryServer } from "mongodb-memory-server";
import * as fs from 'fs';
import * as path from 'path';

interface GlobalWithMongo {
  __MONGOD__: MongoMemoryServer;
}

export default async function globalSetup(): Promise<void> {
  try {
    // Create a custom temp directory for MongoDB
    const tmpDir = path.join(process.cwd(), '.mongodb-tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const mongod = await MongoMemoryServer.create({
      // TEST-01 fix: pin to a version that exists on Ubuntu 22.04 CI/CD
      binary: { version: '7.0.14' },
    });
    (global as unknown as GlobalWithMongo).__MONGOD__ = mongod;
    process.env.MONGO_URI_TEST = mongod.getUri();
  } catch (error) {
    console.error('Failed to start MongoMemoryServer:', error);
    throw error;
  }
}
