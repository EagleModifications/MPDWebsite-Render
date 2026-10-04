import type { Express, Request } from "express"
import fs from "node:fs/promises"
import path from "node:path"

import { getMongoDb } from "../src/lib/mongodb"
import { getRequestUser } from "./auth/session"

type BadgeLines = {
  "1": string
  "2": string
  "3": string
  "4": string
  "5": string
}

type BadgeConfig = {
  badgeId: string
  sealId: string
  lines: BadgeLines
  rankFinishes: Record<string, string>
}

type RankConfig = {
  id?: string
  name: string
}

type RankConfigDocument = {
  division: string
  ranks: RankConfig[]
}

type RosterMember = {
  callsign?: string
  badgeNumber?: string
  name?: string
  rank?: string
  timeInDept?: string
  timeInRank?: string
  discordId?: string
  status?: string
}

type RosterDocument = {
  userId: string
  division: string
  members: RosterMember[]
  updatedAt?: Date
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

async function getBadgeConfig(): Promise<BadgeConfig> {
  const configPath = path.join(
    process.cwd(),
    "config",
    "badges.json",
  )

  const file = await fs.readFile(
    configPath,
    "utf8",
  )

  return JSON.parse(file) as BadgeConfig
}

function replaceLineVariables(
  value: string,
  variables: {
    rank: string
    name: string
  },
): string {
  return value
    .replaceAll(
      "{{rank}}",
      variables.rank,
    )
    .replaceAll(
      "{{name}}",
      variables.name,
    )
}

async function getDepartmentRosterMember(
  discordId: string,
): Promise<RosterMember | null> {
  const db = await getMongoDb()

  const document =
    await db
      .collection<RosterDocument>("rosters")
      .findOne({
        division: "department",
        "members.discordId": discordId,
      })

  if (!document) {
    return null
  }

  return (
    document.members.find(
      (member) =>
        normalize(member.discordId) ===
        normalize(discordId),
    ) ?? null
  )
}

async function getDepartmentRanks(): Promise<RankConfig[]> {
  const db = await getMongoDb()

  const document =
    await db
      .collection<RankConfigDocument>(
        "rankConfigs",
      )
      .findOne({
        division: "department",
      })

  if (!document) {
    return []
  }

  return Array.isArray(document.ranks)
    ? document.ranks
    : []
}

function getCanonicalRank(
  rosterRank: string,
  ranks: RankConfig[],
): string {
  const matchingRank =
    ranks.find(
      (rank) =>
        normalize(rank.name) ===
        normalize(rosterRank),
    )

  return matchingRank?.name ?? rosterRank
}

function getRankFinish(
  rank: string,
  config: BadgeConfig,
): string {
  const exact =
    config.rankFinishes[rank]

  if (exact) {
    return exact
  }

  const normalizedRank =
    normalize(rank)

  const matchingEntry =
    Object.entries(
      config.rankFinishes,
    ).find(
      ([configuredRank]) =>
        normalize(configuredRank) ===
        normalizedRank,
    )

  return matchingEntry?.[1] ?? ""
}

async function generateBadge(
  discordId: string,
) {
  const [
    config,
    rosterMember,
    ranks,
  ] = await Promise.all([
    getBadgeConfig(),
    getDepartmentRosterMember(
      discordId,
    ),
    getDepartmentRanks(),
  ])

  if (!rosterMember) {
    throw new Error(
      "Officer was not found in the department roster.",
    )
  }

  const name =
    rosterMember.name?.trim() ?? ""

  const rosterRank =
    rosterMember.rank?.trim() ?? ""

  if (!name) {
    throw new Error(
      "Officer does not have a name in the roster.",
    )
  }

  if (!rosterRank) {
    throw new Error(
      "Officer does not have a rank in the roster.",
    )
  }

  /*
   * The officer's actual rank comes from MongoDB.
   *
   * rankConfigs is only used to resolve the canonical
   * configured spelling/casing of that rank.
   */
  const rank =
    getCanonicalRank(
      rosterRank,
      ranks,
    )

  const finish =
    getRankFinish(
      rank,
      config,
    )

  const lines = {
    "1": replaceLineVariables(
      config.lines["1"],
      {
        rank,
        name,
      },
    ),
    "2": replaceLineVariables(
      config.lines["2"],
      {
        rank,
        name,
      },
    ),
    "3": replaceLineVariables(
      config.lines["3"],
      {
        rank,
        name,
      },
    ),
    "4": replaceLineVariables(
      config.lines["4"],
      {
        rank,
        name,
      },
    ),
    "5": replaceLineVariables(
      config.lines["5"],
      {
        rank,
        name,
      },
    ),
  }

  return {
    badge: {
      badgeId: config.badgeId,
      sealId: config.sealId,
      finish,
      lines,
    },

    officer: {
      name,
      rank,
      badgeNumber:
        rosterMember.badgeNumber ?? "",
      discordId,
      callsign:
        rosterMember.callsign ?? "",
      status:
        rosterMember.status ?? "",
      timeInDept:
        rosterMember.timeInDept ?? "",
      timeInRank:
        rosterMember.timeInRank ?? "",
    },
  }
}

async function requireAuthenticatedUser(
  req: Request,
) {
  const user =
    await getRequestUser(req)

  if (!user) {
    return null
  }

  if (!user.discordId) {
    return null
  }

  return user
}

export function registerBadgeRoutes(
  app: Express,
) {
  /*
   * Current logged-in officer.
   *
   * This is the endpoint BadgeGenerator should use.
   */
  app.get(
    "/api/badges/me",
    async (req, res) => {
      try {
        const user =
          await requireAuthenticatedUser(
            req,
          )

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated.",
          })
        }

        const result =
          await generateBadge(
            user.discordId,
          )

        return res.json({
          success: true,
          ...result,
        })
      } catch (error) {
        console.error(
          "[badges] Failed to generate current user's badge:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate badge.",
        })
      }
    },
  )

  /*
   * Specific officer.
   *
   * Still requires an authenticated session.
   */
  app.get(
    "/api/badges/:discordId",
    async (req, res) => {
      try {
        const user =
          await requireAuthenticatedUser(
            req,
          )

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated.",
          })
        }

        const requestedDiscordId =
          req.params.discordId?.trim()

        if (!requestedDiscordId) {
          return res.status(400).json({
            success: false,
            error:
              "A Discord ID is required.",
          })
        }

        /*
         * Do not allow an authenticated user to
         * arbitrarily access another officer's badge
         * unless you later explicitly add a permission
         * for that functionality.
         *
         * For now, the requested ID must match the
         * authenticated Discord ID.
         */
        if (
          normalize(
            requestedDiscordId,
          ) !==
          normalize(user.discordId)
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You cannot generate another officer's badge.",
          })
        }

        const result =
          await generateBadge(
            user.discordId,
          )

        return res.json({
          success: true,
          ...result,
        })
      } catch (error) {
        console.error(
          "[badges] Failed to generate badge:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate badge.",
        })
      }
    },
  )
}
