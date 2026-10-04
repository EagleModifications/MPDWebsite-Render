import express from "express"
import cookieParser from "cookie-parser"
import multer from "multer"
import path from "node:path"
import fs from "node:fs"
import os from "node:os"
import XLSX from "xlsx"

import { syncGoogleRosters } from "./googleRosterSync"
import { registerMainRosterRoutes } from "./googleMainRoster"

import {
  authenticateDiscordCode,
  getDiscordLoginUrl,
} from "./auth/service"

import {
  clearSessionCookie,
  createSession,
  getRequestUser,
  setSessionCookie,
} from "./auth/session"

import { hasPermission } from "./permissions/permissions"
import { registerPermissionAdminRoutes } from "./permissions/adminRoutes"
import { logAction, registerActionLogRoutes } from "./actionLogs"
import { env } from "./config"
import { getMongoDb } from "../src/lib/mongodb"
import { GridFSBucket, ObjectId } from "mongodb"
import { randomUUID } from "node:crypto"
import youtubeDl from "youtube-dl-exec"

// Gallery uploads use disk-backed temporary storage so large videos are not
// kept in RAM while they are being copied into MongoDB GridFS.
const GALLERY_UPLOAD_DIR = path.join(
  os.tmpdir(),
  "mpd-gallery-uploads",
)

fs.mkdirSync(GALLERY_UPLOAD_DIR, { recursive: true })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 100 * 1024 * 1024,
  },
})

const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, GALLERY_UPLOAD_DIR)
    },
    filename: (_req, file, callback) => {
      callback(
        null,
        `${Date.now()}-${randomUUID()}-${path.basename(file.originalname || "gallery-file")}`,
      )
    },
  }),
  limits: {
    files: 20,
    fileSize: 100 * 1024 * 1024,
  },
})

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

const VALID_IMPORT_DIVISIONS = [
  "department",
  "swat",
  "mtf7",
  "mcd",
  "tru",
  "teu",
  "sar",
] as const

type ImportDivision =
  (typeof VALID_IMPORT_DIVISIONS)[number]

type RequirementDivision =
  ImportDivision

type RosterMember = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  timeInDept: string
  timeInRank: string
  discordId: string
  status: string
}

/* ─────────────────────────────────────────────
   Shared Roster
───────────────────────────────────────────── */

type RosterDocument = {
  userId: string
  division: ImportDivision
  members: RosterMember[]
  updatedAt: Date
}

type RosterImport = {
  division: ImportDivision
  members: RosterMember[]
}

/* ─────────────────────────────────────────────
   Activity
───────────────────────────────────────────── */

type ActivityMember = {
  discordId: string
  hours: number
}

type ActivityImport = {
  division: ImportDivision
  hours: ActivityMember[]
}

type ActivityDocument = {
  userId: string
  division: ImportDivision
  hours: ActivityMember[]
  updatedAt: Date
}

/* ─────────────────────────────────────────────
   Promotion
───────────────────────────────────────────── */

type PromotionMember = {
  discordId: string
  points: number
}

type PromotionImport = {
  division: ImportDivision
  points: PromotionMember[]
}

type PromotionDocument = {
  userId: string
  division: ImportDivision
  points: PromotionMember[]
  updatedAt: Date
}

/* ─────────────────────────────────────────────
   Rank Configuration
───────────────────────────────────────────── */

type RankDefinition = {
  id: string
  name: string
}

type RankConfig = {
  department: string
  ranks: RankDefinition[]
}

/* ─────────────────────────────────────────────
   Activity Requirements
───────────────────────────────────────────── */

type ActivityRequirement = {
  rankId: string
  rankName: string
  hours: number
  timeInRankDays: number
  trainingLogs: number
  recruitmentLogs: number
}

type ActivityRequirements = {
  division: string
  requirements: Record<
    string,
    ActivityRequirement
  >
}

type ActivityRequirementsDocument =
  ActivityRequirements & {
    userId: string
    updatedAt?: Date
  }

function getActivityRequirementForRank(
  rankName: string,
  rankConfig: RankConfig,
  requirements: ActivityRequirements,
): ActivityRequirement {
  const cleanRankName =
    String(rankName ?? "")
      .trim()
      .toLowerCase()

  const storedRequirement =
    Object.values(
      requirements.requirements,
    ).find(
      (requirement) =>
        requirement.rankName
          .trim()
          .toLowerCase() ===
        cleanRankName,
    )

  if (storedRequirement) {
    return storedRequirement
  }

  const configuredRank =
    rankConfig.ranks.find(
      (rank) =>
        rank.name
          .trim()
          .toLowerCase() ===
        cleanRankName,
    )

  if (configuredRank) {
    return (
      requirements.requirements[
        configuredRank.id
      ] ?? {
        rankId: configuredRank.id,
        rankName: configuredRank.name,
        hours: 0,
        timeInRankDays: 0,
        trainingLogs: 0,
        recruitmentLogs: 0,
      }
    )
  }

  return {
    rankId: "",
    rankName: rankName ?? "",
    hours: 0,
    timeInRankDays: 0,
    trainingLogs: 0,
    recruitmentLogs: 0,
  }
}

/* ─────────────────────────────────────────────
   Promotion Requirements
───────────────────────────────────────────── */

type PromotionRequirement = {
  rankId: string
  rankName: string
  points: number
}

type PromotionRequirements = {
  division: string
  requirements: Record<
    string,
    PromotionRequirement
  >
}

type PromotionRequirementsDocument =
  PromotionRequirements & {
    userId: string
    updatedAt?: Date
  }

/* ─────────────────────────────────────────────
   Events
───────────────────────────────────────────── */

const EVENT_CATEGORIES = [
  "Activities",
  "Patrol",
  "Operations",
  "Meetings",
] as const

type EventCategory =
  (typeof EVENT_CATEGORIES)[number]

type EventDocument = {
  _id?: ObjectId
  title: string
  description: string
  category: EventCategory
  date: string
  startTime: string
  endTime: string
  location: string
  discordUrl: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

function isEventCategory(
  value: unknown,
): value is EventCategory {
  return (
    typeof value === "string" &&
    EVENT_CATEGORIES.includes(
      value as EventCategory,
    )
  )
}

function cleanEventString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : ""
}

function isValidEventDate(
  value: unknown,
): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value
    .split("-")
    .map(Number)

  const date = new Date(
    Date.UTC(year, month - 1, day),
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidEventTime(
  value: unknown,
): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hours, minutes] = value
    .split(":")
    .map(Number)

  return (
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  )
}

function serializeEvent(event: EventDocument) {
  return {
    id: event._id?.toString() ?? "",
    title: event.title,
    description: event.description,
    category: event.category,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    discordUrl: event.discordUrl,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  }
}

/* ─────────────────────────────────────────────
   Gallery
───────────────────────────────────────────── */

const GALLERY_MEDIA_TYPES = [
  "image",
  "video",
] as const

type GalleryMediaType =
  (typeof GALLERY_MEDIA_TYPES)[number]

const GALLERY_CATEGORIES = [
  "Community",
  "Fleet",
] as const

const GALLERY_TAGS = [
  "Dept",
  "SWAT",
  "MTF-7",
  "MCD",
  "TRU",
  "SAR",
] as const

type GalleryTag =
  (typeof GALLERY_TAGS)[number]

function isGalleryTag(
  value: unknown,
): value is GalleryTag {
  return (
    typeof value === "string" &&
    GALLERY_TAGS.includes(
      value as GalleryTag,
    )
  )
}

function normalizeGalleryTags(
  value: unknown,
): GalleryTag[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value.filter(isGalleryTag),
    ),
  )
}

type GalleryCategory =
  (typeof GALLERY_CATEGORIES)[number]

function isGalleryCategory(
  value: unknown,
): value is GalleryCategory {
  return (
    typeof value === "string" &&
    GALLERY_CATEGORIES.includes(
      value as GalleryCategory,
    )
  )
}

type GalleryMedia = {
  id: string
  type: GalleryMediaType
  url: string
  thumbnailUrl: string
  source: "upload" | "url"
  storageId?: string
}

type GalleryDocument = {
  _id?: ObjectId
  title: string
  description: string
  media: GalleryMedia[]
  category?: GalleryCategory
  tags?: GalleryTag[]
  createdBy: string
  createdAt: Date
  updatedAt: Date

  // Legacy fields are kept optional so existing gallery
  // documents continue to work after this migration.
  type?: GalleryMediaType
  url?: string
  thumbnailUrl?: string
}

function isGalleryMediaType(
  value: unknown,
): value is GalleryMediaType {
  return (
    typeof value === "string" &&
    GALLERY_MEDIA_TYPES.includes(
      value as GalleryMediaType,
    )
  )
}

function cleanGalleryString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : ""
}

function normalizeGalleryMedia(
  value: unknown,
): GalleryMedia[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((raw): GalleryMedia | null => {
      if (!raw || typeof raw !== "object") {
        return null
      }

      const item = raw as Record<string, unknown>
      const type = item.type

      if (!isGalleryMediaType(type)) {
        return null
      }

      const url = cleanGalleryString(item.url)

      if (!url) {
        return null
      }

      const source =
        item.source === "upload"
          ? "upload"
          : "url"

      const storageId =
        cleanGalleryString(
          item.storageId,
        )

      return {
        id:
          cleanGalleryString(item.id) ||
          randomUUID(),
        type,
        url,
        thumbnailUrl:
          cleanGalleryString(
            item.thumbnailUrl,
          ),
        source,
        ...(storageId
          ? { storageId }
          : {}),
      }
    })
    .filter(
      (
        item,
      ): item is GalleryMedia =>
        Boolean(item),
    )
}

function getGalleryMedia(
  item: GalleryDocument,
): GalleryMedia[] {
  const media = normalizeGalleryMedia(
    item.media,
  )

  if (media.length > 0) {
    return media
  }

  // Backwards compatibility for the old
  // one-media-per-document format.
  if (
    isGalleryMediaType(item.type) &&
    cleanGalleryString(item.url)
  ) {
    return [
      {
        id:
          item._id?.toString() ||
          randomUUID(),
        type: item.type,
        url: cleanGalleryString(
          item.url,
        ),
        thumbnailUrl:
          cleanGalleryString(
            item.thumbnailUrl,
          ),
        source: "url",
      },
    ]
  }

  return []
}

const APP_ORIGIN =
  (process.env.APP_ORIGIN ?? "")
    .trim()
    .replace(/\/+$/, "")

function getGalleryPublicMediaUrl(
  media: GalleryMedia,
) {
  const originalUrl = cleanGalleryString(media.url)

  // IMPORTANT: keep an existing media URL when one is already present.
  // Older gallery records can contain a storageId that predates the
  // current GridFS bucket. Replacing a perfectly usable legacy URL with
  // /api/gallery/file/<old-id> makes those images appear broken.
  if (originalUrl) {
    if (originalUrl.startsWith("/")) {
      return APP_ORIGIN
        ? `${APP_ORIGIN}${originalUrl}`
        : originalUrl
    }

    return originalUrl
  }

  if (media.storageId) {
    const path =
      `/api/gallery/file/${media.storageId}`

    return APP_ORIGIN
      ? `${APP_ORIGIN}${path}`
      : path
  }

  return ""
}

function serializeGalleryItem(
  item: GalleryDocument,
) {
  return {
    id: item._id?.toString() ?? "",
    title: item.title,
    description: item.description,
    category: item.category ?? "Community",
    tags: normalizeGalleryTags(item.tags),
    media: getGalleryMedia(item).map((media) => {
      const publicUrl = getGalleryPublicMediaUrl(media)
      const originalUrl = cleanGalleryString(media.url)

      return {
        ...media,
        url: publicUrl,
        // Give the frontend a second chance to use the original URL if an
        // old GridFS reference is broken. This is intentionally only sent
        // when the URLs are different.
        fallbackUrl:
          originalUrl && originalUrl !== publicUrl
            ? originalUrl.startsWith("/")
              ? APP_ORIGIN
                ? `${APP_ORIGIN}${originalUrl}`
                : originalUrl
              : originalUrl
            : undefined,
        thumbnailUrl: media.thumbnailUrl?.startsWith("/")
          ? APP_ORIGIN
            ? `${APP_ORIGIN}${media.thumbnailUrl}`
            : media.thumbnailUrl
          : media.thumbnailUrl,
      }
    }),
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function getGalleryFileType(
  mimetype: string,
  filename = "",
): GalleryMediaType | null {
  const normalizedMime =
    cleanGalleryString(mimetype).toLowerCase()

  if (normalizedMime.startsWith("image/")) {
    return "image"
  }

  if (normalizedMime.startsWith("video/")) {
    return "video"
  }

  const extension = path.extname(filename).toLowerCase()

  const imageExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".avif",
    ".bmp",
    ".svg",
    ".tif",
    ".tiff",
  ])

  const videoExtensions = new Set([
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
    ".avi",
    ".mkv",
    ".ogv",
    ".mpeg",
    ".mpg",
  ])

  if (imageExtensions.has(extension)) {
    return "image"
  }

  if (videoExtensions.has(extension)) {
    return "video"
  }

  return null
}

async function getGalleryBucket() {
  const db = await getMongoDb()

  return new GridFSBucket(db, {
    bucketName: "galleryFiles",
  })
}

function getGalleryContentType(
  mimetype: string,
  filename = "",
  type?: GalleryMediaType,
) {
  const normalizedMime =
    cleanGalleryString(mimetype).toLowerCase()

  if (
    normalizedMime &&
    normalizedMime !== "application/octet-stream"
  ) {
    return normalizedMime
  }

  const extension = path.extname(filename).toLowerCase()

  const extensionContentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".ogv": "video/ogg",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
  }

  return (
    extensionContentTypes[extension] ??
    (type === "video" ? "video/mp4" : "application/octet-stream")
  )
}

async function safeUnlinkGalleryTempFile(
  filePath: string | undefined,
) {
  if (!filePath) return

  try {
    await fs.promises.unlink(filePath)
  } catch {
    // The file may already have been removed.
  }
}

