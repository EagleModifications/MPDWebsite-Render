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
   Configuration
───────────────────────────────────────────── */

type MainRosterSheetConfig = {
  id:
    | "home"
    | "department"
    | "employees"
    | "vehicles"
    | "uniforms"
  label: string
  env: string
}

const mainRosterSheets: MainRosterSheetConfig[] = [
  {
    id: "home",
    label: "MPD | Home",
    env: "GOOGLE_MAINROSTER_SHEET_HOME",
  },
  {
    id: "department",
    label: "Department Roster",
    env: "GOOGLE_MAINROSTER_SHEET_DEPARTMENTROSTER",
  },
  {
    id: "employees",
    label: "Employee Data",
    env: "GOOGLE_MAINROSTER_SHEET_EMPLOYEEDATA",
  },
  {
    id: "vehicles",
    label: "Vehicle Roster",
    env: "GOOGLE_MAINROSTER_SHEET_VEHICLEROSTER",
  },
  {
    id: "uniforms",
    label: "Uniform Roster",
    env: "GOOGLE_MAINROSTER_SHEET_UNIFORMROSTER",
  },
]

function getRequiredEnv(
  name: string,
): string {
  const value =
    process.env[name]?.trim() ?? ""

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    )
  }

  return value
}

/* ─────────────────────────────────────────────
   Google Sheets Client
───────────────────────────────────────────── */

