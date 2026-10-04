import fs from "node:fs"
import path from "node:path"

import type { AuthUser } from "../types"
import { getMongoDb } from "../../src/lib/mongodb"

export type AdminConfig = {
  adminRanks: string[]
  superAdminDiscordIds: string[]
  protectedUrls: string[]
}

export type PermissionDefinition = {
  key: string
  name?: string
  description?: string
  urls: string[]
}

export type RankPermissionEntry = {
  rank: string
  permissions: string[]
}

export type DiscordPermissionEntry = {
  discordId: string
  permissions: string[]
}

/**
 * MongoDB uses ONE collection and ONE document.
 *
 * permissions
 * └── _id: "main"
 *     ├── definitions: []
 *     ├── ranks: []
 *     └── discord: []
 *
 * Admin ranks, Super Admin Discord IDs, and the protected admin URLs remain
 * in config/admin_permissions.json.
 */
export type PermissionStoreDocument = {
  _id: "main"
  definitions: PermissionDefinition[]
  ranks: RankPermissionEntry[]
  discord: DiscordPermissionEntry[]
  updatedAt?: Date
}

export const PERMISSIONS_COLLECTION = "permissions"
export const PERMISSION_ADMIN = "permissionadmin"
export const PERMISSION_STORE_ID = "main"

let permissionInitializationPromise: Promise<void> | null = null

