import { google } from "googleapis"
import type { Express } from "express"

import { env } from "./config"

export type MainRosterSheetKey =
  | "home"
  | "departmentRoster"
  | "employeeDatabase"
  | "vehicleRoster"
  | "uniformRoster"

type MainRosterSheetConfig = {
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

const SHEETS: Record<MainRosterSheetKey, MainRosterSheetConfig> = {
  home: {
    key: "home",
    name: env.mainRoster.home.name,
    gid: env.mainRoster.home.gid,
  },
  departmentRoster: {
    key: "departmentRoster",
    name: env.mainRoster.departmentRoster.name,
    gid: env.mainRoster.departmentRoster.gid,
  },
  employeeDatabase: {
    key: "employeeDatabase",
    name: env.mainRoster.employeeDatabase.name,
    gid: env.mainRoster.employeeDatabase.gid,
  },
  vehicleRoster: {
    key: "vehicleRoster",
    name: env.mainRoster.vehicleRoster.name,
    gid: env.mainRoster.vehicleRoster.gid,
  },
  uniformRoster: {
    key: "uniformRoster",
    name: env.mainRoster.uniformRoster.name,
    gid: env.mainRoster.uniformRoster.gid,
  },
}

const CACHE_TTL_MS = 30 * 60 * 1000

type CacheEntry = {
  data: MainRosterSheetData
  fetchedAt: number
}

const cache = new Map<MainRosterSheetKey, CacheEntry>()
const inFlight = new Map<MainRosterSheetKey, Promise<MainRosterSheetData>>()

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

function setNoCacheHeaders(res: { setHeader: (name: string, value: string) => void }) {
  for (const [header, value] of Object.entries(noCacheHeaders)) {
    res.setHeader(header, value)
  }
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.googleServiceAccountEmail,
      private_key: env.googlePrivateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })

  return google.sheets({ version: "v4", auth })
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function escapeSheetName(value: string): string {
  const sheetName = clean(value)

  if (!sheetName) {
    throw new Error("Main Roster Google Sheet tab name is empty.")
  }

  return sheetName.replace(/'/g, "''")
}

function normalizeRows(values: unknown[][]): string[][] {
  const sourceRows = values.map((row) =>
    Array.isArray(row) ? row : [],
  )

  const width = Math.max(
    1,
    ...sourceRows.map((row) => row.length),
  )

  return sourceRows.map((row) =>
    Array.from(
      { length: width },
      (_, index) => clean(row[index]),
    ),
  )
}

async function fetchFromGoogle(
  key: MainRosterSheetKey,
): Promise<MainRosterSheetData> {
  const config = SHEETS[key]
  const sheets = getSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.mainRoster.spreadsheetId,
    range: `'${escapeSheetName(config.name)}'!A:ZZ`,
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  })

  const rows = normalizeRows(response.data.values ?? [])
  const firstNonEmpty = rows.findIndex((row) => row.some(Boolean))
  const headerRow = firstNonEmpty >= 0 ? firstNonEmpty : 0
  const width = rows[0]?.length ?? 1
  const headers =
    rows[headerRow] ??
    Array.from({ length: width }, () => "")

  return {
    key,
    name: config.name,
    gid: config.gid,
    headers,
    rows: rows.slice(headerRow + 1),
    rawRows: rows,
    rowCount: rows.length,
    columnCount: width,
  }
}