function getGoogleSheetsClient() {
  const clientEmail =
    getRequiredEnv(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    )

  const privateKey =
    getRequiredEnv(
      "GOOGLE_PRIVATE_KEY",
    ).replace(/\\n/g, "\n")

  /*
   * IMPORTANT:
   *
   * This is deliberately NOT GOOGLE_SHEET_ID.
   *
   * googleRosterSync.ts uses GOOGLE_SHEET_ID
   * for the existing roster system.
   *
   * Main Roster has its own spreadsheet.
   */
  const spreadsheetId =
    getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_ID",
    )

  const auth =
    new google.auth.GoogleAuth({
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
    spreadsheetId,
  }
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function clean(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim()
}

function normalizeHeader(
  value: unknown,
): string {
  return clean(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      "",
    )
}

function booleanValue(
  value: unknown,
): boolean {
  const normalized =
    clean(value).toLowerCase()

  return [
    "true",
    "yes",
    "y",
    "x",
    "1",
    "checked",
  ].includes(normalized)
}

function findHeaderRow(
  rows: unknown[][],
  requiredHeaders: string[],
): number {
  const required =
    requiredHeaders.map(
      normalizeHeader,
    )

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const headers =
      (rows[index] ?? []).map(
        normalizeHeader,
      )

    if (
      required.every(
        (header) =>
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
    headers.map(
      normalizeHeader,
    )

  const normalizedAlternatives =
    alternatives.map(
      normalizeHeader,
    )

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

  return clean(
    row[column],
  )
}

function nonEmptyRows(
  rows: unknown[][],
): unknown[][] {
  return rows.filter(
    (row) =>
      row.some(
        (value) =>
          clean(value) !== "",
      ),
  )
}

function escapeSheetName(
  sheetName: string,
): string {
  return sheetName.replace(
    /'/g,
    "''",
  )
}

/* ─────────────────────────────────────────────
   Google → Raw Values
───────────────────────────────────────────── */

async function getSheetValues(
  sheets: ReturnType<
    typeof getGoogleSheetsClient
  >["sheets"],
  spreadsheetId: string,
  sheetName: string,
): Promise<unknown[][]> {
  const escapedSheetName =
    escapeSheetName(
      sheetName,
    )

  try {
    const response =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId,
          range: `'${escapedSheetName}'!A:ZZ`,
          majorDimension: "ROWS",
        },
      )

    return (
      response.data.values ?? []
    )
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

/* ─────────────────────────────────────────────
   Department Roster
───────────────────────────────────────────── */

function parseDepartment(
  rows: unknown[][],
  sheetName: string,
): MainRosterDepartmentMember[] {
  const headerIndex =
    findHeaderRow(
      rows,
      [
        "Callsign",
        "Badge Number",
        "Name",
        "Insignia",
        "Rank",
      ],
    )

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Department Roster columns.`,
    )
  }

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    section: getColumn(
      headers,
      [
        "Section",
        "Division",
        "Department",
      ],
    ),

    callsign: getColumn(
      headers,
      [
        "Callsign",
        "Call Sign",
        "Callsign Number",
      ],
    ),

    badgeNumber: getColumn(
      headers,
      [
        "Badge Number",
        "Badge",
        "BadgeNumber",
        "Badge #",
        "Badge#",
      ],
    ),

    name: getColumn(
      headers,
      [
        "Name",
        "Full Name",
        "Officer Name",
      ],
    ),

    insignia: getColumn(
      headers,
      [
        "Insignia",
      ],
    ),

    rank: getColumn(
      headers,
      [
        "Rank",
        "Current Rank",
      ],
    ),

    jobDescription: getColumn(
      headers,
      [
        "Job Description",
        "Job",
        "Description",
      ],
    ),

    timeInDept: getColumn(
      headers,
      [
        "Time In Dept",
        "Time In Department",
        "TimeInDept",
        "Department Time",
        "Dept Time",
      ],
    ),

    timeInRank: getColumn(
      headers,
      [
        "Time In Rank",
        "TimeInRank",
        "Rank Time",
      ],
    ),

    status: getColumn(
      headers,
      [
        "Status",
        "Department Status",
      ],
    ),

    strike1: getColumn(
      headers,
      [
        "Strike 1",
        "Strike1",
        "Strike One",
      ],
    ),

    strike2: getColumn(
      headers,
      [
        "Strike 2",
        "Strike2",
        "Strike Two",
      ],
    ),

    discordId: getColumn(
      headers,
      [
        "Discord ID",
        "DiscordID",
        "Discord",
        "Discord Id",
      ],
    ),

    hoursThisMonth: getColumn(
      headers,
      [
        "Hours This Month",
        "This Month Hours",
        "Hours",
        "Activity Hours",
      ],
    ),
  }

  const members: MainRosterDepartmentMember[] = []

  let currentSection = ""

  for (
    let index = headerIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? []

    if (
      !row.some(
        (value) =>
          clean(value) !== "",
      )
    ) {
      continue
    }

    const callsign =
      getValue(
        row,
        columns.callsign,
      )

    const badgeNumber =
      getValue(
        row,
        columns.badgeNumber,
      )

    const name =
      getValue(
        row,
        columns.name,
      )

    const rank =
      getValue(
        row,
        columns.rank,
      )

    /*
     * Department Roster contains merged
     * section rows such as:
     *
     * High Command
     * Trial High Command
     * Low Command
     * Supervisors
     *
     * Google Sheets returns those as rows
     * with very little data.
     *
     * Treat those as section markers rather
     * than actual personnel.
     */
    const meaningfulValues =
      row.filter(
        (value) =>
          clean(value) !== "",
      )

    if (
      !callsign &&
      !badgeNumber &&
      !name &&
      !rank &&
      meaningfulValues.length > 0
    ) {
      currentSection =
        clean(
          meaningfulValues[0],
        )

      continue
    }

    const section =
      getValue(
        row,
        columns.section,
      ) ||
      currentSection

    const member: MainRosterDepartmentMember =
      {
        section,

        callsign,

        badgeNumber,

        name,

        insignia:
          getValue(
            row,
            columns.insignia,
          ),

        rank,

        jobDescription:
          getValue(
            row,
            columns.jobDescription,
          ),

        timeInDept:
          getValue(
            row,
            columns.timeInDept,
          ),

        timeInRank:
          getValue(
            row,
            columns.timeInRank,
          ),

        status:
          getValue(
            row,
            columns.status,
          ),

        strike1:
          booleanValue(
            row[
              columns.strike1
            ],
          ),

        strike2:
          booleanValue(
            row[
              columns.strike2
            ],
          ),

        discordId:
          getValue(
            row,
            columns.discordId,
          ),

        hoursThisMonth:
          getValue(
            row,
            columns.hoursThisMonth,
          ),
      }

    if (
      member.callsign ||
      member.badgeNumber ||
      member.name ||
      member.discordId
    ) {
      members.push(member)
    }
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
  const headerIndex =
    findHeaderRow(
      rows,
      [
        "Badge Number",
        "Name",
        "Discord ID",
        "Department Status",
        "Rank",
      ],
    )

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Employee Database columns.`,
    )
  }

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    sendMessage: getColumn(
      headers,
      [
        "Message User",
        "Send Message",
        "Message",
        "DM",
      ],
    ),

    badgeNumber: getColumn(
      headers,
      [
        "Badge Number",
        "Badge",
        "BadgeNumber",
        "Badge #",
        "Badge#",
      ],
    ),

    name: getColumn(
      headers,
      [
        "Name",
        "Full Name",
        "Employee Name",
      ],
    ),

    discordId: getColumn(
      headers,
      [
        "Discord ID",
        "DiscordID",
        "Discord",
        "Discord Id",
      ],
    ),

    departmentStatus:
      getColumn(
        headers,
        [
          "Department Status",
          "Status",
        ],
      ),

    rank: getColumn(
      headers,
      [
        "Rank",
        "Current Rank",
      ],
    ),

    timezone: getColumn(
      headers,
      [
        "Timezone",
        "Time Zone",
        "TZ",
      ],
    ),

    joinDeptDate:
      getColumn(
        headers,
        [
          "Join Dept Date",
          "Join Department Date",
          "Department Join Date",
          "Join Date",
        ],
      ),

    promoDate: getColumn(
      headers,
      [
        "Promo Date",
        "Promotion Date",
        "Last Promotion",
      ],
    ),

    strike1: getColumn(
      headers,
      [
        "Strike 1",
        "Strike1",
        "Strike One",
      ],
    ),

    strike2: getColumn(
      headers,
      [
        "Strike 2",
        "Strike2",
        "Strike Two",
      ],
    ),

    callsign: getColumn(
      headers,
      [
        "Callsign",
        "Call Sign",
        "Callsign Number",
      ],
    ),

    timeInDept: getColumn(
      headers,
      [
        "Time In Dept",
        "Time In Department",
        "TimeInDept",
        "Department Time",
      ],
    ),

    terminated: getColumn(
      headers,
      [
        "Terminated",
        "Termination",
      ],
    ),

    loa: getColumn(
      headers,
      [
        "LOA",
        "Leave Of Absence",
        "Leave of Absence",
      ],
    ),

    resigned: getColumn(
      headers,
      [
        "Resigned",
        "Resignation",
      ],
    ),

    thisMonthHours:
      getColumn(
        headers,
        [
          "This Month Hours",
          "Hours This Month",
          "Current Month Hours",
        ],
      ),

    lastMonthHours:
      getColumn(
        headers,
        [
          "Last Month Hours",
          "Previous Month Hours",
        ],
      ),
  }

  return rows
    .slice(headerIndex + 1)
    .filter((row) =>
      row.some(
        (value) =>
          clean(value) !== "",
      ),
    )
    .map(
      (row) => ({
        sendMessage:
          getValue(
            row,
            columns.sendMessage,
          ),

        badgeNumber:
          getValue(
            row,
            columns.badgeNumber,
          ),

        name:
          getValue(
            row,
            columns.name,
          ),

        discordId:
          getValue(
            row,
            columns.discordId,
          ),

        departmentStatus:
          getValue(
            row,
            columns.departmentStatus,
          ),

        rank:
          getValue(
            row,
            columns.rank,
          ),

        timezone:
          getValue(
            row,
            columns.timezone,
          ),

        joinDeptDate:
          getValue(
            row,
            columns.joinDeptDate,
          ),

        promoDate:
          getValue(
            row,
            columns.promoDate,
          ),

        strike1:
          booleanValue(
            row[
              columns.strike1
            ],
          ),

        strike2:
          booleanValue(
            row[
              columns.strike2
            ],
          ),

        callsign:
          getValue(
            row,
            columns.callsign,
          ),

        timeInDept:
          getValue(
            row,
            columns.timeInDept,
          ),

        terminated:
          booleanValue(
            row[
              columns.terminated
            ],
          ),

        loa:
          booleanValue(
            row[
              columns.loa
            ],
          ),

        resigned:
          booleanValue(
            row[
              columns.resigned
            ],
          ),

        thisMonthHours:
          getValue(
            row,
            columns.thisMonthHours,
          ),

        lastMonthHours:
          getValue(
            row,
            columns.lastMonthHours,
          ),
      }),
    )
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
  const headerIndex =
    findHeaderRow(
      rows,
      [
        "Rank",
        "Vehicle Name",
        "Spawncode",
        "Required Extras",
        "Livery",
      ],
    )

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Vehicle Roster columns.`,
    )
  }

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    rank: getColumn(
      headers,
      [
        "Rank",
      ],
    ),

    vehicleName:
      getColumn(
        headers,
        [
          "Vehicle Name",
          "Vehicle",
          "Name",
        ],
      ),

    spawncode:
      getColumn(
        headers,
        [
          "Spawncode",
          "Spawn Code",
          "Spawn",
          "Model",
        ],
      ),

    requiredExtras:
      getColumn(
        headers,
        [
          "Required Extras",
          "Extras",
          "Required Extra",
        ],
      ),

    livery:
      getColumn(
        headers,
        [
          "Livery",
          "Livery ID",
        ],
      ),

    windowTint:
      getColumn(
        headers,
        [
          "Window Tint",
          "Tint",
        ],
      ),

    turbo:
      getColumn(
        headers,
        [
          "Turbo",
          "Turbo Enabled",
        ],
      ),

    slicktopOptional:
      getColumn(
        headers,
        [
          "Slicktop Optional",
          "Slicktop",
          "Slicktop Option",
        ],
      ),

    unmarkedAllowed:
      getColumn(
        headers,
        [
          "Unmarked Allowed",
          "Unmarked",
          "Unmarked Allowed?",
        ],
      ),
  }

  const vehicles: MainRosterVehicle[] = []

  let currentRank = ""

  for (
    let index = headerIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? []

    if (
      !row.some(
        (value) =>
          clean(value) !== "",
      )
    ) {
      continue
    }

    const rank =
      getValue(
        row,
        columns.rank,
      )

    /*
     * Rank cells in the Google Sheet
     * are vertically merged.
     *
     * Only the first row in a group
     * contains the rank value.
     *
     * Carry it forward.
     */
    if (rank) {
      currentRank = rank
    }

    const vehicle: MainRosterVehicle =
      {
        rank:
          rank ||
          currentRank,

        vehicleName:
          getValue(
            row,
            columns.vehicleName,
          ),

        spawncode:
          getValue(
            row,
            columns.spawncode,
          ),

        requiredExtras:
          getValue(
            row,
            columns.requiredExtras,
          ),

        livery:
          getValue(
            row,
            columns.livery,
          ),

        windowTint:
          getValue(
            row,
            columns.windowTint,
          ),

        turbo:
          booleanValue(
            row[
              columns.turbo
            ],
          ),

        slicktopOptional:
          booleanValue(
            row[
              columns.slicktopOptional
            ],
          ),

        unmarkedAllowed:
          booleanValue(
            row[
              columns.unmarkedAllowed
            ],
          ),
      }

    if (
      vehicle.vehicleName ||
      vehicle.spawncode
    ) {
      vehicles.push(vehicle)
    }
  }

  return vehicles
}

/* ─────────────────────────────────────────────
   Uniform Roster
───────────────────────────────────────────── */

function parseUniforms(
  rows: unknown[][],
  sheetName: string,
): MainRosterUniform[] {
  const headerIndex =
    findHeaderRow(
      rows,
      [
        "Rank",
        "Class",
        "Shared Outfit Code",
      ],
    )

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Uniform Roster columns.`,
    )
  }

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    rank: getColumn(
      headers,
      [
        "Rank",
      ],
    ),

    className:
      getColumn(
        headers,
        [
          "Class",
          "Class Name",
          "Uniform Class",
        ],
      ),

    sharedOutfitCode:
      getColumn(
        headers,
        [
          "Shared Outfit Code",
          "Outfit Code",
          "Shared Code",
        ],
      ),
  }

  const uniforms: MainRosterUniform[] = []

  let currentRank = ""

  for (
    let index = headerIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? []

    if (
      !row.some(
        (value) =>
          clean(value) !== "",
      )
    ) {
      continue
    }

    const rank =
      getValue(
        row,
        columns.rank,
      )

    if (rank) {
      currentRank = rank
    }

    const uniform: MainRosterUniform =
      {
        rank:
          rank ||
          currentRank,

        className:
          getValue(
            row,
            columns.className,
          ),

        sharedOutfitCode:
          getValue(
            row,
            columns.sharedOutfitCode,
          ),
      }

    if (
      uniform.rank ||
      uniform.className ||
      uniform.sharedOutfitCode
    ) {
      uniforms.push(uniform)
    }
  }

  return uniforms
}

