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

  mainRoster: {
    homeSheet:
      process.env.GOOGLE_SHEET_MAIN_HOME ??
      "MPD | Home",

    departmentSheet:
      process.env.GOOGLE_SHEET_MAIN_DEPARTMENT ??
      "Department Roster",

    employeeSheet:
      process.env.GOOGLE_SHEET_MAIN_EMPLOYEES ??
      "Employee Database",

    vehicleSheet:
      process.env.GOOGLE_SHEET_MAIN_VEHICLES ??
      "Vehicle Roster",

    uniformSheet:
      process.env.GOOGLE_SHEET_MAIN_UNIFORMS ??
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
