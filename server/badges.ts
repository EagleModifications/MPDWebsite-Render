import type {
  Express,
  Request,
} from "express"

import fs from "node:fs/promises"
import path from "node:path"

import { getMongoDb } from "../src/lib/mongodb"
import { getRequestUser } from "./auth/session"

/* ═════════════════════════════════════════════
   TYPES
═════════════════════════════════════════════ */

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

type RankDefinition = {
  id?: string
  name: string
}

type RankConfigDocument = {
  division: string
  ranks: RankDefinition[]
}

type RosterMember = {
  callsign?: string
  badgeNumber?: string
  name?: string
  insignia?: string
  rank?: string
  jobDescription?: string
  timeInDept?: string
  timeInRank?: string
  status?: string
  strike1?: boolean
  strike2?: boolean
  discordId?: string
  hoursThisMonth?: string
}

type RosterDocument = {
  userId?: string
  division?: string
  members?: RosterMember[]
  updatedAt?: Date
}

/* ═════════════════════════════════════════════
   HELPERS
═════════════════════════════════════════════ */

function normalize(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

async function readBadgeConfig(): Promise<BadgeConfig> {
  const configPath = path.join(
    process.cwd(),
    "config",
    "badges.json",
  )

  const file = await fs.readFile(
    configPath,
    "utf8",
  )

  const parsed = JSON.parse(
    file,
  ) as Partial<BadgeConfig>

  if (
    typeof parsed.badgeId !== "string" ||
    typeof parsed.sealId !== "string" ||
    !parsed.lines ||
    typeof parsed.lines !== "object" ||
    !parsed.rankFinishes ||
    typeof parsed.rankFinishes !== "object"
  ) {
    throw new Error(
      "config/badges.json is invalid.",
    )
  }

  return {
    badgeId: parsed.badgeId,
    sealId: parsed.sealId,

    lines: {
      "1":
        typeof parsed.lines["1"] ===
        "string"
          ? parsed.lines["1"]
          : "",
      "2":
        typeof parsed.lines["2"] ===
        "string"
          ? parsed.lines["2"]
          : "",
      "3":
        typeof parsed.lines["3"] ===
        "string"
          ? parsed.lines["3"]
          : "",
      "4":
        typeof parsed.lines["4"] ===
        "string"
          ? parsed.lines["4"]
          : "",
      "5":
        typeof parsed.lines["5"] ===
        "string"
          ? parsed.lines["5"]
          : "",
    },

    rankFinishes:
      parsed.rankFinishes,
  }
}

function replaceVariables(
  value: string,
  rank: string,
  name: string,
): string {
  return value
    .replaceAll(
      "{{rank}}",
      rank,
    )
    .replaceAll(
      "{{name}}",
      name,
    )
}

function getConfiguredFinish(
  rank: string,
  config: BadgeConfig,
): string {
  /*
   * First try the exact configured rank.
   */
  if (
    config.rankFinishes[rank]
  ) {
    return config.rankFinishes[rank]
  }

  /*
   * Then perform a case-insensitive
   * comparison so casing in MongoDB does
   * not break the configuration lookup.
   */
  const normalizedRank =
    normalize(rank)

  const match =
    Object.entries(
      config.rankFinishes,
    ).find(
      ([configuredRank]) =>
        normalize(
          configuredRank,
        ) === normalizedRank,
    )

  return match?.[1] ?? ""
}

/* ═════════════════════════════════════════════
   AUTHENTICATION
═════════════════════════════════════════════ */

async function getAuthenticatedUser(
  req: Request,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return null
    }

    if (
      typeof user.discordId !==
      "string"
    ) {
      return null
    }

    if (
      !user.discordId.trim()
    ) {
      return null
    }

    return user
  } catch (error) {
    console.error(
      "[badges] Authentication lookup failed:",
      error,
    )

    return null
  }
}

/* ═════════════════════════════════════════════
   MONGODB — ROSTER
═════════════════════════════════════════════ */

async function getDepartmentRosterMember(
  discordId: string,
): Promise<RosterMember | null> {
  const db =
    await getMongoDb()

  const rosters =
    db.collection<RosterDocument>(
      "rosters",
    )

  /*
   * Your roster documents use:
   *
   * {
   *   division: "department",
   *   members: [...]
   * }
   *
   * Find the department document
   * containing this Discord ID.
   */
  const document =
    await rosters.findOne({
      division: "department",
      "members.discordId":
        discordId,
    })

  if (!document) {
    return null
  }

  if (
    !Array.isArray(
      document.members,
    )
  ) {
    return null
  }

  const member =
    document.members.find(
      (candidate) =>
        normalize(
          candidate.discordId,
        ) === normalize(discordId),
    )

  return member ?? null
}

