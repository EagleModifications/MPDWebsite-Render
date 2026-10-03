import { google } from "googleapis"

import { getMongoDb } from "../src/lib/mongodb"

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

export type MainRosterDepartmentMember = {
  section: string
  callsign: string
  badgeNumber: string
  name: string
  insignia: string
  rank: string
  jobDescription: string
  timeInDept: string
  timeInRank: string
  status: string
  strike1: boolean
  strike2: boolean
  discordId: string
  hoursThisMonth: string
}

export type MainRosterEmployee = {
  sendMessage: string
  badgeNumber: string
  name: string
  discordId: string
  departmentStatus: string
  rank: string
  timezone: string
  joinDeptDate: string
  promoDate: string
  strike1: boolean
  strike2: boolean
  callsign: string
  timeInDept: string
  terminated: boolean
  loa: boolean
  resigned: boolean
  thisMonthHours: string
  lastMonthHours: string
}

export type MainRosterVehicle = {
  rank: string
  vehicleName: string
  spawncode: string
  requiredExtras: string
  livery: string
  windowTint: string
  turbo: boolean
  slicktopOptional: boolean
  unmarkedAllowed: boolean
}

export type MainRosterUniform = {
  rank: string
  className: string
  sharedOutfitCode: string
}

export type MainRosterHome = {
  headers: string[]
  rows: string[][]
}

export type MainRosterData = {
  type: "main"
  home: MainRosterHome
  department: MainRosterDepartmentMember[]
  employees: MainRosterEmployee[]
  vehicles: MainRosterVehicle[]
  uniforms: MainRosterUniform[]
  updatedAt: Date
}

/* ─────────────────────────────────────────────
   Google configuration
───────────────────────────────────────────── */

type GoogleMainRosterConfig = {
  spreadsheetId: string
  homeSheet: string
  departmentSheet: string
  employeeSheet: string
  vehicleSheet: string
  uniformSheet: string
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    )
  }

  return value
}

function getConfig(): GoogleMainRosterConfig {
  return {
    spreadsheetId: getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_ID",
    ),
    homeSheet: getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_HOME",
    ),
    departmentSheet: getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_DEPARTMENTROSTER",
    ),
    employeeSheet: getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_EMPLOYEEDATA",
    ),
    vehicleSheet: getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_VEHICLEROSTER",
    ),
    uniformSheet: getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_UNIFORMROSTER",
    ),
  }
}

function getGoogleSheetsClient() {
  const clientEmail = getRequiredEnv(
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  )

  const privateKey = getRequiredEnv(
    "GOOGLE_PRIVATE_KEY",
  ).replace(/\\n/g, "\n")

  const config = getConfig()

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  })

  return {
    sheets: google.sheets({
      version: "v4",
      auth,
    }),
    spreadsheetId: config.spreadsheetId,
  }
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function clean(value: unknown): string {
  return String(value ?? "").trim()
}

function normalizeHeader(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function booleanValue(value: unknown): boolean {
  const normalized = clean(value).toLowerCase()

  return [
    "true",
    "yes",
    "y",
    "x",
    "1",
    "checked",
    "on",
  ].includes(normalized)
}

function findHeaderRow(
  rows: unknown[][],
  requiredHeaders: string[],
): number {
  const required = requiredHeaders.map(
    normalizeHeader,
  )

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const headers = (
      rows[index] ?? []
    ).map(normalizeHeader)

    if (
      required.every((header) =>
        headers.includes(header),
      )
    ) {
      return index
    }
  }

  return -1
}

function getColumn(
  headers: unknown[],
  alternatives: string[],
): number {
  const normalizedHeaders =
    headers.map(normalizeHeader)

  const normalizedAlternatives =
    alternatives.map(normalizeHeader)

  return normalizedHeaders.findIndex(
    (header) =>
      normalizedAlternatives.includes(
        header,
      ),
  )
}

function getValue(
  row: unknown[],
  column: number,
): string {
  if (column < 0) {
    return ""
  }

  return clean(row[column])
}

function hasValue(row: unknown[]): boolean {
  return row.some(
    (value) => clean(value) !== "",
  )
}

function nonEmptyRows(
  rows: unknown[][],
): unknown[][] {
  return rows.filter(hasValue)
}

function isDiscordId(value: string): boolean {
  return /^\d{17,20}$/.test(value)
}

