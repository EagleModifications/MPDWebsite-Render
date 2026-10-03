import { google } from "googleapis"

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

export type MainRosterSheet = {
  key: MainRosterSheetKey
  name: string
  gid: string
  headers: string[]
  rows: string[][]
  rowCount: number
  columnCount: number
}

export type MainRosterResponse = {
  success: true
  spreadsheet: {
    id: string
    name: string
    url: string
    publishedUrl: string
  }
  sheets: Record<
    MainRosterSheetKey,
    MainRosterSheet
  >
  updatedAt: string
}

/* ─────────────────────────────────────────────
   Google configuration
───────────────────────────────────────────── */

const mainRosterConfig = {
  spreadsheetId:
    env.mainRoster.spreadsheetId,

  spreadsheetUrl:
    env.mainRoster.spreadsheetUrl,

  publishedUrl:
    env.mainRoster.publishedUrl,

  sheets: {
    home: {
      name:
        env.mainRoster.home.name,
      gid:
        env.mainRoster.home.gid,
    },

    departmentRoster: {
      name:
        env.mainRoster
          .departmentRoster.name,
      gid:
        env.mainRoster
          .departmentRoster.gid,
    },

    employeeDatabase: {
      name:
        env.mainRoster
          .employeeDatabase.name,
      gid:
        env.mainRoster
          .employeeDatabase.gid,
    },

    vehicleRoster: {
      name:
        env.mainRoster
          .vehicleRoster.name,
      gid:
        env.mainRoster
          .vehicleRoster.gid,
    },

    uniformRoster: {
      name:
        env.mainRoster
          .uniformRoster.name,
      gid:
        env.mainRoster
          .uniformRoster.gid,
    },
  },
} as const

/* ─────────────────────────────────────────────
   Google client
───────────────────────────────────────────── */

