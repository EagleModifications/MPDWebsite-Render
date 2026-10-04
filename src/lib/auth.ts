export type User = {
  discordId: string
  username: string
  displayName: string
  avatar?: string

  callsign: string
  badgeNumber: string
  name: string
  rank: string
  timeInDept: string
  timeInRank: string
  status: string

  permissions: string[]
}

export async function getSession(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "include"
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.user ?? null
  } catch {
    return null
  }
}

export function hasPermission(
  user: User | null,
  permission: string,
): boolean {
  if (!user) return false
  return (
    user.permissions.includes("*") ||
    user.permissions.includes(permission)
  )
}

export function hasAnyPermission(
  user: User | null,
  permissions: string[],
): boolean {
  if (!user) return false
  if (user.permissions.includes("*")) return true

  return permissions.some((permission) =>
    user.permissions.includes(permission),
  )
}