/* ─────────────────────────────────────────────
   MPD | Home
───────────────────────────────────────────── */

function parseHome(
  rows: unknown[][],
): MainRosterHome {
  const cleanedRows =
    nonEmptyRows(rows)

  if (
    cleanedRows.length === 0
  ) {
    return {
      headers: [],
      rows: [],
    }
  }

  /*
   * The MPD | Home sheet is a designed
   * dashboard rather than a conventional
   * database table.
   *
   * We therefore preserve its values
   * instead of trying to interpret every
   * cell as a database field.
   *
   * The frontend can display this as
   * available tabular data.
   */

  const maxColumns =
    cleanedRows.reduce(
      (
        maximum,
        row,
      ) =>
        Math.max(
          maximum,
          row.length,
        ),
      0,
    )

  const headers =
    Array.from(
      {
        length:
          maxColumns,
      },
      (_, index) =>
        `Column ${index + 1}`,
    )

  const normalizedRows =
    cleanedRows.map(
      (row) =>
        Array.from(
          {
            length:
              maxColumns,
          },
          (_, index) =>
            clean(
              row[index],
            ),
        ),
    )

  return {
    headers,
    rows:
      normalizedRows,
  }
}

/* ─────────────────────────────────────────────
   Validate Main Roster Configuration
───────────────────────────────────────────── */

