import type { Express, Request, Response } from "express"
import { getRequestUser } from "./auth/session"
import { hasPermission } from "./permissions/permissions"
import { getMongoDb } from "../src/lib/mongodb"
import { ObjectId } from "mongodb"

const LIST_DIVISIONS = ["department", "swat", "mtf7", "mcd", "tru", "teu", "sar"] as const
const LIST_MODULES = ["activity", "promotion"] as const
type ListModule = (typeof LIST_MODULES)[number]
type ListDivision = (typeof LIST_DIVISIONS)[number]

type RosterListDocument = {
  _id?: ObjectId
  module: ListModule
  division: ListDivision
  week: string
  scope: "global" | "user"
  ownerUserId: string
  selectedUserIds: string[]
  selectedUsers: Array<{
    userId: string
    name: string
    callsign: string
    badgeNumber: string
    rank: string
    strike?: number
  }>
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mondayKey(date = new Date()): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function previousWeek(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

function isValidModule(value: string): value is ListModule {
  return (LIST_MODULES as readonly string[]).includes(value)
}

function isValidDivision(value: string): value is ListDivision {
  return (LIST_DIVISIONS as readonly string[]).includes(value)
}

function serialise(doc: RosterListDocument) {
  return {
    id: doc._id?.toString() ?? "",
    module: doc.module,
    division: doc.division,
    week: doc.week,
    scope: doc.scope,
    ownerUserId: doc.ownerUserId,
    selectedUserIds: doc.selectedUserIds,
    selectedUsers: doc.selectedUsers,
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

export function registerRosterListRoutes(app: Express) {
  app.get("/api/roster-lists/:module/:division", async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req)
      if (!user) return res.status(401).json({ success: false, error: "Not authenticated" })

      const module = clean(req.params.module).toLowerCase()
      const division = clean(req.params.division).toLowerCase()
      if (!isValidModule(module) || !isValidDivision(division)) {
        return res.status(400).json({ success: false, error: "Invalid roster list module or division." })
      }

      if (!hasPermission(user, "audit")) {
        return res.status(403).json({ success: false, error: "You do not have permission to manage roster lists." })
      }

      const db = await getMongoDb()
      const collection = db.collection<RosterListDocument>("rosterLists")
      await collection.createIndex(
        { module: 1, division: 1, week: 1, scope: 1, ownerUserId: 1 },
        { unique: true, name: "roster_list_week_scope" },
      )
      const currentWeek = mondayKey()
      const priorWeek = previousWeek(currentWeek)

      const [current, history] = await Promise.all([
        collection.find({
          module,
          division,
          week: currentWeek,
          $or: [
            { scope: "global" },
            { scope: "user", ownerUserId: clean(user.discordId) },
          ],
        }).sort({ createdAt: -1 }).toArray(),
        collection.find({
          module,
          division,
          week: { $lte: priorWeek },
          $or: [
            { scope: "global" },
            { scope: "user", ownerUserId: clean(user.discordId) },
          ],
        }).sort({ week: -1, createdAt: -1 }).limit(30).toArray(),
      ])

      const latestByUser = new Map<string, { strike: number; week: string; scope: string }>()
      for (const doc of history) {
        for (const userId of doc.selectedUserIds) {
          if (latestByUser.has(userId)) continue
          latestByUser.set(userId, {
            strike: 1,
            week: doc.week,
            scope: doc.scope,
          })
        }
      }

      // Preview is deliberately based on the previous week's list. If someone
      // was selected last week, the preview shows the next strike (1 -> 2 -> 3).
      const previousDocs = history.filter((doc) => doc.week === priorWeek)
      const twoWeeksAgo = previousWeek(priorWeek)
      const twoWeeksAgoDocs = history.filter((doc) => doc.week === twoWeeksAgo)

      const previousSelected = new Set<string>()
      const twoWeeksAgoSelected = new Set<string>()

      for (const doc of previousDocs) {
        for (const id of doc.selectedUserIds) previousSelected.add(id)
      }
      for (const doc of twoWeeksAgoDocs) {
        for (const id of doc.selectedUserIds) twoWeeksAgoSelected.add(id)
      }

      const preview = Array.from(previousSelected).map((userId) => {
        const strike = twoWeeksAgoSelected.has(userId) ? 3 : 2
        return {
          userId,
          strike,
          label: `Activity Strike ${strike}`,
        }
      })

      return res.json({
        success: true,
        week: currentWeek,
        previousWeek: priorWeek,
        current: current.map(serialise),
        history: history.map(serialise),
        preview,
      })
    } catch (error) {
      console.error("GET /api/roster-lists failed:", error)
      return res.status(500).json({ success: false, error: "Failed to load roster lists." })
    }
  })

  app.post("/api/roster-lists/:module/:division", async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req)
      if (!user) return res.status(401).json({ success: false, error: "Not authenticated" })

      const module = clean(req.params.module).toLowerCase()
      const division = clean(req.params.division).toLowerCase()
      if (!isValidModule(module) || !isValidDivision(division)) {
        return res.status(400).json({ success: false, error: "Invalid roster list module or division." })
      }

      if (!hasPermission(user, "audit")) {
        return res.status(403).json({ success: false, error: "You do not have permission to manage roster lists." })
      }

      const scope = clean(req.body?.scope).toLowerCase()
      if (scope !== "global" && scope !== "user") {
        return res.status(400).json({ success: false, error: "Scope must be global or user." })
      }

      const selectedUsers = Array.isArray(req.body?.selectedUsers)
        ? req.body.selectedUsers
            .map((item: any) => ({
              userId: clean(item?.userId || item?.discordId),
              name: clean(item?.name),
              callsign: clean(item?.callsign),
              badgeNumber: clean(item?.badgeNumber),
              rank: clean(item?.rank),
            }))
            .filter((item: any) => item.userId)
        : []

      if (selectedUsers.length === 0) {
        return res.status(400).json({ success: false, error: "Select at least one roster member." })
      }

      const currentWeek = mondayKey()
      const ownerUserId = scope === "global" ? "global" : clean(user.discordId)
      const collection = (await getMongoDb()).collection<RosterListDocument>("rosterLists")
      await collection.createIndex(
        { module: 1, division: 1, week: 1, scope: 1, ownerUserId: 1 },
        { unique: true, name: "roster_list_week_scope" },
      )

      const existing = await collection.findOne({
        module,
        division,
        week: currentWeek,
        scope,
        ownerUserId,
      })

      const priorWeek = previousWeek(currentWeek)
      const twoWeeksAgo = previousWeek(priorWeek)
      const [priorDocs, twoWeeksAgoDocs] = await Promise.all([
        collection.find({ module, division, week: priorWeek }).toArray(),
        collection.find({ module, division, week: twoWeeksAgo }).toArray(),
      ])
      const priorSelected = new Set(priorDocs.flatMap((doc) => doc.selectedUserIds))
      const twoWeeksAgoSelected = new Set(twoWeeksAgoDocs.flatMap((doc) => doc.selectedUserIds))

      const selectedUsersWithStrikes = selectedUsers.map((item: any) => ({
        ...item,
        strike: twoWeeksAgoSelected.has(item.userId)
          ? 3
          : priorSelected.has(item.userId)
            ? 2
            : 1,
      }))

      const now = new Date()
      const document = {
        module,
        division,
        week: currentWeek,
        scope,
        ownerUserId,
        selectedUserIds: Array.from(new Set(selectedUsers.map((item: any) => item.userId))),
        selectedUsers: selectedUsersWithStrikes,
        createdBy: clean(user.discordId),
        createdByName: clean(user.displayName || user.name || user.username),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      } satisfies Omit<RosterListDocument, "_id">

      if (existing?._id) {
        await collection.replaceOne({ _id: existing._id }, document)
        return res.json({ success: true, updated: true, list: serialise({ ...document, _id: existing._id }) })
      }

      const result = await collection.insertOne(document)
      return res.json({ success: true, updated: false, list: serialise({ ...document, _id: result.insertedId }) })
    } catch (error) {
      console.error("POST /api/roster-lists failed:", error)
      return res.status(500).json({ success: false, error: "Failed to save roster list." })
    }
  })
}
