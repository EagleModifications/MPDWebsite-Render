import { google } from "googleapis"
import type { Express, Response } from "express"

import { env } from "./config"

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

type MainRosterColor = {
  red?: number
  green?: number
  blue?: number
  alpha?: number
}

type MainRosterBorder = {
  style?: string
  color?: MainRosterColor
}

export type MainRosterCellStyle = {
  backgroundColor?: MainRosterColor
  textColor?: MainRosterColor
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  horizontalAlignment?: string
  verticalAlignment?: string
  wrapStrategy?: string
  textDirection?: string
  padding?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  borders?: {
    top?: MainRosterBorder
    right?: MainRosterBorder
    bottom?: MainRosterBorder
    left?: MainRosterBorder
  }
  numberFormat?: {
    type?: string
    pattern?: string
  }
  textRotation?: {
    angle?: number
    vertical?: boolean
  }
}

export type MainRosterCell = {
  value: string
  formula?: string
  hyperlink?: string
  styleId: number
}

export type MainRosterMerge = {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
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
  sheetRowCount: number
  sheetColumnCount: number
  hideGridlines: boolean
  frozenRowCount: number
  frozenColumnCount: number
  rowHeights: number[]
  columnWidths: number[]
  hiddenRows: number[]
  hiddenColumns: number[]
  merges: MainRosterMerge[]
  styles: MainRosterCellStyle[]
  cells: MainRosterCell[][]
}

export type MainRosterResponse = {
  success: true
  spreadsheet: {
    id: string
    url: string
    publishedUrl: string
    title: string
  }
  sheets: Record<MainRosterSheetKey, MainRosterSheetData>
  updatedAt: string
}

const mainRoster = env.mainRoster

