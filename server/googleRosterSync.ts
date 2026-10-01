import { google } from "googleapis"

import { getMongoDb } from "../src/lib/mongodb"

type DivisionConfig = {
  id: string
  label: string
  rosterEnv: string
}

const divisionConfigs: DivisionConfig[] = [
  {
    id: "department",
    label: "Department",
    rosterEnv: "GOOGLE_SHEET_ROSTER_IMPORT",
  },
  {
    id: "swat",
    label: "SWAT",
    rosterEnv: "GOOGLE_SHEET_SWAT_ROSTER_IMPORT",
  },
  {
    id: "mtf7",
    label: "MTF-7",
    rosterEnv: "GOOGLE_SHEET_MTF7_ROSTER_IMPORT",
  },
  {
    id: "mcd",
    label: "MCD",
    rosterEnv: "GOOGLE_SHEET_MCD_ROSTER_IMPORT",
  },
  {
    id: "tru",
    label: "TRU",
    rosterEnv: "GOOGLE_SHEET_TRU_ROSTER_IMPORT",
  },
]

export type RosterMember = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  timeInDept: string
  timeInRank: string
  discordId: string
  status: string
}

type RosterDocument = {
  userId: string
  division: string
  members: RosterMember[]
  updatedAt: Date
}

type GoogleConfig = {
  spreadsheetId: string
  serviceAccountEmail: string
  privateKey: string
}

function getGoogleConfig(): GoogleConfig {
  const spreadsheetId =
    process.env.GOOGLE_SHEET_ID?.trim() ?? ""

  const serviceAccountEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? ""

  const privateKey = (
    process.env.GOOGLE_PRIVATE_KEY ?? ""
  )
    .replace(/\\n/g, "\n")
    .trim()

  return {
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
  }
}

function validateGoogleConfig(): GoogleConfig {
  const config = getGoogleConfig()

  if (!config.spreadsheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID is not configured.",
    )
  }

  if (!config.serviceAccountEmail) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured.",
    )
  }

  if (!config.privateKey) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is not configured.",
    )
  }

  for (const division of divisionConfigs) {
    const sheetName =
      process.env[division.rosterEnv]?.trim() ?? ""

    if (!sheetName) {
      throw new Error(
        `${division.rosterEnv} is not configured.`,
      )
    }
  }

  return config
}

function getGoogleSheetsClient() {
  const config = validateGoogleConfig()

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.serviceAccountEmail,
      private_key: config.privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  })

  return google.sheets({
    version: "v4",
    auth,
  })
}

function normalizeHeader(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function getColumn(
  headers: string[],
  possibleNames: string[],
): number {
  const normalizedNames =
    possibleNames.map(normalizeHeader)

  return headers.findIndex((header) =>
    normalizedNames.includes(
      normalizeHeader(header),
    ),
  )
}

function getValue(
  row: unknown[],
  index: number,
): string {
  if (index < 0) {
    return ""
  }

  return String(row[index] ?? "").trim()
}

async function getSheetValues(
  sheetName: string,
): Promise<unknown[][]> {
  const config = validateGoogleConfig()
  const sheets = getGoogleSheetsClient()

  try {
    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${sheetName}'!A:Z`,
      })

    return response.data.values ?? []
  } catch (error) {
    throw new Error(
      `Failed to read Google Sheet "${sheetName}": ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    )
  }
}

function validateHeaders(
  rows: unknown[][],
  sheetName: string,
): void {
  if (rows.length === 0) {
    throw new Error(
      `Google Sheet "${sheetName}" is empty.`,
    )
  }

  const headers = rows[0].map(String)

  const requiredColumns = [
    {
      name: "Callsign",
      alternatives: [
        "Callsign",
        "Call Sign",
        "Callsign Number",
      ],
    },
    {
      name: "Badge Number",
      alternatives: [
        "Badge Number",
        "Badge",
        "BadgeNumber",
        "Badge #",
        "Badge#",
      ],
    },
    {
      name: "Name",
      alternatives: [
        "Name",
        "Full Name",
        "Officer Name",
      ],
    },
    {
      name: "Rank",
      alternatives: [
        "Rank",
        "Current Rank",
      ],
    },
    {
      name: "Discord ID",
      alternatives: [
        "Discord ID",
        "DiscordID",
        "Discord",
        "Discord Id",
      ],
    },
  ]

  const missingColumns =
    requiredColumns
      .filter(
        (column) =>
          getColumn(
            headers,
            column.alternatives,
          ) === -1,
      )
      .map((column) => column.name)

  if (missingColumns.length > 0) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing required columns: ${missingColumns.join(
        ", ",
      )}`,
    )
  }
}

