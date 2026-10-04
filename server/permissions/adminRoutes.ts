import type { Express, Request, Response } from "express"

import { getRequestUser } from "../auth/session"
import {
  ensurePermissionStore,
  getAdminRanks,
  getDiscordPermissionDocuments,
  getPermissionDefinitions,
  getPermissionStore,
  getProtectedAdminUrls,
  getSuperAdminDiscordIds,
  getRankPermissionDocuments,
  hasPermission,
  isAdminRank,
  isSuperAdmin,
  PERMISSION_ADMIN,
  PERMISSIONS_COLLECTION,
  savePermissionStore,
  uniqueStrings,
  type PermissionDefinition,
  type PermissionStoreDocument,
} from "./permissions"

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function validPermissionKey(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(value)
}

function validDiscordId(value: string): boolean {
  return /^\d{17,20}$/.test(value)
}

async function requirePermissionAdmin(
  req: Request,
  res: Response,
) {
  const user = await getRequestUser(req)

  if (!user) {
    res.status(401).json({ error: "Unauthorized" })
    return null
  }

  if (!hasPermission(user, PERMISSION_ADMIN)) {
    res.status(403).json({
      error: "You do not have permission to manage permissions.",
    })
    return null
  }

  return user
}

export function registerPermissionAdminRoutes(app: Express) {
  void ensurePermissionStore().catch((error) => {
    console.error("Permission store initialization failed:", error)
  })

  app.get("/api/admin/permissions", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const [definitions, ranks, discord] = await Promise.all([
        getPermissionDefinitions(),
        getRankPermissionDocuments(),
        getDiscordPermissionDocuments(),
      ])

      return res.json({
        success: true,
        permissions: definitions.map((item) => ({
          key: item.key,
          name: item.name ?? item.key,
          description: item.description ?? "",
          urls: uniqueStrings(item.urls),
        })),
        ranks: ranks.map((item) => ({
          rank: item.rank,
          permissions: uniqueStrings(item.permissions),
          isAdminRank: isAdminRank(item.rank),
        })),
        discordPermissions: discord.map((item) => ({
          discordId: item.discordId,
          permissions: uniqueStrings(item.permissions),
          isSuperAdmin: isSuperAdmin(item.discordId),
        })),
        adminRanks: getAdminRanks(),
        superAdminDiscordIds: getSuperAdminDiscordIds(),
        protectedUrls: getProtectedAdminUrls(),
        currentUser: {
          discordId: user.discordId,
          rank: user.rank,
          isSuperAdmin: isSuperAdmin(user.discordId),
        },
      })
    } catch (error) {
      console.error("GET /api/admin/permissions failed:", error)
      return res.status(500).json({
        error: "Failed to load permission settings.",
      })
    }
  })

  app.post("/api/admin/permissions", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const key = clean(req.body?.key).toLowerCase()
      const name = clean(req.body?.name) || key
      const description = clean(req.body?.description)
      const urls = uniqueStrings(req.body?.urls)

      if (!key || !validPermissionKey(key)) {
        return res.status(400).json({
          error:
            "Permission keys may only contain lowercase letters, numbers, hyphens, and underscores.",
        })
      }

      if (key === PERMISSION_ADMIN) {
        return res.status(400).json({
          error: `${PERMISSION_ADMIN} is a protected system permission and is controlled by admin_permissions.json.`,
        })
      }

      if (!urls.length) {
        return res.status(400).json({ error: "Add at least one URL." })
      }

      const store = await getPermissionStore()
      if (store.definitions.some((item) => item.key === key)) {
        return res.status(409).json({
          error: "That permission already exists.",
        })
      }

      const permission: PermissionDefinition = {
        key,
        name,
        description,
        urls,
      }

      store.definitions.push(permission)
      await savePermissionStore(store)

      return res.status(201).json({
        success: true,
        permission,
      })
    } catch (error) {
      console.error("POST /api/admin/permissions failed:", error)
      return res.status(500).json({ error: "Failed to create permission." })
    }
  })

  app.put("/api/admin/permissions/:key", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const key = clean(req.params.key).toLowerCase()
      const name = clean(req.body?.name) || key
      const description = clean(req.body?.description)
      const urls = uniqueStrings(req.body?.urls)

      if (!validPermissionKey(key) || !urls.length) {
        return res.status(400).json({ error: "Invalid permission data." })
      }

      if (key === PERMISSION_ADMIN) {
        return res.status(400).json({
          error: `${PERMISSION_ADMIN} is a protected system permission and is controlled by admin_permissions.json.`,
        })
      }

      const store = await getPermissionStore()
      const index = store.definitions.findIndex((item) => item.key === key)

      if (index < 0) {
        return res.status(404).json({ error: "Permission not found." })
      }

      store.definitions[index] = {
        key,
        name,
        description,
        urls,
      }

      await savePermissionStore(store)

      return res.json({
        success: true,
        permission: store.definitions[index],
      })
    } catch (error) {
      console.error("PUT /api/admin/permissions failed:", error)
      return res.status(500).json({ error: "Failed to update permission." })
    }
  })

  app.delete("/api/admin/permissions/:key", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const key = clean(req.params.key).toLowerCase()

      if (key === PERMISSION_ADMIN) {
        return res.status(400).json({
          error: `${PERMISSION_ADMIN} is a protected system permission.`,
        })
      }

      const store = await getPermissionStore()
      const exists = store.definitions.some((item) => item.key === key)

      if (!exists) {
        return res.status(404).json({ error: "Permission not found." })
      }

      store.definitions = store.definitions.filter((item) => item.key !== key)
      store.ranks = store.ranks.map((item) => ({
        ...item,
        permissions: item.permissions.filter((permission) => permission !== key),
      }))
      store.discord = store.discord.map((item) => ({
        ...item,
        permissions: item.permissions.filter((permission) => permission !== key),
      }))

      await savePermissionStore(store)
      return res.json({ success: true })
    } catch (error) {
      console.error("DELETE /api/admin/permissions failed:", error)
      return res.status(500).json({ error: "Failed to delete permission." })
    }
  })

  app.post("/api/admin/ranks", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const rank = clean(req.body?.rank)
      const permissions = uniqueStrings(req.body?.permissions)

      if (!rank) {
        return res.status(400).json({ error: "Rank name is required." })
      }

      const store = await getPermissionStore()
      if (store.ranks.some((item) => item.rank.toLowerCase() === rank.toLowerCase())) {
        return res.status(409).json({ error: "That rank already exists." })
      }

      store.ranks.push({ rank, permissions })
      await savePermissionStore(store)

      return res.status(201).json({
        success: true,
        rank: {
          rank,
          permissions,
          isAdminRank: isAdminRank(rank),
        },
      })
    } catch (error) {
      console.error("POST /api/admin/ranks failed:", error)
      return res.status(500).json({ error: "Failed to create rank." })
    }
  })

  app.put("/api/admin/ranks/:rank", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const oldRank = clean(req.params.rank)
      const newRank = clean(req.body?.rank) || oldRank
      const permissions = uniqueStrings(req.body?.permissions)

      if (!oldRank || !newRank) {
        return res.status(400).json({ error: "Rank name is required." })
      }

      if (isAdminRank(oldRank) && newRank.toLowerCase() !== oldRank.toLowerCase()) {
        return res.status(400).json({
          error:
            "Admin ranks are controlled by config/admin_permissions.json and cannot be renamed here.",
        })
      }

      const store = await getPermissionStore()
      const index = store.ranks.findIndex(
        (item) => item.rank.toLowerCase() === oldRank.toLowerCase(),
      )

      if (index < 0) {
        return res.status(404).json({ error: "Rank not found." })
      }

      const duplicate = store.ranks.some(
        (item, itemIndex) =>
          itemIndex !== index &&
          item.rank.toLowerCase() === newRank.toLowerCase(),
      )

      if (duplicate) {
        return res.status(409).json({ error: "That rank already exists." })
      }

      store.ranks[index] = {
        rank: newRank,
        permissions,
      }

      await savePermissionStore(store)
      return res.json({ success: true, rank: store.ranks[index] })
    } catch (error) {
      console.error("PUT /api/admin/ranks failed:", error)
      return res.status(500).json({ error: "Failed to update rank." })
    }
  })

  app.delete("/api/admin/ranks/:rank", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const rank = clean(req.params.rank)

      if (isAdminRank(rank)) {
        return res.status(400).json({
          error:
            "Admin ranks are controlled by config/admin_permissions.json and cannot be deleted here.",
        })
      }

      const store = await getPermissionStore()
      const before = store.ranks.length
      store.ranks = store.ranks.filter(
        (item) => item.rank.toLowerCase() !== rank.toLowerCase(),
      )

      if (store.ranks.length === before) {
        return res.status(404).json({ error: "Rank not found." })
      }

      await savePermissionStore(store)
      return res.json({ success: true })
    } catch (error) {
      console.error("DELETE /api/admin/ranks failed:", error)
      return res.status(500).json({ error: "Failed to delete rank." })
    }
  })

  app.post("/api/admin/discord-permissions", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const discordId = clean(req.body?.discordId)
      const permissions = uniqueStrings(req.body?.permissions)

      if (!validDiscordId(discordId)) {
        return res.status(400).json({ error: "Enter a valid Discord user ID." })
      }

      if (isSuperAdmin(discordId)) {
        return res.status(400).json({
          error:
            "That Discord ID is a Super Admin and is controlled by config/admin_permissions.json.",
        })
      }

      const store = await getPermissionStore()
      const existing = store.discord.findIndex(
        (item) => item.discordId === discordId,
      )

      const entry = { discordId, permissions }

      if (existing >= 0) {
        store.discord[existing] = entry
      } else {
        store.discord.push(entry)
      }

      await savePermissionStore(store)

      return res.json({
        success: true,
        discordPermission: {
          ...entry,
          isSuperAdmin: false,
        },
      })
    } catch (error) {
      console.error("POST /api/admin/discord-permissions failed:", error)
      return res.status(500).json({ error: "Failed to save Discord permissions." })
    }
  })

  app.delete("/api/admin/discord-permissions/:discordId", async (req, res) => {
    try {
      const user = await requirePermissionAdmin(req, res)
      if (!user) return

      const discordId = clean(req.params.discordId)

      if (isSuperAdmin(discordId)) {
        return res.status(400).json({
          error:
            "Super Admin Discord IDs are controlled by config/admin_permissions.json.",
        })
      }

      const store = await getPermissionStore()
      const before = store.discord.length
      store.discord = store.discord.filter(
        (item) => item.discordId !== discordId,
      )

      if (store.discord.length === before) {
        return res.status(404).json({
          error: "Discord permissions not found.",
        })
      }

      await savePermissionStore(store)
      return res.json({ success: true })
    } catch (error) {
      console.error("DELETE /api/admin/discord-permissions failed:", error)
      return res.status(500).json({
        error: "Failed to remove Discord permissions.",
      })
    }
  })
}
