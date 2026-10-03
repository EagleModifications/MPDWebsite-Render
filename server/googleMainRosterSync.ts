import { google } from "googleapis"

import { getDb } from "./db"
import { env } from "./env"

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
  department: MainRosterDepartmentMember[]
  employees: MainRosterEmployee[]
  vehicles: MainRosterVehicle[]
  uniforms: MainRosterUniform[]
  updatedAt: Date
}

function createGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: env.google.clientEmail,
      private_key: env.google.privateKey.replace(
        /\\n/g,
        "\n",
      ),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  })
}

async function getSheetRows(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
) {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'`,
    })

  return response.data.values ?? []
}

function text(value: unknown): string {
  return String(value ?? "").trim()
}

function normaliseHeader(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function booleanValue(value: unknown): boolean {
  const valueText = text(value).toLowerCase()

  return [
    "true",
    "yes",
    "y",
    "x",
    "1",
    "checked",
  ].includes(valueText)
}

function findHeaderRow(
  rows: string[][],
  requiredHeaders: string[],
): number {
  const required =
    requiredHeaders.map(normaliseHeader)

  for (
    let rowIndex = 0;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const headers =
      rows[rowIndex].map(normaliseHeader)

    if (
      required.every((header) =>
        headers.includes(header),
      )
    ) {
      return rowIndex
    }
  }

  return -1
}

function createHeaderMap(row: string[]) {
  const map = new Map<string, number>()

  row.forEach((value, index) => {
    const key = normaliseHeader(value)

    if (key) {
      map.set(key, index)
    }
  })

  return map
}

function getValue(
  row: string[],
  headers: Map<string, number>,
  header: string,
): string {
  const index =
    headers.get(normaliseHeader(header))

  if (index === undefined) {
    return ""
  }

  return text(row[index])
}

function parseDepartmentRoster(
  rows: string[][],
): MainRosterDepartmentMember[] {
  const headerIndex = findHeaderRow(rows, [
    "Callsign",
    "Badge Number",
    "Name",
    "Rank",
  ])

  if (headerIndex === -1) {
    throw new Error(
      "Department Roster headers could not be found.",
    )
  }

  const members: MainRosterDepartmentMember[] = []

  let currentSection = ""

  let headers = createHeaderMap(
    rows[headerIndex],
  )

  for (
    let rowIndex = headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row = rows[rowIndex]

    const possibleHeader =
      normaliseHeader(row[0])

    if (
      possibleHeader === "callsign"
    ) {
      headers = createHeaderMap(row)
      continue
    }

    const callsign = getValue(
      row,
      headers,
      "Callsign",
    )

    const badgeNumber = getValue(
      row,
      headers,
      "Badge Number",
    )

    const name = getValue(
      row,
      headers,
      "Name",
    )

    const rank = getValue(
      row,
      headers,
      "Rank",
    )

    if (
      !callsign &&
      !badgeNumber &&
      !name &&
      !rank
    ) {
      const possibleSection =
        row.find((value) => text(value))

      if (possibleSection) {
        const sectionText =
          text(possibleSection)

        if (
          sectionText.length <= 60 &&
          !sectionText
            .toLowerCase()
            .includes("total")
        ) {
          currentSection =
            sectionText
        }
      }

      continue
    }

    members.push({
      section: currentSection,
      callsign,
      badgeNumber,
      name,
      insignia: getValue(
        row,
        headers,
        "Insignia",
      ),
      rank,
      jobDescription: getValue(
        row,
        headers,
        "Job Description",
      ),
      timeInDept: getValue(
        row,
        headers,
        "Time In Dept",
      ),
      timeInRank: getValue(
        row,
        headers,
        "Time In Rank",
      ),
      status: getValue(
        row,
        headers,
        "Status",
      ),
      strike1: booleanValue(
        getValue(
          row,
          headers,
          "Strike 1",
        ),
      ),
      strike2: booleanValue(
        getValue(
          row,
          headers,
          "Strike 2",
        ),
      ),
      discordId: getValue(
        row,
        headers,
        "Discord ID",
      ),
      hoursThisMonth: getValue(
        row,
        headers,
        "Hours this month",
      ),
    })
  }

  return members
}

function parseEmployees(
  rows: string[][],
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
      "Employee Database headers could not be found.",
    )
  }

  const headers = createHeaderMap(
    rows[headerIndex],
  )

  const employees: MainRosterEmployee[] = []

  for (
    let rowIndex = headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row = rows[rowIndex]

    const badgeNumber = getValue(
      row,
      headers,
      "Badge Number",
    )

    const name = getValue(
      row,
      headers,
      "Name",
    )

    if (!badgeNumber && !name) {
      continue
    }

    employees.push({
      sendMessage: getValue(
        row,
        headers,
        "Send Message",
      ),
      badgeNumber,
      name,
      discordId: getValue(
        row,
        headers,
        "Discord ID",
      ),
      departmentStatus: getValue(
        row,
        headers,
        "Department Status",
      ),
      rank: getValue(
        row,
        headers,
        "Rank",
      ),
      timezone: getValue(
        row,
        headers,
        "Timezone",
      ),
      joinDeptDate: getValue(
        row,
        headers,
        "Join Dept Date",
      ),
      promoDate: getValue(
        row,
        headers,
        "Promo Date",
      ),
      strike1: booleanValue(
        getValue(
          row,
          headers,
          "Strike 1",
        ),
      ),
      strike2: booleanValue(
        getValue(
          row,
          headers,
          "Strike 2",
        ),
      ),
      callsign: getValue(
        row,
        headers,
        "Callsign",
      ),
      timeInDept: getValue(
        row,
        headers,
        "Time In Dept",
      ),
      terminated: booleanValue(
        getValue(
          row,
          headers,
          "Terminated",
        ),
      ),
      loa: booleanValue(
        getValue(
          row,
          headers,
          "LOA",
        ),
      ),
      resigned: booleanValue(
        getValue(
          row,
          headers,
          "Resigned",
        ),
      ),
      thisMonthHours: getValue(
        row,
        headers,
        "This month hours",
      ),
      lastMonthHours: getValue(
        row,
        headers,
        "Last month hours",
      ),
    })
  }

  return employees
}

