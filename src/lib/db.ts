import mongoose from "mongoose";
import { Job } from "@/models/Job";

const JOB_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  jobExpirationPromise: Promise<void> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  jobExpirationPromise: null,
};

global.mongooseCache = cached;

async function ensureJobExpiration() {
  cached.jobExpirationPromise ??= (async () => {
    await Job.collection.updateMany(
      { expiresAt: null },
      [
        {
          $set: {
            expiresAt: {
              $add: [{ $ifNull: ["$createdAt", new Date()] }, JOB_LIFETIME_MS],
            },
          },
        },
      ],
    );
    await Job.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  })();
  try {
    await cached.jobExpirationPromise;
  } catch (error) {
    cached.jobExpirationPromise = null;
    throw error;
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (cached.conn) {
    await ensureJobExpiration();
    return cached.conn;
  }

  const promise =
    cached.promise ??
    (cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    }));

  try {
    cached.conn = await promise;
    await ensureJobExpiration();
    return cached.conn;
  } catch (error) {
    if (cached.promise === promise) {
      cached.promise = null;
    }
    throw error;
  }
}
