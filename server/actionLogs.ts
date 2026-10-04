import type { Express, Request, Response } from "express"
import { randomUUID } from "node:crypto"

import { getRequestUser } from "./auth/session"
import { hasPermission } from "./permissions/permissions"

export const ACTION_LOG_PERMISSION = "promotionlogs"

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000
const MAX_LOGS = 2000

const VALID_MODULES = ["promotion", "activity"] as const
const VALID_DIVISIONS = [
  "department",
  "swat",
  "mtf7",
  "mcd",
  "tru",
  "teu",
  "sar",
] as const

export type ActionLogModule = (typeof VALID_MODULES)[number]
export type ActionLogDivision = (typeof VALID_DIVISIONS)[number]

export type ActionLogStatus =
  | "updated"
  | "imported"
  | "created"
  | "deleted"
  | "completed"

export type ActionLogDocument = {
  id: string
  createdAt: string

  userId: string
  userName: string
  username: string
  displayName: string
  avatar?: string
  rank: string
  callsign: string
  badgeNumber: string

  module: ActionLogModule
  action: string
  status: ActionLogStatus
  division?: ActionLogDivision

  targetUserId?: string
  targetName?: string
  targetRank?: string

  summary: string
  details?: Record<string, unknown>
  path?: string
}

const logs = new Map<string, ActionLogDocument>()

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function limit(value: unknown, max = 500): string {
  return clean(value).slice(0, max)
}

function cleanDetails(
  value: unknown,
): Record<string, unknown> | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined
  }

  const entries = Object.entries(
    value as Record<string, unknown>,
  )
    .slice(0, 40)
    .map(([key, item]) => {
      const safeKey = limit(key, 80)

      if (!safeKey) return null

      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        return [
          safeKey,
          typeof item === "string"
            ? limit(item, 1000)
            : item,
        ] as const
      }

      if (Array.isArray(item)) {
        return [
          safeKey,
          item
            .slice(0, 100)
            .map((entry) =>
              typeof entry === "string"
                ? limit(entry, 250)
                : entry,
            ),
        ] as const
      }

      try {
        return [
          safeKey,
          JSON.stringify(item).slice(0, 1000),
        ] as const
      } catch {
        return [
          safeKey,
          String(item).slice(0, 1000),
        ] as const
      }
    })
    .filter(
      (
        entry,
      ): entry is readonly [string, unknown] =>
        Boolean(entry),
    )

  return entries.length
    ? Object.fromEntries(entries)
    : undefined
}

function pruneLogs(now = Date.now()) {
  const cutoff = now - RETENTION_MS

  for (const [id, log] of logs) {
    if (
      new Date(log.createdAt).getTime() <
      cutoff
    ) {
      logs.delete(id)
    }
  }

  if (logs.size <= MAX_LOGS) return

  const oldestFirst = Array.from(
    logs.values(),
  ).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime(),
  )

  const removeCount =
    logs.size - MAX_LOGS

  for (
    let index = 0;
    index < removeCount;
    index += 1
  ) {
    logs.delete(oldestFirst[index].id)
  }
}

