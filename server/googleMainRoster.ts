import { google } from "googleapis"
import type { Express, Response } from "express"

import { env } from "./config"

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

export type MainRosterSheetKey =
  | "home"
  | "departmentRoster"
  | "employeeDatabase"
  | "vehicleRoster"
  | "uniformRoster"

export type MainRosterSheetConfig = {
  key: MainRosterSheetKey
  name: string
  gid: string
}

export type MainRosterSheetData = {
  key: MainRosterSheetKey
  name: string
  gid: string
  headers: string[]
  rows: string[][]
  rawRows: string[][]
  rowCount: number
  columnCount: number
}

export type MainRosterResponse = {
  success: true
  spreadsheet: {
    id: string
    url: string
    publishedUrl: string
    title: string
  }
  sheets: Record<
    MainRosterSheetKey,
    MainRosterSheetData
  >
  updatedAt: string
}

/* ─────────────────────────────────────────────
   Configuration

   All IDs, GIDs, names and URLs come from
   server/config.ts / .env.
───────────────────────────────────────────── */

const mainRoster = env.mainRoster

const SHEETS: Record<
  MainRosterSheetKey,
  MainRosterSheetConfig
> = {
  home: {
    key: "home",
    name: mainRoster.home.name,
    gid: mainRoster.home.gid,
  },

  departmentRoster: {
    key: "departmentRoster",
    name: mainRoster.departmentRoster.name,
    gid: mainRoster.departmentRoster.gid,
  },

  employeeDatabase: {
    key: "employeeDatabase",
    name: mainRoster.employeeDatabase.name,
    gid: mainRoster.employeeDatabase.gid,
  },

  vehicleRoster: {
    key: "vehicleRoster",
    name: mainRoster.vehicleRoster.name,
    gid: mainRoster.vehicleRoster.gid,
  },

  uniformRoster: {
    key: "uniformRoster",
    name: mainRoster.uniformRoster.name,
    gid: mainRoster.uniformRoster.gid,
  },
}

const CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

/* ─────────────────────────────────────────────
   Google Sheets client
───────────────────────────────────────────── */

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.googleServiceAccountEmail,
      private_key: env.googlePrivateKey,
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

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

function cleanRow(row: unknown[]): string[] {
  return row.map(cleanCell)
}

function trimTrailingEmptyCells(
  row: string[],
): string[] {
  let last = row.length - 1

  while (last >= 0 && row[last] === "") {
    last -= 1
  }

  return row.slice(0, last + 1)
}

function trimTrailingEmptyRows(
  rows: string[][],
): string[][] {
  let last = rows.length - 1

  while (
    last >= 0 &&
    !rows[last].some((value) => value !== "")
  ) {
    last -= 1
  }

  return rows.slice(0, last + 1)
}

function normaliseRows(
  values: unknown[][],
): string[][] {
  return trimTrailingEmptyRows(
    values
      .map(cleanRow)
      .map(trimTrailingEmptyCells),
  )
}

function findHeaderRowIndex(
  rows: string[][],
): number {
  if (rows.length === 0) {
    return 0
  }

  /*
   * Main Roster table tabs use their first populated
   * row as the header. We still skip completely blank
   * rows so an accidental blank row at the top does
   * not become the header.
   */
  const index = rows.findIndex((row) =>
    row.some((value) => value !== ""),
  )

  return index >= 0 ? index : 0
}

function makeUniformRows(
  headers: string[],
  rows: string[][],
): string[][] {
  if (headers.length === 0) {
    return rows
  }

  return rows.map((row) =>
    Array.from(
      { length: headers.length },
      (_, index) => row[index] ?? "",
    ),
  )
}

function escapeSheetName(
  name: string,
): string {
  return name.replace(/'/g, "''")
}

function getConfiguredSheet(
  key: MainRosterSheetKey,
): MainRosterSheetConfig {
  const config = SHEETS[key]

  if (!config) {
    throw new Error(
      `Main Roster sheet configuration not found for: ${key}`,
    )
  }

  return config
}

/* ─────────────────────────────────────────────
   Read a single configured sheet
───────────────────────────────────────────── */

export async function getMainRosterSheet(
  key: MainRosterSheetKey,
): Promise<MainRosterSheetData> {
  const config = getConfiguredSheet(key)
  const sheets = getSheetsClient()

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: mainRoster.spreadsheetId,
      range: `'${escapeSheetName(config.name)}'!A:ZZ`,
      majorDimension: "ROWS",
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    })

  const rawRows = normaliseRows(
    (response.data.values ?? []) as unknown[][],
  )

  const headerRowIndex =
    findHeaderRowIndex(rawRows)

  const headers = rawRows[headerRowIndex] ?? []
  const dataRows = rawRows.slice(headerRowIndex + 1)

  return {
    key,
    name: config.name,
    gid: config.gid,
    headers,
    rows: makeUniformRows(headers, dataRows),
    rawRows,
    rowCount: dataRows.length,
    columnCount: headers.length,
  }
}

