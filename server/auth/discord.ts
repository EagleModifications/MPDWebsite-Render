import type { DiscordUser } from "../types"
import { env } from "../config"

export function getDiscordLoginUrl(): string {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: env.discordRedirectUri,
    response_type: "code",
    scope: "identify"
  })

  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function exchangeDiscordCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.discordRedirectUri
  })

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  })

  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status}`)
  }

  const data = await response.json() as { access_token?: string }

  if (!data.access_token) {
    throw new Error("Discord did not return an access token")
  }

  return data.access_token
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Discord user lookup failed: ${response.status}`)
  }

  return await response.json() as DiscordUser
}