function convertRowsToRoster(
  rows: unknown[][],
): RosterMember[] {
  if (rows.length <= 1) {
    return []
  }

  const headers = rows[0].map(String)

  const callsignColumn = getColumn(headers, [
    "Callsign",
    "Call Sign",
    "Callsign Number",
  ])

  const badgeColumn = getColumn(headers, [
    "Badge Number",
    "Badge",
    "BadgeNumber",
    "Badge #",
    "Badge#",
  ])

  const nameColumn = getColumn(headers, [
    "Name",
    "Full Name",
    "Officer Name",
  ])

  const rankColumn = getColumn(headers, [
    "Rank",
    "Current Rank",
  ])

  const timeInDeptColumn = getColumn(headers, [
    "Time In Dept",
    "Time In Department",
    "TimeInDept",
    "Department Time",
    "Dept Time",
  ])

  const timeInRankColumn = getColumn(headers, [
    "Time In Rank",
    "TimeInRank",
    "Rank Time",
  ])

  const discordIdColumn = getColumn(headers, [
    "Discord ID",
    "DiscordID",
    "Discord",
    "Discord Id",
  ])

  const statusColumn = getColumn(headers, [
    "Status",
    "Department Status",
  ])

  return rows
    .slice(1)
    .filter((row) =>
      row.some(
        (value) =>
          String(value ?? "").trim() !== "",
      ),
    )
    .map(
      (row): RosterMember => ({
        callsign: getValue(
          row,
          callsignColumn,
        ),

        badgeNumber: getValue(
          row,
          badgeColumn,
        ),

        name: getValue(
          row,
          nameColumn,
        ),

        rank: getValue(
          row,
          rankColumn,
        ),

        timeInDept: getValue(
          row,
          timeInDeptColumn,
        ),

        timeInRank: getValue(
          row,
          timeInRankColumn,
        ),

        discordId: getValue(
          row,
          discordIdColumn,
        ),

        status: getValue(
          row,
          statusColumn,
        ),
      }),
    )
}

async function importRoster(
  sheetName: string,
): Promise<RosterMember[]> {
  const rows = await getSheetValues(sheetName)

  validateHeaders(
    rows,
    sheetName,
  )

  return convertRowsToRoster(rows)
}

/* ─────────────────────────────────────────────
   Google → MongoDB
───────────────────────────────────────────── */

export async function syncGoogleRosters(
  userId: string,
) {
  const cleanUserId = String(
    userId ?? "",
  ).trim()

  if (!cleanUserId) {
    throw new Error(
      "A valid authenticated userId is required for Google roster sync.",
    )
  }

  const startedAt = Date.now()

  validateGoogleConfig()

  const db = await getMongoDb()

  const collection =
    db.collection<RosterDocument>(
      "rosters",
    )

  const results: Record<
    string,
    {
      sheet: string
      count: number
    }
  > = {}

  for (const division of divisionConfigs) {
    const sheetName =
      process.env[
        division.rosterEnv
      ]?.trim()

    if (!sheetName) {
      throw new Error(
        `${division.rosterEnv} is not configured.`,
      )
    }

    const members =
      await importRoster(sheetName)

    /*
     * IMPORTANT:
     *
     * Roster is now user-owned.
     *
     * Only this user's roster for this
     * division is replaced.
     *
     * Other users are untouched.
     */
    await collection.updateOne(
      {
        userId: cleanUserId,
        division: division.id,
      },
      {
        $set: {
          userId: cleanUserId,
          division: division.id,
          members,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    )

    results[division.id] = {
      sheet: sheetName,
      count: members.length,
    }
  }

  const duration =
    Date.now() - startedAt

  return {
    success: true,
    userId: cleanUserId,
    divisions: results,
    updatedAt:
      new Date().toISOString(),
    duration,
  }
}

export async function testGoogleRosterConnection() {
  validateGoogleConfig()

  const results: Record<
    string,
    {
      sheet: string
      rows: number
      headers: unknown[]
    }
  > = {}

  for (const division of divisionConfigs) {
    const sheetName =
      process.env[
        division.rosterEnv
      ]?.trim()

    if (!sheetName) {
      throw new Error(
        `${division.rosterEnv} is not configured.`,
      )
    }

    const rows =
      await getSheetValues(
        sheetName,
      )

    results[division.id] = {
      sheet: sheetName,
      rows: rows.length,
      headers: rows[0] ?? [],
    }
  }

  return {
    success: true,
    divisions: results,
  }
}