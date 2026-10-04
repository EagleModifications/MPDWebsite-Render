import type { Express, Request, Response } from "express"
import { getRequestUser } from "./auth/session"
import { hasPermission } from "./permissions/permissions"
import { getMongoDb } from "../src/lib/mongodb"
import { ObjectId } from "mongodb"
import type { Collection } from "mongodb"

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

function easternDateParts(date = new Date()): {
  year: number
  month: number
  day: number
  weekday: number
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>

  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdays[parts.weekday] ?? 0,
  }
}

function mondayKey(date = new Date()): string {
  const parts = easternDateParts(date)
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const diff = parts.weekday === 0 ? -6 : 1 - parts.weekday
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function previousWeek(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

function weekKeyFromDate(date: Date): string {
  return mondayKey(date)
}

/**
 * Older versions could create a document whose week was ahead of its
 * createdAt date (for example created on Sep 24 but stamped Sep 28).
 * That document must never be treated as the current week's document.
 * Move it back to the week in which it was actually created before doing
 * the normal current-week lookup.
 */
async function repairFutureDatedDocuments(
  collection: Collection<RosterListDocument>,
  module: ListModule,
  division: ListDivision,
) {
  const docs = await collection
    .find({ module, division })
    .toArray() as RosterListDocument[]

  for (const doc of docs) {
    if (!(doc.createdAt instanceof Date) || !doc.week) continue

    const actualWeek = weekKeyFromDate(doc.createdAt)
    if (doc.week <= actualWeek) continue

    const conflict = await collection.findOne({
      _id: { $ne: doc._id },
      module: doc.module,
      division: doc.division,
      week: actualWeek,
      scope: doc.scope,
      ownerUserId: doc.ownerUserId,
    })

    if (conflict) {
      console.warn(
        `[roster-lists] Could not repair future-dated document ${doc._id?.toString()}: ${actualWeek} already exists.`,
      )
      continue
    }

    await collection.updateOne(
      { _id: doc._id },
      { $set: { week: actualWeek } },
    )
  }
}

async function repairCreatedByNames(
  collection: Collection<RosterListDocument>,
  docs: RosterListDocument[],
) {
  const db = await getMongoDb()
  const rosterCollection = db.collection<{
    userId: string
    division: string
    members?: Array<{ discordId?: string; name?: string }>
  }>("rosters")

  for (const doc of docs) {
    const createdBy = clean(doc.createdBy)
    if (!createdBy || !doc._id) continue

    const roster = await rosterCollection.findOne({
      userId: createdBy,
      division: doc.division,
    })

    const rosterName = clean(
      roster?.members?.find(
        (member) => clean(member.discordId) === createdBy,
      )?.name,
    )

    if (rosterName && rosterName !== doc.createdByName) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { createdByName: rosterName } },
      )
      doc.createdByName = rosterName
    }
  }
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

async function collectionDbForRoster(db: Awaited<ReturnType<typeof getMongoDb>>, userId: string, division: ListDivision) {
  const rosterCollection = db.collection<{
    userId: string
    division: string
    members: Array<{ discordId?: string; name?: string }>
  }>("rosters")

  return rosterCollection.findOne({ userId, division })
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
      await repairFutureDatedDocuments(collection, module, division)

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

      await repairCreatedByNames(collection, [...current, ...history])

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

      await repairFutureDatedDocuments(collection, module, division)

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

      // Resolve the submitter's name from the MPD roster, not Discord.
      // Roster documents are user-scoped, so use the authenticated user's
      // imported roster and match their Discord ID.
      let createdByName = ""
      try {
        const roster = await collectionDbForRoster(db, clean(user.discordId), division)
        createdByName = clean(
          roster?.members?.find(
            (member: any) => clean(member?.discordId) === clean(user.discordId),
          )?.name,
        )
      } catch (rosterError) {
        console.error("[roster-lists] Failed to resolve roster submitter name:", rosterError)
      }

      if (!createdByName) {
        createdByName = clean(user.name || user.displayName || user.username)
      }

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
        createdByName,
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