/* ═════════════════════════════════════════════
   MONGODB — RANK CONFIGURATION
═════════════════════════════════════════════ */

async function getDepartmentRanks(): Promise<
  RankDefinition[]
> {
  const db =
    await getMongoDb()

  const rankConfigs =
    db.collection<RankConfigDocument>(
      "rankConfigs",
    )

  const document =
    await rankConfigs.findOne({
      division: "department",
    })

  if (!document) {
    return []
  }

  if (
    !Array.isArray(
      document.ranks,
    )
  ) {
    return []
  }

  return document.ranks.filter(
    (rank) =>
      rank &&
      typeof rank.name ===
        "string",
  )
}

function resolveCanonicalRank(
  rosterRank: string,
  ranks: RankDefinition[],
): string {
  const matchingRank =
    ranks.find(
      (rank) =>
        normalize(rank.name) ===
        normalize(rosterRank),
    )

  /*
   * If the rank exists in the DB
   * configuration, use the configured
   * spelling.
   *
   * Otherwise retain the actual roster
   * value rather than inventing a rank.
   */
  return (
    matchingRank?.name ??
    rosterRank
  )
}

/* ═════════════════════════════════════════════
   BADGE GENERATION
═════════════════════════════════════════════ */

async function generateBadge(
  discordId: string,
) {
  const [
    config,
    rosterMember,
    ranks,
  ] = await Promise.all([
    readBadgeConfig(),
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
    rosterMember.name?.trim() ??
    ""

  const rosterRank =
    rosterMember.rank?.trim() ??
    ""

  if (!name) {
    throw new Error(
      "Officer does not have a name in the department roster.",
    )
  }

  if (!rosterRank) {
    throw new Error(
      "Officer does not have a rank in the department roster.",
    )
  }

  /*
   * Rank comes from the roster DB.
   *
   * rankConfigs only supplies the
   * canonical configured name.
   */
  const rank =
    resolveCanonicalRank(
      rosterRank,
      ranks,
    )

  /*
   * Finish is controlled by
   * config/badges.json.
   *
   * It is NOT hardcoded in the
   * React application.
   */
  const finish =
    getConfiguredFinish(
      rank,
      config,
    )

  const lines: BadgeLines = {
    "1": replaceVariables(
      config.lines["1"],
      rank,
      name,
    ),

    "2": replaceVariables(
      config.lines["2"],
      rank,
      name,
    ),

    "3": replaceVariables(
      config.lines["3"],
      rank,
      name,
    ),

    "4": replaceVariables(
      config.lines["4"],
      rank,
      name,
    ),

    "5": replaceVariables(
      config.lines["5"],
      rank,
      name,
    ),
  }

  return {
    badge: {
      badgeId:
        config.badgeId,

      sealId:
        config.sealId,

      finish,

      lines,
    },

    officer: {
      name,

      rank,

      badgeNumber:
        rosterMember.badgeNumber ??
        "",

      callsign:
        rosterMember.callsign ??
        "",

      discordId,

      status:
        rosterMember.status ??
        "",

      timeInDept:
        rosterMember.timeInDept ??
        "",

      timeInRank:
        rosterMember.timeInRank ??
        "",
    },
  }
}

/* ═════════════════════════════════════════════
   ROUTES
═════════════════════════════════════════════ */

export function registerBadgeRoutes(
  app: Express,
) {
  /*
   * GET /api/badges/me
   *
   * Generates the badge for the
   * currently authenticated officer.
   */
  app.get(
    "/api/badges/me",
    async (req, res) => {
      try {
        const user =
          await getAuthenticatedUser(
            req,
          )

        if (!user) {
          return res.status(401).json({
            success: false,
            error:
              "Not authenticated.",
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
          "[badges] /api/badges/me failed:",
          error,
        )

        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate badge."

        /*
         * Database/configuration errors
         * should be distinguishable from
         * authentication errors.
         */
        return res.status(500).json({
          success: false,
          error: message,
        })
      }
    },
  )

  /*
   * GET /api/badges/:discordId
   *
   * Kept for future admin functionality.
   *
   * It still requires authentication.
   */
  app.get(
    "/api/badges/:discordId",
    async (req, res) => {
      try {
        const user =
          await getAuthenticatedUser(
            req,
          )

        if (!user) {
          return res.status(401).json({
            success: false,
            error:
              "Not authenticated.",
          })
        }

        const requestedDiscordId =
          String(
            req.params.discordId ??
              "",
          ).trim()

        if (
          !requestedDiscordId
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Discord ID is required.",
          })
        }

        /*
         * Normal users can only request
         * their own badge.
         *
         * Admin/management access can be
         * added here later.
         */
        if (
          normalize(
            requestedDiscordId,
          ) !==
          normalize(
            user.discordId,
          )
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
          "[badges] /api/badges/:discordId failed:",
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
