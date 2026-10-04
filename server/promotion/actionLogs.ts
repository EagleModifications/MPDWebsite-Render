import type { Express, Request, Response } from "express"
import { getMongoDb } from "../../src/lib/mongodb"
import type { Filter } from "mongodb"
import { getRequestUser } from "../auth/session"
import { hasPermission } from "../permissions/permissions"

export const PROMOTION_ACTION_LOG_PERMISSION = "promotionlogs"

const VALID_CATEGORIES = [
  "roster",
  "import",
  "requirements",
  "navigation",
] as const

const VALID_DIVISIONS = [
  "department",
  "swat",
  "mtf7",
  "mcd",
  "tru",
  "teu",
  "sar",
] as const

type PromotionActionLogCategory =
  (typeof VALID_CATEGORIES)[number]

type PromotionActionLogDivision =
  (typeof VALID_DIVISIONS)[number]

export type PromotionActionLogDocument = {
  _id?: unknown
  createdAt: Date
  userId: string
  userName: string
  username: string
  rank: string
  callsign: string
  badgeNumber: string
  action: string
  category: PromotionActionLogCategory
  division?: PromotionActionLogDivision
  targetUserId?: string
  targetName?: string
  targetRank?: string
  summary: string
  details?: Record<string, unknown>
  path?: string
}

const COLLECTION = "promotionActionLogs"

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function limit(value: unknown, max = 500): string {
  return clean(value).slice(0, max)
}

function cleanDetails(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 30)
    .map(([key, item]) => {
      const safeKey = limit(key, 80)

      if (!safeKey) return null

      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        return [safeKey, typeof item === "string" ? limit(item, 1000) : item] as const
      }

      if (Array.isArray(item)) {
        return [
          safeKey,
          item.slice(0, 50).map((entry) =>
            typeof entry === "string" ? limit(entry, 200) : entry,
          ),
        ] as const
      }

      return [safeKey, String(item).slice(0, 1000)] as const
    })
    .filter((entry): entry is readonly [string, unknown] => Boolean(entry))

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function normaliseDate(value: unknown): Date | null {
  const date = new Date(String(value ?? ""))
  return Number.isNaN(date.getTime()) ? null : date
}

async function collection() {
  const db = await getMongoDb()
  return db.collection<PromotionActionLogDocument>(COLLECTION)
}

export async function ensurePromotionActionLogIndexes() {
  try {
    const logs = await collection()

    await Promise.all([
      logs.createIndex({ createdAt: -1 }),
      logs.createIndex({ userId: 1, createdAt: -1 }),
      logs.createIndex({ category: 1, action: 1, createdAt: -1 }),
      logs.createIndex({ division: 1, createdAt: -1 }),
    ])
  } catch (error) {
    console.error(
      "MongoDB promotion action-log initialization failed:",
      error,
    )
  }
}

export async function logPromotionAction(
  user: {
    discordId: string
    name: string
    username: string
    rank: string
    callsign: string
    badgeNumber: string
  },
  input: {
    action: string
    category: PromotionActionLogCategory
    division?: PromotionActionLogDivision
    targetUserId?: string
    targetName?: string
    targetRank?: string
    summary: string
    details?: Record<string, unknown>
    path?: string
  },
) {
  const logs = await collection()

  const document: PromotionActionLogDocument = {
    createdAt: new Date(),
    userId: limit(user.discordId, 64),
    userName: limit(user.name, 150),
    username: limit(user.username, 150),
    rank: limit(user.rank, 100),
    callsign: limit(user.callsign, 50),
    badgeNumber: limit(user.badgeNumber, 50),
    action: limit(input.action, 100),
    category: input.category,
    ...(input.division ? { division: input.division } : {}),
    ...(input.targetUserId ? { targetUserId: limit(input.targetUserId, 64) } : {}),
    ...(input.targetName ? { targetName: limit(input.targetName, 150) } : {}),
    ...(input.targetRank ? { targetRank: limit(input.targetRank, 100) } : {}),
    summary: limit(input.summary, 1000),
    ...(cleanDetails(input.details) ? { details: cleanDetails(input.details) } : {}),
    ...(input.path ? { path: limit(input.path, 250) } : {}),
  }

  await logs.insertOne(document)
}

async function requireAuthenticatedUser(req: Request, res: Response) {
  const user = await getRequestUser(req)

  if (!user) {
    res.status(401).json({
      success: false,
      error: "Unauthorized",
    })
    return null
  }

  return user
}