export async function getMainRosterSheet(
  key: MainRosterSheetKey,
  options: { forceRefresh?: boolean } = {},
): Promise<MainRosterSheetData> {
  if (!SHEETS[key]) {
    throw new Error(`Unknown Main Roster sheet key: ${key}`)
  }

  const forceRefresh = options.forceRefresh === true
  const now = Date.now()
  const cached = cache.get(key)

  if (
    !forceRefresh &&
    cached &&
    now - cached.fetchedAt < CACHE_TTL_MS
  ) {
    return cached.data
  }

  // Do not create duplicate Google requests when several users/pages request
  // the same uncached sheet at the same time.
  if (!forceRefresh) {
    const existing = inFlight.get(key)
    if (existing) return existing
  }

  const request = fetchFromGoogle(key)
    .then((data) => {
      cache.set(key, {
        data,
        fetchedAt: Date.now(),
      })

      return data
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, request)
  return request
}

export function clearMainRosterCache() {
  cache.clear()
}

export function registerMainRosterRoutes(app: Express) {
  const keyMap: Record<string, MainRosterSheetKey> = {
    home: "home",
    "department-roster": "departmentRoster",
    "employee-database": "employeeDatabase",
    "vehicle-roster": "vehicleRoster",
    "uniform-roster": "uniformRoster",
  }

  app.get("/api/main-roster/:sheet", async (req, res) => {
    const key = keyMap[req.params.sheet]

    if (!key) {
      setNoCacheHeaders(res)
      return res.status(404).json({
        success: false,
        error: "Unknown Main Roster sheet.",
      })
    }

    try {
      const forceRefresh =
        req.query.refresh === "1" ||
        req.query.refresh === "true"

      const sheet = await getMainRosterSheet(key, {
        forceRefresh,
      })

      setNoCacheHeaders(res)
      return res.json({
        success: true,
        sheet,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error)

      console.error(
        `[main-roster] Failed to load ${req.params.sheet}:`,
        error,
      )

      setNoCacheHeaders(res)
      return res.status(500).json({
        success: false,
        error: `Google Sheets error loading ${SHEETS[key].name}: ${message}`,
      })
    }
  })

  app.get("/api/main-roster/config", (_req, res) => {
    setNoCacheHeaders(res)

    return res.json({
      success: true,
      spreadsheet: {
        id: env.mainRoster.spreadsheetId,
        url: env.mainRoster.spreadsheetUrl,
        publishedUrl: env.mainRoster.publishedUrl,
      },
      sheets: SHEETS,
      cache: {
        ttlMinutes: CACHE_TTL_MS / 60000,
      },
    })
  })

  app.get("/api/main-roster/test", async (_req, res) => {
    try {
      const sheets = getSheetsClient()

      const response = await sheets.spreadsheets.get({
        spreadsheetId: env.mainRoster.spreadsheetId,
        fields:
          "spreadsheetId,properties(title),sheets(properties(sheetId,title))",
      })

      const googleSheets = (response.data.sheets ?? []).map(
        (sheet) => ({
          gid: String(sheet.properties?.sheetId ?? ""),
          name: sheet.properties?.title ?? "",
        }),
      )

      setNoCacheHeaders(res)
      return res.json({
        success: true,
        spreadsheet: {
          id:
            response.data.spreadsheetId ??
            env.mainRoster.spreadsheetId,
          title: response.data.properties?.title ?? "",
        },
        configuredSheets: SHEETS,
        googleSheets,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error)

      console.error(
        "[main-roster] Google connection test failed:",
        error,
      )

      setNoCacheHeaders(res)
      return res.status(500).json({
        success: false,
        error: message,
      })
    }
  })

  // Compatibility endpoint for older frontend code.
  app.get("/api/main-roster", async (req, res) => {
    try {
      const forceRefresh =
        req.query.refresh === "1" ||
        req.query.refresh === "true"

      const [
        home,
        departmentRoster,
        employeeDatabase,
        vehicleRoster,
        uniformRoster,
      ] = await Promise.all([
        getMainRosterSheet("home", { forceRefresh }),
        getMainRosterSheet("departmentRoster", { forceRefresh }),
        getMainRosterSheet("employeeDatabase", { forceRefresh }),
        getMainRosterSheet("vehicleRoster", { forceRefresh }),
        getMainRosterSheet("uniformRoster", { forceRefresh }),
      ])

      setNoCacheHeaders(res)
      return res.json({
        success: true,
        sheets: {
          home,
          departmentRoster,
          employeeDatabase,
          vehicleRoster,
          uniformRoster,
        },
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error)

      console.error(
        "[main-roster] Combined request failed:",
        error,
      )

      setNoCacheHeaders(res)
      return res.status(500).json({
        success: false,
        error: message,
      })
    }
  })
}
