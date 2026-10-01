export type RosterUser = {
  discordId: string
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  timeInDept: string
  timeInRank: string
  status: string
}

export type DiscordUser = {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
}

export type AuthUser = RosterUser & {
  username: string
  displayName: string
  avatar?: string
  permissions: string[]
}
