import { google } from "googleapis"
import { env } from "../config"

const auth = new google.auth.JWT({
  email: env.googleServiceAccountEmail,
  key: env.googlePrivateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
})

const sheets = google.sheets({
  version: "v4",
  auth
})

export async function getRosterRows(): Promise<string[][]> {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range: `${env.rosterSheetName}!A:H`
  })

  return (result.data.values ?? []) as string[][]
}
