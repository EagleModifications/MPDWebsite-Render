import fs from "node:fs"
import path from "node:path"
import type { AuthUser } from "../types"

type RankPermissions = Record<string, string[]>

type PermissionDefinition = {
  urls: string[]
  files: string[]
}

type PermissionConfig = Record<string, PermissionDefinition>

function readJson<T>(filename: string): T {
  const file = path.join(process.cwd(), "config", filename)
  return JSON.parse(fs.readFileSync(file, "utf8")) as T
}

export function getRankPermissions(rank: string): string[] {
  const config = readJson<RankPermissions>("rank_permissions.json")
  return config[rank] ?? []
}

export function getPermissionConfig(): PermissionConfig {
  return readJson<PermissionConfig>("permissions.json")
}

export function buildAuthUser(
  roster: Omit<AuthUser, "permissions">,
): AuthUser {
  return {
    ...roster,
    permissions: getRankPermissions(roster.rank)
  }
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.permissions.includes(permission)
}

export function canAccessUrl(user: AuthUser, url: string): boolean {
  const definitions = getPermissionConfig()

  if (url === "/") return true

  return user.permissions.some((permission) => {
    return definitions[permission]?.urls.some(
      (allowed) => url === allowed || url.startsWith(`${allowed}/`)
    )
  })
}