const SHEETS: Record<MainRosterSheetKey, MainRosterSheetConfig> = {
  home: { key: "home", name: mainRoster.home.name, gid: mainRoster.home.gid },
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

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function color(value: any): MainRosterColor | undefined {
  if (!value) return undefined

  const source = value.rgbColor ?? value
  if (!source) return undefined

  const result: MainRosterColor = {}
  if (typeof source.red === "number") result.red = source.red
  if (typeof source.green === "number") result.green = source.green
  if (typeof source.blue === "number") result.blue = source.blue
  if (typeof source.alpha === "number") result.alpha = source.alpha

  return Object.keys(result).length ? result : undefined
}

function border(value: any): MainRosterBorder | undefined {
  if (!value) return undefined
  const result: MainRosterBorder = {}
  if (value.style) result.style = value.style
  const borderColor = color(value.colorStyle ?? value.color)
  if (borderColor) result.color = borderColor
  return Object.keys(result).length ? result : undefined
}

function serializeStyle(format: any): MainRosterCellStyle {
  const style: MainRosterCellStyle = {}
  if (!format) return style

  const background = color(format.backgroundColorStyle ?? format.backgroundColor)
  if (background) style.backgroundColor = background

  const textFormat = format.textFormat
  const foreground = color(textFormat?.foregroundColorStyle ?? textFormat?.foregroundColor)
  if (foreground) style.textColor = foreground

  if (textFormat?.fontFamily) style.fontFamily = textFormat.fontFamily
  if (typeof textFormat?.fontSize === "number") style.fontSize = textFormat.fontSize
  if (typeof textFormat?.bold === "boolean") style.bold = textFormat.bold
  if (typeof textFormat?.italic === "boolean") style.italic = textFormat.italic
  if (typeof textFormat?.underline === "boolean") style.underline = textFormat.underline
  if (typeof textFormat?.strikethrough === "boolean") style.strikethrough = textFormat.strikethrough

  if (format.horizontalAlignment) style.horizontalAlignment = format.horizontalAlignment
  if (format.verticalAlignment) style.verticalAlignment = format.verticalAlignment
  if (format.wrapStrategy) style.wrapStrategy = format.wrapStrategy
  if (format.textDirection) style.textDirection = format.textDirection

  if (format.padding) {
    style.padding = {
      top: format.padding.top,
      right: format.padding.right,
      bottom: format.padding.bottom,
      left: format.padding.left,
    }
  }

  if (format.numberFormat) {
    style.numberFormat = {
      type: format.numberFormat.type,
      pattern: format.numberFormat.pattern,
    }
  }

  if (format.textRotation) {
    style.textRotation = {
      angle: format.textRotation.angle,
      vertical: format.textRotation.vertical,
    }
  }

  if (format.borders) {
    const borders: MainRosterCellStyle["borders"] = {}
    const top = border(format.borders.top)
    const right = border(format.borders.right)
    const bottom = border(format.borders.bottom)
    const left = border(format.borders.left)
    if (top) borders.top = top
    if (right) borders.right = right
    if (bottom) borders.bottom = bottom
    if (left) borders.left = left
    if (Object.keys(borders).length) style.borders = borders
  }

  return style
}

function stableStyleKey(style: MainRosterCellStyle): string {
  return JSON.stringify(style)
}

function escapeSheetName(name: string): string {
  return name.replace(/'/g, "''")
}

function getConfiguredSheet(key: MainRosterSheetKey) {
  const config = SHEETS[key]
  if (!config) throw new Error(`Main Roster sheet configuration not found for: ${key}`)
  return config
}

function mergeCellFormat(base: any, fallback: any) {
  return base ?? fallback ?? {}
}

export async function getMainRosterSheet(
  key: MainRosterSheetKey,
): Promise<MainRosterSheetData> {
  const config = getConfiguredSheet(key)
  const sheets = getSheetsClient()

  const response = await sheets.spreadsheets.get({
    spreadsheetId: mainRoster.spreadsheetId,
    ranges: [`'${escapeSheetName(config.name)}'!A1:ZZ`],
    includeGridData: true,
    fields:
      "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount,hideGridlines)),merges,data(startRow,startColumn,rowData(values(formattedValue,userEnteredValue,effectiveFormat,userEnteredFormat,hyperlink)),rowMetadata(pixelSize,hiddenByUser),columnMetadata(pixelSize,hiddenByUser)))",
  })

  const sheet = response.data.sheets?.[0]
  const properties = sheet?.properties
  const grid = sheet?.data?.[0]
  const gridProperties = properties?.gridProperties

  const sheetRowCount = Number(gridProperties?.rowCount ?? 0)
  const sheetColumnCount = Number(gridProperties?.columnCount ?? 0)
  const rowData = grid?.rowData ?? []
  const rowStart = Number(grid?.startRow ?? 0)
  const columnStart = Number(grid?.startColumn ?? 0)

  const styles: MainRosterCellStyle[] = [{}]
  const styleMap = new Map<string, number>([[stableStyleKey({}), 0]])

  const getStyleId = (format: any) => {
    const style = serializeStyle(format)
    const key = stableStyleKey(style)
    const existing = styleMap.get(key)
    if (existing !== undefined) return existing
    const id = styles.length
    styles.push(style)
    styleMap.set(key, id)
    return id
  }

  const cells: MainRosterCell[][] = []
  const rawRows: string[][] = []

  for (let r = 0; r < rowData.length; r += 1) {
    const row = rowData[r]?.values ?? []
    const cellsRow: MainRosterCell[] = []
    const rawRow: string[] = []

    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c] ?? {}
      const formattedValue = cleanCell(cell.formattedValue)
      const effectiveValue = cell.effectiveValue
      const value = formattedValue || cleanCell(
        effectiveValue?.stringValue ??
          effectiveValue?.numberValue ??
          effectiveValue?.boolValue,
      )
      const formula = cell.userEnteredValue?.formulaValue
      const format = mergeCellFormat(cell.effectiveFormat, cell.userEnteredFormat)

      cellsRow.push({
        value,
        ...(formula ? { formula } : {}),
        ...(cell.hyperlink ? { hyperlink: cell.hyperlink } : {}),
        styleId: getStyleId(format),
      })
      rawRow.push(value)
    }

    cells.push(cellsRow)
    rawRows.push(rawRow)
  }

  const maxRenderedRows = Math.max(
    cells.length,
    1,
  )
  const maxRenderedColumns = Math.max(
    ...cells.map((row) => row.length),
    1,
  )

  const rowHeights: number[] = []
  const hiddenRows: number[] = []
  for (let i = 0; i < rowData.length; i += 1) {
    const metadata = grid?.rowMetadata?.[i]
    rowHeights[rowStart + i] = Number(metadata?.pixelSize ?? 21)
    if (metadata?.hiddenByUser) hiddenRows.push(rowStart + i)
  }

  const columnWidths: number[] = []
  const hiddenColumns: number[] = []
  for (let i = 0; i < Math.max((grid?.columnMetadata ?? []).length, maxRenderedColumns - columnStart); i += 1) {
    const metadata = grid?.columnMetadata?.[i]
    columnWidths[columnStart + i] = Number(metadata?.pixelSize ?? 100)
    if (metadata?.hiddenByUser) hiddenColumns.push(columnStart + i)
  }

  const merges: MainRosterMerge[] = (sheet?.merges ?? []).map((merge) => ({
    startRow: Number(merge.startRow ?? 0),
    endRow: Number(merge.endRow ?? 0),
    startColumn: Number(merge.startColumn ?? 0),
    endColumn: Number(merge.endColumn ?? 0),
  }))

  const paddedCells: MainRosterCell[][] = Array.from(
    { length: maxRenderedRows },
    (_, rowIndex) =>
      Array.from({ length: maxRenderedColumns }, (_, columnIndex) =>
        cells[rowIndex]?.[columnIndex] ?? {
          value: "",
          styleId: 0,
        },
      ),
  )

  const paddedRawRows: string[][] = Array.from(
    { length: maxRenderedRows },
    (_, rowIndex) =>
      Array.from(
        { length: maxRenderedColumns },
        (_, columnIndex) => rawRows[rowIndex]?.[columnIndex] ?? "",
      ),
  )

  // Preserve the old API fields for filtering/search consumers.
  // The first populated row is only treated as a logical header for filters;
  // the rendered grid itself uses every row and its actual Google formatting.
  const firstPopulated = paddedRawRows.findIndex((row) => row.some(Boolean))
  const headerIndex = firstPopulated >= 0 ? firstPopulated : 0
  const headers = paddedRawRows[headerIndex] ?? []
  const rows = paddedRawRows.slice(headerIndex + 1)

  return {
    key,
    name: config.name,
    gid: config.gid,
    headers,
    rows,
    rawRows: paddedRawRows,
    rowCount: maxRenderedRows,
    columnCount: maxRenderedColumns,
    sheetRowCount: maxRenderedRows,
    sheetColumnCount: maxRenderedColumns,
    hideGridlines: gridProperties?.hideGridlines ?? false,
    frozenRowCount: Number(gridProperties?.frozenRowCount ?? 0),
    frozenColumnCount: Number(gridProperties?.frozenColumnCount ?? 0),
    rowHeights,
    columnWidths,
    hiddenRows,
    hiddenColumns,
    merges,
    styles,
    cells: paddedCells,
  }
}