export function validateGoogleMainRosterConfig() {
  const spreadsheetId =
    getRequiredEnv(
      "GOOGLE_MAINROSTER_SHEET_ID",
    )

  const sheets: Record<
    string,
    string
  > = {}

  for (
    const sheet of mainRosterSheets
  ) {
    sheets[sheet.id] =
      getRequiredEnv(
        sheet.env,
      )
  }

  getRequiredEnv(
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  )

  getRequiredEnv(
    "GOOGLE_PRIVATE_KEY",
  )

  return {
    spreadsheetId,
    sheets,
  }
}

/* ─────────────────────────────────────────────
   Main Google → MongoDB Sync
───────────────────────────────────────────── */

export async function syncGoogleMainRoster() {
  const startedAt =
    Date.now()

  const config =
    validateGoogleMainRosterConfig()

  const {
    sheets,
    spreadsheetId,
  } =
    getGoogleSheetsClient()

  const homeSheet =
    config.sheets.home

  const departmentSheet =
    config.sheets.department

  const employeeSheet =
    config.sheets.employees

  const vehicleSheet =
    config.sheets.vehicles

  const uniformSheet =
    config.sheets.uniforms

  /*
   * Fetch every tab in parallel.
   */
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
      homeSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      departmentSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      employeeSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      vehicleSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      uniformSheet,
    ),
  ])

  /*
   * Parse the individual sheets.
   */
  const home =
    parseHome(
      homeRows,
    )

  const department =
    parseDepartment(
      departmentRows,
      departmentSheet,
    )

  const employees =
    parseEmployees(
      employeeRows,
      employeeSheet,
    )

  const vehicles =
    parseVehicles(
      vehicleRows,
      vehicleSheet,
    )

  const uniforms =
    parseUniforms(
      uniformRows,
      uniformSheet,
    )

  /*
   * Safety checks.
   *
   * Never overwrite a working Master Roster
   * with an empty/broken Google import.
   */
  if (
    department.length === 0
  ) {
    throw new Error(
      `Google Sheet "${departmentSheet}" returned no Department Roster members.`,
    )
  }

  if (
    employees.length === 0
  ) {
    throw new Error(
      `Google Sheet "${employeeSheet}" returned no Employee Data records.`,
    )
  }

  if (
    vehicles.length === 0
  ) {
    throw new Error(
      `Google Sheet "${vehicleSheet}" returned no Vehicle Roster records.`,
    )
  }

  if (
    uniforms.length === 0
  ) {
    throw new Error(
      `Google Sheet "${uniformSheet}" returned no Uniform Roster records.`,
    )
  }

  /*
   * Build the complete Master Roster.
   */
  const roster: MainRosterData =
    {
      type: "main",

      home,

      department,

      employees,

      vehicles,

      uniforms,

      updatedAt:
        new Date(),
    }

  /*
   * Save one global Master Roster.
   *
   * There is deliberately no userId.
   */
  const db =
    await getMongoDb()

  await db
    .collection<MainRosterData>(
      "mainRoster",
    )
    .updateOne(
      {
        type: "main",
      },
      {
        $set:
          roster,
      },
      {
        upsert: true,
      },
    )

  const duration =
    Date.now() -
    startedAt

  return {
    success: true,

    counts: {
      home:
        home.rows.length,

      department:
        department.length,

      employees:
        employees.length,

      vehicles:
        vehicles.length,

      uniforms:
        uniforms.length,
    },

    sheets: {
      home:
        homeSheet,

      department:
        departmentSheet,

      employees:
        employeeSheet,

      vehicles:
        vehicleSheet,

      uniforms:
        uniformSheet,
    },

    spreadsheetId,

    updatedAt:
      roster.updatedAt.toISOString(),

    duration,
  }
}

