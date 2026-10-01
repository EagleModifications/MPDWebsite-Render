import { getDiscordLoginUrl, exchangeDiscordCode, getDiscordUser } from "./discord"
import { findRosterUser } from "./roster"
import { buildAuthUser } from "../permissions/permissions"
import type { AuthUser } from "../types"

export { getDiscordLoginUrl }

export async function authenticateDiscordCode(code: string): Promise<AuthUser> {
  const accessToken = await exchangeDiscordCode(code)
  const discord = await getDiscordUser(accessToken)

  const roster = await findRosterUser(discord.id)

  if (!roster) {
    throw new Error("Your Discord account was not found in the Metro Police Department roster.")
  }

  if (roster.status.toLowerCase() !== "active") {
    throw new Error("Your roster status is not Active.")
  }

  const user = buildAuthUser({
    ...roster,
    username: discord.username,
    displayName: discord.global_name || discord.username,
    avatar: discord.avatar
      ? `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.png`
      : undefined
  })

  return user
}