function escapeSheetName(
  sheetName: string,
): string {
  return sheetName.replace(/'/g, "''")
}

/* ─────────────────────────────────────────────
   Google → raw rows
───────────────────────────────────────────── */

async function getSheetValues(
  sheets: ReturnType<
    typeof getGoogleSheetsClient
  >["sheets"],
  spreadsheetId: string,
  sheetName: string,
): Promise<unknown[][]> {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${escapeSheetName(
        sheetName,
      )}'!A:ZZ`,
      majorDimension: "ROWS",
    })

  return response.data.values ?? []
}

/* ─────────────────────────────────────────────
   Department Roster
───────────────────────────────────────────── */

function parseDepartment(
  rows: unknown[][],
  sheetName: string,
): MainRosterDepartmentMember[] {
  const headerIndex = findHeaderRow(rows, [
    "Callsign",
    "Badge Number",
    "Name",
    "Insignia",
    "Rank",
  ])

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Department Roster columns.`,
    )
  }

  const headers = rows[headerIndex] ?? []

  const columns = {
    section: getColumn(headers, [
      "Section",
      "Division",
      "Department",
    ]),
    callsign: getColumn(headers, [
      "Callsign",
      "Call Sign",
      "Callsign Number",
    ]),
    badgeNumber: getColumn(headers, [
      "Badge Number",
      "Badge",
      "BadgeNumber",
      "Badge #",
      "Badge#",
    ]),
    name: getColumn(headers, [
      "Name",
      "Full Name",
      "Officer Name",
    ]),
    insignia: getColumn(headers, [
      "Insignia",
    ]),
    rank: getColumn(headers, [
      "Rank",
      "Current Rank",
    ]),
    jobDescription: getColumn(headers, [
      "Job Description",
      "Job",
      "Description",
    ]),
    timeInDept: getColumn(headers, [
      "Time In Dept",
      "Time In Department",
      "TimeInDept",
      "Department Time",
      "Dept Time",
    ]),
    timeInRank: getColumn(headers, [
      "Time In Rank",
      "TimeInRank",
      "Rank Time",
    ]),
    status: getColumn(headers, [
      "Status",
      "Department Status",
    ]),
    strike1: getColumn(headers, [
      "Strike 1",
      "Strike1",
      "Strike One",
    ]),
    strike2: getColumn(headers, [
      "Strike 2",
      "Strike2",
      "Strike Two",
    ]),
    discordId: getColumn(headers, [
      "Discord ID",
      "DiscordID",
      "Discord",
      "Discord Id",
    ]),
    hoursThisMonth: getColumn(headers, [
      "Hours This Month",
      "This Month Hours",
      "Hours",
      "Activity Hours",
    ]),
  }

  let currentSection = ""
  let currentRank = ""

  const members: MainRosterDepartmentMember[] = []

  for (
    const row of rows.slice(headerIndex + 1)
  ) {
    if (!hasValue(row)) {
      continue
    }

    const sectionValue =
      getValue(row, columns.section)

    const callsign =
      getValue(row, columns.callsign)

    const badgeNumber =
      getValue(row, columns.badgeNumber)

    const name =
      getValue(row, columns.name)

    const rankValue =
      getValue(row, columns.rank)

    /*
     * Google Sheets merged cells only return the value
     * on the first row of a merged block. Carry the
     * section/rank forward for the following rows.
     */
    if (sectionValue) {
      currentSection = sectionValue
    }

    if (rankValue) {
      currentRank = rankValue
    }

    const hasOfficerIdentity =
      callsign ||
      badgeNumber ||
      name ||
      getValue(row, columns.discordId)

    /*
     * Rows such as "High Command", "Supervisors",
     * "Patrol", etc. are group/section rows rather
     * than actual officers.
     */
    if (!hasOfficerIdentity) {
      continue
    }

    const discordId =
      getValue(row, columns.discordId)

    members.push({
      section: currentSection,
      callsign,
      badgeNumber,
      name,
      insignia: getValue(
        row,
        columns.insignia,
      ),
      rank:
        rankValue || currentRank,
      jobDescription: getValue(
        row,
        columns.jobDescription,
      ),
      timeInDept: getValue(
        row,
        columns.timeInDept,
      ),
      timeInRank: getValue(
        row,
        columns.timeInRank,
      ),
      status: getValue(
        row,
        columns.status,
      ),
      strike1: booleanValue(
        row[columns.strike1],
      ),
      strike2: booleanValue(
        row[columns.strike2],
      ),
      discordId,
      hoursThisMonth: getValue(
        row,
        columns.hoursThisMonth,
      ),
    })
  }

  return members
}

/* ─────────────────────────────────────────────
   Employee Database
───────────────────────────────────────────── */

function parseEmployees(
  rows: unknown[][],
  sheetName: string,
): MainRosterEmployee[] {
  const headerIndex = findHeaderRow(rows, [
    "Badge Number",
    "Name",
    "Discord ID",
    "Department Status",
    "Rank",
  ])

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Employee Database columns.`,
    )
  }

  const headers = rows[headerIndex] ?? []

  const columns = {
    sendMessage: getColumn(headers, [
      "Message User",
      "Send Message",
      "Message",
      "DM",
    ]),
    badgeNumber: getColumn(headers, [
      "Badge Number",
      "Badge",
      "BadgeNumber",
      "Badge #",
      "Badge#",
    ]),
    name: getColumn(headers, [
      "Name",
      "Full Name",
      "Employee Name",
    ]),
    discordId: getColumn(headers, [
      "Discord ID",
      "DiscordID",
      "Discord",
      "Discord Id",
    ]),
    departmentStatus: getColumn(headers, [
      "Department Status",
      "Status",
    ]),
    rank: getColumn(headers, [
      "Rank",
      "Current Rank",
    ]),
    timezone: getColumn(headers, [
      "Timezone",
      "Time Zone",
      "TZ",
    ]),
    joinDeptDate: getColumn(headers, [
      "Join Dept Date",
      "Join Department Date",
      "Department Join Date",
      "Join Date",
    ]),
    promoDate: getColumn(headers, [
      "Promo Date",
      "Promotion Date",
      "Last Promotion",
    ]),
    strike1: getColumn(headers, [
      "Strike 1",
      "Strike1",
      "Strike One",
    ]),
    strike2: getColumn(headers, [
      "Strike 2",
      "Strike2",
      "Strike Two",
    ]),
    callsign: getColumn(headers, [
      "Callsign",
      "Call Sign",
      "Callsign Number",
    ]),
    timeInDept: getColumn(headers, [
      "Time In Dept",
      "Time In Department",
      "TimeInDept",
      "Department Time",
    ]),
    terminated: getColumn(headers, [
      "Terminated",
      "Termination",
    ]),
    loa: getColumn(headers, [
      "LOA",
      "Leave Of Absence",
      "Leave of Absence",
    ]),
    resigned: getColumn(headers, [
      "Resigned",
      "Resignation",
    ]),
    thisMonthHours: getColumn(headers, [
      "This Month Hours",
      "Hours This Month",
      "Current Month Hours",
    ]),
    lastMonthHours: getColumn(headers, [
      "Last Month Hours",
      "Previous Month Hours",
    ]),
  }

  return rows
    .slice(headerIndex + 1)
    .filter(hasValue)
    .map((row) => ({
      sendMessage: getValue(
        row,
        columns.sendMessage,
      ),
      badgeNumber: getValue(
        row,
        columns.badgeNumber,
      ),
      name: getValue(row, columns.name),
      discordId: getValue(
        row,
        columns.discordId,
      ),
      departmentStatus: getValue(
        row,
        columns.departmentStatus,
      ),
      rank: getValue(row, columns.rank),
      timezone: getValue(
        row,
        columns.timezone,
      ),
      joinDeptDate: getValue(
        row,
        columns.joinDeptDate,
      ),
      promoDate: getValue(
        row,
        columns.promoDate,
      ),
      strike1: booleanValue(
        row[columns.strike1],
      ),
      strike2: booleanValue(
        row[columns.strike2],
      ),
      callsign: getValue(
        row,
        columns.callsign,
      ),
      timeInDept: getValue(
        row,
        columns.timeInDept,
      ),
      terminated: booleanValue(
        row[columns.terminated],
      ),
      loa: booleanValue(
        row[columns.loa],
      ),
      resigned: booleanValue(
        row[columns.resigned],
      ),
      thisMonthHours: getValue(
        row,
        columns.thisMonthHours,
      ),
      lastMonthHours: getValue(
        row,
        columns.lastMonthHours,
      ),
    }))
    .filter(
      (employee) =>
        employee.badgeNumber ||
        employee.name ||
        employee.discordId,
    )
}

