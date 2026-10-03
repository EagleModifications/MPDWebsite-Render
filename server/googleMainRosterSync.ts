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

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is not configured.`)
  }

  return value
}

function getGoogleSheetsClient() {
  const clientEmail = getRequiredEnv(
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  )

  const privateKey = getRequiredEnv(
    "GOOGLE_PRIVATE_KEY",
  ).replace(/\\n/g, "\n")

  const spreadsheetId = getRequiredEnv(
    "GOOGLE_SHEET_ID",
  )

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
    spreadsheetId,
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
  ].includes(normalized)
}

function findHeaderRow(
  rows: unknown[][],
  requiredHeaders: string[],
): number {
  const required =
    requiredHeaders.map(normalizeHeader)

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
      normalizedAlternatives.includes(header),
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

function nonEmptyRows(
  rows: unknown[][],
): unknown[][] {
  return rows.filter((row) =>
    row.some(
      (value) => clean(value) !== "",
    ),
  )
}

/* ─────────────────────────────────────────────
   Google → Sheet names
───────────────────────────────────────────── */

function normalizeSheetTitle(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

async function resolveSheetNames(
  sheets: ReturnType<
    typeof getGoogleSheetsClient
  >["sheets"],
  spreadsheetId: string,
  requestedNames: string[],
): Promise<Record<string, string>> {
  const response =
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    })

  const availableTitles = (
    response.data.sheets ?? []
  )
    .map(
      (sheet) =>
        sheet.properties?.title,
    )
    .filter(
      (
        title,
      ): title is string =>
        typeof title === "string" &&
        title.trim() !== "",
    )

  const resolved: Record<
    string,
    string
  > = {}

  for (const requestedName of requestedNames) {
    const trimmedRequested =
      requestedName.trim()

    /*
     * First try an exact match.
     */
    const exact =
      availableTitles.find(
        (title) =>
          title === trimmedRequested,
      )

    if (exact) {
      resolved[requestedName] = exact
      continue
    }

    /*
     * Then tolerate:
     * - capitalisation differences
     * - leading/trailing spaces
     * - multiple spaces
     */
    const normalizedRequested =
      normalizeSheetTitle(
        trimmedRequested,
      )

    const normalizedMatches =
      availableTitles.filter(
        (title) =>
          normalizeSheetTitle(
            title,
          ) === normalizedRequested,
      )

    if (normalizedMatches.length === 1) {
      resolved[requestedName] =
        normalizedMatches[0]

      continue
    }

    if (normalizedMatches.length > 1) {
      throw new Error(
        `Google Sheet tab "${trimmedRequested}" is ambiguous. Matching tabs: ${normalizedMatches.join(
          ", ",
        )}.`,
      )
    }

    throw new Error(
      `Google Sheet tab "${trimmedRequested}" was not found. Available tabs: ${
        availableTitles.join(", ") ||
        "none"
      }.`,
    )
  }

  return resolved
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
  /*
   * Do NOT use:
   *
   *   'Employee Database'!A:ZZ
   *
   * Some Google Sheets configurations reject that
   * range even though it looks valid.
   *
   * Passing the actual sheet title lets the Sheets API
   * return the sheet's complete used range.
   */
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
      majorDimension: "ROWS",
    })

  return response.data.values ?? []
}

/* ─────────────────────────────────────────────
   Department
───────────────────────────────────────────── */

function parseDepartment(
  rows: unknown[][],
  sheetName: string,
): MainRosterDepartmentMember[] {
  const headerIndex =
    findHeaderRow(rows, [
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

  const headers =
    rows[headerIndex] ?? []

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

    jobDescription: getColumn(
      headers,
      [
        "Job Description",
        "Job",
        "Description",
      ],
    ),

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

  return rows
    .slice(headerIndex + 1)
    .filter((row) =>
      row.some(
        (value) =>
          clean(value) !== "",
      ),
    )
    .map((row) => ({
      section: getValue(
        row,
        columns.section,
      ),

      callsign: getValue(
        row,
        columns.callsign,
      ),

      badgeNumber: getValue(
        row,
        columns.badgeNumber,
      ),

      name: getValue(
        row,
        columns.name,
      ),

      insignia: getValue(
        row,
        columns.insignia,
      ),

      rank: getValue(
        row,
        columns.rank,
      ),

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

      discordId: getValue(
        row,
        columns.discordId,
      ),

      hoursThisMonth: getValue(
        row,
        columns.hoursThisMonth,
      ),
    }))
    .filter(
      (member) =>
        member.callsign ||
        member.badgeNumber ||
        member.name ||
        member.discordId,
    )
}

/* ─────────────────────────────────────────────
   Employees
───────────────────────────────────────────── */

function parseEmployees(
  rows: unknown[][],
  sheetName: string,
): MainRosterEmployee[] {
  const headerIndex =
    findHeaderRow(rows, [
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

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    sendMessage: getColumn(
      headers,
      [
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

    name: getColumn(headers, [
      "Name",
      "Full Name",
      "Employee Name",
    ]),

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

    rank: getColumn(headers, [
      "Rank",
      "Current Rank",
    ]),

    timezone: getColumn(headers, [
      "Timezone",
      "Time Zone",
      "TZ",
    ]),

    joinDeptDate: getColumn(
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

    thisMonthHours: getColumn(
      headers,
      [
        "This Month Hours",
        "Hours This Month",
        "Current Month Hours",
      ],
    ),

    lastMonthHours: getColumn(
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
    .map((row) => ({
      sendMessage: getValue(
        row,
        columns.sendMessage,
      ),

      badgeNumber: getValue(
        row,
        columns.badgeNumber,
      ),

      name: getValue(
        row,
        columns.name,
      ),

      discordId: getValue(
        row,
        columns.discordId,
      ),

      departmentStatus: getValue(
        row,
        columns.departmentStatus,
      ),

      rank: getValue(
        row,
        columns.rank,
      ),

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
   Vehicles
───────────────────────────────────────────── */

function parseVehicles(
  rows: unknown[][],
  sheetName: string,
): MainRosterVehicle[] {
  const headerIndex =
    findHeaderRow(rows, [
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

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    rank: getColumn(headers, [
      "Rank",
    ]),

    vehicleName: getColumn(
      headers,
      [
        "Vehicle Name",
        "Vehicle",
        "Name",
      ],
    ),

    spawncode: getColumn(
      headers,
      [
        "Spawncode",
        "Spawn Code",
        "Spawn",
        "Model",
      ],
    ),

    requiredExtras: getColumn(
      headers,
      [
        "Required Extras",
        "Extras",
        "Required Extra",
      ],
    ),

    livery: getColumn(headers, [
      "Livery",
      "Livery ID",
    ]),

    windowTint: getColumn(
      headers,
      [
        "Window Tint",
        "Tint",
      ],
    ),

    turbo: getColumn(headers, [
      "Turbo",
      "Turbo Enabled",
    ]),

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

  return rows
    .slice(headerIndex + 1)
    .filter((row) =>
      row.some(
        (value) =>
          clean(value) !== "",
      ),
    )
    .map((row) => ({
      rank: getValue(
        row,
        columns.rank,
      ),

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
    }))
    .filter(
      (vehicle) =>
        vehicle.vehicleName ||
        vehicle.spawncode,
    )
}

/* ─────────────────────────────────────────────
   Uniforms
───────────────────────────────────────────── */

function parseUniforms(
  rows: unknown[][],
  sheetName: string,
): MainRosterUniform[] {
  const headerIndex =
    findHeaderRow(rows, [
      "Rank",
      "Class",
      "Shared Outfit Code",
    ])

  if (headerIndex === -1) {
    throw new Error(
      `Google Sheet "${sheetName}" is missing the required Uniform Roster columns.`,
    )
  }

  const headers =
    rows[headerIndex] ?? []

  const columns = {
    rank: getColumn(headers, [
      "Rank",
    ]),

    className: getColumn(
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

  return rows
    .slice(headerIndex + 1)
    .filter((row) =>
      row.some(
        (value) =>
          clean(value) !== "",
      ),
    )
    .map((row) => ({
      rank: getValue(
        row,
        columns.rank,
      ),

      className: getValue(
        row,
        columns.className,
      ),

      sharedOutfitCode:
        getValue(
          row,
          columns.sharedOutfitCode,
        ),
    }))
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
  const cleanedRows =
    nonEmptyRows(rows)

  if (cleanedRows.length === 0) {
    return {
      headers: [],
      rows: [],
    }
  }

  const headers =
    (
      cleanedRows[0] ?? []
    ).map(clean)

  const dataRows =
    cleanedRows
      .slice(1)
      .map((row) =>
        headers.map(
          (_, index) =>
            clean(row[index]),
        ),
      )
      .filter((row) =>
        row.some(
          (value) =>
            value !== "",
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

  const departmentSheet =
    getRequiredEnv(
      "GOOGLE_MAIN_ROSTER_DEPARTMENT_SHEET",
    )

  const employeeSheet =
    getRequiredEnv(
      "GOOGLE_MAIN_ROSTER_EMPLOYEE_SHEET",
    )

  const uniformSheet =
    getRequiredEnv(
      "GOOGLE_MAIN_ROSTER_UNIFORM_SHEET",
    )

  const vehicleSheet =
    getRequiredEnv(
      "GOOGLE_MAIN_ROSTER_VEHICLE_SHEET",
    )

  const homeSheet =
    getRequiredEnv(
      "GOOGLE_MAIN_ROSTER_HOME_SHEET",
    )

  const {
    sheets,
    spreadsheetId,
  } =
    getGoogleSheetsClient()

  /*
   * Resolve the actual Google Sheet tab names first.
   */
  const resolvedSheets =
    await resolveSheetNames(
      sheets,
      spreadsheetId,
      [
        departmentSheet,
        employeeSheet,
        uniformSheet,
        vehicleSheet,
        homeSheet,
      ],
    )

  const resolvedDepartmentSheet =
    resolvedSheets[
      departmentSheet
    ]

  const resolvedEmployeeSheet =
    resolvedSheets[
      employeeSheet
    ]

  const resolvedUniformSheet =
    resolvedSheets[
      uniformSheet
    ]

  const resolvedVehicleSheet =
    resolvedSheets[
      vehicleSheet
    ]

  const resolvedHomeSheet =
    resolvedSheets[
      homeSheet
    ]

  /*
   * Download all five tabs.
   */
  const [
    departmentRows,
    employeeRows,
    uniformRows,
    vehicleRows,
    homeRows,
  ] = await Promise.all([
    getSheetValues(
      sheets,
      spreadsheetId,
      resolvedDepartmentSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      resolvedEmployeeSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      resolvedUniformSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      resolvedVehicleSheet,
    ),

    getSheetValues(
      sheets,
      spreadsheetId,
      resolvedHomeSheet,
    ),
  ])

  /*
   * Parse every tab.
   */
  const department =
    parseDepartment(
      departmentRows,
      resolvedDepartmentSheet,
    )

  const employees =
    parseEmployees(
      employeeRows,
      resolvedEmployeeSheet,
    )

  const vehicles =
    parseVehicles(
      vehicleRows,
      resolvedVehicleSheet,
    )

  const uniforms =
    parseUniforms(
      uniformRows,
      resolvedUniformSheet,
    )

  const home =
    parseHome(homeRows)

  /*
   * Never replace an existing working Master
   * Roster with an empty/broken import.
   */
  if (department.length === 0) {
    throw new Error(
      `Google Sheet "${departmentSheet}" returned no Department Roster rows.`,
    )
  }

  if (employees.length === 0) {
    throw new Error(
      `Google Sheet "${employeeSheet}" returned no Employee Database rows.`,
    )
  }

  if (vehicles.length === 0) {
    throw new Error(
      `Google Sheet "${vehicleSheet}" returned no Vehicle Roster rows.`,
    )
  }

  if (uniforms.length === 0) {
    throw new Error(
      `Google Sheet "${uniformSheet}" returned no Uniform Roster rows.`,
    )
  }

  /*
   * Build the Master Roster document.
   */
  const roster: MainRosterData = {
    type: "main",
    home,
    department,
    employees,
    vehicles,
    uniforms,
    updatedAt: new Date(),
  }

  /*
   * Save to MongoDB.
   */
  const db =
    await getMongoDb()

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

  /*
   * Return useful sync information.
   */
  return {
    success: true,

    counts: {
      home: home.rows.length,
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
      home: resolvedHomeSheet,
      department:
        resolvedDepartmentSheet,
      employees:
        resolvedEmployeeSheet,
      vehicles:
        resolvedVehicleSheet,
      uniforms:
        resolvedUniformSheet,
    },

    updatedAt:
      roster.updatedAt.toISOString(),

    duration:
      Date.now() - startedAt,
  }
}
