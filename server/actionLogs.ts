import type { Express, Request, Response } from "express"
import { getRequestUser } from "./auth/session"
import { hasPermission } from "./permissions/permissions"
import { getMongoDb } from "../src/lib/mongodb"
import type { Collection, Filter, ObjectId } from "mongodb"

export const ACTION_LOG_PERMISSION = "promotionlogs"
export const ACTION_LOG_MODULES = ["promotion", "activity"] as const
export const ACTION_LOG_CATEGORIES = ["roster", "import", "requirements", "navigation", "management"] as const
export const ACTION_LOG_DIVISIONS = ["department", "swat", "mtf7", "mcd", "tru", "teu", "sar"] as const

export type ActionLogModule = (typeof ACTION_LOG_MODULES)[number]
export type ActionLogCategory = (typeof ACTION_LOG_CATEGORIES)[number]
export type ActionLogDivision = (typeof ACTION_LOG_DIVISIONS)[number]

/** API shape. The Mongo document below deliberately uses compact field names. */
export type ActionLog = {
  id: string
  entryNumber: number
  createdAt: string
  userId: string
  userName: string
  rank: string
  callsign: string
  module: ActionLogModule
  action: string
  category: ActionLogCategory
  division?: ActionLogDivision
  targetUserId?: string
  targetName?: string
  targetRank?: string
  summary: string
  details?: Record<string, unknown>
}

type StoredLog = {
  _id?: ObjectId
  n: number // entry number
  t: Date // created time / TTL field
  u: string // actor Discord ID
  un: string // actor display name
  r: string // actor rank
  c: string // actor callsign
  m: ActionLogModule
  a: string
  k: ActionLogCategory
  d?: ActionLogDivision
  tu?: string
  tn?: string
  tr?: string
  s: string
  x?: Record<string, unknown>
}
type CounterDocument = { _id: "global"; v: number }

const COLLECTION = "actionLogs"
const COUNTER_COLLECTION = "actionLogCounters"
const RETENTION_DAYS = Math.max(1, Math.min(365, Number(process.env.ACTION_LOG_RETENTION_DAYS ?? 14)))
const MAX_ENTRIES = Math.max(100, Math.min(5000, Number(process.env.ACTION_LOG_MAX_ENTRIES ?? 1000)))
const RETENTION_SECONDS = Math.floor(RETENTION_DAYS * 86400)
const MAX_CHANGES = 50
const MAX_EXTRA_FIELDS = 6

function clean(value: unknown): string { return typeof value === "string" ? value.trim() : "" }
function limit(value: unknown, max: number): string { return clean(value).slice(0, max) }

function compactValue(value: unknown): unknown {
  if (value === null) return null
  if (typeof value === "string") return limit(value, 300)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.slice(0, 20).map(compactValue)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value).slice(0, 10)) {
      const safeKey = limit(key, 50)
      if (safeKey) out[safeKey] = compactValue(item)
    }
    return out
  }
  return String(value).slice(0, 300)
}

/**
 * Details are intentionally compact. Requirement/import changes are preserved,
 * while arbitrary request payloads cannot fill Mongo with large JSON blobs.
 */
function cleanDetails(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}

  if (Array.isArray(source.changes)) {
    const changes = source.changes.slice(0, MAX_CHANGES).map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
      const item = raw as Record<string, unknown>
      const change: Record<string, unknown> = {}
      for (const key of ["rank", "name", "discordId", "label", "old", "new"]) {
        if (key in item) change[key] = compactValue(item[key])
      }
      return Object.keys(change).length ? change : null
    }).filter((item): item is Record<string, unknown> => Boolean(item))
    if (changes.length) result.changes = changes
  }

  let extras = 0
  for (const [key, item] of Object.entries(source)) {
    if (key === "changes" || extras >= MAX_EXTRA_FIELDS) continue
    const safeKey = limit(key, 50)
    if (!safeKey) continue
    result[safeKey] = compactValue(item)
    extras += 1
  }

  return Object.keys(result).length ? result : undefined
}