async function storeGalleryFile(
  file: Express.Multer.File,
) {
  const type = getGalleryFileType(
    file.mimetype,
    file.originalname,
  )

  if (!type) {
    await safeUnlinkGalleryTempFile(file.path)
    throw new Error(
      `Unsupported gallery file type: ${file.originalname || "file"}`,
    )
  }

  if (!file.path) {
    throw new Error("Gallery upload did not create a temporary file.")
  }

  const bucket = await getGalleryBucket()
  const filename =
    file.originalname?.trim() ||
    `gallery-${Date.now()}`
  const contentType = getGalleryContentType(
    file.mimetype,
    filename,
    type,
  )

  const uploadStream = bucket.openUploadStream(
    filename,
    {
      contentType,
      metadata: {
        originalName: filename,
        mediaType: type,
        contentType,
      },
    },
  )

  try {
    await new Promise<void>((resolve, reject) => {
      const input = fs.createReadStream(file.path)

      input.once("error", reject)
      uploadStream.once("error", reject)
      uploadStream.once("finish", () => resolve())

      input.pipe(uploadStream)
    })

    const storageId = uploadStream.id.toString()
    const filePath = `/api/gallery/file/${storageId}`

    return {
      id: storageId,
      type,
      url: APP_ORIGIN
        ? `${APP_ORIGIN}${filePath}`
        : filePath,
      thumbnailUrl: "",
      source: "upload" as const,
      storageId,
    }
  } catch (error) {
    if (uploadStream.id) {
      await deleteGalleryStoredFile(
        uploadStream.id.toString(),
      )
    }
    throw error
  } finally {
    await safeUnlinkGalleryTempFile(file.path)
  }
}

function isSupportedGalleryExternalVideoUrl(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")

    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "vimeo.com" ||
      host === "player.vimeo.com"
    )
  } catch {
    return false
  }
}

async function importGalleryExternalVideo(
  sourceUrl: string,
) {
  const url = sourceUrl.trim()

  if (!isSupportedGalleryExternalVideoUrl(url)) {
    throw new Error("Only YouTube and Vimeo video URLs can be imported as gallery files.")
  }

  const jobId = randomUUID()
  const outputTemplate = path.join(
    GALLERY_UPLOAD_DIR,
    `external-${jobId}-%(ext)s`,
  )

  try {
    await youtubeDl(
      url,
      {
        noPlaylist: true,
        format: "best[ext=mp4]/best",
        output: outputTemplate,
        noPart: true,
        restrictFilenames: true,
        noWarnings: true,
      },
      {
        timeout: 20 * 60 * 1000,
        killSignal: "SIGKILL",
      },
    )

    const files = fs
      .readdirSync(GALLERY_UPLOAD_DIR)
      .filter((name) => name.startsWith(`external-${jobId}-`))

    if (!files.length) {
      throw new Error("The video extractor completed without producing a video file.")
    }

    const filename = files[0]
    const filePath = path.join(GALLERY_UPLOAD_DIR, filename)
    const stat = fs.statSync(filePath)

    if (!stat.isFile() || stat.size <= 0) {
      throw new Error("The extracted video file is empty.")
    }

    if (stat.size > 100 * 1024 * 1024) {
      throw new Error("The extracted video is larger than the 100 MB gallery limit.")
    }

    const extension = path.extname(filename).toLowerCase()
    const mimetype =
      extension === ".mp4"
        ? "video/mp4"
        : extension === ".webm"
          ? "video/webm"
          : extension === ".mkv"
            ? "video/x-matroska"
            : "video/*"

    const stored = await storeGalleryFile({
      fieldname: "file",
      originalname: `gallery-${jobId}${extension || ".mp4"}`,
      encoding: "7bit",
      mimetype,
      size: stat.size,
      destination: GALLERY_UPLOAD_DIR,
      filename,
      path: filePath,
      buffer: undefined,
      stream: fs.createReadStream(filePath),
    } as Express.Multer.File)

    return {
      ...stored,
      source: "upload" as const,
    }
  } catch (error) {
    for (const name of fs
      .readdirSync(GALLERY_UPLOAD_DIR)
      .filter((entry) => entry.startsWith(`external-${jobId}-`))) {
      await safeUnlinkGalleryTempFile(
        path.join(GALLERY_UPLOAD_DIR, name),
      )
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown extraction error"

    throw new Error(
      `Unable to import the video from the URL. ${message}`,
    )
  }
}

async function deleteGalleryStoredFile(
  storageId: string,
) {
  if (!ObjectId.isValid(storageId)) {
    return
  }

  try {
    const bucket =
      await getGalleryBucket()

    await bucket.delete(
      new ObjectId(storageId),
    )
  } catch (error) {
    console.warn(
      `Failed to delete gallery file ${storageId}:`,
      error,
    )
  }
}

async function deleteGalleryStoredFiles(
  media: GalleryMedia[],
) {
  const storageIds =
    Array.from(
      new Set(
        media
          .map(
            (item) =>
              item.storageId ?? "",
          )
          .filter(Boolean),
      ),
    )

  for (const storageId of storageIds) {
    await deleteGalleryStoredFile(
      storageId,
    )
  }
}

/* ─────────────────────────────────────────────
   Activity Roster Row
───────────────────────────────────────────── */

type ActivityRosterRow = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  discordId: string
  timeInDept: string
  timeInRank: string
  requiredHours: number
  activityHours: number
  status:
    | "compliant"
    | "non-compliant"
}

/* ─────────────────────────────────────────────
   Promotion Roster Row
───────────────────────────────────────────── */

type PromotionRosterRow = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  discordId: string
  timeInDept: string
  timeInRank: string
  requiredPoints: number
  promotionPoints: number
  requiredTimeInRankDays: number
  requiredTrainingLogs: number
  requiredRecruitmentLogs: number
  requiredLogs: number
  status:
    | "compliant"
    | "non-compliant"
}

/* ─────────────────────────────────────────────
   MongoDB Helpers
───────────────────────────────────────────── */

async function getCollection<T>(
  name: string,
) {
  const db = await getMongoDb()

  return db.collection<T>(name)
}

/* ─────────────────────────────────────────────
   MongoDB User-Scoped Migration + Indexes
───────────────────────────────────────────── */

async function ensureUserScopedIndexes() {
  const db = await getMongoDb()

  const activity =
    db.collection("activity")

  const requirements =
    db.collection("activityRequirements")

  const rosters =
    db.collection("rosters")

  const promotions =
    db.collection("promotions")

  const promotionRequirements =
    db.collection(
      "promotionRequirements",
    )

  /*
   * ───────────────────────────────────────────
   * ACTIVITY
   * ───────────────────────────────────────────
   */

  const activityIndexes =
    await activity
      .listIndexes()
      .toArray()

  const oldActivityIndex =
    activityIndexes.some(
      (index) =>
        index.name ===
        "activity_user_division_discord",
    )

  const activityDocuments =
    await activity
      .find({
        userId: {
          $type: "string",
        },
        division: {
          $type: "string",
        },
      })
      .toArray()

  const activityGroups =
    new Map<
      string,
      {
        userId: string
        division: string
        hours: Map<string, number>
      }
    >()

  for (const document of activityDocuments) {
    const userId =
      String(
        document.userId ?? "",
      ).trim()

    const division =
      String(
        document.division ?? "",
      ).trim()

    if (!userId || !division) {
      continue
    }

    const key =
      `${userId}::${division}`

    if (!activityGroups.has(key)) {
      activityGroups.set(key, {
        userId,
        division,
        hours: new Map(),
      })
    }

    const group =
      activityGroups.get(key)!

    if (
      Array.isArray(
        document.hours,
      )
    ) {
      for (
        const item of document.hours
      ) {
        if (
          !item ||
          typeof item !== "object"
        ) {
          continue
        }

        const discordId =
          String(
            (
              item as {
                discordId?: unknown
              }
            ).discordId ?? "",
          ).trim()

        const hours =
          Number(
            (
              item as {
                hours?: unknown
              }
            ).hours ?? 0,
          )

        if (
          /^\d{17,20}$/.test(
            discordId,
          ) &&
          Number.isFinite(hours)
        ) {
          group.hours.set(
            discordId,
            Math.max(0, hours),
          )
        }
      }
    }

    if (document.discordId) {
      const discordId =
        String(
          document.discordId,
        ).trim()

      const hours =
        Number(
          document.hours ?? 0,
        )

      if (
        /^\d{17,20}$/.test(
          discordId,
        ) &&
        Number.isFinite(hours)
      ) {
        group.hours.set(
          discordId,
          Math.max(0, hours),
        )
      }
    }
  }

  for (
    const group of
      activityGroups.values()
  ) {
    const hours =
      Array.from(
        group.hours.entries(),
      ).map(
        ([discordId, value]) => ({
          discordId,
          hours: value,
        }),
      )

    await activity.deleteMany({
      userId: group.userId,
      division: group.division,
    })

    await activity.insertOne({
      userId: group.userId,
      division: group.division,
      hours,
      updatedAt: new Date(),
    })
  }

  if (oldActivityIndex) {
    try {
      await activity.dropIndex(
        "activity_user_division_discord",
      )
    } catch {
      // Already removed.
    }
  }

  const finalActivityIndexes =
    await activity
      .listIndexes()
      .toArray()

  if (
    !finalActivityIndexes.some(
      (index) =>
        index.name ===
        "activity_user_division",
    )
  ) {
    await activity.createIndex(
      {
        userId: 1,
        division: 1,
      },
      {
        unique: true,
        name:
          "activity_user_division",
        partialFilterExpression: {
          userId: {
            $type: "string",
          },
        },
      },
    )
  }

  /*
   * ───────────────────────────────────────────
   * ACTIVITY REQUIREMENTS
   * ───────────────────────────────────────────
   */

  const requirementIndexes =
    await requirements
      .listIndexes()
      .toArray()

  const existingRequirementsIndex =
    requirementIndexes.find(
      (index) => {
        const key = index.key ?? {}

        return (
          key.userId === 1 &&
          key.division === 1
        )
      },
    )

  if (!existingRequirementsIndex) {
    await requirements.createIndex(
      {
        userId: 1,
        division: 1,
      },
      {
        unique: true,
        name:
          "requirements_user_division",
        partialFilterExpression: {
          userId: {
            $type: "string",
          },
        },
      },
    )
  }

  /*
   * ───────────────────────────────────────────
   * ROSTERS
   * ───────────────────────────────────────────
   */

  const rosterIndexes =
    await rosters
      .listIndexes()
      .toArray()

  const oldRosterIndexNames = [
    "roster_division_discord",
    "rosters_division_discord",
    "roster_division",
  ]

  const oldRosterIndexes =
    rosterIndexes.filter(
      (index) =>
        index.name &&
        oldRosterIndexNames.includes(
          index.name,
        ),
    )

  const rosterDocuments =
    await rosters
      .find({
        userId: {
          $type: "string",
        },
        division: {
          $type: "string",
        },
      })
      .toArray()

  const rosterGroups =
    new Map<
      string,
      {
        userId: string
        division: string
        members: Map<
          string,
          RosterMember
        >
      }
    >()

  for (
    const document of
      rosterDocuments
  ) {
    const userId =
      String(
        document.userId ?? "",
      ).trim()

    const division =
      String(
        document.division ?? "",
      ).trim()

    if (
      !userId ||
      !division
    ) {
      continue
    }

    const key =
      `${userId}::${division}`

    if (!rosterGroups.has(key)) {
      rosterGroups.set(key, {
        userId,
        division,
        members: new Map(),
      })
    }

    const group =
      rosterGroups.get(key)!

    if (
      Array.isArray(
        document.members,
      )
    ) {
      for (
        const rawMember of
          document.members
      ) {
        if (
          !rawMember ||
          typeof rawMember !==
            "object"
        ) {
          continue
        }

        const member =
          rawMember as Partial<RosterMember>

        const discordId =
          String(
            member.discordId ?? "",
          ).trim()

        if (!discordId) {
          continue
        }

        group.members.set(
          discordId,
          {
            callsign:
              String(
                member.callsign ??
                  "",
              ).trim(),

            badgeNumber:
              String(
                member.badgeNumber ??
                  "",
              ).trim(),

            name:
              String(
                member.name ?? "",
              ).trim(),

            rank:
              String(
                member.rank ?? "",
              ).trim(),

            timeInDept:
              String(
                member.timeInDept ??
                  "",
              ).trim(),

            timeInRank:
              String(
                member.timeInRank ??
                  "",
              ).trim(),

            discordId,

            status:
              String(
                member.status ?? "",
              ).trim(),
          },
        )
      }
    }

    const legacyDiscordId =
      String(
        document.discordId ?? "",
      ).trim()

    if (legacyDiscordId) {
      group.members.set(
        legacyDiscordId,
        {
          callsign:
            String(
              document.callsign ??
                "",
            ).trim(),

          badgeNumber:
            String(
              document.badgeNumber ??
                "",
            ).trim(),

          name:
            String(
              document.name ?? "",
            ).trim(),

          rank:
            String(
              document.rank ?? "",
            ).trim(),

          timeInDept:
            String(
              document.timeInDept ??
                "",
            ).trim(),

          timeInRank:
            String(
              document.timeInRank ??
                "",
            ).trim(),

          discordId:
            legacyDiscordId,

          status:
            String(
              document.status ?? "",
            ).trim(),
        },
      )
    }
  }

  for (
    const group of
      rosterGroups.values()
  ) {
    const members =
      Array.from(
        group.members.values(),
      )

    await rosters.deleteMany({
      userId: group.userId,
      division: group.division,
    })

    if (
      VALID_IMPORT_DIVISIONS.includes(
        group.division as ImportDivision,
      )
    ) {
      await rosters.insertOne({
        userId: group.userId,
        division:
          group.division as ImportDivision,
        members,
        updatedAt: new Date(),
      })
    }
  }

  for (
    const index of
      oldRosterIndexes
  ) {
    if (!index.name) {
      continue
    }

    try {
      await rosters.dropIndex(
        index.name,
      )
    } catch {
      // Already removed.
    }
  }

  const finalRosterIndexes =
    await rosters
      .listIndexes()
      .toArray()

  if (
    !finalRosterIndexes.some(
      (index) =>
        index.name ===
        "rosters_user_division",
    )
  ) {
    await rosters.createIndex(
      {
        userId: 1,
        division: 1,
      },
      {
        unique: true,
        name:
          "rosters_user_division",
        partialFilterExpression: {
          userId: {
            $type: "string",
          },
        },
      },
    )
  }

  /*
   * ───────────────────────────────────────────
   * PROMOTION
   * ───────────────────────────────────────────
   *
   * Promotion is intentionally separate from
   * Activity.
   *
   * One document:
   *
   * userId + division
   *
   * points:
   * [
   *   {
   *     discordId,
   *     points
   *   }
   * ]
   */

  const promotionIndexes =
    await promotions
      .listIndexes()
      .toArray()

  const oldPromotionIndex =
    promotionIndexes.some(
      (index) =>
        index.name ===
        "promotion_user_division_discord",
    )

  const promotionDocuments =
    await promotions
      .find({
        userId: {
          $type: "string",
        },
        division: {
          $type: "string",
        },
      })
      .toArray()

  const promotionGroups =
    new Map<
      string,
      {
        userId: string
        division: string
        points: Map<string, number>
      }
    >()

  for (
    const document of
      promotionDocuments
  ) {
    const userId =
      String(
        document.userId ?? "",
      ).trim()

    const division =
      String(
        document.division ?? "",
      ).trim()

    if (
      !userId ||
      !division
    ) {
      continue
    }

    const key =
      `${userId}::${division}`

    if (!promotionGroups.has(key)) {
      promotionGroups.set(key, {
        userId,
        division,
        points: new Map(),
      })
    }

    const group =
      promotionGroups.get(key)!

    /*
     * New format.
     */
    if (
      Array.isArray(
        document.points,
      )
    ) {
      for (
        const item of document.points
      ) {
        if (
          !item ||
          typeof item !== "object"
        ) {
          continue
        }

        const discordId =
          String(
            (
              item as {
                discordId?: unknown
              }
            ).discordId ?? "",
          ).trim()

        const points =
          Number(
            (
              item as {
                points?: unknown
              }
            ).points ?? 0,
          )

        if (
          /^\d{17,20}$/.test(
            discordId,
          ) &&
          Number.isFinite(points)
        ) {
          group.points.set(
            discordId,
            Math.max(0, points),
          )
        }
      }
    }

    /*
     * Legacy format.
     *
     * This also allows the collection to be
     * safely migrated if an older promotion
     * implementation stored one Discord ID
     * per document.
     */
    if (document.discordId) {
      const discordId =
        String(
          document.discordId,
        ).trim()

      const points =
        Number(
          document.points ?? 0,
        )

      if (
        /^\d{17,20}$/.test(
          discordId,
        ) &&
        Number.isFinite(points)
      ) {
        group.points.set(
          discordId,
          Math.max(0, points),
        )
      }
    }
  }

  for (
    const group of
      promotionGroups.values()
  ) {
    const points =
      Array.from(
        group.points.entries(),
      ).map(
        ([discordId, value]) => ({
          discordId,
          points: value,
        }),
      )

    await promotions.deleteMany({
      userId: group.userId,
      division: group.division,
    })

    if (
      VALID_IMPORT_DIVISIONS.includes(
        group.division as ImportDivision,
      )
    ) {
      await promotions.insertOne({
        userId: group.userId,
        division:
          group.division as ImportDivision,
        points,
        updatedAt: new Date(),
      })
    }
  }

  if (oldPromotionIndex) {
    try {
      await promotions.dropIndex(
        "promotion_user_division_discord",
      )
    } catch {
      // Already removed.
    }
  }

  const finalPromotionIndexes =
    await promotions
      .listIndexes()
      .toArray()

  if (
    !finalPromotionIndexes.some(
      (index) =>
        index.name ===
        "promotions_user_division",
    )
  ) {
    await promotions.createIndex(
      {
        userId: 1,
        division: 1,
      },
      {
        unique: true,
        name:
          "promotions_user_division",
        partialFilterExpression: {
          userId: {
            $type: "string",
          },
        },
      },
    )
  }

  /*
   * ───────────────────────────────────────────
   * PROMOTION REQUIREMENTS
   * ───────────────────────────────────────────
   */

  const promotionRequirementIndexes =
    await promotionRequirements
      .listIndexes()
      .toArray()

  const existingPromotionRequirementsIndex =
    promotionRequirementIndexes.find(
      (index) => {
        const key = index.key ?? {}

        return (
          key.userId === 1 &&
          key.division === 1
        )
      },
    )

  if (
    !existingPromotionRequirementsIndex
  ) {
    await promotionRequirements.createIndex(
      {
        userId: 1,
        division: 1,
      },
      {
        unique: true,
        name:
          "promotion_requirements_user_division",
        partialFilterExpression: {
          userId: {
            $type: "string",
          },
        },
      },
    )
  }

  console.log(
    "MongoDB Activity + Promotion indexes ready.",
  )
}

