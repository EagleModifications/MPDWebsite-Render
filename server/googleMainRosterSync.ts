import { google } from "googleapis"

import { getMongoDb } from "../src/lib/mongodb"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

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

export type MainRosterData = {
  type: "main"
  department: MainRosterDepartmentMember[]
  employees: MainRosterEmployee[]
  vehicles: MainRosterVehicle[]
  uniforms: MainRosterUniform[]
  updatedAt: Date
}

type GoogleConfig = {
  spreadsheetId: string
  serviceAccountEmail: string
  privateKey: string
  departmentSheet: string
  employeeSheet: string
  vehicleSheet: string
  uniformSheet: string
}

// ─────────────────────────────────────────────
// Google configuration
// ─────────────────────────────────────────────

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

  const departmentSheet =
    process.env
      .GOOGLE_MAIN_ROSTER_DEPARTMENT_SHEET
      ?.trim() ?? ""

  const employeeSheet =
    process.env
      .GOOGLE_MAIN_ROSTER_EMPLOYEE_SHEET
      ?.trim() ?? ""

  const vehicleSheet =
    process.env
      .GOOGLE_MAIN_ROSTER_VEHICLE_SHEET
      ?.trim() ?? ""

  const uniformSheet =
    process.env
      .GOOGLE_MAIN_ROSTER_UNIFORM_SHEET
      ?.trim() ?? ""

  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID is not configured.",
    )
  }

  if (!serviceAccountEmail) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured.",
    )
  }

  if (!privateKey) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is not configured.",
    )
  }

  if (!departmentSheet) {
    throw new Error(
      "GOOGLE_MAIN_ROSTER_DEPARTMENT_SHEET is not configured.",
    )
  }

  if (!employeeSheet) {
    throw new Error(
      "GOOGLE_MAIN_ROSTER_EMPLOYEE_SHEET is not configured.",
    )
  }

  if (!vehicleSheet) {
    throw new Error(
      "GOOGLE_MAIN_ROSTER_VEHICLE_SHEET is not configured.",
    )
  }

  if (!uniformSheet) {
    throw new Error(
      "GOOGLE_MAIN_ROSTER_UNIFORM_SHEET is not configured.",
    )
  }

  return {
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
    departmentSheet,
    employeeSheet,
    vehicleSheet,
    uniformSheet,
  }
}

// ─────────────────────────────────────────────
// Google authentication
// ─────────────────────────────────────────────