/* ─────────────────────────────────────────────
   Vehicle Roster
───────────────────────────────────────────── */

function parseVehicles(
  rows: unknown[][],
  sheetName: string,
): MainRosterVehicle[] {
  const headerIndex = findHeaderRow(rows, [
    "Rank",
    "Vehicle Name",
    "Spawncode",
    "Required Extras",
    "Livery",
  ])

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Vehicle Roster columns.`,
    )
  }

  const headers = rows[headerIndex] ?? []

  const columns = {
    rank: getColumn(headers, ["Rank"]),
    vehicleName: getColumn(headers, [
      "Vehicle Name",
      "Vehicle",
      "Name",
    ]),
    spawncode: getColumn(headers, [
      "Spawncode",
      "Spawn Code",
      "Spawn",
      "Model",
    ]),
    requiredExtras: getColumn(headers, [
      "Required Extras",
      "Extras",
      "Required Extra",
    ]),
    livery: getColumn(headers, [
      "Livery",
      "Livery ID",
    ]),
    windowTint: getColumn(headers, [
      "Window Tint",
      "Tint",
    ]),
    turbo: getColumn(headers, [
      "Turbo",
      "Turbo Enabled",
    ]),
    slicktopOptional: getColumn(headers, [
      "Slicktop Optional",
      "Slicktop",
      "Slicktop Option",
    ]),
    unmarkedAllowed: getColumn(headers, [
      "Unmarked Allowed",
      "Unmarked",
      "Unmarked Allowed?",
    ]),
  }

  let currentRank = ""

  return rows
    .slice(headerIndex + 1)
    .filter(hasValue)
    .map((row) => {
      const rankValue =
        getValue(row, columns.rank)

      if (rankValue) {
        currentRank = rankValue
      }

      return {
        rank: rankValue || currentRank,
        vehicleName: getValue(
          row,
          columns.vehicleName,
        ),
        spawncode: getValue(
          row,
          columns.spawncode,
        ),
        requiredExtras: getValue(
          row,
          columns.requiredExtras,
        ),
        livery: getValue(
          row,
          columns.livery,
        ),
        windowTint: getValue(
          row,
          columns.windowTint,
        ),
        turbo: booleanValue(
          row[columns.turbo],
        ),
        slicktopOptional: booleanValue(
          row[columns.slicktopOptional],
        ),
        unmarkedAllowed: booleanValue(
          row[columns.unmarkedAllowed],
        ),
      }
    })
    .filter(
      (vehicle) =>
        vehicle.vehicleName ||
        vehicle.spawncode,
    )
}

/* ─────────────────────────────────────────────
   Uniform Roster
───────────────────────────────────────────── */

function parseUniforms(
  rows: unknown[][],
  sheetName: string,
): MainRosterUniform[] {
  const headerIndex = findHeaderRow(rows, [
    "Rank",
    "Class",
    "Server Outfit Code",
  ])

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Uniform Roster columns.`,
    )
  }

  const headers = rows[headerIndex] ?? []

  const columns = {
    rank: getColumn(headers, ["Rank"]),
    className: getColumn(headers, [
      "Class",
      "Class Name",
      "Uniform Class",
    ]),
    sharedOutfitCode: getColumn(headers, [
      "Server Outfit Code",
      "Shared Outfit Code",
      "Outfit Code",
      "Shared Code",
    ]),
  }

  let currentRank = ""

  return rows
    .slice(headerIndex + 1)
    .filter(hasValue)
    .map((row) => {
      const rankValue =
        getValue(row, columns.rank)

      if (rankValue) {
        currentRank = rankValue
      }

      return {
        rank: rankValue || currentRank,
        className: getValue(
          row,
          columns.className,
        ),
        sharedOutfitCode: getValue(
          row,
          columns.sharedOutfitCode,
        ),
      }
    })
    .filter(
      (uniform) =>
        uniform.rank ||
        uniform.className ||
        uniform.sharedOutfitCode,
    )
}

