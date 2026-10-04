import type { Express, Request, Response } from "express"
import { randomUUID } from "node:crypto"

import { getRequestUser } from "./auth/session"
import { hasPermission } from "./permissions/permissions"
import { getMongoDb } from "../src/lib/mongodb"
import type { Filter } from "mongodb"

export const ACTION_LOG_PERMISSION = "promotionlogs"

export const ACTION_LOG_MODULES = ["promotion", "activity"] as const
export const ACTION_LOG_CATEGORIES = [
  "roster",
  "import",
  "requirements",
  "navigation",
  "management",
] as const
export const ACTION_LOG_DIVISIONS = [
  "department",
  "swat",
  "mtf7",
  "mcd",
  "tru",
  "teu",
  "sar",
] as const

export type ActionLogModule = (typeof ACTION_LOG_MODULES)[number]
export type ActionLogCategory = (typeof ACTION_LOG_CATEGORIES)[number]
export type ActionLogDivision = (typeof ACTION_LOG_DIVISIONS)[number]

export type ActionLog = {
  id: string
  entryNumber: number
  createdAt: string
  userId: string
  userName: string
  username: string
  avatar?: string | null
  rank: string
  callsign: string
  badgeNumber: string
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
}

type ActionLogDocument = ActionLog & { _id?: string }

const COLLECTION = "actionLogs"
const COUNTER_COLLECTION = "actionLogCounters"
const MAX_DETAIL_ITEMS = 120

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function limit(value: unknown, max = 500): string {
  return clean(value).slice(0, max)
}

function cleanDetails(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 60)
    .map(([key, item]) => {
      const safeKey = limit(key, 100)
      if (!safeKey) return null

      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        return [safeKey, typeof item === "string" ? limit(item, 4000) : item] as const
      }

      if (Array.isArray(item)) {
        return [
          safeKey,
          item.slice(0, MAX_DETAIL_ITEMS).map((entry) => {
            if (entry === null || typeof entry === "number" || typeof entry === "boolean") return entry
            if (typeof entry === "string") return limit(entry, 1000)
            if (entry && typeof entry === "object") {
              try {
                return JSON.parse(JSON.stringify(entry, (_key, nested) =>
                  typeof nested === "string" ? nested.slice(0, 1000) : nested,
                ))
              } catch {
                return String(entry).slice(0, 1000)
              }
            }
            return String(entry).slice(0, 1000)
          }),
        ] as const
      }

      try {
        return [safeKey, JSON.stringify(item).slice(0, 4000)] as const
      } catch {
        return [safeKey, String(item).slice(0, 4000)] as const
      }
    })
    .filter((entry): entry is readonly [string, unknown] => Boolean(entry))

  return entries.length ? Object.fromEntries(entries) : undefined
}

function getActionLogUser(user: {
  discordId: string
  name: string
  username: string
  avatar?: string | null
  rank: string
  callsign: string
  badgeNumber: string
}) {
  return {
    userId: limit(user.discordId, 64),
    userName: limit(user.name, 150),
    username: limit(user.username, 150),
    avatar: user.avatar ? limit(user.avatar, 500) : null,
    rank: limit(user.rank, 100),
    callsign: limit(user.callsign, 50),
    badgeNumber: limit(user.badgeNumber, 50),
  }
}

let indexesPromise: Promise<void> | null = null

async function ensureIndexes() {
  if (indexesPromise) return indexesPromise

  indexesPromise = (async () => {
    const db = await getMongoDb()
    const collection = db.collection<ActionLogDocument>(COLLECTION)

    await Promise.all([
      collection.createIndex({ entryNumber: -1 }, { name: "action_logs_entry_desc" }),
      collection.createIndex({ createdAt: -1 }, { name: "action_logs_created_desc" }),
      collection.createIndex({ module: 1, category: 1, division: 1 }, { name: "action_logs_filters" }),
      collection.createIndex({ userId: 1 }, { name: "action_logs_actor" }),
      collection.createIndex({ targetUserId: 1 }, { name: "action_logs_target" }),
    ])
  })()

  try {
    await indexesPromise
  } catch (error) {
    indexesPromise = null
    throw error
  }
}

async function nextEntryNumber(): Promise<number> {
  const db = await getMongoDb()
  const counters = db.collection<{ _id: string; value: number }>(COUNTER_COLLECTION)
  const result = await counters.findOneAndUpdate(
    { _id: "global" },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", includeResultMetadata: false },
  )

  const value = result?.value ?? 1
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
}

/**
 * Persistent Render-safe audit logging.
 *
 * Action logs live in MongoDB rather than process memory. This means a refresh,
 * logout/login, Render restart, deploy, or a new instance does not erase them.
 */
export async function logAction(
  user: {
    discordId: string
    name: string
    username: string
    avatar?: string | null
    rank: string
    callsign: string
    badgeNumber: string
  },
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

  const db = await getMongoDb()
  const actor = getActionLogUser(user)
  const details = cleanDetails(input.details)

  const duplicateSince = new Date(Date.now() - 3000).toISOString()
  const duplicate = await db.collection<ActionLogDocument>(COLLECTION).findOne({
    createdAt: { $gte: duplicateSince },
    userId: actor.userId,
    module: input.module,
    action: limit(input.action, 120),
    category: input.category,
    division: input.division ?? null,
    targetUserId: input.targetUserId ? limit(input.targetUserId, 64) : null,
    summary: limit(input.summary, 1500),
  })

  if (duplicate) return duplicate

  const entryNumber = await nextEntryNumber()

  const document: ActionLogDocument = {
    id: randomUUID(),
    entryNumber,
    createdAt: new Date().toISOString(),
    ...actor,
    module: input.module,
    action: limit(input.action, 120),
    category: input.category,
    ...(input.division ? { division: input.division } : {}),
    ...(input.targetUserId ? { targetUserId: limit(input.targetUserId, 64) } : {}),
    ...(input.targetName ? { targetName: limit(input.targetName, 150) } : {}),
    ...(input.targetRank ? { targetRank: limit(input.targetRank, 100) } : {}),
    summary: limit(input.summary, 1500),
    ...(details ? { details } : {}),
    ...(input.path ? { path: limit(input.path, 300) } : {}),
  }

  if (!document.action || !document.summary) {
    throw new Error("Action and summary are required.")
  }

  await db.collection<ActionLogDocument>(COLLECTION).insertOne(document)
  return document
}