/* ─────────────────────────────────────────────
   Test Google Main Roster Connection
───────────────────────────────────────────── */

export async function testGoogleMainRosterConnection() {
  const config =
    validateGoogleMainRosterConfig()

  const {
    sheets,
    spreadsheetId,
  } =
    getGoogleSheetsClient()

  const results: Record<
    string,
    {
      sheet: string
      rows: number
      headers: unknown[]
    }
  > = {}

  for (
    const sheet of mainRosterSheets
  ) {
    const sheetName =
      config.sheets[
        sheet.id
      ]

    const rows =
      await getSheetValues(
        sheets,
        spreadsheetId,
        sheetName,
      )

    results[sheet.id] = {
      sheet:
        sheetName,

      rows:
        rows.length,

      headers:
        rows[0] ?? [],
    }
  }

  return {
    success: true,

    spreadsheetId,

    sheets:
      results,
  }
}

/* ─────────────────────────────────────────────
   Get Stored Main Roster
───────────────────────────────────────────── */

export async function getGoogleMainRoster() {
  const db =
    await getMongoDb()

  const roster =
    await db
      .collection<MainRosterData>(
        "mainRoster",
      )
      .findOne(
        {
          type: "main",
        },
        {
          projection: {
            _id: 0,
          },
        },
      )

  return roster
}