async function requireLogPermission(req: Request, res: Response) {
  const user = await requireAuthenticatedUser(req, res)

  if (!user) return null

  if (!hasPermission(user, PROMOTION_ACTION_LOG_PERMISSION)) {
    res.status(403).json({
      success: false,
      error: "You do not have permission to view promotion action logs.",
    })
    return null
  }

  return user
}

export function registerPromotionActionLogRoutes(app: Express) {
  app.post(
    "/api/promotion/action-logs",
    async (req, res) => {
      try {
        const user = await requireAuthenticatedUser(req, res)
        if (!user) return

        const category = clean(req.body?.category) as PromotionActionLogCategory
        const division = clean(req.body?.division) as PromotionActionLogDivision
        const action = limit(req.body?.action, 100)
        const summary = limit(req.body?.summary, 1000)

        if (!action || !summary) {
          return res.status(400).json({
            success: false,
            error: "Action and summary are required.",
          })
        }

        if (!VALID_CATEGORIES.includes(category)) {
          return res.status(400).json({
            success: false,
            error: "Invalid promotion action-log category.",
          })
        }

        if (division && !VALID_DIVISIONS.includes(division)) {
          return res.status(400).json({
            success: false,
            error: "Invalid promotion division.",
          })
        }

        await logPromotionAction(user, {
          action,
          category,
          ...(division ? { division } : {}),
          targetUserId: limit(req.body?.targetUserId, 64) || undefined,
          targetName: limit(req.body?.targetName, 150) || undefined,
          targetRank: limit(req.body?.targetRank, 100) || undefined,
          summary,
          details: cleanDetails(req.body?.details),
          path: limit(req.body?.path, 250) || undefined,
        })

        return res.json({
          success: true,
        })
      } catch (error) {
        console.error(
          "POST /api/promotion/action-logs failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error: "Failed to write promotion action log.",
        })
      }
    },
  )

  app.get(
    "/api/promotion/action-logs",
    async (req, res) => {
      try {
        const user = await requireLogPermission(req, res)
        if (!user) return

        const logs = await collection()

        const search = limit(req.query.search, 200)
        const action = limit(req.query.action, 100)
        const category = limit(req.query.category, 50)
        const division = limit(req.query.division, 50)
        const actor = limit(req.query.actor, 150)
        const from = normaliseDate(req.query.from)
        const to = normaliseDate(req.query.to)

        const pageValue = Number(req.query.page ?? 1)
        const limitValue = Number(req.query.limit ?? 50)
        const page = Number.isFinite(pageValue)
          ? Math.max(1, Math.min(100000, Math.floor(pageValue)))
          : 1
        const pageSize = Number.isFinite(limitValue)
          ? Math.max(10, Math.min(100, Math.floor(limitValue)))
          : 50

        const query: Filter<PromotionActionLogDocument> = {}

        if (search) {
          const expression = new RegExp(
            search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          )

          query.$or = [
            { userName: expression },
            { username: expression },
            { userId: expression },
            { callsign: expression },
            { badgeNumber: expression },
            { rank: expression },
            { action: expression },
            { category: expression },
            { division: expression },
            { targetUserId: expression },
            { targetName: expression },
            { targetRank: expression },
            { summary: expression },
            { path: expression },
          ]
        }

        if (action) query.action = action
        if (category) query.category = category
        if (division) query.division = division

        if (actor) {
          const expression = new RegExp(
            actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          )
          query.$or = [
            ...(Array.isArray(query.$or) ? query.$or : []),
            { userName: expression },
            { username: expression },
            { userId: expression },
          ]
        }

        if (from || to) {
          const createdAt: Record<string, Date> = {}

          if (from) createdAt.$gte = from
          if (to) createdAt.$lte = to

          query.createdAt = createdAt
        }

        const [total, items] = await Promise.all([
          logs.countDocuments(query),
          logs
            .find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray(),
        ])

        return res.json({
          success: true,
          logs: items.map((item) => ({
            id: String(item._id ?? ""),
            createdAt: item.createdAt,
            userId: item.userId,
            userName: item.userName,
            username: item.username,
            rank: item.rank,
            callsign: item.callsign,
            badgeNumber: item.badgeNumber,
            action: item.action,
            category: item.category,
            division: item.division ?? null,
            targetUserId: item.targetUserId ?? null,
            targetName: item.targetName ?? null,
            targetRank: item.targetRank ?? null,
            summary: item.summary,
            details: item.details ?? null,
            path: item.path ?? null,
          })),
          pagination: {
            page,
            limit: pageSize,
            total,
            pages: Math.max(1, Math.ceil(total / pageSize)),
          },
        })
      } catch (error) {
        console.error(
          "GET /api/promotion/action-logs failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error: "Failed to load promotion action logs.",
        })
      }
    },
  )
}
