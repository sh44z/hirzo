import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (cached.conn) {
    return cached.conn;
  }

  const promise =
    cached.promise ??
    (cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    }));

  try {
    cached.conn = await promise;
    return cached.conn;
  } catch (error) {
    if (cached.promise === promise) {
      cached.promise = null;
    }
    throw error;
  }
}
