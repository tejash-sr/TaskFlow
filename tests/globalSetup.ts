import { MongoMemoryServer } from "mongodb-memory-server";

interface GlobalWithMongo {
  __MONGOD__: MongoMemoryServer;
}

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create({
    instance: {
      storageEngine: 'wiredTiger', // ephemeralForTest requires --replSet on MongoDB 6.0+
    },
  });
  (global as unknown as GlobalWithMongo).__MONGOD__ = mongod;
  process.env.MONGO_URI_TEST = mongod.getUri();
}
