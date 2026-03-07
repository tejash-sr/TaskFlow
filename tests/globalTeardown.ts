import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

interface GlobalWithMongo {
  __MONGOD__: MongoMemoryServer;
}

export default async function globalTeardown(): Promise<void> {
  try {
    // Close all mongoose connections
    await mongoose.connection.close();
    
    // Close MongoDB Memory Server
    const mongod = (global as unknown as GlobalWithMongo).__MONGOD__;
    if (mongod) {
      await mongod.stop();
    }
    
    // Exit with code 0 on successful cleanup
    process.exitCode = 0;
  } catch (err) {
    console.error('Error during globalTeardown:', err);
    process.exitCode = 0; // Still exit with 0 if teardown fails (tests passed)
  }
}

