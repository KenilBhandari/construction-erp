import mongoose from "mongoose";

// NOTE: read inside connectDB (not at module top) so standalone scripts
// that load .env after imports still work.
function mongoUri(): string {
  return process.env.MONGODB_URI ?? "";
}

// Cached connection for Next.js dev (hot reload) and serverless.
// See: https://mongoosejs.com/docs/connections.html
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global._mongooseCache) {
  global._mongooseCache = cache;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = mongoUri();
  if (!uri) {
    throw new Error("MONGODB_URI is not set. See .env.example.");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      // Keep it simple: defaults are fine for V1.
      maxPoolSize: 10,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