/* ─────────────────────────────────────────────
   User Helpers
───────────────────────────────────────────── */

function getAuthenticatedUserId(
  user: Awaited<
    ReturnType<typeof getRequestUser>
  >,
): string {
  return String(
    user?.discordId ?? "",
  ).trim()
}

/* ─────────────────────────────────────────────
   Roster Helpers
───────────────────────────────────────────── */

async function readRosterImport(
  userId: string,
  division: ImportDivision,
): Promise<RosterImport> {
  const collection =
    await getCollection<RosterDocument>(
      "rosters",
    )

  const document =
    await collection.findOne({
      userId,
      division,
    })

  return {
    division,

    members:
      Array.isArray(
        document?.members,
      )
        ? document.members.map(
            (member) => ({
              callsign:
                member.callsign ?? "",

              badgeNumber:
                member.badgeNumber ?? "",

              name:
                member.name ?? "",

              rank:
                member.rank ?? "",

              timeInDept:
                member.timeInDept ?? "",

              timeInRank:
                member.timeInRank ?? "",

              discordId:
                member.discordId ?? "",

              status:
                member.status ?? "",
            }),
          )
        : [],
  }
}

async function readActivityRoster(
  userId: string,
  division: ImportDivision,
): Promise<RosterImport> {
  return readRosterImport(
    userId,
    division,
  )
}

/* ─────────────────────────────────────────────
   Roster Parsing
───────────────────────────────────────────── */