function toApi(doc: StoredLog): ActionLog {
  return {
    id: doc._id ? String(doc._id) : `${doc.n}`,
    entryNumber: doc.n,
    createdAt: doc.t.toISOString(),
    userId: doc.u,
    userName: doc.un,
    rank: doc.r,
    callsign: doc.c,
    module: doc.m,
    action: doc.a,
    category: doc.k,
    ...(doc.d ? { division: doc.d } : {}),
    ...(doc.tu ? { targetUserId: doc.tu } : {}),
    ...(doc.tn ? { targetName: doc.tn } : {}),
    ...(doc.tr ? { targetRank: doc.tr } : {}),
    summary: doc.s,
    ...(doc.x ? { details: doc.x } : {}),
  }
}

function getCollection(): Promise<Collection<StoredLog>> {
  return getMongoDb().then((db) => db.collection<StoredLog>(COLLECTION))
}

let indexesPromise: Promise<void> | null = null
async function ensureIndexes() {
  if (indexesPromise) return indexesPromise
  indexesPromise = (async () => {
    const db = await getMongoDb()
    // Deliberately the only secondary index. The log collection is capped by count
    // and TTL, so filter/search indexes would cost more storage than they save.
    await db.collection<StoredLog>(COLLECTION).createIndex(
      { t: 1 },
      { name: "action_logs_ttl", expireAfterSeconds: RETENTION_SECONDS },
    )
  })()
  try { await indexesPromise } catch (error) { indexesPromise = null; throw error }
}

async function nextEntryNumber(): Promise<number> {
  const db = await getMongoDb()
  const result = await db.collection<CounterDocument>(COUNTER_COLLECTION).findOneAndUpdate(
    { _id: "global" },
    { $inc: { v: 1 } },
    { upsert: true, returnDocument: "after", includeResultMetadata: false },
  )
  return Math.max(1, Math.floor(Number(result?.v ?? 1)))
}

async function trimToLimit(logs: Collection<StoredLog>) {
  const count = await logs.countDocuments()
  if (count <= MAX_ENTRIES) return
  const old = await logs.find({}, { projection: { _id: 1 } }).sort({ t: 1 }).limit(count - MAX_ENTRIES).toArray()
  if (old.length) await logs.deleteMany({ _id: { $in: old.map((item) => item._id) } })
}

export async function logAction(
  user: { discordId: string; name: string; username: string; avatar?: string | null; rank: string; callsign: string; badgeNumber: string },
  input: {
    module: ActionLogModule
    action: string
    category: ActionLogCategory
    division?: ActionLogDivision
    targetUserId?: string
    targetName?: string
    targetRank?: string
    summary: string
    details?: Record<string, unknown>
    path?: string
  },
): Promise<ActionLog> {
  await ensureIndexes()
  const logs = await getCollection()
  const action = limit(input.action, 80)
  const summary = limit(input.summary, 600)
  if (!action || !summary) throw new Error("Action and summary are required.")

  // Small duplicate guard; no extra index is created for it.
  const duplicate = await logs.findOne({
    t: { $gte: new Date(Date.now() - 3000) },
    u: limit(user.discordId, 64),
    m: input.module,
    a: action,
    k: input.category,
    ...(input.division ? { d: input.division } : {}),
    ...(input.targetUserId ? { tu: limit(input.targetUserId, 64) } : {}),
    s: summary,
  })
  if (duplicate) return toApi(duplicate)

  const stored: StoredLog = {
    n: await nextEntryNumber(),
    t: new Date(),
    u: limit(user.discordId, 64),
    un: limit(user.name, 100),
    r: limit(user.rank, 80),
    c: limit(user.callsign, 32),
    m: input.module,
    a: action,
    k: input.category,
    ...(input.division ? { d: input.division } : {}),
    ...(input.targetUserId ? { tu: limit(input.targetUserId, 64) } : {}),
    ...(input.targetName ? { tn: limit(input.targetName, 100) } : {}),
    ...(input.targetRank ? { tr: limit(input.targetRank, 80) } : {}),
    s: summary,
    ...(cleanDetails(input.details) ? { x: cleanDetails(input.details) } : {}),
  }

  const result = await logs.insertOne(stored)
  stored._id = result.insertedId
  await trimToLimit(logs)
  return toApi(stored)
}

async function requireAuthenticatedUser(req: Request, res: Response) {
  const user = await getRequestUser(req)
  if (!user) { res.status(401).json({ success: false, error: "Unauthorized" }); return null }
  return user
}