function getGoogleSheetsClient() {
  const auth =
    new google.auth.GoogleAuth({
      credentials: {
        client_email:
          env.googleServiceAccountEmail,

        private_key:
          env.googlePrivateKey,
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

function clean(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return ""
  }

  return String(value).trim()
}

function escapeSheetName(
  sheetName: string,
): string {
  return sheetName.replace(
    /'/g,
    "''",
  )
}

function normaliseRow(
  row: unknown[],
): string[] {
  return row.map(clean)
}

function removeTrailingEmptyCells(
  row: string[],
): string[] {
  let lastIndex =
    row.length - 1

  while (
    lastIndex >= 0 &&
    row[lastIndex] === ""
  ) {
    lastIndex -= 1
  }

  return row.slice(
    0,
    lastIndex + 1,
  )
}

function findHeaderRow(
  rows: string[][],
): number {
  /*
   * Prefer the first row containing
   * meaningful values.
   *
   * This allows decorative rows above
   * the actual table to be ignored.
   */

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? []

    const values =
      row.filter(
        (value) =>
          value.trim() !== "",
      )

    if (values.length >= 2) {
      return index
    }
  }

  return 0
}

/* ─────────────────────────────────────────────
   Read one sheet
───────────────────────────────────────────── */

async function readSheet(
  sheetsApi: ReturnType<
    typeof getGoogleSheetsClient
  >,
  sheetName: string,
  gid: string,
  key: MainRosterSheetKey,
): Promise<MainRosterSheet> {
  try {
    const response =
      await sheetsApi.spreadsheets.values.get(
        {
          spreadsheetId:
            mainRosterConfig.spreadsheetId,

          range:
            `'${escapeSheetName(
              sheetName,
            )}'!A:ZZ`,

          majorDimension: "ROWS",

          valueRenderOption:
            "FORMATTED_VALUE",

          dateTimeRenderOption:
            "FORMATTED_STRING",
        },
      )

    const rawRows =
      (response.data.values ??
        []) as unknown[][]

    const rows =
      rawRows
        .map(normaliseRow)
        .map(
          removeTrailingEmptyCells,
        )
        .filter(
          (row) =>
            row.some(
              (value) =>
                value !== "",
            ),
        )

    const headerIndex =
      findHeaderRow(rows)

    const headers =
      rows[headerIndex] ?? []

    const dataRows =
      rows.slice(
        headerIndex + 1,
      )

    /*
     * Make every row the same length
     * as the header row.
     */

    const normalisedDataRows =
      dataRows.map(
        (row) => {
          const result =
            Array.from(
              {
                length:
                  headers.length,
              },
              (_, index) =>
                row[index] ?? "",
            )

          return result
        },
      )

    return {
      key,
      name: sheetName,
      gid,
      headers,
      rows:
        normalisedDataRows,
      rowCount:
        normalisedDataRows.length,
      columnCount:
        headers.length,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Google Sheets error"

    throw new Error(
      `Failed to read Google Main Roster sheet "${sheetName}": ${message}`,
    )
  }
}

/* ─────────────────────────────────────────────
   Spreadsheet metadata
───────────────────────────────────────────── */

export async function getMainRosterSpreadsheetInfo() {
  const sheetsApi =
    getGoogleSheetsClient()

  try {
    const response =
      await sheetsApi.spreadsheets.get(
        {
          spreadsheetId:
            mainRosterConfig.spreadsheetId,

          fields:
            "spreadsheetId,properties(title),sheets(properties(sheetId,title))",
        },
      )

    return {
      id:
        response.data
          .spreadsheetId ??
        mainRosterConfig
          .spreadsheetId,

      title:
        response.data
          .properties
          ?.title ??
        "Metro Police Department Main Roster",

      sheets:
        (
          response.data.sheets ??
          []
        ).map(
          (sheet) => ({
            gid:
              String(
                sheet.properties
                  ?.sheetId ??
                "",
              ),

            name:
              sheet.properties
                ?.title ??
              "",
          }),
        ),
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Google Sheets error"

    throw new Error(
      `Failed to access Google Main Roster spreadsheet: ${message}`,
    )
  }
}

/* ─────────────────────────────────────────────
   Read one configured sheet
───────────────────────────────────────────── */

export async function getMainRosterSheet(
  key: MainRosterSheetKey,
): Promise<MainRosterSheet> {
  const config =
    mainRosterConfig.sheets[key]

  if (!config) {
    throw new Error(
      `Unknown Main Roster sheet: ${key}`,
    )
  }

  const sheetsApi =
    getGoogleSheetsClient()

  return readSheet(
    sheetsApi,
    config.name,
    config.gid,
    key,
  )
}

/* ─────────────────────────────────────────────
   Read all Main Roster sheets
───────────────────────────────────────────── */

export async function getMainRoster(): Promise<MainRosterResponse> {
  const sheetsApi =
    getGoogleSheetsClient()

  const [
    home,
    departmentRoster,
    employeeDatabase,
    vehicleRoster,
    uniformRoster,
  ] = await Promise.all([
    readSheet(
      sheetsApi,
      mainRosterConfig
        .sheets.home.name,
      mainRosterConfig
        .sheets.home.gid,
      "home",
    ),

    readSheet(
      sheetsApi,
      mainRosterConfig
        .sheets.departmentRoster
        .name,
      mainRosterConfig
        .sheets.departmentRoster
        .gid,
      "departmentRoster",
    ),

    readSheet(
      sheetsApi,
      mainRosterConfig
        .sheets.employeeDatabase
        .name,
      mainRosterConfig
        .sheets.employeeDatabase
        .gid,
      "employeeDatabase",
    ),

    readSheet(
      sheetsApi,
      mainRosterConfig
        .sheets.vehicleRoster
        .name,
      mainRosterConfig
        .sheets.vehicleRoster
        .gid,
      "vehicleRoster",
    ),

    readSheet(
      sheetsApi,
      mainRosterConfig
        .sheets.uniformRoster
        .name,
      mainRosterConfig
        .sheets.uniformRoster
        .gid,
      "uniformRoster",
    ),
  ])

  const spreadsheetInfo =
    await getMainRosterSpreadsheetInfo()

  return {
    success: true,

    spreadsheet: {
      id:
        mainRosterConfig
          .spreadsheetId,

      name:
        spreadsheetInfo.title,

      url:
        mainRosterConfig
          .spreadsheetUrl,

      publishedUrl:
        mainRosterConfig
          .publishedUrl,
    },

    sheets: {
      home,
      departmentRoster,
      employeeDatabase,
      vehicleRoster,
      uniformRoster,
    },

    updatedAt:
      new Date().toISOString(),
  }
}