function parseRosterText(
  data: string,
): RosterMember[] {
  const lines = data
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const members: RosterMember[] = []

  for (const line of lines) {
    const lowerLine =
      line.toLowerCase()

    if (
      lowerLine.includes("callsign") &&
      lowerLine.includes("discord id")
    ) {
      continue
    }

    const columns = line.includes("\t")
      ? line.split("\t")
      : line.split(",")

    if (columns.length < 8) {
      continue
    }

    const clean = (
      value: unknown,
    ) =>
      String(value ?? "")
        .trim()
        .replace(
          /^["']|["']$/g,
          "",
        )

    const callsign =
      clean(columns[0])

    const badgeNumber =
      clean(columns[1])

    const name =
      clean(columns[2])

    const rank =
      clean(columns[3])

    const timeInDept =
      clean(columns[4])

    const timeInRank =
      clean(columns[5])

    const discordId =
      clean(columns[6])

    const status =
      clean(columns[7])

    if (
      discordId &&
      !/^\d{17,20}$/.test(
        discordId,
      )
    ) {
      continue
    }

    if (
      !callsign &&
      !badgeNumber &&
      !name &&
      !discordId
    ) {
      continue
    }

    members.push({
      callsign,
      badgeNumber,
      name,
      rank,
      timeInDept,
      timeInRank,
      discordId,
      status,
    })
  }

  return members
}

function parseRosterSpreadsheet(
  buffer: Buffer,
): RosterMember[] {
  const workbook =
    XLSX.read(buffer, {
      type: "buffer",
    })

  const sheetName =
    workbook.SheetNames[0]

  if (!sheetName) {
    return []
  }

  const sheet =
    workbook.Sheets[sheetName]

  const rows =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(sheet, {
      header: 1,
      defval: "",
    })

  const text = rows
    .map((row) =>
      row
        .map((value) =>
          String(value ?? ""),
        )
        .join("\t"),
    )
    .join("\n")

  return parseRosterText(text)
}

/* ─────────────────────────────────────────────
   Activity Import Helpers
───────────────────────────────────────────── */

async function readActivityImport(
  userId: string,
  division: ImportDivision,
): Promise<ActivityImport> {
  const collection =
    await getCollection<ActivityDocument>(
      "activity",
    )

  const document =
    await collection.findOne({
      userId,
      division,
    })

  const hours =
    Array.isArray(
      document?.hours,
    )
      ? document.hours
          .map((item) => ({
            discordId: String(
              item?.discordId ?? "",
            ).trim(),

            hours: Math.max(
              0,
              Number(
                item?.hours ?? 0,
              ) || 0,
            ),
          }))
          .filter(
            (item) =>
              /^\d{17,20}$/.test(
                item.discordId,
              ),
          )
      : []

  return {
    division,
    hours,
  }
}

async function writeActivityImport(
  userId: string,
  division: ImportDivision,
  data: ActivityImport,
) {
  const collection =
    await getCollection<ActivityDocument>(
      "activity",
    )

  const hours =
    data.hours
      .map((item) => ({
        discordId: String(
          item.discordId ?? "",
        ).trim(),

        hours: Math.max(
          0,
          Number(
            item.hours ?? 0,
          ) || 0,
        ),
      }))
      .filter(
        (item) =>
          /^\d{17,20}$/.test(
            item.discordId,
          ),
      )

  await collection.updateOne(
    {
      userId,
      division,
    },
    {
      $set: {
        userId,
        division,
        hours,
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
    },
  )
}

function parseActivityText(
  data: string,
): Array<[string, number]> {
  const lines = data
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows: Array<
    [string, number]
  > = []

  for (const line of lines) {
    const lowerLine =
      line.toLowerCase()

    if (
      lowerLine.includes(
        "discord id",
      ) &&
      lowerLine.includes("hour")
    ) {
      continue
    }

    const columns = line.includes("\t")
      ? line.split("\t")
      : line.split(",")

    if (columns.length < 2) {
      continue
    }

    const discordId =
      columns[0]
        .trim()
        .replace(
          /^["']|["']$/g,
          "",
        )

    const hoursText =
      columns
        .slice(1)
        .join(" ")
        .trim()
        .replace(
          /^["']|["']$/g,
          "",
        )

    const hours = Number(
      hoursText.replace(
        /[^\d.-]/g,
        "",
      ),
    )

    if (
      !/^\d{17,20}$/.test(
        discordId,
      )
    ) {
      continue
    }

    if (
      !Number.isFinite(hours)
    ) {
      continue
    }

    rows.push([
      discordId,
      Math.max(0, hours),
    ])
  }

  return rows
}

function parseActivitySpreadsheet(
  buffer: Buffer,
): Array<[string, number]> {
  const workbook =
    XLSX.read(buffer, {
      type: "buffer",
    })

  const sheetName =
    workbook.SheetNames[0]

  if (!sheetName) {
    return []
  }

  const sheet =
    workbook.Sheets[sheetName]

  const rows =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(sheet, {
      header: 1,
      defval: "",
    })

  const text = rows
    .map((row) =>
      row
        .map((value) =>
          String(value ?? ""),
        )
        .join("\t"),
    )
    .join("\n")

  return parseActivityText(text)
}

/* ─────────────────────────────────────────────
   Promotion Import Helpers
───────────────────────────────────────────── */

async function readPromotionImport(
  userId: string,
  division: ImportDivision,
): Promise<PromotionImport> {
  const collection =
    await getCollection<PromotionDocument>(
      "promotions",
    )

  const document =
    await collection.findOne({
      userId,
      division,
    })

  const points =
    Array.isArray(
      document?.points,
    )
      ? document.points
          .map((item) => ({
            discordId: String(
              item?.discordId ?? "",
            ).trim(),

            points: Math.max(
              0,
              Number(
                item?.points ?? 0,
              ) || 0,
            ),
          }))
          .filter(
            (item) =>
              /^\d{17,20}$/.test(
                item.discordId,
              ),
          )
      : []

  return {
    division,
    points,
  }
}

async function writePromotionImport(
  userId: string,
  division: ImportDivision,
  data: PromotionImport,
) {
  const collection =
    await getCollection<PromotionDocument>(
      "promotions",
    )

  const points =
    data.points
      .map((item) => ({
        discordId: String(
          item.discordId ?? "",
        ).trim(),

        points: Math.max(
          0,
          Number(
            item.points ?? 0,
          ) || 0,
        ),
      }))
      .filter(
        (item) =>
          /^\d{17,20}$/.test(
            item.discordId,
          ),
      )

  await collection.updateOne(
    {
      userId,
      division,
    },
    {
      $set: {
        userId,
        division,
        points,
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
    },
  )
}

function parsePromotionText(
  data: string,
): Array<[string, number]> {
  const lines = data
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows: Array<
    [string, number]
  > = []

  for (const line of lines) {
    const lowerLine =
      line.toLowerCase()

    if (
      lowerLine.includes(
        "discord id",
      ) &&
      (
        lowerLine.includes("point") ||
        lowerLine.includes("promotion")
      )
    ) {
      continue
    }

    const columns = line.includes("\t")
      ? line.split("\t")
      : line.split(",")

    if (columns.length < 2) {
      continue
    }

    const discordId =
      columns[0]
        .trim()
        .replace(
          /^["']|["']$/g,
          "",
        )

    const pointsText =
      columns
        .slice(1)
        .join(" ")
        .trim()
        .replace(
          /^["']|["']$/g,
          "",
        )

    const points = Number(
      pointsText.replace(
        /[^\d.-]/g,
        "",
      ),
    )

    if (
      !/^\d{17,20}$/.test(
        discordId,
      )
    ) {
      continue
    }

    if (
      !Number.isFinite(points)
    ) {
      continue
    }

    rows.push([
      discordId,
      Math.max(0, points),
    ])
  }

  return rows
}

function parsePromotionSpreadsheet(
  buffer: Buffer,
): Array<[string, number]> {
  const workbook =
    XLSX.read(buffer, {
      type: "buffer",
    })

  const sheetName =
    workbook.SheetNames[0]

  if (!sheetName) {
    return []
  }

  const sheet =
    workbook.Sheets[sheetName]

  const rows =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(sheet, {
      header: 1,
      defval: "",
    })

  const text = rows
    .map((row) =>
      row
        .map((value) =>
          String(value ?? ""),
        )
        .join("\t"),
    )
    .join("\n")

  return parsePromotionText(text)
}

/* ─────────────────────────────────────────────
   Rank Configuration
───────────────────────────────────────────── */

async function readRankConfig(
  division: RequirementDivision,
): Promise<RankConfig> {
  const collection =
    await getCollection<
      RankConfig & {
        division: string
        updatedAt?: Date
      }
    >("rankConfigs")

  const document =
    await collection.findOne({
      division,
    })

  return {
    department:
      document?.department ??
      division,

    ranks:
      Array.isArray(
        document?.ranks,
      )
        ? document.ranks
            .map(
              (rank) => ({
                id: String(
                  rank?.id ?? "",
                ).trim(),

                name: String(
                  rank?.name ?? "",
                ).trim(),
              }),
            )
            .filter(
              (rank) =>
                rank.id.length > 0 &&
                rank.name.length > 0,
            )
        : [],
  }
}

async function readPromotionRankConfig(
  division: RequirementDivision,
): Promise<RankConfig> {
  const collection =
    await getCollection<
      RankConfig & {
        division: string
        updatedAt?: Date
      }
    >("promotionRankConfigs")

  const document =
    await collection.findOne({
      division,
    })

  return {
    department:
      document?.department ??
      division,

    ranks:
      Array.isArray(
        document?.ranks,
      )
        ? document.ranks
            .map(
              (rank) => ({
                id: String(
                  rank?.id ?? "",
                ).trim(),

                name: String(
                  rank?.name ?? "",
                ).trim(),
              }),
            )
            .filter(
              (rank) =>
                rank.id.length > 0 &&
                rank.name.length > 0,
            )
        : [],
  }
}

function findRankById(
  rankConfig: RankConfig,
  rankId: string,
): RankDefinition | undefined {
  const cleanId =
    String(rankId ?? "")
      .trim()
      .toLowerCase()

  if (!cleanId) {
    return undefined
  }

  return rankConfig.ranks.find(
    (rank) =>
      rank.id
        .trim()
        .toLowerCase() ===
      cleanId,
  )
}

/* ─────────────────────────────────────────────
   Activity Requirements
───────────────────────────────────────────── */

async function readActivityRequirements(
  userId: string,
  division: RequirementDivision,
): Promise<ActivityRequirements> {
  const collection =
    await getCollection<ActivityRequirementsDocument>(
      "activityRequirements",
    )

  const document =
    await collection.findOne({
      userId,
      division,
    })

  const rawRequirements =
    document?.requirements ?? {}

  const requirements: Record<
    string,
    ActivityRequirement
  > = {}

  const rankConfig =
    await readRankConfig(
      division,
    )

  for (const [
    rankId,
    value,
  ] of Object.entries(
    rawRequirements,
  )) {
    const item =
      value as Partial<ActivityRequirement>

    const cleanRankId =
      String(
        item.rankId ??
          rankId,
      ).trim()

    if (!cleanRankId) {
      continue
    }

    const configuredRank =
      findRankById(
        rankConfig,
        cleanRankId,
      )

    const storedRankName =
      String(
        item.rankName ?? "",
      ).trim()

    const rankName =
      configuredRank?.name ||
      storedRankName ||
      cleanRankId

    const hours =
      Number(
        item.hours ?? 0,
      )

    const timeInRankDays =
      Number(
        item.timeInRankDays ?? 0,
      )

    const trainingLogs =
      Number(
        item.trainingLogs ?? 0,
      )

    const recruitmentLogs =
      Number(
        item.recruitmentLogs ?? 0,
      )

    requirements[
      cleanRankId
    ] = {
      rankId:
        cleanRankId,

      rankName,

      hours:
        Number.isFinite(hours)
          ? Math.max(
              0,
              Math.floor(hours),
            )
          : 0,

      timeInRankDays:
        Number.isFinite(timeInRankDays)
          ? Math.max(
              0,
              Math.floor(timeInRankDays),
            )
          : 0,

      trainingLogs:
        Number.isFinite(trainingLogs)
          ? Math.max(
              0,
              Math.floor(trainingLogs),
            )
          : 0,

      recruitmentLogs:
        Number.isFinite(recruitmentLogs)
          ? Math.max(
              0,
              Math.floor(recruitmentLogs),
            )
          : 0,
    }
  }

  return {
    division,
    requirements,
  }
}

async function writeActivityRequirements(
  userId: string,
  division: RequirementDivision,
  requirements: Record<
    string,
    ActivityRequirement
  >,
) {
  const collection =
    await getCollection<ActivityRequirementsDocument>(
      "activityRequirements",
    )

  const existing =
    await collection.findOne({
      userId,
      division,
    })

  const existingRequirements =
    existing?.requirements ?? {}

  const rankConfig =
    await readRankConfig(
      division,
    )

  const normalizedRequirements: Record<
    string,
    ActivityRequirement
  > = {}

  for (const [
    rankId,
    value,
  ] of Object.entries(
    requirements,
  )) {
    const input =
      value as Partial<ActivityRequirement>

    const cleanRankId =
      String(
        input.rankId ??
          rankId,
      ).trim()

    if (!cleanRankId) {
      continue
    }

    const configuredRank =
      findRankById(
        rankConfig,
        cleanRankId,
      )

    const existingRequirement =
      existingRequirements[
        cleanRankId
      ] as
        | ActivityRequirement
        | undefined

    const suppliedRankName =
      String(
        input.rankName ??
          "",
      ).trim()

    const rankName =
      configuredRank?.name ||
      suppliedRankName ||
      existingRequirement?.rankName ||
      cleanRankId

    const hours =
      Number(
        input.hours ??
          existingRequirement?.hours ??
          0,
      )

    const timeInRankDays =
      Number(
        input.timeInRankDays ??
          existingRequirement?.timeInRankDays ??
          0,
      )

    const trainingLogs =
      Number(
        input.trainingLogs ??
          existingRequirement?.trainingLogs ??
          0,
      )

    const recruitmentLogs =
      Number(
        input.recruitmentLogs ??
          existingRequirement?.recruitmentLogs ??
          0,
      )

    normalizedRequirements[
      cleanRankId
    ] = {
      rankId:
        cleanRankId,

      rankName,

      hours:
        Number.isFinite(hours)
          ? Math.max(
              0,
              Math.floor(hours),
            )
          : 0,

      timeInRankDays:
        Number.isFinite(timeInRankDays)
          ? Math.max(
              0,
              Math.floor(timeInRankDays),
            )
          : 0,

      trainingLogs:
        Number.isFinite(trainingLogs)
          ? Math.max(
              0,
              Math.floor(trainingLogs),
            )
          : 0,

      recruitmentLogs:
        Number.isFinite(recruitmentLogs)
          ? Math.max(
              0,
              Math.floor(recruitmentLogs),
            )
          : 0,
    }
  }

  await collection.updateOne(
    {
      userId,
      division,
    },
    {
      $set: {
        userId,
        division,
        requirements:
          normalizedRequirements,
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
    },
  )

  return {
    division,
    requirements:
      normalizedRequirements,
  }
}

function getRequiredHoursForRank(
  rankName: string,
  rankConfig: RankConfig,
  requirements: ActivityRequirements,
): number {
  const cleanRankName =
    String(rankName ?? "")
      .trim()
      .toLowerCase()

  if (!cleanRankName) {
    return 0
  }

  const storedRequirement =
    Object.values(
      requirements.requirements,
    ).find(
      (requirement) =>
        requirement.rankName
          .trim()
          .toLowerCase() ===
        cleanRankName,
    )

  if (storedRequirement) {
    const hours =
      Number(
        storedRequirement.hours,
      )

    return Number.isFinite(hours)
      ? Math.max(0, hours)
      : 0
  }

  const configuredRank =
    rankConfig.ranks.find(
      (rank) =>
        rank.name
          .trim()
          .toLowerCase() ===
        cleanRankName,
    )

  if (!configuredRank) {
    return 0
  }

  const requirement =
    requirements.requirements[
      configuredRank.id
    ]

  if (!requirement) {
    return 0
  }

  const hours =
    Number(
      requirement.hours,
    )

  return Number.isFinite(hours)
    ? Math.max(0, hours)
    : 0
}

/* ─────────────────────────────────────────────
   Promotion Requirements
───────────────────────────────────────────── */

async function readPromotionRequirements(
  userId: string,
  division: RequirementDivision,
): Promise<PromotionRequirements> {
  const collection =
    await getCollection<PromotionRequirementsDocument>(
      "promotionRequirements",
    )

  const document =
    await collection.findOne({
      userId,
      division,
    })

  const rawRequirements =
    document?.requirements ?? {}

  const requirements: Record<
    string,
    PromotionRequirement
  > = {}

  const rankConfig =
    await readPromotionRankConfig(
      division,
    )

  for (const [
    rankId,
    value,
  ] of Object.entries(
    rawRequirements,
  )) {
    const item =
      value as Partial<PromotionRequirement>

    const cleanRankId =
      String(
        item.rankId ??
          rankId,
      ).trim()

    if (!cleanRankId) {
      continue
    }

    const configuredRank =
      findRankById(
        rankConfig,
        cleanRankId,
      )

    const storedRankName =
      String(
        item.rankName ?? "",
      ).trim()

    const rankName =
      configuredRank?.name ||
      storedRankName ||
      cleanRankId

    const points =
      Number(
        item.points ?? 0,
      )

    requirements[
      cleanRankId
    ] = {
      rankId:
        cleanRankId,

      rankName,

      points:
        Number.isFinite(points)
          ? Math.max(
              0,
              Math.floor(points),
            )
          : 0,
    }
  }

  return {
    division,
    requirements,
  }
}

async function writePromotionRequirements(
  userId: string,
  division: RequirementDivision,
  requirements: Record<
    string,
    PromotionRequirement
  >,
) {
  const collection =
    await getCollection<PromotionRequirementsDocument>(
      "promotionRequirements",
    )

  const existing =
    await collection.findOne({
      userId,
      division,
    })

  const existingRequirements =
    existing?.requirements ?? {}

  const rankConfig =
    await readPromotionRankConfig(
      division,
    )

  const normalizedRequirements: Record<
    string,
    PromotionRequirement
  > = {}

  for (const [
    rankId,
    value,
  ] of Object.entries(
    requirements,
  )) {
    const input =
      value as Partial<PromotionRequirement>

    const cleanRankId =
      String(
        input.rankId ??
          rankId,
      ).trim()

    if (!cleanRankId) {
      continue
    }

    const configuredRank =
      findRankById(
        rankConfig,
        cleanRankId,
      )

    const existingRequirement =
      existingRequirements[
        cleanRankId
      ] as
        | PromotionRequirement
        | undefined

    const suppliedRankName =
      String(
        input.rankName ??
          "",
      ).trim()

    const rankName =
      configuredRank?.name ||
      suppliedRankName ||
      existingRequirement?.rankName ||
      cleanRankId

    const points =
      Number(
        input.points ?? 0,
      )

    normalizedRequirements[
      cleanRankId
    ] = {
      rankId:
        cleanRankId,

      rankName,

      points:
        Number.isFinite(points)
          ? Math.max(
              0,
              Math.floor(points),
            )
          : 0,
    }
  }

  await collection.updateOne(
    {
      userId,
      division,
    },
    {
      $set: {
        userId,
        division,
        requirements:
          normalizedRequirements,
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
    },
  )

  return {
    division,
    requirements:
      normalizedRequirements,
  }
}

function getRequiredPromotionPointsForRank(
  rankName: string,
  rankConfig: RankConfig,
  requirements: PromotionRequirements,
): number {
  const cleanRankName =
    String(rankName ?? "")
      .trim()
      .toLowerCase()

  if (!cleanRankName) {
    return 0
  }

  const storedRequirement =
    Object.values(
      requirements.requirements,
    ).find(
      (requirement) =>
        requirement.rankName
          .trim()
          .toLowerCase() ===
        cleanRankName,
    )

  if (storedRequirement) {
    const points =
      Number(
        storedRequirement.points,
      )

    return Number.isFinite(points)
      ? Math.max(0, points)
      : 0
  }

  const configuredRank =
    rankConfig.ranks.find(
      (rank) =>
        rank.name
          .trim()
          .toLowerCase() ===
        cleanRankName,
    )

  if (!configuredRank) {
    return 0
  }

  const requirement =
    requirements.requirements[
      configuredRank.id
    ]

  if (!requirement) {
    return 0
  }

  const points =
    Number(
      requirement.points,
    )

  return Number.isFinite(points)
    ? Math.max(0, points)
    : 0
}

/* ─────────────────────────────────────────────
   Activity Import Handler
───────────────────────────────────────────── */

async function handleActivityImport(
  division: ImportDivision,
  req: express.Request,
  res: express.Response,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      })
    }

    const userId =
      getAuthenticatedUserId(user)

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "Authenticated user does not have a Discord ID.",
      })
    }

    let rows: Array<
      [string, number]
    > = []

    if (req.file) {
      const extension =
        path
          .extname(
            req.file.originalname,
          )
          .toLowerCase()

      if (
        extension === ".xlsx" ||
        extension === ".xls"
      ) {
        rows =
          parseActivitySpreadsheet(
            req.file.buffer,
          )
      } else {
        rows =
          parseActivityText(
            req.file.buffer.toString(
              "utf8",
            ),
          )
      }
    } else {
      const data =
        req.body?.data

      if (
        typeof data !== "string" ||
        !data.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "No import data was provided.",
        })
      }

      rows =
        parseActivityText(data)
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          `No valid Discord ID and Hours rows were found for ${division}.`,
      })
    }

    const existing =
      await readActivityImport(
        userId,
        division,
      )

    const hoursByDiscordId =
      new Map<string, number>()

    for (
      const item of existing.hours
    ) {
      hoursByDiscordId.set(
        item.discordId,
        item.hours,
      )
    }

    let added = 0
    let updated = 0

    for (
      const [
        discordId,
        hours,
      ] of rows
    ) {
      if (
        hoursByDiscordId.has(
          discordId,
        )
      ) {
        updated++
      } else {
        added++
      }

      hoursByDiscordId.set(
        discordId,
        hours,
      )
    }

    const hours =
      Array.from(
        hoursByDiscordId.entries(),
      ).map(
        ([discordId, value]) => ({
          discordId,
          hours: value,
        }),
      )

    await writeActivityImport(
      userId,
      division,
      {
        division,
        hours,
      },
    )

    logAction(user, {
      module: "activity",
      action: "import-activity",
      status: "imported",
      division,
      summary:
        `${division.toUpperCase()} activity import updated ` +
        `${hours.length} members.`,
      details: {
        added,
        updated,
        imported: rows.length,
        totalMembers: hours.length,
      },
      path: req.path,
    })

    return res.json({
      success: true,

      message:
        `${division.toUpperCase()} import successful. ` +
        `${added} added, ` +
        `${updated} updated. ` +
        `${hours.length} total members.`,

      added,
      updated,
      imported: rows.length,
      totalMembers: hours.length,
    })
  } catch (error) {
    console.error(
      `${division} import error:`,
      error,
    )

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `${division.toUpperCase()} import failed.`,
    })
  }
}

