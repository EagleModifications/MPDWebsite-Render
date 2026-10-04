import { MongoClient, type Db } from "mongodb"

const uri = process.env.MONGODB_URI?.trim() ?? ""
const dbName = process.env.MONGODB_DB_NAME?.trim() || "mpd-dashboard"

if (!uri) throw new Error("MONGODB_URI is not configured.")

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>
}

const clientPromise = globalForMongo.mongoClientPromise ?? new MongoClient(uri, {
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
}).connect()

globalForMongo.mongoClientPromise = clientPromise

export async function getMongoDb(): Promise<Db> {
  return (await clientPromise).db(dbName)
}
