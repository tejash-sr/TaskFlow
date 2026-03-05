import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

interface GlobalWithMongo {
  __MONGOD__: MongoMemoryServer;
}

export default async function globalTeardown(): Promise<void> {
  await mongoose.connection.close();
  const mongod = (global as unknown as GlobalWithMongo).__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }
}
