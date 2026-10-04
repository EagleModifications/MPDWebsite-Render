import { google } from "googleapis"

import { env } from "../config"
import { buildAuthUser } from "../permissions/permissions"
import type { DiscordUser, RosterUser } from "../types"

function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.googleServiceAccountEmail,
      private_key: env.googlePrivateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  })

  return google.sheets({
    version: "v4",
    auth,
  })
}

async function findRosterUser(
  discordId: string,
): Promise<RosterUser | null> {
  const sheets = getGoogleSheetsClient()
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range: `${env.rosterSheetName}!A:H`,
  })

  const rows = result.data.values ?? []

  for (const row of rows.slice(1)) {
    const id = String(row[6] ?? "").trim()

    if (id !== discordId) continue

    return {
      callsign: String(row[0] ?? "").trim(),
      badgeNumber: String(row[1] ?? "").trim(),
      name: String(row[2] ?? "").trim(),
      rank: String(row[3] ?? "").trim(),
      timeInDept: String(row[4] ?? "").trim(),
      timeInRank: String(row[5] ?? "").trim(),
      discordId: id,
      status: String(row[7] ?? "").trim(),
    }
  }

  return null
}

export function getDiscordLoginUrl() {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    response_type: "code",
    redirect_uri: env.discordRedirectUri,
    scope: "identify",
  })

  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function authenticateDiscordCode(
  code: string,
) {
  const tokenResponse = await fetch(
    "https://discord.com/api/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.discordClientId,
        client_secret: env.discordClientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.discordRedirectUri,
      }),
    },
  )

  if (!tokenResponse.ok) {
    throw new Error("Discord token exchange failed.")
  }

  const token = (await tokenResponse.json()) as {
    access_token?: string
  }

  if (!token.access_token) {
    throw new Error("Discord did not return an access token.")
  }

  const discordResponse = await fetch(
    "https://discord.com/api/users/@me",
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    },
  )

  if (!discordResponse.ok) {
    throw new Error("Failed to retrieve your Discord account.")
  }

  const discordUser = (await discordResponse.json()) as DiscordUser
  const discordId = String(discordUser.id).trim()

  if (!discordId) {
    throw new Error("Discord did not return a valid user ID.")
  }

  const rosterUser = await findRosterUser(discordId)

  if (!rosterUser) {
    throw new Error("Your Discord ID is not registered on the MPD roster.")
  }

  const baseUser = {
    ...rosterUser,
    username: String(discordUser.username ?? ""),
    displayName: String(
      discordUser.global_name ||
        discordUser.username ||
        "",
    ),
    ...(discordUser.avatar
      ? { avatar: String(discordUser.avatar) }
      : {}),
  }

  const user = await buildAuthUser(baseUser)

  if (
    rosterUser.status.trim().toLowerCase() !== "active" &&
    !user.permissions.includes("*")
  ) {
    throw new Error("Your MPD roster status is not active.")
  }

  return user
}