function readAdminConfig(): AdminConfig {
  const file = path.join(
    process.cwd(),
    "config",
    "admin_permissions.json",
  )

  const parsed = JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as Partial<AdminConfig>

  return {
    adminRanks: uniqueStrings(parsed.adminRanks),
    superAdminDiscordIds: uniqueStrings(
      parsed.superAdminDiscordIds,
    ),
    protectedUrls: uniqueStrings(parsed.protectedUrls),
  }
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function uniqueStrings(values: unknown): string[] {
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

function normaliseStore(
  document?: Partial<PermissionStoreDocument> | null,
): PermissionStoreDocument {
  const definitions = Array.isArray(document?.definitions)
    ? document.definitions
        .map((item) => ({
          key: clean(item?.key).toLowerCase(),
          name: clean(item?.name),
          description: clean(item?.description),
          urls: uniqueStrings(item?.urls),
        }))
        .filter((item) => item.key && item.urls.length > 0)
    : []

  const ranks = Array.isArray(document?.ranks)
    ? document.ranks
        .map((item) => ({
          rank: clean(item?.rank),
          permissions: uniqueStrings(item?.permissions),
        }))
        .filter((item) => item.rank)
    : []

  const discord = Array.isArray(document?.discord)
    ? document.discord
        .map((item) => ({
          discordId: clean(item?.discordId),
          permissions: uniqueStrings(item?.permissions),
        }))
        .filter((item) => item.discordId)
    : []

  return {
    _id: PERMISSION_STORE_ID,
    definitions,
    ranks,
    discord,
    updatedAt: document?.updatedAt,
  }
}

export function isSuperAdmin(discordId: string): boolean {
  const id = clean(discordId)
  if (!id) return false

  return readAdminConfig().superAdminDiscordIds.includes(id)
}

export function isAdminRank(rank: string): boolean {
  const normalized = normalise(rank)
  if (!normalized) return false

  return readAdminConfig().adminRanks.some(
    (adminRank) => normalise(adminRank) === normalized,
  )
}

export function getAdminRanks(): string[] {
  return readAdminConfig().adminRanks
}

export function getSuperAdminDiscordIds(): string[] {
  return readAdminConfig().superAdminDiscordIds
}

export function getProtectedPageUrls(): string[] {
  return readAdminConfig().protectedUrls
}

async function getCollection() {
  const db = await getMongoDb()
  return db.collection<PermissionStoreDocument>(PERMISSIONS_COLLECTION)
}

/**
 * Migrates the previous three-document layout into the new single-document
 * layout once. This means existing Mongo data is not lost when the new code is
 * deployed.
 */
async function migrateLegacyPermissionDocuments() {
  const collection = await getCollection()
  const current = await collection.findOne({
    _id: PERMISSION_STORE_ID,
  })

  const legacyDocuments = await collection
    .find({
      _id: { $ne: PERMISSION_STORE_ID },
      type: { $in: ["definition", "rank", "discord"] },
    })
    .toArray()

  if (current) {
    if (legacyDocuments.length > 0) {
      await collection.deleteMany({
        _id: { $in: legacyDocuments.map((item) => item._id) },
      })
    }

    await dropLegacyIndexes(collection)
    return
  }

  const definitions: PermissionDefinition[] = []
  const ranks: RankPermissionEntry[] = []
  const discord: DiscordPermissionEntry[] = []

  for (const item of legacyDocuments as Array<Record<string, unknown>>) {
    if (item.type === "definition") {
      definitions.push({
        key: clean(item.key).toLowerCase(),
        name: clean(item.name),
        description: clean(item.description),
        urls: uniqueStrings(item.urls),
      })
    }

    if (item.type === "rank") {
      ranks.push({
        rank: clean(item.rank),
        permissions: uniqueStrings(item.permissions),
      })
    }

    if (item.type === "discord") {
      discord.push({
        discordId: clean(item.discordId),
        permissions: uniqueStrings(item.permissions),
      })
    }
  }

  const now = new Date()

  await collection.insertOne({
    _id: PERMISSION_STORE_ID,
    definitions,
    ranks,
    discord,
    updatedAt: now,
  })

  if (legacyDocuments.length > 0) {
    await collection.deleteMany({
      _id: {
        $in: legacyDocuments.map((item) => item._id),
      },
    })
  }

  await dropLegacyIndexes(collection)
}

async function dropLegacyIndexes(
  collection: Awaited<ReturnType<typeof getCollection>>,
) {
  for (const name of [
    "permission_definition_key",
    "permission_rank_name",
    "permission_discord_id",
  ]) {
    try {
      await collection.dropIndex(name)
    } catch {
      // The index may not exist on a fresh installation.
    }
  }
}

export async function ensurePermissionStore() {
  if (!permissionInitializationPromise) {
    permissionInitializationPromise = (async () => {
      await migrateLegacyPermissionDocuments()

      const collection = await getCollection()
      const current = await collection.findOne({
        _id: PERMISSION_STORE_ID,
      })

      if (!current) {
        await collection.insertOne({
          _id: PERMISSION_STORE_ID,
          definitions: [],
          ranks: [],
          discord: [],
          updatedAt: new Date(),
        })
      }
    })().catch((error) => {
      permissionInitializationPromise = null
      throw error
    })
  }

  return permissionInitializationPromise
}

export async function getPermissionStore(): Promise<PermissionStoreDocument> {
  await ensurePermissionStore()

  const collection = await getCollection()
  const document = await collection.findOne({
    _id: PERMISSION_STORE_ID,
  })

  return normaliseStore(document)
}

export async function savePermissionStore(
  store: PermissionStoreDocument,
): Promise<PermissionStoreDocument> {
  const normalized = normaliseStore(store)
  normalized.updatedAt = new Date()

  const collection = await getCollection()

  await collection.replaceOne(
    { _id: PERMISSION_STORE_ID },
    normalized,
    { upsert: true },
  )

  return normalized
}

export async function getPermissionDefinitions(): Promise<PermissionDefinition[]> {
  const store = await getPermissionStore()
  return store.definitions
}

export async function getRankPermissionDocuments(): Promise<RankPermissionEntry[]> {
  const store = await getPermissionStore()
  return store.ranks
}

export async function getDiscordPermissionDocuments(): Promise<DiscordPermissionEntry[]> {
  const store = await getPermissionStore()
  return store.discord
}

export async function getRankPermissions(rank: string): Promise<string[]> {
  const store = await getPermissionStore()
  const normalizedRank = normalise(rank)

  const entry = store.ranks.find(
    (item) => normalise(item.rank) === normalizedRank,
  )

  const permissions = uniqueStrings(entry?.permissions)

  if (isAdminRank(rank)) {
    permissions.push(PERMISSION_ADMIN)
  }

  return uniqueStrings(permissions)
}

export async function getDiscordPermissionOverride(
  discordId: string,
): Promise<DiscordPermissionEntry | null> {
  const store = await getPermissionStore()
  const id = clean(discordId)

  return (
    store.discord.find((item) => item.discordId === id) ?? null
  )
}

export async function resolvePermissions(
  discordId: string,
  rank: string,
): Promise<string[]> {
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
  return (
    user.permissions.includes("*") ||
    user.permissions.includes(permission)
  )
}

function urlMatches(url: string, allowedUrl: string): boolean {
  return (
    url === allowedUrl ||
    url.startsWith(`${allowedUrl}/`)
  )
}

export async function canAccessPage(
  user: AuthUser,
  url: string,
): Promise<boolean> {
  if (user.permissions.includes("*")) return true
  if (url === "/") return true

  const protectedPageUrls = getProtectedPageUrls()

  if (protectedPageUrls.some((allowed) => urlMatches(url, allowed))) {
    return user.permissions.includes(PERMISSION_ADMIN)
  }

  const definitions = await getPermissionDefinitions()

  return definitions.some(
    (definition) =>
      user.permissions.includes(definition.key) &&
      definition.urls.some((allowed) => urlMatches(url, allowed)),
  )
}
