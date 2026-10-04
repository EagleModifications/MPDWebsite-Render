import type { Express } from "express"
import fs from "node:fs"
import path from "node:path"

import { getRequestUser } from "./auth/session"
import { getMongoDb } from "../src/lib/mongodb"

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

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
  id: string
  name: string
}

type RankConfigDocument = {
  division: string
  department?: string
  ranks?: RankDefinition[]
  updatedAt?: Date
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
  members?: RosterMember[]
  updatedAt?: Date
}

/* ─────────────────────────────────────────────
   Config
───────────────────────────────────────────── */

function getBadgeConfig(): BadgeConfig {
  const configPath = path.join(
    process.cwd(),
    "config",
    "badges.json",
  )

  if (!fs.existsSync(configPath)) {
    throw new Error(
      "Badge configuration file was not found.",
    )
  }

  const raw = fs.readFileSync(
    configPath,
    "utf8",
  )

  const parsed = JSON.parse(raw) as Partial<BadgeConfig>

  if (
    typeof parsed.badgeId !== "string" ||
    !parsed.badgeId.trim()
  ) {
    throw new Error(
      "Badge configuration is missing badgeId.",
    )
  }

  if (
    typeof parsed.sealId !== "string" ||
    !parsed.sealId.trim()
  ) {
    throw new Error(
      "Badge configuration is missing sealId.",
    )
  }

  if (
    !parsed.lines ||
    typeof parsed.lines !== "object"
  ) {
    throw new Error(
      "Badge configuration is missing badge lines.",
    )
  }

  const lines = parsed.lines as Partial<BadgeLines>

  for (const lineNumber of [
    "1",
    "2",
    "3",
    "4",
    "5",
  ] as const) {
    if (
      typeof lines[lineNumber] !== "string"
    ) {
      throw new Error(
        `Badge configuration is missing line ${lineNumber}.`,
      )
    }
  }

  if (
    !parsed.rankFinishes ||
    typeof parsed.rankFinishes !== "object"
  ) {
    throw new Error(
      "Badge configuration is missing rankFinishes.",
    )
  }

  return {
    badgeId: parsed.badgeId.trim(),
    sealId: parsed.sealId.trim(),
    lines: {
      "1": lines["1"]!,
      "2": lines["2"]!,
      "3": lines["3"]!,
      "4": lines["4"]!,
      "5": lines["5"]!,
    },
    rankFinishes:
      parsed.rankFinishes,
  }
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

function replaceLineVariables(
  line: string,
  values: {
    rank: string
    name: string
    badgeNumber: string
  },
): string {
  return line
    .replaceAll(
      "{{rank}}",
      values.rank,
    )
    .replaceAll(
      "{{name}}",
      values.name,
    )
    .replaceAll(
      "{{badgeNumber}}",
      values.badgeNumber,
    )
}

function getConfiguredFinish(
  rank: string,
  rankFinishes: Record<string, string>,
): string {
  const normalizedRank =
    normalize(rank)

  const entry = Object.entries(
    rankFinishes,
  ).find(
    ([configuredRank]) =>
      normalize(configuredRank) ===
      normalizedRank,
  )

  if (!entry) {
    throw new Error(
      `No badge finish is configured for rank "${rank}".`,
    )
  }

  const finish =
    String(entry[1] ?? "").trim()

  if (!finish) {
    throw new Error(
      `Badge finish for rank "${rank}" is empty.`,
    )
  }

  return finish
}

/* ─────────────────────────────────────────────
   MongoDB
───────────────────────────────────────────── */

async function getDepartmentRosterMember(
  discordId: string,
): Promise<RosterMember | null> {
  const db = await getMongoDb()

  const rosters =
    db.collection<RosterDocument>(
      "rosters",
    )

  /*
   * Roster data is currently user-scoped.
   *
   * We therefore search the department roster
   * documents for the Discord ID rather than
   * assuming a particular userId.
   *
   * The actual personnel data still comes
   * directly from MongoDB.
   */
  const document =
    await rosters.findOne({
      division: "department",
      "members.discordId": discordId,
    })

  if (!document) {
    return null
  }

  const member =
    document.members?.find(
      (item) =>
        normalize(
          item.discordId,
        ) === normalize(discordId),
    )

  return member ?? null
}

async function getDepartmentRanks(): Promise<
  RankDefinition[]
> {
  const db = await getMongoDb()

  const rankConfigs =
    db.collection<RankConfigDocument>(
      "rankConfigs",
    )

  const document =
    await rankConfigs.findOne({
      division: "department",
    })

  if (
    !document ||
    !Array.isArray(document.ranks)
  ) {
    return []
  }

  return document.ranks
    .map((rank) => ({
      id: String(
        rank?.id ?? "",
      ).trim(),

      name: String(
        rank?.name ?? "",
      ).trim(),
    }))
    .filter(
      (rank) =>
        Boolean(rank.id) &&
        Boolean(rank.name),
    )
}

/* ─────────────────────────────────────────────
   Badge Generation
───────────────────────────────────────────── */

async function generateBadge(
  discordId: string,
) {
  const config =
    getBadgeConfig()

  const member =
    await getDepartmentRosterMember(
      discordId,
    )

  if (!member) {
    return null
  }

  const name =
    String(
      member.name ?? "",
    ).trim()

  const rosterRank =
    String(
      member.rank ?? "",
    ).trim()

  const badgeNumber =
    String(
      member.badgeNumber ?? "",
    ).trim()

  if (!name) {
    throw new Error(
      "The roster member does not have a name.",
    )
  }

  if (!rosterRank) {
    throw new Error(
      "The roster member does not have a rank.",
    )
  }

  /*
   * Get the authoritative rank list from
   * MongoDB rather than maintaining a rank list
   * inside this file.
   */
  const ranks =
    await getDepartmentRanks()

  const configuredRank =
    ranks.find(
      (rank) =>
        normalize(rank.name) ===
        normalize(rosterRank),
    )

  if (!configuredRank) {
    throw new Error(
      `Rank "${rosterRank}" is not present in the department rank configuration.`,
    )
  }

  /*
   * Use the name from the roster and the
   * canonical rank name from rankConfigs.
   */
  const rank =
    configuredRank.name

  /*
   * Finish comes exclusively from
   * config/badges.json.
   */
  const finish =
    getConfiguredFinish(
      rank,
      config.rankFinishes,
    )

  const lines: BadgeLines = {
    "1": replaceLineVariables(
      config.lines["1"],
      {
        rank,
        name,
        badgeNumber,
      },
    ),

    "2": replaceLineVariables(
      config.lines["2"],
      {
        rank,
        name,
        badgeNumber,
      },
    ),

    "3": replaceLineVariables(
      config.lines["3"],
      {
        rank,
        name,
        badgeNumber,
      },
    ),

    "4": replaceLineVariables(
      config.lines["4"],
      {
        rank,
        name,
        badgeNumber,
      },
    ),

    "5": replaceLineVariables(
      config.lines["5"],
      {
        rank,
        name,
        badgeNumber,
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
      badgeNumber,
      discordId,
      callsign:
        String(
          member.callsign ?? "",
        ).trim(),
      status:
        String(
          member.status ?? "",
        ).trim(),
    },
  }
}

/* ─────────────────────────────────────────────
   Routes
───────────────────────────────────────────── */

export function registerBadgeRoutes(
  app: Express,
) {
  /*
   * Get the currently logged-in officer's badge.
   */
  app.get(
    "/api/badges/me",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated.",
          })
        }

        const discordId =
          String(
            user.discordId ?? "",
          ).trim()

        if (
          !/^\d{17,20}$/.test(
            discordId,
          )
        ) {
          return res.status(401).json({
            success: false,
            error:
              "Authenticated user does not have a valid Discord ID.",
          })
        }

        const result =
          await generateBadge(
            discordId,
          )

        if (!result) {
          return res.status(404).json({
            success: false,
            error:
              "Your department roster record could not be found.",
          })
        }

        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        )

        res.setHeader(
          "Pragma",
          "no-cache",
        )

        res.setHeader(
          "Expires",
          "0",
        )

        return res.json({
          success: true,
          ...result,
        })
      } catch (error) {
        console.error(
          "[badges/me] Failed to generate badge:",
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
   * Look up a specific officer by Discord ID.
   *
   * Authentication is still required.
   */
  app.get(
    "/api/badges/:discordId",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated.",
          })
        }

        const discordId =
          String(
            req.params.discordId ?? "",
          ).trim()

        if (
          !/^\d{17,20}$/.test(
            discordId,
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid Discord ID.",
          })
        }

        const result =
          await generateBadge(
            discordId,
          )

        if (!result) {
          return res.status(404).json({
            success: false,
            error:
              "Officer was not found in the department roster.",
          })
        }

        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        )

        res.setHeader(
          "Pragma",
          "no-cache",
        )

        res.setHeader(
          "Expires",
          "0",
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