/* ─────────────────────────────────────────────
   MPD Home
───────────────────────────────────────────── */

function parseHome(
  rows: unknown[][],
): MainRosterHome {
  const cleanedRows = nonEmptyRows(rows)

  if (cleanedRows.length === 0) {
    return {
      headers: [],
      rows: [],
    }
  }

  /*
   * The Home sheet is a formatted dashboard rather
   * than a normal database table. Preserve its raw
   * non-empty grid instead of trying to invent
   * semantic columns.
   */
  const width = Math.max(
    ...cleanedRows.map(
      (row) => row.length,
    ),
  )

  const headers = Array.from(
    { length: width },
    (_, index) => `Column ${index + 1}`,
  )

  const dataRows = cleanedRows.map(
    (row) =>
      headers.map((_, index) =>
        clean(row[index]),
      ),
  )

  return {
    headers,
    rows: dataRows,
  }
}

/* ─────────────────────────────────────────────
   Main sync
───────────────────────────────────────────── */

export async function syncGoogleMainRoster() {
  const startedAt = Date.now()

  const config = getConfig()

  const { sheets, spreadsheetId } =
    getGoogleSheetsClient()

  const [
    homeRows,
    departmentRows,
    employeeRows,
    vehicleRows,
    uniformRows,
  ] = await Promise.all([
    getSheetValues(
      sheets,
      spreadsheetId,
      config.homeSheet,
    ),
    getSheetValues(
      sheets,
      spreadsheetId,
      config.departmentSheet,
    ),
    getSheetValues(
      sheets,
      spreadsheetId,
      config.employeeSheet,
    ),
    getSheetValues(
      sheets,
      spreadsheetId,
      config.vehicleSheet,
    ),
    getSheetValues(
      sheets,
      spreadsheetId,
      config.uniformSheet,
    ),
  ])

  const department = parseDepartment(
    departmentRows,
    config.departmentSheet,
  )

  const employees = parseEmployees(
    employeeRows,
    config.employeeSheet,
  )

  const vehicles = parseVehicles(
    vehicleRows,
    config.vehicleSheet,
  )

  const uniforms = parseUniforms(
    uniformRows,
    config.uniformSheet,
  )

  const home = parseHome(homeRows)

  /*
   * Never replace a working Main Roster with
   * an empty/broken import.
   */
  if (department.length === 0) {
    throw new Error(
      `Google Sheet "${config.departmentSheet}" returned no Department Roster rows.`,
    )
  }

  if (employees.length === 0) {
    throw new Error(
      `Google Sheet "${config.employeeSheet}" returned no Employee Database rows.`,
    )
  }

  if (vehicles.length === 0) {
    throw new Error(
      `Google Sheet "${config.vehicleSheet}" returned no Vehicle Roster rows.`,
    )
  }

  if (uniforms.length === 0) {
    throw new Error(
      `Google Sheet "${config.uniformSheet}" returned no Uniform Roster rows.`,
    )
  }

  const roster: MainRosterData = {
    type: "main",
    home,
    department,
    employees,
    vehicles,
    uniforms,
    updatedAt: new Date(),
  }

  const db = await getMongoDb()

  await db
    .collection<MainRosterData>(
      "mainRoster",
    )
    .updateOne(
      { type: "main" },
      {
        $set: roster,
      },
      {
        upsert: true,
      },
    )

  return {
    success: true,
    counts: {
      home: home.rows.length,
      department: department.length,
      employees: employees.length,
      vehicles: vehicles.length,
      uniforms: uniforms.length,
    },
    sheets: {
      home: config.homeSheet,
      department: config.departmentSheet,
      employees: config.employeeSheet,
      vehicles: config.vehicleSheet,
      uniforms: config.uniformSheet,
    },
    updatedAt:
      roster.updatedAt.toISOString(),
    duration: Date.now() - startedAt,
  }
}

export async function testGoogleMainRosterConnection() {
  const config = getConfig()

  const { sheets, spreadsheetId } =
    getGoogleSheetsClient()

  const metadata =
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        "spreadsheetId,properties.title,sheets.properties",
    })

  const availableSheets =
    (metadata.data.sheets ?? [])
      .map(
        (sheet) =>
          sheet.properties?.title ?? "",
      )
      .filter(Boolean)

  const requestedSheets = [
    config.homeSheet,
    config.departmentSheet,
    config.employeeSheet,
    config.vehicleSheet,
    config.uniformSheet,
  ]

  const missingSheets =
    requestedSheets.filter(
      (name) =>
        !availableSheets.includes(name),
    )

  if (missingSheets.length > 0) {
    throw new Error(
      `The Main Roster spreadsheet is missing these tabs: ${missingSheets.join(
        ", ",
      )}`,
    )
  }

  return {
    success: true,
    spreadsheetId,
    spreadsheetTitle:
      metadata.data.properties?.title ??
      "",
    sheets: requestedSheets,
  }
}
