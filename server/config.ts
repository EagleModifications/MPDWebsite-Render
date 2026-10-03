import "dotenv/config"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordClientSecret: required("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: required("DISCORD_REDIRECT_URI"),

  googleServiceAccountEmail: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  googlePrivateKey: required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  googleSheetId: required("GOOGLE_SHEET_ID"),
  rosterSheetName: required("GOOGLE_SHEET_ROSTER_IMPORT"),

  mainRosterSheetId: required("GOOGLE_MAINROSTER_SHEET_ID"),
  mainRosterHomeSheet: required("GOOGLE_MAINROSTER_SHEET_HOME"),
  mainRosterDepartmentRosterSheet: required(
    "GOOGLE_MAINROSTER_SHEET_DEPARTMENTROSTER",
  ),
  mainRosterEmployeeDataSheet: required(
    "GOOGLE_MAINROSTER_SHEET_EMPLOYEEDATA",
  ),
  mainRosterVehicleRosterSheet: required(
    "GOOGLE_MAINROSTER_SHEET_VEHICLEROSTER",
  ),
  mainRosterUniformRosterSheet: required(
    "GOOGLE_MAINROSTER_SHEET_UNIFORMROSTER",
  ),

  sessionSecret: required("SESSION_SECRET"),

  port: Number(process.env.PORT ?? 3001),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:5173"
}