function createGoogleAuth() {
  const config =
    getGoogleConfig()

  return new google.auth.GoogleAuth({
    credentials: {
      client_email:
        config.serviceAccountEmail,

      private_key:
        config.privateKey,
    },

    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  })
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function text(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim()
}

function normaliseHeader(
  value: unknown,
): string {
  return text(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      "",
    )
}

function booleanValue(
  value: unknown,
): boolean {
  const valueText =
    text(value).toLowerCase()

  return [
    "true",
    "yes",
    "y",
    "x",
    "1",
    "checked",
  ].includes(valueText)
}

function createHeaderMap(
  row: string[],
): Map<string, number> {
  const headers =
    new Map<string, number>()

  row.forEach(
    (
      value,
      index,
    ) => {
      const key =
        normaliseHeader(
          value,
        )

      if (key) {
        headers.set(
          key,
          index,
        )
      }
    },
  )

  return headers
}

function getValue(
  row: string[],
  headers: Map<string, number>,
  header: string,
): string {
  const index =
    headers.get(
      normaliseHeader(
        header,
      ),
    )

  if (
    index === undefined
  ) {
    return ""
  }

  return text(
    row[index],
  )
}

function findHeaderRow(
  rows: string[][],
  requiredHeaders: string[],
): number {
  const required =
    requiredHeaders.map(
      normaliseHeader,
    )

  for (
    let rowIndex = 0;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const headers =
      rows[rowIndex].map(
        normaliseHeader,
      )

    const found =
      required.every(
        (header) =>
          headers.includes(
            header,
          ),
      )

    if (found) {
      return rowIndex
    }
  }

  return -1
}

async function getSheetRows(
  sheets: ReturnType<
    typeof google.sheets
  >,
  sheetName: string,
): Promise<string[][]> {
  const config =
    getGoogleConfig()

  try {
    const response =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId:
            config.spreadsheetId,

          range: `'${sheetName}'`,
        },
      )

    return (
      (response.data.values as
        | string[][]
        | undefined) ?? []
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

// ─────────────────────────────────────────────
// Department Roster
// ─────────────────────────────────────────────

function parseDepartmentRoster(
  rows: string[][],
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

  if (
    headerIndex === -1
  ) {
    throw new Error(
      "Could not find Department Roster headers.",
    )
  }

  const members: MainRosterDepartmentMember[] =
    []

  let headers =
    createHeaderMap(
      rows[headerIndex],
    )

  let currentSection = ""

  for (
    let rowIndex =
      headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row =
      rows[rowIndex]

    if (
      !row ||
      row.length === 0
    ) {
      continue
    }

    // Google Sheets can repeat
    // the column header before
    // each roster section.
    const firstCell =
      normaliseHeader(
        row[0],
      )

    if (
      firstCell ===
      "callsign"
    ) {
      headers =
        createHeaderMap(
          row,
        )

      continue
    }

    const callsign =
      getValue(
        row,
        headers,
        "Callsign",
      )

    const badgeNumber =
      getValue(
        row,
        headers,
        "Badge Number",
      )

    const name =
      getValue(
        row,
        headers,
        "Name",
      )

    const rank =
      getValue(
        row,
        headers,
        "Rank",
      )

    // Empty row or section heading.
    if (
      !callsign &&
      !badgeNumber &&
      !name &&
      !rank
    ) {
      const nonEmptyCells =
        row
          .map(text)
          .filter(Boolean)

      if (
        nonEmptyCells.length ===
        1
      ) {
        currentSection =
          nonEmptyCells[0]
      }

      continue
    }

    members.push({
      section:
        currentSection,

      callsign,

      badgeNumber,

      name,

      insignia:
        getValue(
          row,
          headers,
          "Insignia",
        ),

      rank,

      jobDescription:
        getValue(
          row,
          headers,
          "Job Description",
        ),

      timeInDept:
        getValue(
          row,
          headers,
          "Time In Dept",
        ),

      timeInRank:
        getValue(
          row,
          headers,
          "Time In Rank",
        ),

      status:
        getValue(
          row,
          headers,
          "Status",
        ),

      strike1:
        booleanValue(
          getValue(
            row,
            headers,
            "Strike 1",
          ),
        ),

      strike2:
        booleanValue(
          getValue(
            row,
            headers,
            "Strike 2",
          ),
        ),

      discordId:
        getValue(
          row,
          headers,
          "Discord ID",
        ),

      hoursThisMonth:
        getValue(
          row,
          headers,
          "Hours this month",
        ),
    })
  }

  return members
}

// ─────────────────────────────────────────────
// Employee Database
// ─────────────────────────────────────────────

function parseEmployees(
  rows: string[][],
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

  if (
    headerIndex === -1
  ) {
    throw new Error(
      "Could not find Employee Database headers.",
    )
  }

  const headers =
    createHeaderMap(
      rows[headerIndex],
    )

  const employees: MainRosterEmployee[] =
    []

  for (
    let rowIndex =
      headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row =
      rows[rowIndex]

    if (!row) {
      continue
    }

    const badgeNumber =
      getValue(
        row,
        headers,
        "Badge Number",
      )

    const name =
      getValue(
        row,
        headers,
        "Name",
      )

    if (
      !badgeNumber &&
      !name
    ) {
      continue
    }

    employees.push({
      sendMessage:
        getValue(
          row,
          headers,
          "Send Message",
        ),

      badgeNumber,

      name,

      discordId:
        getValue(
          row,
          headers,
          "Discord ID",
        ),

      departmentStatus:
        getValue(
          row,
          headers,
          "Department Status",
        ),

      rank:
        getValue(
          row,
          headers,
          "Rank",
        ),

      timezone:
        getValue(
          row,
          headers,
          "Timezone",
        ),

      joinDeptDate:
        getValue(
          row,
          headers,
          "Join Dept Date",
        ),

      promoDate:
        getValue(
          row,
          headers,
          "Promo Date",
        ),

      strike1:
        booleanValue(
          getValue(
            row,
            headers,
            "Strike 1",
          ),
        ),

      strike2:
        booleanValue(
          getValue(
            row,
            headers,
            "Strike 2",
          ),
        ),

      callsign:
        getValue(
          row,
          headers,
          "Callsign",
        ),

      timeInDept:
        getValue(
          row,
          headers,
          "Time In Dept",
        ),

      terminated:
        booleanValue(
          getValue(
            row,
            headers,
            "Terminated",
          ),
        ),

      loa:
        booleanValue(
          getValue(
            row,
            headers,
            "LOA",
          ),
        ),

      resigned:
        booleanValue(
          getValue(
            row,
            headers,
            "Resigned",
          ),
        ),

      thisMonthHours:
        getValue(
          row,
          headers,
          "This month hours",
        ),

      lastMonthHours:
        getValue(
          row,
          headers,
          "Last month hours",
        ),
    })
  }

  return employees
}

// ─────────────────────────────────────────────
// Vehicle Roster
// ─────────────────────────────────────────────

function parseVehicles(
  rows: string[][],
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

  if (
    headerIndex === -1
  ) {
    throw new Error(
      "Could not find Vehicle Roster headers.",
    )
  }

  const headers =
    createHeaderMap(
      rows[headerIndex],
    )

  const vehicles: MainRosterVehicle[] =
    []

  for (
    let rowIndex =
      headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row =
      rows[rowIndex]

    if (!row) {
      continue
    }

    const rank =
      getValue(
        row,
        headers,
        "Rank",
      )

    const vehicleName =
      getValue(
        row,
        headers,
        "Vehicle Name",
      )

    const spawncode =
      getValue(
        row,
        headers,
        "Spawncode",
      )

    if (
      !vehicleName &&
      !spawncode
    ) {
      continue
    }

    vehicles.push({
      rank,

      vehicleName,

      spawncode,

      requiredExtras:
        getValue(
          row,
          headers,
          "Required Extras",
        ),

      livery:
        getValue(
          row,
          headers,
          "Livery",
        ),

      windowTint:
        getValue(
          row,
          headers,
          "Window Tint",
        ),

      turbo:
        booleanValue(
          getValue(
            row,
            headers,
            "Turbo",
          ),
        ),

      slicktopOptional:
        booleanValue(
          getValue(
            row,
            headers,
            "Slicktop Optional",
          ),
        ),

      unmarkedAllowed:
        booleanValue(
          getValue(
            row,
            headers,
            "Unmarked Allowed",
          ),
        ),
    })
  }

  return vehicles
}

// ─────────────────────────────────────────────
// Uniform Roster
// ─────────────────────────────────────────────

function parseUniforms(
  rows: string[][],
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

  if (
    headerIndex === -1
  ) {
    throw new Error(
      "Could not find Uniform Roster headers.",
    )
  }

  const headers =
    createHeaderMap(
      rows[headerIndex],
    )

  const uniforms: MainRosterUniform[] =
    []

  let currentRank = ""

  for (
    let rowIndex =
      headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row =
      rows[rowIndex]

    if (!row) {
      continue
    }

    const rank =
      getValue(
        row,
        headers,
        "Rank",
      )

    const className =
      getValue(
        row,
        headers,
        "Class",
      )

    const sharedOutfitCode =
      getValue(
        row,
        headers,
        "Shared Outfit Code",
      )

    if (rank) {
      currentRank = rank
    }

    if (
      !className &&
      !sharedOutfitCode
    ) {
      continue
    }

    uniforms.push({
      rank:
        rank ||
        currentRank,

      className,

      sharedOutfitCode,
    })
  }

  return uniforms
}

// ─────────────────────────────────────────────
// Main Google → MongoDB Sync
// ─────────────────────────────────────────────

export async function syncGoogleMainRoster() {
  const config =
    getGoogleConfig()

  const auth =
    createGoogleAuth()

  const sheets =
    google.sheets({
      version: "v4",
      auth,
    })

  console.log(
    "[Main Roster] Starting Google Sheets sync...",
  )

  const [
    departmentRows,
    employeeRows,
    vehicleRows,
    uniformRows,
  ] = await Promise.all([
    getSheetRows(
      sheets,
      config.departmentSheet,
    ),

    getSheetRows(
      sheets,
      config.employeeSheet,
    ),

    getSheetRows(
      sheets,
      config.vehicleSheet,
    ),

    getSheetRows(
      sheets,
      config.uniformSheet,
    ),
  ])

  console.log(
    "[Main Roster] Google Sheets data loaded.",
  )

  const department =
    parseDepartmentRoster(
      departmentRows,
    )

  const employees =
    parseEmployees(
      employeeRows,
    )

  const vehicles =
    parseVehicles(
      vehicleRows,
    )

  const uniforms =
    parseUniforms(
      uniformRows,
    )

  // Never replace valid MongoDB data
  // with an empty/broken Google Sheet.
  if (
    department.length === 0
  ) {
    throw new Error(
      "Department Roster returned zero members. Existing MongoDB data was not changed.",
    )
  }

  if (
    employees.length === 0
  ) {
    throw new Error(
      "Employee Database returned zero employees. Existing MongoDB data was not changed.",
    )
  }

  if (
    vehicles.length === 0
  ) {
    throw new Error(
      "Vehicle Roster returned zero vehicles. Existing MongoDB data was not changed.",
    )
  }

  if (
    uniforms.length === 0
  ) {
    throw new Error(
      "Uniform Roster returned zero uniforms. Existing MongoDB data was not changed.",
    )
  }

  const db =
    await getMongoDb()

  const updatedAt =
    new Date()

  const roster: MainRosterData = {
    type: "main",

    department,

    employees,

    vehicles,

    uniforms,

    updatedAt,
  }

  await db
    .collection<MainRosterData>(
      "mainRoster",
    )
    .updateOne(
      {
        type: "main",
      },
      {
        $set: roster,
      },
      {
        upsert: true,
      },
    )

  const result = {
    department:
      department.length,

    employees:
      employees.length,

    vehicles:
      vehicles.length,

    uniforms:
      uniforms.length,

    updatedAt,
  }

  console.log(
    "[Main Roster] Sync completed successfully:",
    {
      department:
        result.department,

      employees:
        result.employees,

      vehicles:
        result.vehicles,

      uniforms:
        result.uniforms,

      updatedAt:
        result.updatedAt.toISOString(),
    },
  )

  return result
}