export async function getMainRoster(): Promise<MainRosterResponse> {
  const sheets = getSheetsClient()
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: mainRoster.spreadsheetId,
    fields: "spreadsheetId,properties(title)",
  })

  const [home, departmentRoster, employeeDatabase, vehicleRoster, uniformRoster] =
    await Promise.all([
      getMainRosterSheet("home"),
      getMainRosterSheet("departmentRoster"),
      getMainRosterSheet("employeeDatabase"),
      getMainRosterSheet("vehicleRoster"),
      getMainRosterSheet("uniformRoster"),
    ])

  return {
    success: true,
    spreadsheet: {
      id: spreadsheet.data.spreadsheetId ?? mainRoster.spreadsheetId,
      url: mainRoster.spreadsheetUrl,
      publishedUrl: mainRoster.publishedUrl,
      title: spreadsheet.data.properties?.title ?? "Metro Police Department Main Roster",
    },
    sheets: { home, departmentRoster, employeeDatabase, vehicleRoster, uniformRoster },
    updatedAt: new Date().toISOString(),
  }
}

export async function testMainRosterConnection() {
  const sheets = getSheetsClient()
  const response = await sheets.spreadsheets.get({
    spreadsheetId: mainRoster.spreadsheetId,
    fields: "spreadsheetId,properties(title),sheets(properties(sheetId,title))",
  })

  return {
    success: true as const,
    spreadsheet: {
      id: response.data.spreadsheetId ?? mainRoster.spreadsheetId,
      title: response.data.properties?.title ?? "",
    },
    configuredSheets: SHEETS,
    googleSheets: (response.data.sheets ?? []).map((sheet) => ({
      gid: String(sheet.properties?.sheetId ?? ""),
      name: sheet.properties?.title ?? "",
    })),
  }
}

function sendNoCache(res: Response) {
  for (const [key, value] of Object.entries(CACHE_HEADERS)) res.setHeader(key, value)
}

export function registerMainRosterRoutes(app: Express) {
  app.get("/api/main-roster", async (_req, res) => {
    try {
      const result = await getMainRoster()
      sendNoCache(res)
      return res.json(result)
    } catch (error) {
      console.error("[main-roster] Failed to load Main Roster:", error)
      sendNoCache(res)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to load Main Roster.",
      })
    }
  })

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
      return res.status(404).json({ success: false, error: "Unknown Main Roster sheet." })
    }

    try {
      const sheet = await getMainRosterSheet(key)
      sendNoCache(res)
      return res.json({ success: true, sheet })
    } catch (error) {
      console.error(`[main-roster] Failed to load ${req.params.sheet}:`, error)
      sendNoCache(res)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to load Main Roster sheet.",
      })
    }
  })

  app.get("/api/main-roster/config", (_req, res) => {
    return res.json({
      success: true,
      spreadsheet: {
        id: mainRoster.spreadsheetId,
        url: mainRoster.spreadsheetUrl,
        publishedUrl: mainRoster.publishedUrl,
      },
      sheets: SHEETS,
    })
  })

  app.get("/api/main-roster/test", async (_req, res) => {
    try {
      const result = await testMainRosterConnection()
      sendNoCache(res)
      return res.json(result)
    } catch (error) {
      console.error("[main-roster] Google connection test failed:", error)
      sendNoCache(res)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Google Main Roster connection failed.",
      })
    }
  })
}
