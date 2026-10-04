import fs from "node:fs"
import path from "node:path"

import type { AuthUser } from "../types"
import { getMongoDb } from "../../src/lib/mongodb"

type AdminConfig = {
  adminRanks: string[]
  superAdminDiscordIds: string[]
}

type PermissionDocument = {
  key: string
  name?: string
  description?: string
  urls: string[]
  createdAt?: Date
  updatedAt?: Date
}

type RankPermissionDocument = {
  rank: string
  permissions: string[]
  createdAt?: Date
  updatedAt?: Date
}

type DiscordPermissionDocument = {
  discordId: string
  permissions: string[]
  createdAt?: Date
  updatedAt?: Date
}

const PERMISSION_COLLECTION = "permissionDefinitions"
const RANK_COLLECTION = "rankPermissions"
const DISCORD_COLLECTION = "discordPermissionOverrides"

// This is the only permission that is hard-coded into the application.
// Admin ranks in admin_permissions.json receive it automatically.
export const PERMISSION_ADMIN = "permissionadmin"

let permissionInitializationPromise: Promise<void> | null = null

function readAdminConfig(): AdminConfig {
  const file = path.join(process.cwd(), "config", "admin_permissions.json")
  return JSON.parse(fs.readFileSync(file, "utf8")) as AdminConfig
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(
      values
        .map(clean)
        .filter(Boolean),
    ),
  )
}

function normalise(value: string): string {
  return clean(value).toLowerCase()
}

export function isSuperAdmin(discordId: string): boolean {
  const id = clean(discordId)
  if (!id) return false

  return uniqueStrings(readAdminConfig().superAdminDiscordIds).includes(id)
}

export function isAdminRank(rank: string): boolean {
  const normalized = normalise(rank)
  if (!normalized) return false

  return uniqueStrings(readAdminConfig().adminRanks).some(
    (adminRank) => normalise(adminRank) === normalized,
  )
}

export function getAdminRanks(): string[] {
  return uniqueStrings(readAdminConfig().adminRanks)
}

export async function ensurePermissionIndexes() {
  const db = await getMongoDb()

  await db.collection<PermissionDocument>(PERMISSION_COLLECTION).createIndex(
    { key: 1 },
    { unique: true, name: "permission_key" },
  )

  await db.collection<RankPermissionDocument>(RANK_COLLECTION).createIndex(
    { rank: 1 },
    { unique: true, name: "rank_name" },
  )

  await db.collection<DiscordPermissionDocument>(DISCORD_COLLECTION).createIndex(
    { discordId: 1 },
    { unique: true, name: "discord_permission_id" },
  )
}

export async function ensurePermissionStore() {
  if (!permissionInitializationPromise) {
    permissionInitializationPromise = ensurePermissionIndexes().catch((error) => {
      permissionInitializationPromise = null
      throw error
    })
  }

  return permissionInitializationPromise
}

export async function getRankPermissions(rank: string): Promise<string[]> {
  await ensurePermissionStore()

  const db = await getMongoDb()
  const document = await db
    .collection<RankPermissionDocument>(RANK_COLLECTION)
    .findOne({ rank: clean(rank) })

  const permissions = uniqueStrings(document?.permissions)

  // Admin rank status is deliberately NOT stored in MongoDB.
  // The JSON file is the authoritative bootstrap/security layer.
  if (isAdminRank(rank)) {
    permissions.push(PERMISSION_ADMIN)
  }

  return uniqueStrings(permissions)
}

export async function getDiscordPermissionOverride(discordId: string) {
  const db = await getMongoDb()

  return db
    .collection<DiscordPermissionDocument>(DISCORD_COLLECTION)
    .findOne({ discordId: clean(discordId) })
}

export async function resolvePermissions(
  discordId: string,
  rank: string,
): Promise<string[]> {
  await ensurePermissionStore()

  // Super admins are the only users with a true full bypass.
  // This cannot be created or granted from the admin page.
  if (isSuperAdmin(discordId)) {
    return ["*"]
  }

  const rankPermissions = await getRankPermissions(rank)
  const override = await getDiscordPermissionOverride(discordId)

  return uniqueStrings([
    ...rankPermissions,
    ...(override?.permissions ?? []),
  ])
}

export async function buildAuthUser(
  roster: Omit<AuthUser, "permissions">,
): Promise<AuthUser> {
  return {
    ...roster,
    permissions: await resolvePermissions(
      roster.discordId,
      roster.rank,
    ),
  }
}

export async function refreshAuthUserPermissions(
  user: Omit<AuthUser, "permissions">,
): Promise<AuthUser> {
  return buildAuthUser(user)
}

export function hasPermission(
  user: AuthUser,
  permission: string,
): boolean {
  return user.permissions.includes("*") || user.permissions.includes(permission)
}

export async function canAccessUrl(
  user: AuthUser,
  url: string,
): Promise<boolean> {
  if (user.permissions.includes("*")) return true
  if (url === "/") return true

  const db = await getMongoDb()
  const definitions = await db
    .collection<PermissionDocument>(PERMISSION_COLLECTION)
    .find({ key: { $in: user.permissions } })
    .toArray()

  return definitions.some((definition) =>
    uniqueStrings(definition.urls).some(
      (allowed) =>
        url === allowed ||
        url.startsWith(`${allowed}/`),
    ),
  )
}

export type {
  AdminConfig,
  DiscordPermissionDocument,
  PermissionDocument,
  RankPermissionDocument,
}