/* ─────────────────────────────────────────────
   Promotion Import Handler
───────────────────────────────────────────── */

async function handlePromotionImport(
  division: ImportDivision,
  req: express.Request,
  res: express.Response,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      })
    }

    const userId =
      getAuthenticatedUserId(user)

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "Authenticated user does not have a Discord ID.",
      })
    }

    let rows: Array<
      [string, number]
    > = []

    if (req.file) {
      const extension =
        path
          .extname(
            req.file.originalname,
          )
          .toLowerCase()

      if (
        extension === ".xlsx" ||
        extension === ".xls"
      ) {
        rows =
          parsePromotionSpreadsheet(
            req.file.buffer,
          )
      } else {
        rows =
          parsePromotionText(
            req.file.buffer.toString(
              "utf8",
            ),
          )
      }
    } else {
      const data =
        req.body?.data

      if (
        typeof data !== "string" ||
        !data.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "No promotion data was provided.",
        })
      }

      rows =
        parsePromotionText(data)
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          `No valid Discord ID and Promotion Points rows were found for ${division}.`,
      })
    }

    const existing =
      await readPromotionImport(
        userId,
        division,
      )

    const pointsByDiscordId =
      new Map<string, number>()

    for (
      const item of existing.points
    ) {
      pointsByDiscordId.set(
        item.discordId,
        item.points,
      )
    }

    let added = 0
    let updated = 0

    for (
      const [
        discordId,
        points,
      ] of rows
    ) {
      if (
        pointsByDiscordId.has(
          discordId,
        )
      ) {
        updated++
      } else {
        added++
      }

      pointsByDiscordId.set(
        discordId,
        points,
      )
    }

    const points =
      Array.from(
        pointsByDiscordId.entries(),
      ).map(
        ([discordId, value]) => ({
          discordId,
          points: value,
        }),
      )

    await writePromotionImport(
      userId,
      division,
      {
        division,
        points,
      },
    )

    logAction(user, {
      module: "promotion",
      action: "import-promotion",
      status: "imported",
      division,
      summary:
        `${division.toUpperCase()} promotion import updated ` +
        `${points.length} members.`,
      details: {
        added,
        updated,
        imported: rows.length,
        totalMembers: points.length,
      },
      path: req.path,
    })

    return res.json({
      success: true,

      message:
        `${division.toUpperCase()} promotion import successful. ` +
        `${added} added, ` +
        `${updated} updated. ` +
        `${points.length} total members.`,

      added,
      updated,
      imported: rows.length,
      totalMembers: points.length,
    })
  } catch (error) {
    console.error(
      `${division} promotion import error:`,
      error,
    )

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `${division.toUpperCase()} promotion import failed.`,
    })
  }
}

/* ─────────────────────────────────────────────
   Activity Requirements Save
───────────────────────────────────────────── */

async function handleActivityRequirementsSave(
  req: express.Request,
  res: express.Response,
  division: RequirementDivision,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const userId =
      getAuthenticatedUserId(user)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user does not have a Discord ID.",
      })
    }

    const body = req.body

    if (
      !body ||
      typeof body !== "object" ||
      !body.requirements ||
      typeof body.requirements !==
        "object"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid requirements data.",
      })
    }

    const requirements: Record<
      string,
      ActivityRequirement
    > = {}

    for (const [
      rankId,
      value,
    ] of Object.entries(
      body.requirements,
    )) {
      if (
        !value ||
        typeof value !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid requirement for rank: ${rankId}`,
        })
      }

      const input =
        value as {
          rankId?: unknown
          rankName?: unknown
          name?: unknown
          hours?: unknown
          timeInRankDays?: unknown
          trainingLogs?: unknown
          recruitmentLogs?: unknown
        }

      const hours =
        Number(input.hours ?? 0)

      const timeInRankDays =
        Number(input.timeInRankDays ?? 0)

      const trainingLogs =
        Number(input.trainingLogs ?? 0)

      const recruitmentLogs =
        Number(input.recruitmentLogs ?? 0)

      if (
        !Number.isFinite(hours) ||
        hours < 0 ||
        !Number.isFinite(timeInRankDays) ||
        timeInRankDays < 0 ||
        !Number.isFinite(trainingLogs) ||
        trainingLogs < 0 ||
        !Number.isFinite(recruitmentLogs) ||
        recruitmentLogs < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid requirement values for rank: ${rankId}`,
        })
      }

      const cleanRankId =
        String(
          input.rankId ??
            rankId,
        ).trim()

      if (!cleanRankId) {
        return res.status(400).json({
          success: false,
          message:
            "A rank ID is required.",
        })
      }

      const rankName =
        String(
          input.rankName ??
            input.name ??
            "",
        ).trim()

      requirements[
        cleanRankId
      ] = {
        rankId:
          cleanRankId,

        rankName,

        hours:
          Math.floor(hours),

        timeInRankDays:
          Math.floor(timeInRankDays),

        trainingLogs:
          Math.floor(trainingLogs),

        recruitmentLogs:
          Math.floor(recruitmentLogs),
      }
    }

    const saved =
      await writeActivityRequirements(
        userId,
        division,
        requirements,
      )

    logAction(user, {
      module: "activity",
      action: "update-requirements",
      status: "updated",
      division,
      summary:
        `${division.toUpperCase()} activity requirements were updated.`,
      details: {
        ranksConfigured:
          Object.keys(
            requirements,
          ).length,
        ranks: Object.values(
          requirements,
        ).map((item) => ({
          rank:
            item.rankName ||
            item.rankId,
          hours: item.hours,
          timeInRankDays:
            item.timeInRankDays,
          trainingLogs:
            item.trainingLogs,
          recruitmentLogs:
            item.recruitmentLogs,
        })),
      },
      path: req.path,
    })

    return res.json({
      success: true,

      message:
        `${division.toUpperCase()} requirements saved successfully.`,

      requirements:
        saved.requirements,
    })
  } catch (error) {
    console.error(
      `[requirements] Failed to save ${division} requirements:`,
      error,
    )

    return res.status(500).json({
      success: false,
      message:
        "Failed to save requirements.",
    })
  }
}

/* ─────────────────────────────────────────────
   Promotion Requirements Save
───────────────────────────────────────────── */

async function handlePromotionRequirementsSave(
  req: express.Request,
  res: express.Response,
  division: RequirementDivision,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const userId =
      getAuthenticatedUserId(user)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user does not have a Discord ID.",
      })
    }

    const body = req.body

    if (
      !body ||
      typeof body !== "object" ||
      !body.requirements ||
      typeof body.requirements !==
        "object"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid promotion requirements data.",
      })
    }

    const requirements: Record<
      string,
      PromotionRequirement
    > = {}

    for (const [
      rankId,
      value,
    ] of Object.entries(
      body.requirements,
    )) {
      if (
        !value ||
        typeof value !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid promotion requirement for rank: ${rankId}`,
        })
      }

      const input =
        value as {
          rankId?: unknown
          rankName?: unknown
          name?: unknown
          points?: unknown
        }

      const points =
        Number(input.points)

      if (
        !Number.isFinite(points) ||
        points < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid promotion points for rank: ${rankId}`,
        })
      }

      const cleanRankId =
        String(
          input.rankId ??
            rankId,
        ).trim()

      if (!cleanRankId) {
        return res.status(400).json({
          success: false,
          message:
            "A rank ID is required.",
        })
      }

      const rankName =
        String(
          input.rankName ??
            input.name ??
            "",
        ).trim()

      requirements[
        cleanRankId
      ] = {
        rankId:
          cleanRankId,

        rankName,

        points:
          Math.floor(points),
      }
    }

    const saved =
      await writePromotionRequirements(
        userId,
        division,
        requirements,
      )

    logAction(user, {
      module: "promotion",
      action: "update-requirements",
      status: "updated",
      division,
      summary:
        `${division.toUpperCase()} promotion requirements were updated.`,
      details: {
        ranksConfigured:
          Object.keys(
            requirements,
          ).length,
        ranks: Object.values(
          requirements,
        ).map((item) => ({
          rank:
            item.rankName ||
            item.rankId,
          points: item.points,
        })),
      },
      path: req.path,
    })

    return res.json({
      success: true,

      message:
        `${division.toUpperCase()} promotion requirements saved successfully.`,

      requirements:
        saved.requirements,
    })
  } catch (error) {
    console.error(
      `[promotion-requirements] Failed to save ${division} requirements:`,
      error,
    )

    return res.status(500).json({
      success: false,
      message:
        "Failed to save promotion requirements.",
    })
  }
}

/* ─────────────────────────────────────────────
   Activity Requirements GET
───────────────────────────────────────────── */

async function handleActivityRequirementsGet(
  req: express.Request,
  res: express.Response,
  division: RequirementDivision,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      })
    }

    const userId =
      getAuthenticatedUserId(user)

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "Authenticated user does not have a Discord ID.",
      })
    }

    const requirements =
      await readActivityRequirements(
        userId,
        division,
      )

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    )

    res.setHeader(
      "Pragma",
      "no-cache",
    )

    res.setHeader(
      "Expires",
      "0",
    )

    return res.json({
      success: true,
      division,
      requirements:
        requirements.requirements,
    })
  } catch (error) {
    console.error(
      `[requirements] Failed to load ${division} requirements:`,
      error,
    )

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load requirements.",
    })
  }
}

/* ─────────────────────────────────────────────
   Promotion Requirements GET
───────────────────────────────────────────── */

async function handlePromotionRequirementsGet(
  req: express.Request,
  res: express.Response,
  division: RequirementDivision,
) {
  try {
    const user =
      await getRequestUser(req)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      })
    }

    const userId =
      getAuthenticatedUserId(user)

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "Authenticated user does not have a Discord ID.",
      })
    }

    const requirements =
      await readPromotionRequirements(
        userId,
        division,
      )

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    )

    res.setHeader(
      "Pragma",
      "no-cache",
    )

    res.setHeader(
      "Expires",
      "0",
    )

    return res.json({
      success: true,
      division,
      requirements:
        requirements.requirements,
    })
  } catch (error) {
    console.error(
      `[promotion-requirements] Failed to load ${division} requirements:`,
      error,
    )

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load promotion requirements.",
    })
  }
}

/* ─────────────────────────────────────────────
   Express App
───────────────────────────────────────────── */

function validateEventInput(input: {
  title: string
  description: string
  category: unknown
  date: string
  startTime: string
  endTime: string
  location: string
}): string | null {
  if (!input.title) return "Event title is required"
  if (!isEventCategory(input.category)) {
    return "Category must be Activities, Patrol, Operations, or Meetings"
  }
  if (!isValidEventDate(input.date)) return "Invalid event date"
  if (!isValidEventTime(input.startTime)) return "Invalid event start time"
  if (!isValidEventTime(input.endTime)) return "Invalid event end time"
  if (input.endTime <= input.startTime) {
    return "Event end time must be after the start time"
  }
  if (!input.location) return "Event location is required"
  return null
}

async function ensureEventIndexes() {
  const db = await getMongoDb()
  const events = db.collection<EventDocument>("events")

  await events.createIndex(
    { date: 1, startTime: 1 },
    { name: "events_date_startTime" },
  )

  await events.createIndex(
    { category: 1, date: 1 },
    { name: "events_category_date" },
  )
}

async function ensureGalleryIndexes() {
  const db = await getMongoDb()
  const gallery =
    db.collection<GalleryDocument>("gallery")

  await gallery.createIndex(
    { createdAt: -1 },
    {
      name: "gallery_createdAt",
    },
  )

  await gallery.createIndex(
    { type: 1, createdAt: -1 },
    {
      name: "gallery_type_createdAt",
    },
  )
}