/* ─────────────────────────────────────────────
   Read all configured sheets
───────────────────────────────────────────── */

export async function getMainRoster(): Promise<MainRosterResponse> {
  const sheets = getSheetsClient()

  const spreadsheet =
    await sheets.spreadsheets.get({
      spreadsheetId: mainRoster.spreadsheetId,
      fields:
        "spreadsheetId,properties(title),sheets(properties(sheetId,title))",
    })

  const [
    home,
    departmentRoster,
    employeeDatabase,
    vehicleRoster,
    uniformRoster,
  ] = await Promise.all([
    getMainRosterSheet("home"),
    getMainRosterSheet("departmentRoster"),
    getMainRosterSheet("employeeDatabase"),
    getMainRosterSheet("vehicleRoster"),
    getMainRosterSheet("uniformRoster"),
  ])

  return {
    success: true,
    spreadsheet: {
      id:
        spreadsheet.data.spreadsheetId ??
        mainRoster.spreadsheetId,
      url: mainRoster.spreadsheetUrl,
      publishedUrl: mainRoster.publishedUrl,
      title:
        spreadsheet.data.properties?.title ??
        "Metro Police Department Main Roster",
    },
    sheets: {
      home,
      departmentRoster,
      employeeDatabase,
      vehicleRoster,
      uniformRoster,
    },
    updatedAt: new Date().toISOString(),
  }
}

/* ─────────────────────────────────────────────
   Spreadsheet metadata / connection test
───────────────────────────────────────────── */

export async function testMainRosterConnection() {
  const sheets = getSheetsClient()

  const response =
    await sheets.spreadsheets.get({
      spreadsheetId: mainRoster.spreadsheetId,
      fields:
        "spreadsheetId,properties(title),sheets(properties(sheetId,title))",
    })

  const googleSheets =
    (response.data.sheets ?? []).map(
      (sheet) => ({
        gid: String(
          sheet.properties?.sheetId ?? "",
        ),
        name:
          sheet.properties?.title ?? "",
      }),
    )

  return {
    success: true as const,
    spreadsheet: {
      id:
        response.data.spreadsheetId ??
        mainRoster.spreadsheetId,
      title:
        response.data.properties?.title ?? "",
    },
    configuredSheets: SHEETS,
    googleSheets,
  }
}

/* ─────────────────────────────────────────────
   Express API
───────────────────────────────────────────── */

function sendNoCache(res: Response) {
  for (const [key, value] of Object.entries(CACHE_HEADERS)) {
    res.setHeader(key, value)
  }
}

export function registerMainRosterRoutes(
  app: Express,
) {
  /*
   * GET /api/main-roster
   *
   * Returns every configured Main Roster tab.
   */
  app.get(
    "/api/main-roster",
    async (_req, res) => {
      try {
        const result = await getMainRoster()
        sendNoCache(res)
        return res.json(result)
      } catch (error) {
        console.error(
          "[main-roster] Failed to load Main Roster:",
          error,
        )

        sendNoCache(res)

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load Main Roster.",
        })
      }
    },
  )

  /*
   * GET /api/main-roster/:sheet
   *
   * Individual tabs are useful because the frontend
   * can load only the active tab when desired.
   */
  app.get(
    "/api/main-roster/:sheet",
    async (req, res) => {
      const keyMap: Record<
        string,
        MainRosterSheetKey
      > = {
        home: "home",
        "department-roster": "departmentRoster",
        "employee-database": "employeeDatabase",
        "vehicle-roster": "vehicleRoster",
        "uniform-roster": "uniformRoster",
      }

      const key = keyMap[req.params.sheet]

      if (!key) {
        return res.status(404).json({
          success: false,
          error: "Unknown Main Roster sheet.",
        })
      }

      try {
        const sheet = await getMainRosterSheet(key)
        sendNoCache(res)

        return res.json({
          success: true,
          sheet,
        })
      } catch (error) {
        console.error(
          `[main-roster] Failed to load ${req.params.sheet}:`,
          error,
        )

        sendNoCache(res)

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load Main Roster sheet.",
        })
      }
    },
  )

  /*
   * GET /api/main-roster/config
   *
   * Exposes only non-secret spreadsheet configuration.
   */
  app.get(
    "/api/main-roster/config",
    (_req, res) => {
      return res.json({
        success: true,
        spreadsheet: {
          id: mainRoster.spreadsheetId,
          url: mainRoster.spreadsheetUrl,
          publishedUrl: mainRoster.publishedUrl,
        },
        sheets: SHEETS,
      })
    },
  )

  /*
   * GET /api/main-roster/test
   *
   * Useful for Render/local debugging. This confirms
   * the service account can actually access the sheet.
   */
  app.get(
    "/api/main-roster/test",
    async (_req, res) => {
      try {
        const result =
          await testMainRosterConnection()

        sendNoCache(res)
        return res.json(result)
      } catch (error) {
        console.error(
          "[main-roster] Google connection test failed:",
          error,
        )

        sendNoCache(res)

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Google Main Roster connection failed.",
        })
      }
    },
  )
}
