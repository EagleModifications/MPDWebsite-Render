import type { Express, Request, Response } from "express"
import { randomUUID } from "node:crypto"

import { getRequestUser } from "./auth/session"
import { hasPermission } from "./permissions/permissions"

export const ACTION_LOG_PERMISSION = "promotionlogs"

export const ACTION_LOG_MODULES = [
  "promotion",
  "activity",
] as const

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

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000
const MAX_LOGS = 2000

/**
 * Render-safe action log storage.
 *
 * This deliberately uses process memory instead of MongoDB. Action logs are
 * temporary by design and are removed after 14 days or when the Render
 * process restarts/redeploys.
 */
const actionLogs = new Map<string, ActionLog>()

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
    .slice(0, 40)
    .map(([key, item]) => {
      const safeKey = limit(key, 100)
      if (!safeKey) return null

      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        return [
          safeKey,
          typeof item === "string" ? limit(item, 2000) : item,
        ] as const
      }

      if (Array.isArray(item)) {
        return [
          safeKey,
          item.slice(0, 100).map((entry) =>
            typeof entry === "string" ? limit(entry, 500) : entry,
          ),
        ] as const
      }

      try {
        return [safeKey, JSON.stringify(item).slice(0, 2000)] as const
      } catch {
        return [safeKey, String(item).slice(0, 2000)] as const
      }
    })
    .filter((entry): entry is readonly [string, unknown] => Boolean(entry))

  return entries.length ? Object.fromEntries(entries) : undefined
}

function pruneLogs(now = Date.now()) {
  const cutoff = now - RETENTION_MS

  for (const [id, log] of actionLogs) {
    const time = new Date(log.createdAt).getTime()
    if (!Number.isFinite(time) || time < cutoff) {
      actionLogs.delete(id)
    }
  }

  if (actionLogs.size <= MAX_LOGS) return

  const ordered = Array.from(actionLogs.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const removeCount = actionLogs.size - MAX_LOGS
  for (let index = 0; index < removeCount; index += 1) {
    actionLogs.delete(ordered[index].id)
  }
}

function duplicateKey(input: {
  userId: string
  module: string
  action: string
  category: string
  division?: string
  targetUserId?: string
  targetName?: string
  summary: string
  path?: string
}) {
  return [
    input.userId,
    input.module,
    input.action,
    input.category,
    input.division ?? "",
    input.targetUserId ?? "",
    input.targetName ?? "",
    input.summary,
    input.path ?? "",
  ].join("|")
}

function sameDuplicate(log: ActionLog, key: string) {
  return duplicateKey(log) === key
}

export function logAction(
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
) {
  pruneLogs()

  const document: ActionLog = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    userId: limit(user.discordId, 64),
    userName: limit(user.name, 150),
    username: limit(user.username, 150),
    avatar: user.avatar ? limit(user.avatar, 500) : null,
    rank: limit(user.rank, 100),
    callsign: limit(user.callsign, 50),
    badgeNumber: limit(user.badgeNumber, 50),
    module: input.module,
    action: limit(input.action, 120),
    category: input.category,
    ...(input.division ? { division: input.division } : {}),
    ...(input.targetUserId ? { targetUserId: limit(input.targetUserId, 64) } : {}),
    ...(input.targetName ? { targetName: limit(input.targetName, 150) } : {}),
    ...(input.targetRank ? { targetRank: limit(input.targetRank, 100) } : {}),
    summary: limit(input.summary, 1500),
    ...(cleanDetails(input.details) ? { details: cleanDetails(input.details) } : {}),
    ...(input.path ? { path: limit(input.path, 300) } : {}),
  }

  if (!document.action || !document.summary) return

  const key = duplicateKey(document)
  const cutoff = Date.now() - 3000

  for (const existing of actionLogs.values()) {
    if (
      new Date(existing.createdAt).getTime() >= cutoff &&
      sameDuplicate(existing, key)
    ) {
      return
    }
  }

  actionLogs.set(document.id, document)
  pruneLogs()
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

      logAction(user, {
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

      return res.json({ success: true })
    } catch (error) {
      console.error("POST /api/action-logs failed:", error)
      return res.status(500).json({ success: false, error: "Failed to write action log." })
    }
  })

  app.get("/api/action-logs", async (req, res) => {
    try {
      const user = await requireLogPermission(req, res)
      if (!user) return

      pruneLogs()

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

      let items = Array.from(actionLogs.values())

      items = items.filter((item) => {
        if (module && item.module !== module) return false
        if (action && item.action !== action) return false
        if (category && item.category !== category) return false
        if (division && item.division !== division) return false

        const created = new Date(item.createdAt).getTime()
        if (from && created < from.getTime()) return false
        if (to && created > to.getTime()) return false

        if (actor) {
          const actorValues = [item.userName, item.username, item.userId]
            .join(" ")
            .toLowerCase()
          if (!actorValues.includes(actor)) return false
        }

        if (search) {
          const searchable = [
            item.userName,
            item.username,
            item.userId,
            item.callsign,
            item.badgeNumber,
            item.rank,
            item.module,
            item.action,
            item.category,
            item.division,
            item.targetUserId,
            item.targetName,
            item.targetRank,
            item.summary,
            item.path,
            JSON.stringify(item.details ?? {}),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()

          if (!searchable.includes(search)) return false
        }

        return true
      })

      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

      const total = items.length
      const pages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(page, pages)
      const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize)

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