function parseVehicles(
  rows: string[][],
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
      "Vehicle Roster headers could not be found.",
    )
  }

  const headers = createHeaderMap(
    rows[headerIndex],
  )

  const vehicles: MainRosterVehicle[] = []

  for (
    let rowIndex = headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row = rows[rowIndex]

    const rank = getValue(
      row,
      headers,
      "Rank",
    )

    const vehicleName = getValue(
      row,
      headers,
      "Vehicle Name",
    )

    const spawncode = getValue(
      row,
      headers,
      "Spawncode",
    )

    if (!vehicleName && !spawncode) {
      continue
    }

    vehicles.push({
      rank,
      vehicleName,
      spawncode,
      requiredExtras: getValue(
        row,
        headers,
        "Required Extras",
      ),
      livery: getValue(
        row,
        headers,
        "Livery",
      ),
      windowTint: getValue(
        row,
        headers,
        "Window Tint",
      ),
      turbo: booleanValue(
        getValue(
          row,
          headers,
          "Turbo",
        ),
      ),
      slicktopOptional: booleanValue(
        getValue(
          row,
          headers,
          "Slicktop Optional",
        ),
      ),
      unmarkedAllowed: booleanValue(
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

function parseUniforms(
  rows: string[][],
): MainRosterUniform[] {
  const headerIndex = findHeaderRow(rows, [
    "Rank",
    "Class",
    "Shared Outfit Code",
  ])

  if (headerIndex === -1) {
    throw new Error(
      "Uniform Roster headers could not be found.",
    )
  }

  const headers = createHeaderMap(
    rows[headerIndex],
  )

  const uniforms: MainRosterUniform[] = []

  let currentRank = ""

  for (
    let rowIndex = headerIndex + 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row = rows[rowIndex]

    const rank = getValue(
      row,
      headers,
      "Rank",
    )

    const className = getValue(
      row,
      headers,
      "Class",
    )

    const code = getValue(
      row,
      headers,
      "Shared Outfit Code",
    )

    if (rank) {
      currentRank = rank
    }

    if (!className && !code) {
      continue
    }

    uniforms.push({
      rank: rank || currentRank,
      className,
      sharedOutfitCode: code,
    })
  }

  return uniforms
}

export async function syncGoogleMainRoster() {
  const spreadsheetId =
    env.google.sheetId

  if (!spreadsheetId) {
    throw new Error(
      "Google Sheet ID is not configured.",
    )
  }

  const auth = createGoogleAuth()

  const sheets = google.sheets({
    version: "v4",
    auth,
  })

  const [
    departmentRows,
    employeeRows,
    vehicleRows,
    uniformRows,
  ] = await Promise.all([
    getSheetRows(
      sheets,
      spreadsheetId,
      env.google.mainDepartmentSheet,
    ),
    getSheetRows(
      sheets,
      spreadsheetId,
      env.google.mainEmployeeSheet,
    ),
    getSheetRows(
      sheets,
      spreadsheetId,
      env.google.mainVehicleSheet,
    ),
    getSheetRows(
      sheets,
      spreadsheetId,
      env.google.mainUniformSheet,
    ),
  ])

  const department =
    parseDepartmentRoster(
      departmentRows,
    )

  const employees =
    parseEmployees(employeeRows)

  const vehicles =
    parseVehicles(vehicleRows)

  const uniforms =
    parseUniforms(uniformRows)

  const db = await getDb()

  await db
    .collection("mainRoster")
    .updateOne(
      {
        type: "main",
      },
      {
        $set: {
          type: "main",
          department,
          employees,
          vehicles,
          uniforms,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    )

  return {
    department: department.length,
    employees: employees.length,
    vehicles: vehicles.length,
    uniforms: uniforms.length,
  }
}