export function createApp() {
  const app = express()

  void ensureUserScopedIndexes().catch(
    (error) => {
      console.error(
        "MongoDB user-scoped initialization failed:",
        error,
      )
    },
  )

  void ensureEventIndexes().catch(
    (error) => {
      console.error(
        "MongoDB event initialization failed:",
        error,
      )
    },
  )

  void ensureGalleryIndexes().catch(
    (error) => {
      console.error(
        "MongoDB gallery initialization failed:",
        error,
      )
    },
  )

  app.use(express.json())
  app.use(cookieParser())

  // Main Roster Google Sheets API routes.
  registerMainRosterRoutes(app)

  // Permission administration API routes.
  // These must be registered before the React fallback so /api/admin/*
  // requests are handled by Express instead of becoming 404 responses.
  registerPermissionAdminRoutes(app)
  // Action Logs API. Logs are kept in-memory for the last 14 days.
  registerActionLogRoutes(app)

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "mpd-dashboard",
    })
  })

  // Serve the production Vite build from the same Express service.
  // This keeps the React app and /api/* on the same origin in production.
  const clientDist = path.join(process.cwd(), "dist")
  app.use(express.static(clientDist))

  /* ─────────────────────────────────────────
     Authentication
  ───────────────────────────────────────── */

  app.get(
    "/api/auth/login",
    (_req, res) => {
      res.redirect(
        getDiscordLoginUrl(),
      )
    },
  )

  app.get(
    "/api/auth/callback",
    async (req, res) => {
      const code =
        typeof req.query.code ===
        "string"
          ? req.query.code
          : null

      if (!code) {
        res.redirect(
          "/sign-in?error=missing_code",
        )
        return
      }

      try {
        const user =
          await authenticateDiscordCode(
            code,
          )

        // Cache the exact Discord profile returned by OAuth.
        // Promotion Roster can then show the same display name,
        // username, and avatar that the Sidebar shows for that user.
        try {
          const db = await getMongoDb()
          const discordProfiles =
            db.collection("discordProfiles")

          const discordId =
            typeof user.discordId === "string"
              ? user.discordId.trim()
              : ""

          if (discordId) {
            await discordProfiles.updateOne(
              { discordId },
              {
                $set: {
                  discordId,
                  username:
                    typeof user.username === "string"
                      ? user.username.trim()
                      : "",
                  displayName:
                    typeof user.displayName === "string"
                      ? user.displayName.trim()
                      : "",
                  avatar:
                    typeof user.avatar === "string"
                      ? user.avatar.trim()
                      : null,
                  updatedAt: new Date(),
                },
                $setOnInsert: {
                  createdAt: new Date(),
                },
              },
              { upsert: true },
            )
          }
        } catch (profileCacheError) {
          // Profile caching must never prevent a successful login.
          console.error(
            "[auth] Failed to cache Discord profile:",
            profileCacheError,
          )
        }

        const token =
          await createSession(user)

        setSessionCookie(
          res,
          token,
        )

        res.redirect(
          "/verifying",
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Authentication failed"

        res.redirect(
          `/sign-in?error=${encodeURIComponent(
            message,
          )}`,
        )
      }
    },
  )

  app.get(
    "/api/auth/session",
    async (req, res) => {
      const user =
        await getRequestUser(req)

      if (!user) {
        return res
          .status(401)
          .json({
            user: null,
          })
      }

      return res.json({
        user,
      })
    },
  )

  app.get(
    "/api/auth/logout",
    (_req, res) => {
      clearSessionCookie(res)

      res.redirect(
        "/signed-out?logout=true",
      )
    },
  )

  app.get(
    "/api/auth/check",
    async (req, res) => {
      const user =
        await getRequestUser(req)

      if (!user) {
        return res
          .status(401)
          .json({
            error:
              "Unauthorized",
          })
      }

      const permission =
        typeof req.query
          .permission ===
        "string"
          ? req.query.permission
          : null

      if (
        permission &&
        !hasPermission(
          user,
          permission,
        )
      ) {
        return res
          .status(403)
          .json({
            error:
              "Forbidden",
          })
      }

      return res.json({
        allowed: true,
        user,
      })
    },
  )

  /* ─────────────────────────────────────────
     Manual Roster Import
  ───────────────────────────────────────── */

  app.post(
    "/api/import/roster",
    upload.single("file"),
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Unauthorized",
          })
        }

        const userId =
          getAuthenticatedUserId(
            user,
          )

        if (!userId) {
          return res.status(401).json({
            success: false,
            error:
              "Authenticated user does not have a Discord ID.",
          })
        }

        let members: RosterMember[] =
          []

        if (req.file) {
          const extension =
            path
              .extname(
                req.file.originalname,
              )
              .toLowerCase()

          if (
            extension === ".xlsx" ||
            extension === ".xls"
          ) {
            members =
              parseRosterSpreadsheet(
                req.file.buffer,
              )
          } else {
            members =
              parseRosterText(
                req.file.buffer.toString(
                  "utf8",
                ),
              )
          }
        } else {
          const data =
            req.body?.data

          if (
            typeof data !==
              "string" ||
            !data.trim()
          ) {
            return res.status(
              400,
            ).json({
              success: false,
              error:
                "No roster data was provided.",
            })
          }

          members =
            parseRosterText(data)
        }

        if (
          members.length === 0
        ) {
          return res.status(
            400,
          ).json({
            success: false,
            error:
              "No valid roster rows were found.",
          })
        }

        const collection =
          await getCollection<RosterDocument>(
            "rosters",
          )

        await collection.updateOne(
          {
            userId,
            division:
              "department",
          },
          {
            $set: {
              userId,
              division:
                "department",
              members,
              updatedAt:
                new Date(),
            },
          },
          {
            upsert: true,
          },
        )

        return res.json({
          success: true,

          message:
            `Roster import successful. ${members.length} members imported.`,

          imported:
            members.length,

          totalMembers:
            members.length,
        })
      } catch (error) {
        console.error(
          "Roster import error:",
          error,
        )

        return res.status(
          500,
        ).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Roster import failed.",
        })
      }
    },
  )

  /* ─────────────────────────────────────────
     Activity Imports
  ───────────────────────────────────────── */

  for (
    const division of
      VALID_IMPORT_DIVISIONS
  ) {
    app.post(
      `/api/import/activity/${division}`,
      upload.single("file"),
      async (req, res) => {
        await handleActivityImport(
          division,
          req,
          res,
        )
      },
    )
  }

  /* ─────────────────────────────────────────
     Promotion Imports
  ───────────────────────────────────────── */

  for (
    const division of
      VALID_IMPORT_DIVISIONS
  ) {
    app.post(
      `/api/import/promotion/${division}`,
      upload.single("file"),
      async (req, res) => {
        await handlePromotionImport(
          division,
          req,
          res,
        )
      },
    )
  }

  /* ─────────────────────────────────────────
     Activity Requirements
  ───────────────────────────────────────── */

  for (
    const division of
      VALID_IMPORT_DIVISIONS
  ) {
    app.get(
      `/api/requirements/activity/${division}`,
      async (req, res) => {
        await handleActivityRequirementsGet(
          req,
          res,
          division,
        )
      },
    )

    app.post(
      `/api/requirements/activity/${division}`,
      async (req, res) => {
        await handleActivityRequirementsSave(
          req,
          res,
          division,
        )
      },
    )
  }

  /* ─────────────────────────────────────────
     Promotion Requirements
  ───────────────────────────────────────── */

  for (
    const division of
      VALID_IMPORT_DIVISIONS
  ) {
    app.get(
      `/api/requirements/promotion/${division}`,
      async (req, res) => {
        await handlePromotionRequirementsGet(
          req,
          res,
          division,
        )
      },
    )

    app.post(
      `/api/requirements/promotion/${division}`,
      async (req, res) => {
        await handlePromotionRequirementsSave(
          req,
          res,
          division,
        )
      },
    )
  }

  /* ─────────────────────────────────────────
     Activity Rank Configuration
  ───────────────────────────────────────── */

  for (
    const division of
      VALID_IMPORT_DIVISIONS
  ) {
    app.get(
      `/api/ranks/${division}`,
      async (req, res) => {
        try {
          const user =
            await getRequestUser(req)

          if (!user) {
            return res
              .status(401)
              .json({
                success: false,
                error:
                  "Unauthorized",
              })
          }

          const config =
            await readRankConfig(
              division,
            )

          return res.json({
            success: true,
            division,
            ranks:
              config.ranks,
          })
        } catch (error) {
          console.error(
            `[ranks] Failed to load ${division} ranks:`,
            error,
          )

          return res
            .status(500)
            .json({
              success: false,
              error:
                "Failed to load ranks.",
            })
        }
      },
    )
  }

  /* ─────────────────────────────────────────
     Promotion Rank Configuration
  ───────────────────────────────────────── */

  for (
    const division of
      VALID_IMPORT_DIVISIONS
  ) {
    app.get(
      `/api/ranks/promotion/${division}`,
      async (req, res) => {
        try {
          const user =
            await getRequestUser(req)

          if (!user) {
            return res
              .status(401)
              .json({
                success: false,
                error:
                  "Unauthorized",
              })
          }

          const config =
            await readPromotionRankConfig(
              division,
            )

          return res.json({
            success: true,
            division,
            ranks:
              config.ranks,
          })
        } catch (error) {
          console.error(
            `[promotion-ranks] Failed to load ${division} ranks:`,
            error,
          )

          return res
            .status(500)
            .json({
              success: false,
              error:
                "Failed to load promotion ranks.",
            })
        }
      },
    )
  }

  /* ─────────────────────────────────────────
     Activity Roster Audit
  ───────────────────────────────────────── */

  app.get(
    "/api/activity/roster/:division",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Unauthorized",
            })
        }

        const userId =
          getAuthenticatedUserId(
            user,
          )

        if (!userId) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Authenticated user does not have a Discord ID.",
            })
        }

        const division =
          typeof req.params
            .division === "string"
            ? req.params.division.toLowerCase()
            : ""

        if (
          !VALID_IMPORT_DIVISIONS.includes(
            division as ImportDivision,
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Invalid activity division.",
            })
        }

        const importDivision =
          division as ImportDivision

        const [
          roster,
          activity,
          rankConfig,
          requirements,
        ] = await Promise.all([
          readRosterImport(
            userId,
            importDivision,
          ),

          readActivityImport(
            userId,
            importDivision,
          ),

          readRankConfig(
            importDivision,
          ),

          readActivityRequirements(
            userId,
            importDivision,
          ),
        ])

        const activityHoursByDiscordId =
          new Map<string, number>()

        for (
          const item of
            activity.hours
        ) {
          activityHoursByDiscordId.set(
            item.discordId,
            item.hours,
          )
        }

        const members:
          ActivityRosterRow[] =
          roster.members.map(
            (member) => {
              const discordId =
                String(
                  member.discordId ??
                    "",
                ).trim()

              const activityHours =
                Number(
                  activityHoursByDiscordId.get(
                    discordId,
                  ) ?? 0,
                )

              const requiredHours =
                getRequiredHoursForRank(
                  member.rank,
                  rankConfig,
                  requirements,
                )

              const safeActivityHours =
                Number.isFinite(
                  activityHours,
                )
                  ? Math.max(
                      0,
                      activityHours,
                    )
                  : 0

              return {
                callsign:
                  member.callsign ??
                  "",

                badgeNumber:
                  member.badgeNumber ??
                  "",

                name:
                  member.name ?? "",

                rank:
                  member.rank ?? "",

                discordId,

                timeInDept:
                  member.timeInDept ??
                  "",

                timeInRank:
                  member.timeInRank ??
                  "",

                requiredHours,

                activityHours:
                  safeActivityHours,

                status:
                  safeActivityHours >=
                    requiredHours ||
                  requiredHours <= 0
                    ? "compliant"
                    : "non-compliant",
              }
            },
          )

        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        )

        res.setHeader(
          "Pragma",
          "no-cache",
        )

        res.setHeader(
          "Expires",
          "0",
        )

        return res.json({
          success: true,
          division:
            importDivision,
          members,
        })
      } catch (error) {
        console.error(
          "[activity-roster] Failed to load roster:",
          error,
        )

        return res
          .status(500)
          .json({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load activity roster.",
          })
      }
    },
  )

  /* ─────────────────────────────────────────
     Promotion Discord Profile
  ───────────────────────────────────────── */

  app.get(
    "/api/promotion/discord-profile/:discordId",
    async (req, res) => {
      try {
        const user = await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Unauthorized",
          })
        }

        const discordId =
          typeof req.params.discordId === "string"
            ? req.params.discordId.trim()
            : ""

        if (!/^\d{17,20}$/.test(discordId)) {
          return res.status(400).json({
            success: false,
            error: "Invalid Discord user ID.",
          })
        }

        const db = await getMongoDb()
        const discordProfiles =
          db.collection("discordProfiles")

        // First use the profile captured during that user's Discord OAuth
        // login. This is the exact same source used to build the Sidebar
        // session profile: displayName, username, and avatar.
        const cachedProfile =
          await discordProfiles.findOne({
            discordId,
          })

        if (cachedProfile) {
          return res.json({
            success: true,
            profile: {
              id: discordId,
              username:
                typeof cachedProfile.username === "string"
                  ? cachedProfile.username
                  : "",
              displayName:
                typeof cachedProfile.displayName === "string"
                  ? cachedProfile.displayName
                  : "",
              avatar:
                typeof cachedProfile.avatar === "string"
                  ? cachedProfile.avatar
                  : null,
            },
            source: "login",
          })
        }

        // Fallback for users who have not logged in since profile caching
        // was introduced. If a bot token is configured, Discord can provide
        // the same profile fields directly. The result is cached as well.
        if (!env.discordBotToken) {
          return res.status(404).json({
            success: false,
            error:
              "This Discord user's profile has not been cached from a login yet. Ask the user to sign in once, then refresh the roster.",
          })
        }

        const response = await fetch(
          `https://discord.com/api/v10/users/${encodeURIComponent(
            discordId,
          )}`,
          {
            headers: {
              Authorization: `Bot ${env.discordBotToken}`,
              Accept: "application/json",
            },
          },
        )

        if (!response.ok) {
          const body = await response.text().catch(() => "")
          console.error(
            "[promotion-discord-profile] Discord lookup failed:",
            response.status,
            body,
          )

          return res.status(502).json({
            success: false,
            error:
              "Discord could not return this user's profile.",
          })
        }

        const discordUser = (await response.json()) as {
          id?: string
          username?: string
          global_name?: string | null
          avatar?: string | null
        }

        const profile = {
          id: String(discordUser.id ?? discordId),
          username: String(discordUser.username ?? "").trim(),
          displayName: String(
            discordUser.global_name ||
              discordUser.username ||
              "",
          ).trim(),
          avatar: discordUser.avatar ?? null,
        }

        await discordProfiles.updateOne(
          { discordId },
          {
            $set: {
              discordId,
              username: profile.username,
              displayName: profile.displayName,
              avatar: profile.avatar,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true },
        )

        return res.json({
          success: true,
          profile,
          source: "discord-api",
        })
      } catch (error) {
        console.error(
          "[promotion-discord-profile] Failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load Discord profile.",
        })
      }
    },
  )

  /* ─────────────────────────────────────────
     Promotion Roster Audit
  ───────────────────────────────────────── */

  app.get(
    "/api/promotion/roster/:division",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Unauthorized",
            })
        }

        const userId =
          getAuthenticatedUserId(
            user,
          )

        if (!userId) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Authenticated user does not have a Discord ID.",
            })
        }

        const division =
          typeof req.params
            .division === "string"
            ? req.params.division.toLowerCase()
            : ""

        if (
          !VALID_IMPORT_DIVISIONS.includes(
            division as ImportDivision,
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Invalid promotion division.",
            })
        }

        const importDivision =
          division as ImportDivision

        const [
          roster,
          promotion,
          rankConfig,
          requirements,
          activityRequirements,
        ] = await Promise.all([
          readRosterImport(
            userId,
            importDivision,
          ),

          readPromotionImport(
            userId,
            importDivision,
          ),

          readPromotionRankConfig(
            importDivision,
          ),

          readPromotionRequirements(
            userId,
            importDivision,
          ),

          readActivityRequirements(
            userId,
            importDivision,
          ),
        ])

        const pointsByDiscordId =
          new Map<string, number>()

        for (
          const item of
            promotion.points
        ) {
          pointsByDiscordId.set(
            item.discordId,
            item.points,
          )
        }

        const members:
          PromotionRosterRow[] =
          roster.members.map(
            (member) => {
              const discordId =
                String(
                  member.discordId ??
                    "",
                ).trim()

              const promotionPoints =
                Number(
                  pointsByDiscordId.get(
                    discordId,
                  ) ?? 0,
                )

              const requiredPoints =
                getRequiredPromotionPointsForRank(
                  member.rank,
                  rankConfig,
                  requirements,
                )

              const activityRequirement =
                getActivityRequirementForRank(
                  member.rank,
                  rankConfig,
                  activityRequirements,
                )

              const requiredTimeInRankDays =
                Math.max(
                  0,
                  Number(
                    activityRequirement.timeInRankDays ?? 0,
                  ),
                )

              const requiredTrainingLogs =
                Math.max(
                  0,
                  Number(
                    activityRequirement.trainingLogs ?? 0,
                  ),
                )

              const requiredRecruitmentLogs =
                Math.max(
                  0,
                  Number(
                    activityRequirement.recruitmentLogs ?? 0,
                  ),
                )

              const requiredLogs =
                requiredTrainingLogs +
                requiredRecruitmentLogs

              const safePromotionPoints =
                Number.isFinite(
                  promotionPoints,
                )
                  ? Math.max(
                      0,
                      promotionPoints,
                    )
                  : 0

              return {
                callsign:
                  member.callsign ??
                  "",

                badgeNumber:
                  member.badgeNumber ??
                  "",

                name:
                  member.name ?? "",

                rank:
                  member.rank ?? "",

                discordId,

                timeInDept:
                  member.timeInDept ??
                  "",

                timeInRank:
                  member.timeInRank ??
                  "",

                requiredPoints,

                promotionPoints:
                  safePromotionPoints,

                requiredTimeInRankDays,

                requiredTrainingLogs,

                requiredRecruitmentLogs,

                requiredLogs,

                status:
                  safePromotionPoints >=
                    requiredPoints ||
                  requiredPoints <= 0
                    ? "compliant"
                    : "non-compliant",
              }
            },
          )

        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        )

        res.setHeader(
          "Pragma",
          "no-cache",
        )

        res.setHeader(
          "Expires",
          "0",
        )

        return res.json({
          success: true,
          division:
            importDivision,
          members,
        })
      } catch (error) {
        console.error(
          "[promotion-roster] Failed to load roster:",
          error,
        )

        return res
          .status(500)
          .json({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load promotion roster.",
          })
      }
    },
  )

  /* ─────────────────────────────────────────
     Google Roster Sync
  ───────────────────────────────────────── */

  app.post(
    "/api/import/google/rosters",
    async (req, res) => {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      )

      res.setHeader(
        "Pragma",
        "no-cache",
      )

      res.setHeader(
        "Expires",
        "0",
      )

      res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8",
      )

      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Unauthorized",
            })
        }

        const userId =
          getAuthenticatedUserId(
            user,
          )

        if (!userId) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Authenticated user does not have a Discord ID.",
            })
        }

        const result =
          await syncGoogleRosters(
            userId,
          )

        return res
          .status(200)
          .json({
            success: true,
            updated: true,

            message:
              "All Google roster imports synchronized successfully.",

            ...result,
          })
      } catch (error) {
        console.error(
          "[google-sync] Manual roster sync failed:",
          error,
        )

        return res
          .status(500)
          .json({
            success: false,
            updated: false,
            error:
              error instanceof Error
                ? error.message
                : "Google roster sync failed.",
          })
      }
    },
  )

  /*
   * Promotion Google Sync
   *
   * This endpoint is intentionally separate
   * from the existing roster sync endpoint.
   *
   * The actual Google promotion-sheet
   * implementation can be connected to:
   *
   * syncGooglePromotions(userId)
   *
   * once the promotion Google Sheet tabs
   * are configured.
   */
  app.post(
    "/api/import/google/promotions",
    async (req, res) => {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      )

      res.setHeader(
        "Pragma",
        "no-cache",
      )

      res.setHeader(
        "Expires",
        "0",
      )

      res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8",
      )

      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Unauthorized",
            })
        }

        const userId =
          getAuthenticatedUserId(
            user,
          )

        if (!userId) {
          return res
            .status(401)
            .json({
              success: false,
              error:
                "Authenticated user does not have a Discord ID.",
            })
        }

        /*
         * Promotion Google synchronization
         * requires a separate implementation
         * because promotion data is stored
         * separately from activity data.
         *
         * The endpoint is kept separate so the
         * frontend can use a dedicated Promotion
         * refresh button without touching Activity.
         */

        return res.status(200).json({
          success: true,
          updated: false,
          message:
            "Promotion Google synchronization endpoint is ready. Configure the promotion Google Sheet synchronization before importing promotion data.",
        })
      } catch (error) {
        console.error(
          "[google-promotion-sync] Manual promotion sync failed:",
          error,
        )

        return res
          .status(500)
          .json({
            success: false,
            updated: false,
            error:
              error instanceof Error
                ? error.message
                : "Google promotion sync failed.",
          })
      }
    },
  )

  /* ─────────────────────────────────────────
     Events
  ───────────────────────────────────────── */

  app.get("/api/events", async (_req, res) => {
    try {
      // Public read endpoint: guests can view events.
      // Management endpoints below still require authentication + permission.
      const events = await getCollection<EventDocument>("events")

      const results = await events
        .find({})
        .sort({ date: 1, startTime: 1 })
        .toArray()

      return res.json({
        events: results.map(serializeEvent),
      })
    } catch (error) {
      console.error("GET /api/events failed:", error)

      return res.status(500).json({
        error: "Failed to load events",
      })
    }
  })

  app.post("/api/events", async (req, res) => {
    try {
      const user = await getRequestUser(req)

      if (!user) {
        return res.status(401).json({
          error: "Not authenticated",
        })
      }

      if (!hasPermission(user, "events")) {
        return res.status(403).json({
          error: "You do not have permission to manage events",
        })
      }

      const title = cleanEventString(req.body?.title)
      const description = cleanEventString(req.body?.description)
      const category = req.body?.category
      const date = cleanEventString(req.body?.date)
      const startTime = cleanEventString(req.body?.startTime)
      const endTime = cleanEventString(req.body?.endTime)
      const location = cleanEventString(req.body?.location)
      const discordUrl = cleanEventString(req.body?.discordUrl)

      const validationError = validateEventInput({
        title, description, category, date, startTime, endTime, location,
      })

      if (validationError) {
        return res.status(400).json({ error: validationError })
      }

      const userId = getAuthenticatedUserId(user)

      if (!userId) {
        return res.status(401).json({
          error: "Unable to determine authenticated user",
        })
      }

      const now = new Date()
      const event: EventDocument = {
        title,
        description,
        category: category as EventCategory,
        date,
        startTime,
        endTime,
        location,
        discordUrl,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }

      const events = await getCollection<EventDocument>("events")
      const result = await events.insertOne(event)
      const created = await events.findOne({ _id: result.insertedId })

      if (!created) {
        return res.status(500).json({
          error: "Event was created but could not be retrieved",
        })
      }

      return res.status(201).json({ event: serializeEvent(created) })
    } catch (error) {
      console.error("POST /api/events failed:", error)

      return res.status(500).json({
        error: "Failed to create event",
      })
    }
  })

  app.put("/api/events/:id", async (req, res) => {
    try {
      const user = await getRequestUser(req)

      if (!user) {
        return res.status(401).json({ error: "Not authenticated" })
      }

      if (!hasPermission(user, "events")) {
        return res.status(403).json({
          error: "You do not have permission to manage events",
        })
      }

      const id = req.params.id

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid event ID" })
      }

      const title = cleanEventString(req.body?.title)
      const description = cleanEventString(req.body?.description)
      const category = req.body?.category
      const date = cleanEventString(req.body?.date)
      const startTime = cleanEventString(req.body?.startTime)
      const endTime = cleanEventString(req.body?.endTime)
      const location = cleanEventString(req.body?.location)
      const discordUrl = cleanEventString(req.body?.discordUrl)

      const validationError = validateEventInput({
        title, description, category, date, startTime, endTime, location,
      })

      if (validationError) {
        return res.status(400).json({ error: validationError })
      }

      const events = await getCollection<EventDocument>("events")
      const objectId = new ObjectId(id)
      const existing = await events.findOne({ _id: objectId })

      if (!existing) {
        return res.status(404).json({ error: "Event not found" })
      }

      await events.updateOne(
        { _id: objectId },
        {
          $set: {
            title,
            description,
            category: category as EventCategory,
            date,
            startTime,
            endTime,
            location,
            discordUrl,
            updatedAt: new Date(),
          },
        },
      )

      const updated = await events.findOne({ _id: objectId })

      if (!updated) {
        return res.status(404).json({ error: "Event not found" })
      }

      return res.json({ event: serializeEvent(updated) })
    } catch (error) {
      console.error("PUT /api/events/:id failed:", error)

      return res.status(500).json({
        error: "Failed to update event",
      })
    }
  })

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const user = await getRequestUser(req)

      if (!user) {
        return res.status(401).json({ error: "Not authenticated" })
      }

      if (!hasPermission(user, "events")) {
        return res.status(403).json({
          error: "You do not have permission to manage events",
        })
      }

      const id = req.params.id

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid event ID" })
      }

      const events = await getCollection<EventDocument>("events")
      const result = await events.deleteOne({ _id: new ObjectId(id) })

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Event not found" })
      }

      return res.json({ success: true })
    } catch (error) {
      console.error("DELETE /api/events/:id failed:", error)

      return res.status(500).json({
        error: "Failed to delete event",
      })
    }
  })

  /* ─────────────────────────────────────────
     Gallery
  ───────────────────────────────────────── */

  app.get("/api/gallery", async (_req, res) => {
    try {
      // Public read endpoint: guests can view the gallery.
      // Upload/edit/delete endpoints below still require authentication + permission.
      const gallery =
        await getCollection<GalleryDocument>(
          "gallery",
        )

      const results = await gallery
        .find({})
        .sort({ createdAt: -1 })
        .toArray()

      return res.json({
        success: true,
        items: results.map(
          serializeGalleryItem,
        ),
      })
    } catch (error) {
      console.error(
        "GET /api/gallery failed:",
        error,
      )

      return res.status(500).json({
        success: false,
        error: "Failed to load gallery",
      })
    }
  })

  /*
   * Upload one or more real image/video files.
   *
   * Files are stored in MongoDB GridFS and the
   * returned media objects can then be included
   * in the gallery item's media[] array.
   */
  app.post(
    "/api/gallery/upload",
    galleryUpload.array("files", 20),
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated",
          })
        }

        if (
          !hasPermission(
            user,
            "gallery",
          )
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You do not have permission to manage the gallery",
          })
        }

        const files =
          Array.isArray(req.files)
            ? req.files
            : []

        if (files.length === 0) {
          return res.status(400).json({
            success: false,
            error:
              "At least one image or video file is required",
          })
        }

        const uploaded: GalleryMedia[] = []

        try {
          for (const file of files) {
            uploaded.push(
              await storeGalleryFile(
                file,
              ),
            )
          }
        } catch (error) {
          await deleteGalleryStoredFiles(
            uploaded,
          )

          throw error
        }

        return res.status(201).json({
          success: true,
          items: uploaded,
        })
      } catch (error) {
        console.error(
          "POST /api/gallery/upload failed:",
          error,
        )

        return res.status(400).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to upload gallery files",
        })
      }
    },
  )

  /*
   * Stream an uploaded gallery file from
   * MongoDB GridFS.
   */
  app.post(
    "/api/gallery/import-url",
    async (req, res) => {
      try {
        const user = await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated",
          })
        }

        if (!hasPermission(user, "gallery")) {
          return res.status(403).json({
            success: false,
            error: "You do not have permission to manage the gallery",
          })
        }

        const url =
          typeof req.body?.url === "string"
            ? req.body.url.trim()
            : ""

        if (!url) {
          return res.status(400).json({
            success: false,
            error: "A video URL is required.",
          })
        }

        const media = await importGalleryExternalVideo(url)

        return res.status(201).json({
          success: true,
          item: media,
        })
      } catch (error) {
        console.error(
          "POST /api/gallery/import-url failed:",
          error,
        )

        return res.status(400).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to import video URL",
        })
      }
    },
  )

  app.get(
    "/api/gallery/file/:id",
    async (req, res) => {
      try {
        // Public media endpoint: guests must be able to render gallery media.
        const id = req.params.id

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error: "Invalid gallery file ID",
          })
        }

        const objectId = new ObjectId(id)
        const bucket = await getGalleryBucket()
        const files = await bucket
          .find({ _id: objectId })
          .limit(1)
          .toArray()

        const file = files[0]

        if (!file) {
          return res.status(404).json({
            success: false,
            error: "Gallery file not found",
          })
        }

        const metadata =
          (file.metadata as {
            contentType?: unknown
            mediaType?: unknown
          } | undefined) ?? {}

        const contentType = getGalleryContentType(
          typeof file.contentType === "string"
            ? file.contentType
            : "",
          typeof file.filename === "string"
            ? file.filename
            : "",
          metadata.mediaType === "video" ? "video" : "image",
        )

        const totalLength = Number(file.length)
        const range = req.headers.range

        res.setHeader("Content-Type", contentType)
        res.setHeader("Content-Disposition", "inline")
        res.setHeader("Accept-Ranges", "bytes")
        res.setHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        )

        if (!range) {
          res.status(200)
          res.setHeader("Content-Length", String(totalLength))

          const stream = bucket.openDownloadStream(objectId)
          stream.once("error", (error) => {
            console.error("Gallery file stream failed:", error)
            if (!res.headersSent) res.status(500).end()
            else res.end()
          })
          stream.pipe(res)
          return
        }

        const match = /^bytes=(\d*)-(\d*)$/i.exec(
          range.trim(),
        )

        if (!match) {
          res.setHeader("Content-Range", `bytes */${totalLength}`)
          return res.status(416).end()
        }

        const requestedStart = match[1]
          ? Number(match[1])
          : null
        const requestedEnd = match[2]
          ? Number(match[2])
          : null

        let start: number
        let end: number

        if (requestedStart === null) {
          const suffixLength = requestedEnd ?? 0

          if (suffixLength <= 0) {
            res.setHeader("Content-Range", `bytes */${totalLength}`)
            return res.status(416).end()
          }

          start = Math.max(0, totalLength - suffixLength)
          end = totalLength - 1
        } else {
          start = requestedStart
          end = requestedEnd ?? totalLength - 1
        }

        if (
          start < 0 ||
          start >= totalLength ||
          end < start
        ) {
          res.setHeader("Content-Range", `bytes */${totalLength}`)
          return res.status(416).end()
        }

        end = Math.min(end, totalLength - 1)

        const length = end - start + 1

        res.status(206)
        res.setHeader(
          "Content-Range",
          `bytes ${start}-${end}/${totalLength}`,
        )
        res.setHeader("Content-Length", String(length))

        const stream = bucket.openDownloadStream(objectId, {
          start,
          end: end + 1,
        })

        stream.once("error", (error) => {
          console.error("Gallery ranged stream failed:", error)
          if (!res.headersSent) res.status(500).end()
          else res.end()
        })

        stream.pipe(res)
        return
      } catch (error) {
        console.error(
          "GET /api/gallery/file/:id failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error: "Failed to load gallery file",
        })
      }
    },
  )

  app.post(
    "/api/gallery",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated",
          })
        }

        if (
          !hasPermission(
            user,
            "gallery",
          )
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You do not have permission to manage the gallery",
          })
        }

        const userId =
          getAuthenticatedUserId(user)

        if (!userId) {
          return res.status(401).json({
            success: false,
            error:
              "Unable to determine authenticated user",
          })
        }

        const title =
          cleanGalleryString(
            req.body?.title,
          )

        // Gallery descriptions are optional. Empty/missing descriptions are stored as an empty string.
        const description =
          cleanGalleryString(
            req.body?.description,
          ) || ""

        const requestedCategory =
          req.body?.category

        if (
          requestedCategory !== undefined &&
          !isGalleryCategory(
            requestedCategory,
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Gallery category must be Community or Fleet",
          })
        }

        if (!title) {
          return res.status(400).json({
            success: false,
            error:
              "Gallery title is required",
          })
        }

        const category =
          isGalleryCategory(
            requestedCategory,
          )
            ? requestedCategory
            : "Community"

        const requestedTags =
          req.body?.tags

        if (
          requestedTags !== undefined &&
          !Array.isArray(requestedTags)
        ) {
          return res.status(400).json({
            success: false,
            error: "Gallery tags must be an array.",
          })
        }

        const tags = normalizeGalleryTags(
          requestedTags,
        )

        if (
          Array.isArray(requestedTags) &&
          requestedTags.some(
            (tag) => !isGalleryTag(tag),
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Gallery tags must be Dept, SWAT, MTF-7, MCD, TRU, or SAR.",
          })
        }

        const rawMedia = req.body?.media

        if (rawMedia !== undefined && !Array.isArray(rawMedia)) {
          return res.status(400).json({
            success: false,
            error: "Gallery media must be an array.",
          })
        }

        if (Array.isArray(rawMedia)) {
          for (const rawItem of rawMedia) {
            if (!rawItem || typeof rawItem !== "object") {
              return res.status(400).json({
                success: false,
                error: "Invalid gallery media item.",
              })
            }

            const rawType = (rawItem as Record<string, unknown>).type
            const rawUrl = cleanGalleryString((rawItem as Record<string, unknown>).url)

            if (!isGalleryMediaType(rawType)) {
              return res.status(400).json({
                success: false,
                error: "Gallery media type must be image or video",
              })
            }

            if (!rawUrl) {
              return res.status(400).json({
                success: false,
                error: "Gallery media URL is required.",
              })
            }
          }
        }

        let media =
          normalizeGalleryMedia(
            rawMedia,
          )

        /*
         * Accept the previous single-media
         * request format as well.
         */
        if (
          media.length === 0 &&
          isGalleryMediaType(
            req.body?.type,
          )
        ) {
          const url =
            cleanGalleryString(
              req.body?.url,
            )

          if (url) {
            media = [
              {
                id: randomUUID(),
                type:
                  req.body.type,
                url,
                thumbnailUrl:
                  cleanGalleryString(
                    req.body
                      ?.thumbnailUrl,
                  ),
                source: "url",
              },
            ]
          }
        }

        if (media.length === 0) {
          return res.status(400).json({
            success: false,
            error:
              "Add at least one image, video, or media URL",
          })
        }

        for (const item of media) {
          if (
            item.type === "video" &&
            !item.thumbnailUrl &&
            item.source === "url"
          ) {
            // External videos are allowed without a
            // thumbnail. The UI can show its fallback.
            continue
          }
        }

        const now = new Date()

        const item: GalleryDocument = {
          title,
          description,
          category,
          tags,
          media,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        }

        const gallery =
          await getCollection<GalleryDocument>(
            "gallery",
          )

        const result =
          await gallery.insertOne(item)

        const created =
          await gallery.findOne({
            _id:
              result.insertedId,
          })

        if (!created) {
          await deleteGalleryStoredFiles(
            media,
          )

          return res.status(500).json({
            success: false,
            error:
              "Media was created but could not be retrieved",
          })
        }

        return res.status(201).json({
          success: true,
          item:
            serializeGalleryItem(
              created,
            ),
        })
      } catch (error) {
        console.error(
          "POST /api/gallery failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            "Failed to create gallery item",
        })
      }
    },
  )

  app.put(
    "/api/gallery/:id",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated",
          })
        }

        if (
          !hasPermission(
            user,
            "gallery",
          )
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You do not have permission to manage the gallery",
          })
        }

        const id = req.params.id

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid gallery item ID",
          })
        }

        const title =
          cleanGalleryString(
            req.body?.title,
          )

        // Gallery descriptions are optional. Empty/missing descriptions are stored as an empty string.
        const description =
          cleanGalleryString(
            req.body?.description,
          ) || ""

        if (
          req.body?.category !== undefined &&
          !isGalleryCategory(
            req.body?.category,
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Gallery category must be Community or Fleet",
          })
        }

        const requestedCategory =
          req.body?.category

        const requestedTags =
          req.body?.tags

        if (
          requestedTags !== undefined &&
          !Array.isArray(requestedTags)
        ) {
          return res.status(400).json({
            success: false,
            error: "Gallery tags must be an array.",
          })
        }

        if (
          Array.isArray(requestedTags) &&
          requestedTags.some(
            (tag) => !isGalleryTag(tag),
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Gallery tags must be Dept, SWAT, MTF-7, MCD, TRU, or SAR.",
          })
        }

        if (!title) {
          return res.status(400).json({
            success: false,
            error:
              "Gallery title is required",
          })
        }

        const gallery =
          await getCollection<GalleryDocument>(
            "gallery",
          )

        const objectId =
          new ObjectId(id)

        const existing =
          await gallery.findOne({
            _id: objectId,
          })

        if (!existing) {
          return res.status(404).json({
            success: false,
            error:
              "Gallery item not found",
          })
        }

        const category =
          isGalleryCategory(
            requestedCategory,
          )
            ? requestedCategory
            : existing.category ?? "Community"

        const tags =
          requestedTags === undefined
            ? normalizeGalleryTags(existing.tags)
            : normalizeGalleryTags(requestedTags)

        const rawMedia = req.body?.media

        if (rawMedia !== undefined && !Array.isArray(rawMedia)) {
          return res.status(400).json({
            success: false,
            error: "Gallery media must be an array.",
          })
        }

        if (Array.isArray(rawMedia)) {
          for (const rawItem of rawMedia) {
            if (!rawItem || typeof rawItem !== "object") {
              return res.status(400).json({
                success: false,
                error: "Invalid gallery media item.",
              })
            }

            const rawType = (rawItem as Record<string, unknown>).type
            const rawUrl = cleanGalleryString((rawItem as Record<string, unknown>).url)

            if (!isGalleryMediaType(rawType)) {
              return res.status(400).json({
                success: false,
                error: "Gallery media type must be image or video",
              })
            }

            if (!rawUrl) {
              return res.status(400).json({
                success: false,
                error: "Gallery media URL is required.",
              })
            }
          }
        }

        let media =
          normalizeGalleryMedia(
            rawMedia,
          )

        /*
         * Keep compatibility with the old
         * single-media editor.
         */
        if (
          media.length === 0 &&
          isGalleryMediaType(
            req.body?.type,
          )
        ) {
          const url =
            cleanGalleryString(
              req.body?.url,
            )

          if (url) {
            media = [
              {
                id:
                  randomUUID(),
                type:
                  req.body.type,
                url,
                thumbnailUrl:
                  cleanGalleryString(
                    req.body
                      ?.thumbnailUrl,
                  ),
                source: "url",
              },
            ]
          }
        }

        if (media.length === 0) {
          return res.status(400).json({
            success: false,
            error:
              "Add at least one image, video, or media URL",
          })
        }

        const oldMedia =
          getGalleryMedia(existing)

        const nextStorageIds =
          new Set(
            media
              .map(
                (item) =>
                  item.storageId ?? "",
              )
              .filter(Boolean),
          )

        const removedMedia =
          oldMedia.filter(
            (item) =>
              item.storageId &&
              !nextStorageIds.has(
                item.storageId,
              ),
          )

        await gallery.updateOne(
          { _id: objectId },
          {
            $set: {
              title,
              description,
              category,
              tags,
              media,
              updatedAt:
                new Date(),
            },
            $unset: {
              type: "",
              url: "",
              thumbnailUrl: "",
            },
          },
        )

        await deleteGalleryStoredFiles(
          removedMedia,
        )

        const updated =
          await gallery.findOne({
            _id: objectId,
          })

        if (!updated) {
          return res.status(404).json({
            success: false,
            error:
              "Gallery item not found",
          })
        }

        return res.json({
          success: true,
          item:
            serializeGalleryItem(
              updated,
            ),
        })
      } catch (error) {
        console.error(
          "PUT /api/gallery/:id failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            "Failed to update gallery item",
        })
      }
    },
  )

  app.delete(
    "/api/gallery/:id",
    async (req, res) => {
      try {
        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Not authenticated",
          })
        }

        if (
          !hasPermission(
            user,
            "gallery",
          )
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You do not have permission to manage the gallery",
          })
        }

        const id = req.params.id

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid gallery item ID",
          })
        }

        const gallery =
          await getCollection<GalleryDocument>(
            "gallery",
          )

        const objectId =
          new ObjectId(id)

        const existing =
          await gallery.findOne({
            _id: objectId,
          })

        if (!existing) {
          return res.status(404).json({
            success: false,
            error:
              "Gallery item not found",
          })
        }

        const result =
          await gallery.deleteOne({
            _id: objectId,
          })

        if (
          result.deletedCount === 0
        ) {
          return res.status(404).json({
            success: false,
            error:
              "Gallery item not found",
          })
        }

        await deleteGalleryStoredFiles(
          getGalleryMedia(existing),
        )

        return res.json({
          success: true,
        })
      } catch (error) {
        console.error(
          "DELETE /api/gallery/:id failed:",
          error,
        )

        return res.status(500).json({
          success: false,
          error:
            "Failed to delete gallery item",
        })
      }
    },
  )

  // React Router fallback. API routes are excluded so missing API endpoints
  // still return a normal 404 instead of index.html.
  // Serve the built React application for all non-API routes.
  // Open Graph metadata is handled by the client build/index.html only;
  // this server does not generate or rewrite OG previews.
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    return res.sendFile(path.join(clientDist, "index.html"))
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Gallery files must be 100 MB or smaller."
          : error.code === "LIMIT_FILE_COUNT"
            ? "You can upload up to 20 gallery files at once."
            : error.message

      return res.status(400).json({
        success: false,
        error: message,
      })
    }

    if (error) {
      console.error("Unhandled API error:", error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      })
    }

    return next()
  })

  return app
}

/* ─────────────────────────────────────────────
   Server
───────────────────────────────────────────── */

const app = createApp()

app.listen(env.port, () => {
  console.log(
    `MPD Dashboard running on port ${env.port}`,
  )
})

export default app