async function requireLogPermission(req: Request, res: Response) {
  const user = await requireAuthenticatedUser(req, res)
  if (!user) return null
  if (!hasPermission(user, ACTION_LOG_PERMISSION)) {
    res.status(403).json({ success: false, error: "You do not have permission to view action logs." })
    return null
  }
  return user
}

function normaliseDate(value: unknown): Date | null {
  const date = new Date(String(value ?? ""))
  return Number.isNaN(date.getTime()) ? null : date
}
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }

export function registerActionLogRoutes(app: Express) {
  app.post("/api/action-logs", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res)
      if (!user) return
      const module = clean(req.body?.module) as ActionLogModule
      const category = clean(req.body?.category) as ActionLogCategory
      const division = clean(req.body?.division) as ActionLogDivision
      if (!ACTION_LOG_MODULES.includes(module) || !ACTION_LOG_CATEGORIES.includes(category) || (division && !ACTION_LOG_DIVISIONS.includes(division))) {
        return res.status(400).json({ success: false, error: "Invalid action-log values." })
      }
      const log = await logAction(user, {
        module,
        category,
        action: clean(req.body?.action),
        ...(division ? { division } : {}),
        targetUserId: limit(req.body?.targetUserId, 64) || undefined,
        targetName: limit(req.body?.targetName, 100) || undefined,
        targetRank: limit(req.body?.targetRank, 80) || undefined,
        summary: clean(req.body?.summary),
        details: cleanDetails(req.body?.details),
      })
      return res.json({ success: true, log })
    } catch (error) {
      console.error("POST /api/action-logs failed:", error)
      return res.status(500).json({ success: false, error: "Failed to write action log." })
    }
  })

  app.get("/api/action-logs", async (req, res) => {
    try {
      const user = await requireLogPermission(req, res)
      if (!user) return
      await ensureIndexes()
      const logs = await getCollection()
      const search = limit(req.query.search, 120).toLowerCase()
      const module = limit(req.query.module, 30) as ActionLogModule | ""
      const action = limit(req.query.action, 80)
      const category = limit(req.query.category, 30)
      const division = limit(req.query.division, 30)
      const actor = limit(req.query.actor, 100).toLowerCase()
      const from = normaliseDate(req.query.from)
      const to = normaliseDate(req.query.to)
      const page = Math.max(1, Math.floor(Number(req.query.page ?? 1) || 1))
      const pageSize = Math.min(100, Math.max(10, Math.floor(Number(req.query.limit ?? 50) || 50)))

      const and: Filter<StoredLog>[] = []
      if (module) and.push({ m: module })
      if (action) and.push({ a: action })
      if (category) and.push({ k: category })
      if (division) and.push({ d: division })
      if (from || to) and.push({ t: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } })
      if (actor) {
        const rx = escapeRegex(actor)
        and.push({ $or: [{ un: { $regex: rx, $options: "i" } }, { u: { $regex: rx, $options: "i" } }] })
      }
      if (search) {
        const rx = escapeRegex(search)
        and.push({ $or: [
          { un: { $regex: rx, $options: "i" } }, { u: { $regex: rx, $options: "i" } },
          { r: { $regex: rx, $options: "i" } }, { c: { $regex: rx, $options: "i" } },
          { a: { $regex: rx, $options: "i" } }, { k: { $regex: rx, $options: "i" } },
          { d: { $regex: rx, $options: "i" } }, { tu: { $regex: rx, $options: "i" } },
          { tn: { $regex: rx, $options: "i" } }, { tr: { $regex: rx, $options: "i" } },
          { s: { $regex: rx, $options: "i" } },
        ] })
      }
      const filter: Filter<StoredLog> = and.length ? { $and: and } : {}
      const total = await logs.countDocuments(filter)
      const pages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(page, pages)
      const items = await logs.find(filter).sort({ n: -1 }).skip((safePage - 1) * pageSize).limit(pageSize).toArray()
      return res.json({ success: true, logs: items.map(toApi), pagination: { page: safePage, limit: pageSize, total, pages } })
    } catch (error) {
      console.error("GET /api/action-logs failed:", error)
      return res.status(500).json({ success: false, error: "Failed to load action logs." })
    }
  })
}
