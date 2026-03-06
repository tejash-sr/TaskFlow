import mongoose from "mongoose";

beforeAll(async () => {
  const uri = process.env.MONGO_URI_TEST;
  if (!uri) throw new Error("MONGO_URI_TEST is not set — globalSetup may not have run");
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }
}, 30000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  jest.resetAllMocks();
});
