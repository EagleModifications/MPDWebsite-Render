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
  const requestedPath =
    clean(url).split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/"

  const configuredPath =
    clean(allowedUrl).split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/"

  return (
    requestedPath === configuredPath ||
    requestedPath.startsWith(`${configuredPath}/`)
  )
}

export const PERMISSION_ADMIN_URL = "/dashboard/admin/permissions"

/**
 * Returns true ONLY when the requested frontend URL is explicitly listed in
 * config/admin_permissions.json.
 *
 * Mongo permission definitions do NOT automatically make a page protected.
 * This is intentional: the JSON file is the master switch for which browser
 * routes use the web-permission system.
 */
export function isConfiguredProtectedUrl(url: string): boolean {
  const protectedPageUrls = getProtectedPageUrls()

  return protectedPageUrls.some((configuredUrl) =>
    urlMatches(url, configuredUrl),
  )
}

/**
 * Returns the MongoDB web permissions that apply to a configured protected
 * URL. A URL can be covered by more than one permission definition.
 */
export async function getPagePermissions(
  url: string,
): Promise<PermissionDefinition[]> {
  if (!isConfiguredProtectedUrl(url)) {
    return []
  }

  const definitions = await getPermissionDefinitions()

  return definitions.filter((definition) =>
    definition.urls.some((configuredUrl) =>
      urlMatches(url, configuredUrl),
    ),
  )
}

/**
 * Frontend page protection is driven exclusively by protectedUrls.
 *
 * - URL not in protectedUrls -> public, no login required.
 * - URL in protectedUrls -> authentication + matching web permission.
 * - Super Admin -> bypass.
 *
 * The Permissions administration page is not silently special-cased here.
 * If it should be protected, put it in protectedUrls. When it is listed,
 * permissionadmin is accepted as its required system permission.
 */
export async function isPageProtected(url: string): Promise<boolean> {
  return isConfiguredProtectedUrl(url)
}

/**
 * Checks access to a frontend page.
 *
 * IMPORTANT:
 * protectedUrls decides whether a page is protected at all.
 * MongoDB definitions decide which permission(s) can open that page.
 *
 * A protected URL with no matching Mongo permission is denied rather than
 * accidentally becoming public. This is an intentional fail-closed rule.
 */
export async function canAccessPage(
  user: AuthUser,
  url: string,
): Promise<boolean> {
  if (!isConfiguredProtectedUrl(url)) {
    return true
  }

  if (hasPermission(user, "*")) {
    return true
  }

  /*
   * The admin permissions page uses the system permission. Admin ranks in
   * admin_permissions.json automatically receive permissionadmin.
   */
  if (urlMatches(url, PERMISSION_ADMIN_URL)) {
    return hasPermission(user, PERMISSION_ADMIN)
  }

  const definitions = await getPagePermissions(url)

  if (definitions.length === 0) {
    return false
  }

  return definitions.some((definition) =>
    hasPermission(user, definition.key),
  )
}
