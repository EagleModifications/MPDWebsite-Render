import type { Express, Request, Response } from "express"

import { getMongoDb } from "../../src/lib/mongodb"
import {
  ensurePermissionStore,
  getAdminRanks,
  hasPermission,
  isAdminRank,
  isSuperAdmin,
  type DiscordPermissionDocument,
  type PermissionDocument,
  type RankPermissionDocument,
} from "./permissions"
import { getRequestUser } from "../auth/session"

const PERMISSIONS = "permissionDefinitions"
const RANKS = "rankPermissions"
const DISCORD = "discordPermissionOverrides"

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(values.map(clean).filter(Boolean)),
  )
}

function validPermissionKey(value: string) {
  return /^[a-z0-9][a-z0-9_-]*$/.test(value)
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

  if (!hasPermission(user, "permissionadmin")) {
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

      const db = await getMongoDb()

      const [permissions, ranks, discordOverrides] = await Promise.all([
        db.collection<PermissionDocument>(PERMISSIONS)
          .find({})
          .sort({ key: 1 })
          .toArray(),
        db.collection<RankPermissionDocument>(RANKS)
          .find({})
          .sort({ rank: 1 })
          .toArray(),
        db.collection<DiscordPermissionDocument>(DISCORD)
          .find({})
          .sort({ discordId: 1 })
          .toArray(),
      ])

      return res.json({
        permissions: permissions.map((item) => ({
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
        discordOverrides: discordOverrides.map((item) => ({
          discordId: item.discordId,
          permissions: uniqueStrings(item.permissions),
          isSuperAdmin: isSuperAdmin(item.discordId),
        })),
        adminRanks: getAdminRanks(),
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
          error: "Permission keys may only contain lowercase letters, numbers, hyphens, and underscores.",
        })
      }

      if (!urls.length) {
        return res.status(400).json({ error: "Add at least one URL." })
      }

      const db = await getMongoDb()
      const existing = await db
        .collection<PermissionDocument>(PERMISSIONS)
        .findOne({ key })

      if (existing) {
        return res.status(409).json({ error: "That permission already exists." })
      }

      const now = new Date()
      await db.collection<PermissionDocument>(PERMISSIONS).insertOne({
        key,
        name,
        description,
        urls,
        createdAt: now,
        updatedAt: now,
      })

      return res.status(201).json({ success: true })
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

      const db = await getMongoDb()
      const result = await db.collection<PermissionDocument>(PERMISSIONS).updateOne(
        { key },
        {
          $set: {
            name,
            description,
            urls,
            updatedAt: new Date(),
          },
        },
      )

      if (!result.matchedCount) {
        return res.status(404).json({ error: "Permission not found." })
      }

      return res.json({ success: true })
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

      // permissionadmin is virtual and must never be created/deleted from Mongo.
      if (key === "permissionadmin") {
        return res.status(400).json({
          error: "permissionadmin is a protected system permission.",
        })
      }

      const db = await getMongoDb()
      const result = await db
        .collection<PermissionDocument>(PERMISSIONS)
        .deleteOne({ key })

      if (!result.deletedCount) {
        return res.status(404).json({ error: "Permission not found." })
      }

      await db.collection<RankPermissionDocument>(RANKS).updateMany(
        {},
        { $pull: { permissions: key } },
      )
      await db.collection<DiscordPermissionDocument>(DISCORD).updateMany(
        {},
        { $pull: { permissions: key } },
      )

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

      const db = await getMongoDb()
      const existing = await db
        .collection<RankPermissionDocument>(RANKS)
        .findOne({ rank })

      if (existing) {
        return res.status(409).json({ error: "That rank already exists." })
      }

      const now = new Date()
      await db.collection<RankPermissionDocument>(RANKS).insertOne({
        rank,
        permissions,
        createdAt: now,
        updatedAt: now,
      })

      return res.status(201).json({ success: true })
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

      // Admin status is deliberately controlled only by admin_permissions.json.
      // Do not allow the admin page to rename/remove the security bootstrap rank.
      if (isAdminRank(oldRank) && newRank !== oldRank) {
        return res.status(400).json({
          error: "Admin ranks are controlled by config/admin_permissions.json and cannot be renamed here.",
        })
      }

      const db = await getMongoDb()
      const update: Record<string, unknown> = {
        permissions,
        updatedAt: new Date(),
      }

      if (newRank !== oldRank) {
        const duplicate = await db
          .collection<RankPermissionDocument>(RANKS)
          .findOne({ rank: newRank })

        if (duplicate) {
          return res.status(409).json({ error: "That rank already exists." })
        }

        update.rank = newRank
      }

      const result = await db.collection<RankPermissionDocument>(RANKS).updateOne(
        { rank: oldRank },
        { $set: update },
      )

      if (!result.matchedCount) {
        return res.status(404).json({ error: "Rank not found." })
      }

      return res.json({ success: true })
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
          error: "Admin ranks are controlled by config/admin_permissions.json and cannot be deleted here.",
        })
      }

      const db = await getMongoDb()
      const result = await db
        .collection<RankPermissionDocument>(RANKS)
        .deleteOne({ rank })

      if (!result.deletedCount) {
        return res.status(404).json({ error: "Rank not found." })
      }

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

      if (!/^\d{17,20}$/.test(discordId)) {
        return res.status(400).json({ error: "Enter a valid Discord user ID." })
      }

      // Super admins are controlled exclusively by JSON and cannot be changed here.
      if (isSuperAdmin(discordId)) {
        return res.status(400).json({
          error: "That Discord ID is a Super Admin and is controlled by config/admin_permissions.json.",
        })
      }

      const db = await getMongoDb()
      const now = new Date()

      await db.collection<DiscordPermissionDocument>(DISCORD).updateOne(
        { discordId },
        {
          $set: {
            permissions,
            updatedAt: now,
          },
          $setOnInsert: {
            discordId,
            createdAt: now,
          },
        },
        { upsert: true },
      )

      return res.json({ success: true })
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
          error: "Super Admin Discord IDs are controlled by config/admin_permissions.json.",
        })
      }

      const db = await getMongoDb()
      const result = await db
        .collection<DiscordPermissionDocument>(DISCORD)
        .deleteOne({ discordId })

      if (!result.deletedCount) {
        return res.status(404).json({ error: "Discord override not found." })
      }

      return res.json({ success: true })
    } catch (error) {
      console.error("DELETE /api/admin/discord-permissions failed:", error)
      return res.status(500).json({ error: "Failed to remove Discord permissions." })
    }
  })
}