async function requireAuthenticatedUser(req: Request, res: Response) {
  const user = await getRequestUser(req)
  if (!user) {
    res.status(401).json({ success: false, error: "Unauthorized" })
    return null
  }
  return user
}

async function requireLogPermission(req: Request, res: Response) {
  const user = await requireAuthenticatedUser(req, res)
  if (!user) return null

  if (!hasPermission(user, ACTION_LOG_PERMISSION)) {
    res.status(403).json({
      success: false,
      error: "You do not have permission to view action logs.",
    })
    return null
  }

  return user
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normaliseDate(value: unknown): Date | null {
  const date = new Date(String(value ?? ""))
  return Number.isNaN(date.getTime()) ? null : date
}

export function registerActionLogRoutes(app: Express) {
  app.post("/api/action-logs", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res)
      if (!user) return

      const module = clean(req.body?.module) as ActionLogModule
      const category = clean(req.body?.category) as ActionLogCategory
      const division = clean(req.body?.division) as ActionLogDivision
      const action = limit(req.body?.action, 120)
      const summary = limit(req.body?.summary, 1500)

      if (!ACTION_LOG_MODULES.includes(module)) {
        return res.status(400).json({ success: false, error: "Invalid action-log module." })
      }
      if (!ACTION_LOG_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: "Invalid action-log category." })
      }
      if (division && !ACTION_LOG_DIVISIONS.includes(division)) {
        return res.status(400).json({ success: false, error: "Invalid action-log division." })
      }
      if (!action || !summary) {
        return res.status(400).json({ success: false, error: "Action and summary are required." })
      }

      const log = await logAction(user, {
        module,
        category,
        action,
        ...(division ? { division } : {}),
        targetUserId: limit(req.body?.targetUserId, 64) || undefined,
        targetName: limit(req.body?.targetName, 150) || undefined,
        targetRank: limit(req.body?.targetRank, 100) || undefined,
        summary,
        details: cleanDetails(req.body?.details),
        path: limit(req.body?.path, 300) || undefined,
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
      const db = await getMongoDb()
      const collection = db.collection<ActionLogDocument>(COLLECTION)

      const search = limit(req.query.search, 200).toLowerCase()
      const module = limit(req.query.module, 50) as ActionLogModule | ""
      const action = limit(req.query.action, 120)
      const category = limit(req.query.category, 50)
      const division = limit(req.query.division, 50)
      const actor = limit(req.query.actor, 150).toLowerCase()
      const from = normaliseDate(req.query.from)
      const to = normaliseDate(req.query.to)

      const pageValue = Number(req.query.page ?? 1)
      const limitValue = Number(req.query.limit ?? 50)
      const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1
      const pageSize = Number.isFinite(limitValue)
        ? Math.max(10, Math.min(100, Math.floor(limitValue)))
        : 50

      const searchRegex = search ? escapeRegex(search) : ""
      const actorRegex = actor ? escapeRegex(actor) : ""
      const and: Filter<ActionLogDocument>[] = []
      if (module) and.push({ module })
      if (action) and.push({ action })
      if (category) and.push({ category })
      if (division) and.push({ division })
      if (from || to) {
        and.push({
          createdAt: {
            ...(from ? { $gte: from.toISOString() } : {}),
            ...(to ? { $lte: to.toISOString() } : {}),
          },
        })
      }
      if (actor) {
        and.push({
          $or: [
            { userName: { $regex: actorRegex, $options: "i" } },
            { username: { $regex: actorRegex, $options: "i" } },
            { userId: { $regex: actorRegex, $options: "i" } },
          ],
        })
      }
      if (search) {
        and.push({
          $or: [
            { userName: { $regex: searchRegex, $options: "i" } },
            { username: { $regex: searchRegex, $options: "i" } },
            { userId: { $regex: searchRegex, $options: "i" } },
            { callsign: { $regex: searchRegex, $options: "i" } },
            { badgeNumber: { $regex: searchRegex, $options: "i" } },
            { rank: { $regex: searchRegex, $options: "i" } },
            { action: { $regex: searchRegex, $options: "i" } },
            { summary: { $regex: searchRegex, $options: "i" } },
            { targetName: { $regex: searchRegex, $options: "i" } },
            { targetRank: { $regex: searchRegex, $options: "i" } },
            { division: { $regex: searchRegex, $options: "i" } },
          ],
        })
      }

      const filter: Filter<ActionLogDocument> = and.length ? { $and: and } : {}
      const total = await collection.countDocuments(filter)
      const pages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(page, pages)
      const paged = await collection
        .find(filter)
        .sort({ entryNumber: -1 })
        .skip((safePage - 1) * pageSize)
        .limit(pageSize)
        .project({ _id: 0 })
        .toArray()

      return res.json({
        success: true,
        logs: paged,
        pagination: {
          page: safePage,
          limit: pageSize,
          total,
          pages,
        },
      })
    } catch (error) {
      console.error("GET /api/action-logs failed:", error)
      return res.status(500).json({ success: false, error: "Failed to load action logs." })
    }
  })
}
