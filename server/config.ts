import "dotenv/config"

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    )
  }

  return value
}

export const env = {
  // ─────────────────────────────────────────────
  // Discord
  // ─────────────────────────────────────────────

  discordClientId: required(
    "DISCORD_CLIENT_ID",
  ),

  discordClientSecret: required(
    "DISCORD_CLIENT_SECRET",
  ),

  discordRedirectUri: required(
    "DISCORD_REDIRECT_URI",
  ),

  // ─────────────────────────────────────────────
  // Google
  // ─────────────────────────────────────────────

  googleServiceAccountEmail: required(
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  ),

  googlePrivateKey: required(
    "GOOGLE_PRIVATE_KEY",
  ).replace(/\\n/g, "\n"),

  googleSheetId: required(
    "GOOGLE_SHEET_ID",
  ),

  // Existing division roster import sheet
  rosterSheetName: required(
    "GOOGLE_SHEET_ROSTER_IMPORT",
  ),

  // ─────────────────────────────────────────────
  // Master Roster Google Sheets
  // ─────────────────────────────────────────────

  // These names are deliberately separate from the existing division
  // roster import setting above. The Main Roster sync reads these exact
  // sheet-tab names from the environment and uses safe defaults locally.
  mainRoster: {
    homeSheet:
      process.env.GOOGLE_MAIN_ROSTER_HOME_SHEET ??
      "MPD | Home",

    departmentSheet:
      process.env.GOOGLE_MAIN_ROSTER_DEPARTMENT_SHEET ??
      "Department Roster",

    employeeSheet:
      process.env.GOOGLE_MAIN_ROSTER_EMPLOYEE_SHEET ??
      "Employee Database",

    vehicleSheet:
      process.env.GOOGLE_MAIN_ROSTER_VEHICLE_SHEET ??
      "Vehicle Roster",

    uniformSheet:
      process.env.GOOGLE_MAIN_ROSTER_UNIFORM_SHEET ??
      "Uniform Roster",
  },

  // ─────────────────────────────────────────────
  // Session
  // ─────────────────────────────────────────────

  sessionSecret: required(
    "SESSION_SECRET",
  ),

  // ─────────────────────────────────────────────
  // Server
  // ─────────────────────────────────────────────

  port: Number(
    process.env.PORT ?? 3001,
  ),

  appOrigin:
    process.env.APP_ORIGIN ??
    "http://localhost:5173",
}
