import { google } from "googleapis"
import type { Express, Response } from "express"

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
    name: env.mainRosterHomeSheet,
    gid: process.env.GOOGLE_MAINROSTER_GID_HOME?.trim() ?? "",
  },
  departmentRoster: {
    key: "departmentRoster",
    name: env.mainRosterDepartmentRosterSheet,
    gid: process.env.GOOGLE_MAINROSTER_GID_DEPARTMENTROSTER?.trim() ?? "",
  },
  employeeDatabase: {
    key: "employeeDatabase",
    name: env.mainRosterEmployeeDataSheet,
    gid: process.env.GOOGLE_MAINROSTER_GID_EMPLOYEEDATA?.trim() ?? "",
  },
  vehicleRoster: {
    key: "vehicleRoster",
    name: env.mainRosterVehicleRosterSheet,
    gid: process.env.GOOGLE_MAINROSTER_GID_VEHICLEROSTER?.trim() ?? "",
  },
  uniformRoster: {
    key: "uniformRoster",
    name: env.mainRosterUniformRosterSheet,
    gid: process.env.GOOGLE_MAINROSTER_GID_UNIFORMROSTER?.trim() ?? "",
  },
}

const CACHE_TTL_MS = 30 * 60 * 1000
const cache = new Map<MainRosterSheetKey, { data: MainRosterSheetData; fetchedAt: number }>()
const inFlight = new Map<MainRosterSheetKey, Promise<MainRosterSheetData>>()

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
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
  return value.replace(/'/g, "''")
}

async function fetchFromGoogle(key: MainRosterSheetKey): Promise<MainRosterSheetData> {
  const config = SHEETS[key]
  const sheets = getSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.mainRosterSheetId,
    range: `'${escapeSheetName(config.name)}'!A:ZZ`,
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  })

  const sourceRows = response.data.values ?? []
  const width = Math.max(1, ...sourceRows.map((row) => row.length))
  const rows = sourceRows.map((row) =>
    Array.from({ length: width }, (_, index) => clean(row[index])),
  )

  const firstNonEmpty = rows.findIndex((row) => row.some(Boolean))
  const headerRow = firstNonEmpty >= 0 ? firstNonEmpty : 0
  const headers = rows[headerRow] ?? Array.from({ length: width }, () => "")

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
  const forceRefresh = options.forceRefresh === true
  const now = Date.now()
  const cached = cache.get(key)

  if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data
  }

  if (!forceRefresh) {
    const existing = inFlight.get(key)
    if (existing) return existing
  }

  const request = fetchFromGoogle(key)
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() })
      return data
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, request)
  return request
}

export function registerMainRosterRoutes(app: Express) {
  app.get("/api/main-roster/:sheet", async (req, res) => {
    const keyMap: Record<string, MainRosterSheetKey> = {
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
      const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true"
      const sheet = await getMainRosterSheet(key, { forceRefresh })
      for (const [header, value] of Object.entries(noCacheHeaders)) {
        res.setHeader(header, value)
      }
      return res.json({ success: true, sheet })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[main-roster] Failed to load ${req.params.sheet}:`, error)
      for (const [header, value] of Object.entries(noCacheHeaders)) {
        res.setHeader(header, value)
      }
      return res.status(500).json({
        success: false,
        error: `Google Sheets error loading ${SHEETS[key].name}: ${message}`,
      })
    }
  })

  app.get("/api/main-roster/config", (_req, res) => {
    return res.json({
      success: true,
      spreadsheet: {
        id: env.mainRosterSheetId,
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
        spreadsheetId: env.mainRosterSheetId,
        fields: "spreadsheetId,properties(title),sheets(properties(sheetId,title))",
      })

      return res.json({
        success: true,
        spreadsheet: {
          id: response.data.spreadsheetId ?? env.mainRosterSheetId,
          title: response.data.properties?.title ?? "",
        },
        configuredSheets: SHEETS,
        googleSheets: (response.data.sheets ?? []).map((sheet) => ({
          gid: String(sheet.properties?.sheetId ?? ""),
          name: sheet.properties?.title ?? "",
        })),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[main-roster] Google connection test failed:", error)
      return res.status(500).json({
        success: false,
        error: message,
      })
    }
  })

  // Keep the old combined endpoint working for any older frontend code.
  app.get("/api/main-roster", async (_req, res) => {
    try {
      const [home, departmentRoster, employeeDatabase, vehicleRoster, uniformRoster] =
        await Promise.all([
          getMainRosterSheet("home"),
          getMainRosterSheet("departmentRoster"),
          getMainRosterSheet("employeeDatabase"),
          getMainRosterSheet("vehicleRoster"),
          getMainRosterSheet("uniformRoster"),
        ])

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
      const message = error instanceof Error ? error.message : String(error)
      console.error("[main-roster] Combined request failed:", error)
      return res.status(500).json({ success: false, error: message })
    }
  })
}
