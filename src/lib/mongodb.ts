import {
  MongoClient,
  type Db,
} from "mongodb"

const uri =
  process.env.MONGODB_URI?.trim() ?? ""

const dbName =
  process.env.MONGODB_DB_NAME?.trim() ||
  "mpd-dashboard"

if (!uri) {
  throw new Error(
    "MONGODB_URI is not configured.",
  )
}

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>
}

const clientPromise =
  globalForMongo.mongoClientPromise ??
  new MongoClient(uri).connect()

if (
  process.env.NODE_ENV !==
    "production"
) {
  globalForMongo.mongoClientPromise =
    clientPromise
}

export async function getMongoDb(): Promise<Db> {
  const client =
    await clientPromise

  return client.db(dbName)
}