export function logAction(
  user: {
    discordId: string
    name: string
    username: string
    displayName?: string
    avatar?: string | null
    rank: string
    callsign: string
    badgeNumber: string
  },
  input: {
    module: ActionLogModule
    action: string
    status: ActionLogStatus
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

  const now = new Date()

  const document: ActionLogDocument = {
    id: randomUUID(),
    createdAt: now.toISOString(),

    userId: limit(user.discordId, 64),
    userName: limit(user.name, 150),
    username: limit(user.username, 150),
    displayName: limit(
      user.displayName || user.name,
      150,
    ),
    ...(user.avatar
      ? { avatar: limit(user.avatar, 500) }
      : {}),
    rank: limit(user.rank, 100),
    callsign: limit(user.callsign, 50),
    badgeNumber: limit(
      user.badgeNumber,
      50,
    ),

    module: input.module,
    action: limit(input.action, 100),
    status: input.status,
    ...(input.division
      ? { division: input.division }
      : {}),

    ...(input.targetUserId
      ? {
          targetUserId: limit(
            input.targetUserId,
            64,
          ),
        }
      : {}),
    ...(input.targetName
      ? {
          targetName: limit(
            input.targetName,
            150,
          ),
        }
      : {}),
    ...(input.targetRank
      ? {
          targetRank: limit(
            input.targetRank,
            100,
          ),
        }
      : {}),

    summary: limit(input.summary, 1000),

    ...(cleanDetails(input.details)
      ? {
          details: cleanDetails(
            input.details,
          ),
        }
      : {}),

    ...(input.path
      ? {
          path: limit(input.path, 250),
        }
      : {}),
  }

  logs.set(document.id, document)
  pruneLogs()
}

async function requireLogPermission(
  req: Request,
  res: Response,
) {
  const user = await getRequestUser(req)

  if (!user) {
    res.status(401).json({
      success: false,
      error: "Unauthorized",
    })
    return null
  }

  if (
    !hasPermission(
      user,
      ACTION_LOG_PERMISSION,
    )
  ) {
    res.status(403).json({
      success: false,
      error:
        "You do not have permission to view action logs.",
    })
    return null
  }

  return user
}

export function registerActionLogRoutes(
  app: Express,
) {
  app.get(
    "/api/action-logs",
    async (req, res) => {
      try {
        const user =
          await requireLogPermission(
            req,
            res,
          )

        if (!user) return

        pruneLogs()

        const search = limit(
          req.query.search,
          200,
        ).toLowerCase()
        const moduleFilter =
          limit(
            req.query.module,
            50,
          ) as ActionLogModule
        const divisionFilter =
          limit(
            req.query.division,
            50,
          ) as ActionLogDivision
        const actionFilter = limit(
          req.query.action,
          100,
        )
        const actorFilter = limit(
          req.query.actor,
          150,
        ).toLowerCase()

        let items = Array.from(
          logs.values(),
        )

        items = items.filter((log) => {
          if (
            moduleFilter &&
            VALID_MODULES.includes(
              moduleFilter,
            ) &&
            log.module !== moduleFilter
          ) {
            return false
          }

          if (
            divisionFilter &&
            VALID_DIVISIONS.includes(
              divisionFilter,
            ) &&
            log.division !==
              divisionFilter
          ) {
            return false
          }

          if (
            actionFilter &&
            log.action !== actionFilter
          ) {
            return false
          }

          if (
            actorFilter &&
            ![
              log.userName,
              log.displayName,
              log.username,
              log.userId,
              log.callsign,
              log.badgeNumber,
            ]
              .join(" ")
              .toLowerCase()
              .includes(actorFilter)
          ) {
            return false
          }

          if (search) {
            const haystack = [
              log.userName,
              log.displayName,
              log.username,
              log.userId,
              log.callsign,
              log.badgeNumber,
              log.rank,
              log.module,
              log.action,
              log.status,
              log.division ?? "",
              log.targetUserId ?? "",
              log.targetName ?? "",
              log.targetRank ?? "",
              log.summary,
              log.path ?? "",
            ]
              .join(" ")
              .toLowerCase()

            if (!haystack.includes(search)) {
              return false
            }
          }

          return true
        })

        items.sort(
          (a, b) =>
            new Date(
              b.createdAt,
            ).getTime() -
            new Date(
              a.createdAt,
            ).getTime(),
        )

        const actors = Array.from(
          new Map(
            Array.from(
              logs.values(),
            ).map((log) => [
              log.userId,
              {
                userId: log.userId,
                name:
                  log.displayName ||
                  log.userName ||
                  log.username ||
                  log.userId,
              },
            ]),
          ).values(),
        ).sort((a, b) =>
          a.name.localeCompare(
            b.name,
          ),
        )

        const actions =
          Array.from(
            new Set(
              Array.from(
                logs.values(),
              ).map(
                (log) => log.action,
              ),
            ),
          ).sort()

        return res.json({
          success: true,
          logs: items,
          actors,
          actions,
          retentionDays: 14,
          total: items.length,
        })
      } catch (error) {
        console.error(
          "GET /api/action-logs failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            "Failed to load action logs.",
        })
      }
    },
  )
}
