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

import {
  canAccessPage,
  hasPermission,
  isPageProtected,
} from "./permissions/permissions"
import { registerPermissionAdminRoutes } from "./permissions/adminRoutes"
import { logAction, registerActionLogRoutes } from "./actionLogs"
import { registerRosterListRoutes } from "./rosterLists"
import { env } from "./config"
import { getMongoDb } from "../src/lib/mongodb"
import { GridFSBucket, ObjectId } from "mongodb"
import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
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
  points?: number
  hours?: number
  timeInRankDays?: number
  trainingLogs?: number
  recruitmentLogs?: number
  trainings?: number
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

type RequirementChange = {
  rank: string
  old: Record<string, unknown>
  new: Record<string, unknown>
}

function buildActivityRequirementChanges(
  oldRequirements: ActivityRequirements["requirements"],
  newRequirements: ActivityRequirements["requirements"],
): RequirementChange[] {
  const ids = new Set([
    ...Object.keys(oldRequirements),
    ...Object.keys(newRequirements),
  ])

  return Array.from(ids)
    .map((rankId) => {
      const oldValue = oldRequirements[rankId]
      const newValue = newRequirements[rankId]
      const oldHours = Number(oldValue?.hours ?? 0)
      const newHours = Number(newValue?.hours ?? 0)

      if (oldHours === newHours) return null

      return {
        rank: newValue?.rankName || oldValue?.rankName || rankId,
        old: { hours: oldHours },
        new: { hours: newHours },
      }
    })
    .filter((value): value is RequirementChange => Boolean(value))
}

function buildPromotionRequirementChanges(
  oldRequirements: PromotionRequirements["requirements"],
  newRequirements: PromotionRequirements["requirements"],
): RequirementChange[] {
  const ids = new Set([
    ...Object.keys(oldRequirements),
    ...Object.keys(newRequirements),
  ])

  const fields = [
    "points",
    "hours",
    "timeInRankDays",
    "trainingLogs",
    "recruitmentLogs",
    "trainings",
  ] as const

  return Array.from(ids)
    .map((rankId) => {
      const oldValue = oldRequirements[rankId]
      const newValue = newRequirements[rankId]
      const oldChanges: Record<string, unknown> = {}
      const newChanges: Record<string, unknown> = {}

      for (const field of fields) {
        const oldField = oldValue?.[field]
        const newField = newValue?.[field]

        if (oldField === undefined && newField === undefined) continue

        const oldNumber = oldField === undefined ? 0 : Number(oldField)
        const newNumber = newField === undefined ? 0 : Number(newField)

        if (!Number.isFinite(oldNumber) || !Number.isFinite(newNumber)) continue
        if (oldNumber === newNumber) continue

        oldChanges[field] = oldNumber
        newChanges[field] = newNumber
      }

      if (!Object.keys(oldChanges).length) return null

      return {
        rank: newValue?.rankName || oldValue?.rankName || rankId,
        old: oldChanges,
        new: newChanges,
      }
    })
    .filter((value): value is RequirementChange => Boolean(value))
}

function requirementChangeSummary(
  division: string,
  changes: RequirementChange[],
  label: "hours" | "points",
): string {
  const displayDivision = division === "department"
    ? "Department"
    : division.toUpperCase()

  if (!changes.length) {
    return `${displayDivision} requirements saved with no changes.`
  }

  const visible = changes.slice(0, 4).map((change) => {
    const next = Number(change.new[label] ?? 0)
    return `${change.rank} → ${next} ${label}`
  })

  if (changes.length > visible.length) {
    visible.push(`+${changes.length - visible.length} more`)
  }

  return visible.join(" • ")
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

const DEFAULT_GALLERY_CATEGORIES = [
  "Community",
  "Fleet",
] as const

const DEFAULT_GALLERY_TAGS = [] as const

const DEFAULT_GALLERY_CATEGORY_COLORS: Record<string, string> = {
  Community: "#3b82f6",
  Fleet: "#ffffff",
}

const DEFAULT_GALLERY_TAG_COLORS: Record<string, string> = {}

function normalizeGalleryColor(value: unknown, fallback = "#3b82f6") {
  const color = typeof value === "string" ? value.trim().toLowerCase() : ""
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback
}

type GalleryTag = string
type GalleryCategory = string

function isGalleryTag(value: unknown): value is GalleryTag {
  return typeof value === "string" && value.trim().length > 0
}

function normalizeGalleryTags(value: unknown): GalleryTag[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter(isGalleryTag).map((tag) => tag.trim())))
}

function isGalleryCategory(value: unknown): value is GalleryCategory {
  return typeof value === "string" && value.trim().length > 0
}

type GalleryMedia = {
  id: string
  type: GalleryMediaType
  url: string
  thumbnailUrl: string
  source: "upload" | "url"
  storageId?: string
  extension?: string
  publicSlug?: string
}

type GalleryDocument = {
  _id?: ObjectId
  _galleryConfig?: boolean
  title: string
  description: string
  media: GalleryMedia[]
  category?: GalleryCategory
  tags?: GalleryTag[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
  categories?: string[]
  tagCategories?: Record<string, string[]>
  categoryColors?: Record<string, string>
  tagColors?: Record<string, string>

  // Legacy fields are kept optional so existing gallery
  // documents continue to work after this migration.
  type?: GalleryMediaType
  url?: string
  thumbnailUrl?: string
}

type GalleryTagsConfigDocument = {
  _id?: ObjectId
  key: "default"
  categories: string[]
  tags: string[]
  tagCategories: Record<string, string[]>
  categoryColors: Record<string, string>
  tagColors: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

async function getGalleryConfig() {
  const tagsCollection = await getCollection<GalleryTagsConfigDocument>("galleryTags")
  const existing = await tagsCollection.findOne({ key: "default" })

  if (existing) {
    const categories = existing.categories?.length ? existing.categories : [...DEFAULT_GALLERY_CATEGORIES]
    const legacyDefaultTags = new Set(["Dept", "SWAT", "MTF-7", "MCD", "TRU", "SAR"])
    const existingTags = Array.isArray(existing.tags) ? existing.tags : []
    const tags = existingTags.filter((tag) => !legacyDefaultTags.has(tag))
    const tagCategories = Object.fromEntries(
      categories.map((category) => [category, Array.from(new Set((existing.tagCategories?.[category] ?? []).filter((tag) => tags.includes(tag))))]),
    )

    // Remove the old built-in tags from the persisted galleryTags document as
    // well, so they do not come back after a refresh or deployment.
    if (tags.length !== existingTags.length) {
      const tagsCollection = await getCollection<GalleryTagsConfigDocument>("galleryTags")
      const tagColors = Object.fromEntries(
        Object.entries(existing.tagColors ?? {}).filter(([tag]) => tags.includes(tag)),
      )
      await tagsCollection.updateOne(
        { key: "default" },
        { $set: { tags, tagCategories, tagColors, updatedAt: new Date() } },
      )
    }
    const categoryColors = Object.fromEntries(
      categories.map((category) => [category, normalizeGalleryColor(existing.categoryColors?.[category], category === "Fleet" ? "#ffffff" : "#3b82f6")]),
    )
    const tagColors = Object.fromEntries(
      tags.map((tag, index) => [tag, normalizeGalleryColor(existing.tagColors?.[tag], index % 2 === 0 ? "#3b82f6" : "#ffffff")]),
    )

    return { categories, tags, tagCategories, categoryColors, tagColors }
  }

  // One-time migration from the old _galleryConfig document that lived in
  // the gallery collection. From this point forward galleryTags is the
  // dedicated collection for all Gallery categories, tags and colors.
  const gallery = await getCollection<GalleryDocument & { _galleryConfig?: boolean }>("gallery")
  const legacy = await gallery.findOne({ _galleryConfig: true })

  const categories = Array.isArray(legacy?.categories) && legacy.categories.length
    ? legacy.categories
    : [...DEFAULT_GALLERY_CATEGORIES]
  const tags = Array.isArray(legacy?.tags) && legacy.tags.length
    ? legacy.tags.filter((tag) => !["Dept", "SWAT", "MTF-7", "MCD", "TRU", "SAR"].includes(tag))
    : [...DEFAULT_GALLERY_TAGS]
  const legacyTagCategories = legacy && typeof legacy.tagCategories === "object" ? legacy.tagCategories : {}
  const tagCategories = Object.fromEntries(
    categories.map((category) => [category, Array.from(new Set((legacyTagCategories?.[category] ?? tags).filter((tag: string) => tags.includes(tag))))]),
  )
  const categoryColors = Object.fromEntries(
    categories.map((category) => [category, normalizeGalleryColor(legacy?.categoryColors?.[category], category === "Fleet" ? "#ffffff" : "#3b82f6")]),
  )
  const tagColors = Object.fromEntries(
    tags.map((tag, index) => [tag, normalizeGalleryColor(legacy?.tagColors?.[tag], index % 2 === 0 ? "#3b82f6" : "#ffffff")]),
  )

  const now = new Date()
  await tagsCollection.insertOne({
    key: "default",
    categories,
    tags,
    tagCategories,
    categoryColors,
    tagColors,
    createdAt: now,
    updatedAt: now,
  })

  if (legacy?._id) {
    await gallery.deleteOne({ _id: legacy._id })
  }

  return { categories, tags, tagCategories, categoryColors, tagColors }
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
  const storageId = cleanGalleryString(media.storageId)

  /*
   * GridFS-backed media must always use the current application's
   * gallery-file endpoint. Older records may contain an absolute URL
   * generated from a previous APP_ORIGIN/domain. Returning that stale
   * absolute URL is what causes existing images to become unavailable
   * after a domain/deployment change.
   *
   * The relative URL also works on local development, Render previews,
   * and the production custom domain without requiring APP_ORIGIN to be
   * perfectly configured.
   */
  if (storageId && ObjectId.isValid(storageId)) {
    const publicSlug = cleanGalleryString((media as GalleryMedia & { publicSlug?: string }).publicSlug)
    const extension = cleanGalleryString((media as GalleryMedia & { extension?: string }).extension)
    const mediaType = media.type === "video" ? "video" : "image"
    if (publicSlug && extension) {
      return `/gallery/${mediaType}/${publicSlug}.${extension}`
    }
    return `/api/gallery/file/${storageId}`
  }

  if (originalUrl) {
    if (originalUrl.startsWith("/")) {
      return APP_ORIGIN
        ? `${APP_ORIGIN}${originalUrl}`
        : originalUrl
    }

    return originalUrl
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

function slugifyGalleryTitle(value: string) {
  return cleanGalleryString(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "gallery"
}

async function storeGalleryFile(
  file: Express.Multer.File,
  publicBaseName?: string,
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
  const originalFilename = file.originalname?.trim() || `gallery-${Date.now()}`
  const originalExtension = path.extname(originalFilename).toLowerCase()
  const filename = publicBaseName
    ? `${slugifyGalleryTitle(publicBaseName)}${originalExtension || ".bin"}`
    : originalFilename
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
        publicSlug: slugifyGalleryTitle(publicBaseName || path.basename(filename, path.extname(filename))),
        galleryTitle: publicBaseName || path.basename(filename, path.extname(filename)),
        publicExtension: path.extname(filename).replace(/^\./, "").toLowerCase() || "bin",
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
    const extension = path.extname(filename).replace(/^\./, "").toLowerCase() || "bin"
    const publicSlug = slugifyGalleryTitle(publicBaseName || path.basename(filename, path.extname(filename)))
    const filePath = `/gallery/${type}/${publicSlug}.${extension}`

    return {
      id: storageId,
      type,
      url: APP_ORIGIN
        ? `${APP_ORIGIN}${filePath}`
        : filePath,
      thumbnailUrl: "",
      source: "upload" as const,
      storageId,
      extension,
      publicSlug,
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

function getGalleryExtensionFromContentType(
  contentType: string,
  fallback = "bin",
) {
  const clean = contentType.toLowerCase().split(";")[0].trim()
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/tiff": "tiff",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/ogg": "ogv",
    "video/mpeg": "mpeg",
  }
  return map[clean] || fallback
}

async function downloadGalleryUrlToFile(
  sourceUrl: string,
  expectedType?: GalleryMediaType,
  publicBaseName?: string,
) {
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 MPD Gallery",
      "Accept": "image/*,video/*,*/*;q=0.8",
    },
  })

  if (!response.ok || !response.body) {
    throw new Error(`The URL returned HTTP ${response.status}.`)
  }

  const contentType = response.headers.get("content-type") || ""
  let detectedType = getGalleryFileType(contentType, sourceUrl)

  // If the link is a webpage rather than a direct media file, extract the
  // page's Open Graph media URL and download that actual media instead.
  if (!detectedType && contentType.toLowerCase().includes("text/html")) {
    const html = await response.text()
    const metaPattern =
      expectedType === "video"
        ? /<meta[^>]+(?:property|name)=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i
        : /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i

    const reverseMetaPattern =
      expectedType === "video"
        ? /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:video(?::secure_url)?["'][^>]*>/i
        : /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i

    const match = html.match(metaPattern) || html.match(reverseMetaPattern)
    const extractedUrl = match?.[1]?.trim()

    if (extractedUrl) {
      const absoluteUrl = new URL(extractedUrl, response.url).toString()
      return downloadGalleryUrlToFile(absoluteUrl, expectedType, publicBaseName)
    }
  }

  const type = detectedType || expectedType

  if (!type) {
    throw new Error("The URL does not point to a supported image or video.")
  }

  if (expectedType && detectedType && expectedType !== detectedType) {
    throw new Error(`The URL contains a ${detectedType}, not an ${expectedType}.`)
  }

  const lengthHeader = response.headers.get("content-length")
  const length = lengthHeader ? Number(lengthHeader) : 0
  if (length > 100 * 1024 * 1024) {
    throw new Error("The downloaded media is larger than the 100 MB gallery limit.")
  }

  const extension =
    path.extname(new URL(response.url).pathname).replace(/^\./, "").toLowerCase() ||
    getGalleryExtensionFromContentType(contentType, type === "video" ? "mp4" : "jpg")

  const jobId = randomUUID()
  const filePath = path.join(
    GALLERY_UPLOAD_DIR,
    `url-${jobId}.${extension}`,
  )

  try {
    const output = fs.createWriteStream(filePath)
    let bytes = 0

    const body = Readable.fromWeb(
      response.body as globalThis.ReadableStream<Uint8Array>,
    )

    body.on("data", (chunk: Buffer | Uint8Array) => {
      bytes += chunk.length
      if (bytes > 100 * 1024 * 1024) {
        body.destroy(
          new Error(
            "The downloaded media is larger than the 100 MB gallery limit.",
          ),
        )
      }
    })

    await new Promise<void>((resolve, reject) => {
      body.once("error", reject)
      output.once("error", reject)
      output.once("finish", resolve)
      body.pipe(output)
    })

    const stat = await fs.promises.stat(filePath)
    if (stat.size <= 0) {
      throw new Error("The URL returned an empty media file.")
    }

    const stored = await storeGalleryFile({
      fieldname: "file",
      originalname: `gallery-${jobId}.${extension}`,
      encoding: "7bit",
      mimetype: contentType || (type === "video" ? "video/mp4" : "image/jpeg"),
      size: stat.size,
      destination: GALLERY_UPLOAD_DIR,
      filename: path.basename(filePath),
      path: filePath,
      buffer: undefined,
      stream: fs.createReadStream(filePath),
    } as Express.Multer.File, publicBaseName)

    return stored
  } finally {
    await safeUnlinkGalleryTempFile(filePath)
  }
}

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v")
      const parts = url.pathname.split("/").filter(Boolean)
      if (["shorts", "embed", "live"].includes(parts[0] ?? "")) return parts[1] || null
    }
  } catch {
    return null
  }
  return null
}

function getYouTubeThumbnailForServer(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    let id = ""
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] || ""
    else if (host === "youtube.com" || host === "m.youtube.com") id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).slice(1)[0] || ""
    return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : ""
  } catch { return "" }
}

async function importGalleryExternalVideo(
  sourceUrl: string,
  publicBaseName?: string,
) {
  const url = sourceUrl.trim()

  if (!isSupportedGalleryExternalVideoUrl(url)) {
    return downloadGalleryUrlToFile(url, "video", publicBaseName)
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

    const extension = path.extname(filename).replace(/^\./, "").toLowerCase() || "mp4"
    const stored = await storeGalleryFile({
      fieldname: "file",
      originalname: `gallery-${jobId}.${extension}`,
      encoding: "7bit",
      mimetype: extension === "webm" ? "video/webm" : "video/mp4",
      size: stat.size,
      destination: GALLERY_UPLOAD_DIR,
      filename,
      path: filePath,
      buffer: undefined,
      stream: fs.createReadStream(filePath),
    } as Express.Multer.File, publicBaseName)

    return {
      ...stored,
      source: "url" as const,
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

    if (/sign in|cookies|authentication|confirm you.?re not a bot/i.test(message) && getYouTubeVideoId(url)) {
      return {
        id: randomUUID(),
        type: "video" as const,
        url,
        thumbnailUrl: getYouTubeThumbnailForServer(url),
        source: "url" as const,
      }
    }

    throw new Error(
      `Unable to import the video from the URL. ${message}`,
    )
  }
}

async function importGalleryMediaUrl(
  sourceUrl: string,
  requestedType: GalleryMediaType,
  publicBaseName?: string,
) {
  if (requestedType === "video") {
    return importGalleryExternalVideo(sourceUrl, publicBaseName)
  }

  return downloadGalleryUrlToFile(sourceUrl, "image", publicBaseName)
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

    const timeInRankDays = Number(item.timeInRankDays ?? 0)
    const trainingLogs = Number(item.trainingLogs ?? 0)
    const recruitmentLogs = Number(item.recruitmentLogs ?? 0)

    requirements[
      cleanRankId
    ] = {
      rankId: cleanRankId,
      rankName,
      hours: Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0,
      timeInRankDays: Number.isFinite(timeInRankDays) ? Math.max(0, Math.floor(timeInRankDays)) : 0,
      trainingLogs: Number.isFinite(trainingLogs) ? Math.max(0, Math.floor(trainingLogs)) : 0,
      recruitmentLogs: Number.isFinite(recruitmentLogs) ? Math.max(0, Math.floor(recruitmentLogs)) : 0,
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

    const hours = Number(input.hours ?? existingRequirement?.hours ?? 0)
    const timeInRankDays = Number(input.timeInRankDays ?? existingRequirement?.timeInRankDays ?? 0)
    const trainingLogs = Number(input.trainingLogs ?? existingRequirement?.trainingLogs ?? 0)
    const recruitmentLogs = Number(input.recruitmentLogs ?? existingRequirement?.recruitmentLogs ?? 0)

    normalizedRequirements[
      cleanRankId
    ] = {
      rankId: cleanRankId,
      rankName,
      hours: Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0,
      timeInRankDays: Number.isFinite(timeInRankDays) ? Math.max(0, Math.floor(timeInRankDays)) : 0,
      trainingLogs: Number.isFinite(trainingLogs) ? Math.max(0, Math.floor(trainingLogs)) : 0,
      recruitmentLogs: Number.isFinite(recruitmentLogs) ? Math.max(0, Math.floor(recruitmentLogs)) : 0,
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

  const document = await collection.findOne({ userId, division })
  const rawRequirements = document?.requirements ?? {}
  const requirements: Record<string, PromotionRequirement> = {}
  const rankConfig = await readPromotionRankConfig(division)

  const numericFields = [
    "points",
    "hours",
    "timeInRankDays",
    "trainingLogs",
    "recruitmentLogs",
    "trainings",
  ] as const

  for (const [rankId, value] of Object.entries(rawRequirements)) {
    const item = value as Partial<PromotionRequirement>
    const cleanRankId = String(item.rankId ?? rankId).trim()
    if (!cleanRankId) continue

    const configuredRank = findRankById(rankConfig, cleanRankId)
    const storedRankName = String(item.rankName ?? "").trim()
    const rankName = configuredRank?.name || storedRankName || cleanRankId

    const normalized: PromotionRequirement = {
      rankId: cleanRankId,
      rankName,
    }

    for (const field of numericFields) {
      const valueForField = item[field]
      if (valueForField === undefined || valueForField === null || valueForField === "") continue
      const number = Number(valueForField)
      if (Number.isFinite(number)) {
        normalized[field] = Math.max(0, Math.floor(number))
      }
    }

    requirements[cleanRankId] = normalized
  }

  return { division, requirements }
}

async function writePromotionRequirements(
  userId: string,
  division: RequirementDivision,
  requirements: Record<string, PromotionRequirement>,
) {
  const collection =
    await getCollection<PromotionRequirementsDocument>(
      "promotionRequirements",
    )

  const existing = await collection.findOne({ userId, division })
  const existingRequirements = existing?.requirements ?? {}
  const rankConfig = await readPromotionRankConfig(division)
  const normalizedRequirements: Record<string, PromotionRequirement> = {}

  const numericFields = [
    "points",
    "hours",
    "timeInRankDays",
    "trainingLogs",
    "recruitmentLogs",
    "trainings",
  ] as const

  for (const [rankId, value] of Object.entries(requirements)) {
    const input = value as Partial<PromotionRequirement>
    const cleanRankId = String(input.rankId ?? rankId).trim()
    if (!cleanRankId) continue

    const configuredRank = findRankById(rankConfig, cleanRankId)
    const existingRequirement = existingRequirements[cleanRankId] as PromotionRequirement | undefined
    const suppliedRankName = String(input.rankName ?? "").trim()
    const rankName = configuredRank?.name || suppliedRankName || existingRequirement?.rankName || cleanRankId

    const normalized: PromotionRequirement = {
      rankId: cleanRankId,
      rankName,
    }

    for (const field of numericFields) {
      const supplied = input[field]
      const previous = existingRequirement?.[field]
      if (supplied === undefined && previous === undefined) continue

      const raw = supplied === undefined ? previous : supplied
      const number = Number(raw ?? 0)
      normalized[field] = Number.isFinite(number)
        ? Math.max(0, Math.floor(number))
        : 0
    }

    normalizedRequirements[cleanRankId] = normalized
  }

  await collection.updateOne(
    { userId, division },
    {
      $set: {
        userId,
        division,
        requirements: normalizedRequirements,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )

  return { division, requirements: normalizedRequirements }
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
    const changes: Array<Record<string, unknown>> = []

    for (
      const [
        discordId,
        hours,
      ] of rows
    ) {
      const previousHours = hoursByDiscordId.get(discordId)
      if (previousHours !== undefined) {
        updated++
        if (previousHours !== hours) {
          changes.push({ discordId, old: previousHours, new: hours })
        }
      } else {
        added++
        changes.push({ discordId, old: null, new: hours })
      }

      hoursByDiscordId.set(discordId, hours)
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

    await logAction(user, {
      module: "activity",
      action: "import-activity",
      category: "import",
      division,
      summary: `${division === "department" ? "Department" : division.toUpperCase()} activity import updated ${changes.length} values.`,
      details: {
        changes: changes.slice(0, 120),
        added,
        updated,
        imported: rows.length,
        totalMembers: hours.length,
      },
      path: req.path,
    }) .catch((error) => console.error("[action-log] Failed to persist audit entry:", error))

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
    const changes: Array<Record<string, unknown>> = []

    for (
      const [
        discordId,
        points,
      ] of rows
    ) {
      const previousPoints = pointsByDiscordId.get(discordId)
      if (previousPoints !== undefined) {
        updated++
        if (previousPoints !== points) {
          changes.push({ discordId, old: previousPoints, new: points })
        }
      } else {
        added++
        changes.push({ discordId, old: null, new: points })
      }

      pointsByDiscordId.set(discordId, points)
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

    await logAction(user, {
      module: "promotion",
      action: "import-promotion",
      category: "import",
      division,
      summary: `${division === "department" ? "Department" : division.toUpperCase()} promotion import updated ${changes.length} values.`,
      details: {
        changes: changes.slice(0, 120),
        added,
        updated,
        imported: rows.length,
        totalMembers: points.length,
      },
      path: req.path,
    }) .catch((error) => console.error("[action-log] Failed to persist audit entry:", error))

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

      const hours = Number(input.hours ?? 0)
      const timeInRankDays = Number(input.timeInRankDays ?? 0)
      const trainingLogs = Number(input.trainingLogs ?? 0)
      const recruitmentLogs = Number(input.recruitmentLogs ?? 0)

      if (
        !Number.isFinite(hours) || hours < 0 ||
        !Number.isFinite(timeInRankDays) || timeInRankDays < 0 ||
        !Number.isFinite(trainingLogs) || trainingLogs < 0 ||
        !Number.isFinite(recruitmentLogs) || recruitmentLogs < 0
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

        hours: Math.floor(hours),
        timeInRankDays: Math.floor(timeInRankDays),
        trainingLogs: Math.floor(trainingLogs),
        recruitmentLogs: Math.floor(recruitmentLogs),
      }
    }

    const previous = await readActivityRequirements(userId, division)
    const saved = await writeActivityRequirements(userId, division, requirements)
    const changes = buildActivityRequirementChanges(previous.requirements, saved.requirements)

    await logAction(user, {
      module: "activity",
      action: "update-requirements",
      category: "requirements",
      division,
      summary: requirementChangeSummary(division, changes, "hours"),
      details: {
        changes,
        changedRanks: changes.length,
        totalRanks: Object.keys(saved.requirements).length,
      },
      path: req.path,
    }) .catch((error) => console.error("[action-log] Failed to persist audit entry:", error))

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

      const input = value as {
        rankId?: unknown
        rankName?: unknown
        name?: unknown
        points?: unknown
        hours?: unknown
        timeInRankDays?: unknown
        trainingLogs?: unknown
        recruitmentLogs?: unknown
        trainings?: unknown
      }

      const numericFields = [
        "points",
        "hours",
        "timeInRankDays",
        "trainingLogs",
        "recruitmentLogs",
        "trainings",
      ] as const

      for (const field of numericFields) {
        if (input[field] === undefined) continue
        const number = Number(input[field])
        if (!Number.isFinite(number) || number < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid promotion ${field} for rank: ${rankId}`,
          })
        }
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

      const normalizedInput: PromotionRequirement = {
        rankId: cleanRankId,
        rankName,
      }

      for (const field of [
        "points",
        "hours",
        "timeInRankDays",
        "trainingLogs",
        "recruitmentLogs",
        "trainings",
      ] as const) {
        if (input[field] === undefined) continue
        const number = Number(input[field])
        normalizedInput[field] = Number.isFinite(number)
          ? Math.floor(number)
          : 0
      }

      requirements[cleanRankId] = normalizedInput
    }

    const previous = await readPromotionRequirements(userId, division)
    const saved = await writePromotionRequirements(userId, division, requirements)
    const changes = buildPromotionRequirementChanges(previous.requirements, saved.requirements)

    await logAction(user, {
      module: "promotion",
      action: "update-requirements",
      category: "requirements",
      division,
      summary: requirementChangeSummary(division, changes, "hours"),
      details: {
        changes,
        changedRanks: changes.length,
        totalRanks: Object.keys(saved.requirements).length,
      },
      path: req.path,
    }) .catch((error) => console.error("[action-log] Failed to persist audit entry:", error))

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
  registerRosterListRoutes(app)

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "mpd-dashboard",
    })
  })

  /* ─────────────────────────────────────────
     Desktop Releases
  ───────────────────────────────────────── */

  /*
   * Desktop releases are proxied through this server.
   *
   * The browser never talks to the GitHub API directly and never receives a
   * GitHub repository URL or access token. This allows the repository to be
   * private while the public MPD download page remains available.
   *
   * Render environment variable:
   *   GITHUB_RELEASE_TOKEN
   *
   * For a private repository, use a fine-grained GitHub token with read-only
   * Contents access to EagleModifications/MPDWebsite-Render.
   */

  const GITHUB_REPOSITORY =
    "EagleModifications/MPDWebsite-Render"

  const GITHUB_API_BASE =
    `https://api.github.com/repos/${GITHUB_REPOSITORY}`

  const GITHUB_RELEASES_URL =
    `${GITHUB_API_BASE}/releases?per_page=20`

  const GITHUB_RELEASE_TOKEN =
    process.env.GITHUB_RELEASE_TOKEN?.trim() || ""

  const RELEASE_CACHE_TTL = 5 * 60 * 1000

  type CachedReleasePayload = {
    releases: SafeDesktopRelease[]
    cachedAt: number
  }

  type SafeDesktopAsset = {
    id: number
    name: string
    size: number
    download_count: number
    content_type: string
    created_at: string
    updated_at: string
    download_url: string
  }

  type SafeDesktopRelease = {
    id: string
    name: string
    tag_name: string
    body: string
    prerelease: boolean
    published_at: string
    created_at: string
    assets: SafeDesktopAsset[]
  }

  let cachedReleasePayload: CachedReleasePayload | null = null

  const ALLOWED_RELEASE_EXTENSIONS = new Set([
    ".exe",
    ".dmg",
    ".appimage",
  ])

  const ALLOWED_CHECKSUM_NAME =
    /^sha256sums\.txt$/i

  const githubHeaders = (
    accept = "application/vnd.github+json",
  ): Record<string, string> => {
    const headers: Record<string, string> = {
      Accept: accept,
      "User-Agent": "MetroPoliceDepartment/desktop-releases",
      "X-GitHub-Api-Version": "2022-11-28",
    }

    if (GITHUB_RELEASE_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_RELEASE_TOKEN}`
    }

    return headers
  }

  const isAllowedAssetName = (value: unknown) => {
    if (typeof value !== "string") return false

    const name = path.basename(value).trim().toLowerCase()

    return (
      Array.from(ALLOWED_RELEASE_EXTENSIONS).some((extension) =>
        name.endsWith(extension),
      ) || ALLOWED_CHECKSUM_NAME.test(name)
    )
  }

  const toSafeRelease = (
    release: unknown,
  ): SafeDesktopRelease | null => {
    if (!release || typeof release !== "object") {
      return null
    }

    const source = release as Record<string, unknown>

    if (Boolean(source.draft)) {
      return null
    }

    const rawAssets = Array.isArray(source.assets)
      ? source.assets
      : []

    const assets = rawAssets
      .filter(
        (asset): asset is Record<string, unknown> =>
          Boolean(asset && typeof asset === "object"),
      )
      .map((asset) => {
        const id = Number(asset.id ?? 0)
        const name = String(asset.name ?? "").trim()

        if (
          !Number.isSafeInteger(id) ||
          id <= 0 ||
          !name ||
          !isAllowedAssetName(name)
        ) {
          return null
        }

        return {
          id,
          name,
          size: Number.isFinite(Number(asset.size))
            ? Number(asset.size)
            : 0,
          download_count: Number.isFinite(
            Number(asset.download_count),
          )
            ? Number(asset.download_count)
            : 0,
          content_type: String(asset.content_type ?? ""),
          created_at: String(asset.created_at ?? ""),
          updated_at: String(asset.updated_at ?? ""),
          download_url: `/api/releases/download/${id}`,
        }
      })
      .filter(
        (asset): asset is SafeDesktopAsset =>
          Boolean(asset),
      )

    const installerCount = assets.filter((asset) =>
      Array.from(ALLOWED_RELEASE_EXTENSIONS).some((extension) =>
        asset.name.toLowerCase().endsWith(extension),
      ),
    ).length

    // Never expose a release that has no supported desktop installer.
    if (installerCount === 0) {
      return null
    }

    const tagName = String(
      source.tag_name ?? "",
    ).trim()

    return {
      id: String(source.id ?? ""),
      name: String(
        (source.name ?? tagName) ||
          "Metro Police Department Desktop",
      ),
      tag_name: tagName,
      body:
        typeof source.body === "string"
          ? source.body
          : "",
      prerelease: Boolean(source.prerelease),
      published_at: String(
        source.published_at ?? "",
      ),
      created_at: String(
        source.created_at ?? "",
      ),
      assets,
    }
  }

  const fetchGitHubReleases = async (): Promise<SafeDesktopRelease[]> => {
    if (!GITHUB_RELEASE_TOKEN) {
      console.warn(
        "[releases] GITHUB_RELEASE_TOKEN is not configured. Public GitHub repositories can still be read, but a private repository requires this variable.",
      )
    }

    const response = await fetch(
      GITHUB_RELEASES_URL,
      {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!response.ok) {
      const body = await response
        .text()
        .catch(() => "")

      console.error(
        "[releases] GitHub API request failed:",
        response.status,
        {
          remaining: response.headers.get(
            "x-ratelimit-remaining",
          ),
          reset: response.headers.get(
            "x-ratelimit-reset",
          ),
          body: body.slice(0, 500),
        },
      )

      throw new Error(
        `GitHub releases returned HTTP ${response.status}.`,
      )
    }

    const data =
      (await response.json()) as unknown

    if (!Array.isArray(data)) {
      throw new Error(
        "GitHub returned an invalid release response.",
      )
    }

    return data
      .map(toSafeRelease)
      .filter(
        (release): release is SafeDesktopRelease =>
          Boolean(release),
      )
  }

  app.get(
    "/api/releases",
    async (_req, res) => {
      try {
        const now = Date.now()

        if (
          cachedReleasePayload &&
          now - cachedReleasePayload.cachedAt <
            RELEASE_CACHE_TTL
        ) {
          res.setHeader(
            "Cache-Control",
            "private, max-age=60, stale-while-revalidate=300",
          )

          return res.json({
            success: true,
            releases:
              cachedReleasePayload.releases,
          })
        }

        const releases =
          await fetchGitHubReleases()

        cachedReleasePayload = {
          releases,
          cachedAt: now,
        }

        res.setHeader(
          "Cache-Control",
          "private, max-age=60, stale-while-revalidate=300",
        )

        return res.json({
          success: true,
          releases,
        })
      } catch (error) {
        console.error(
          "[releases] Failed to load desktop releases:",
          error,
        )

        // Keep the public page working during a temporary GitHub outage.
        if (cachedReleasePayload) {
          res.setHeader(
            "Cache-Control",
            "private, max-age=30, stale-while-revalidate=300",
          )

          return res.json({
            success: true,
            stale: true,
            releases:
              cachedReleasePayload.releases,
          })
        }

        return res.status(503).json({
          success: false,
          error: GITHUB_RELEASE_TOKEN
            ? "Desktop releases are temporarily unavailable."
            : "Desktop releases are not configured on the server.",
        })
      }
    },
  )

  /*
   * Electron auto-update proxy.
   *
   * electron-updater's generic provider requests files such as:
   *   latest.yml
   *   latest-mac.yml
   *   latest-linux.yml
   * and then the installer/blockmap named by those metadata files.
   *
   * GitHub stays private. The Electron app talks only to this public
   * endpoint; the GitHub token remains on the Render server.
   */
  app.get(
    "/api/desktop-updates/:fileName",
    async (req, res) => {
      const fileName =
        typeof req.params.fileName === "string"
          ? path.basename(req.params.fileName).trim()
          : ""

      // electron-updater only needs these metadata and release artifact files.
      // Keep the route deliberately narrow so it cannot become a generic
      // proxy into GitHub.
      const isUpdateMetadata =
        /^latest(?:-mac|-linux)?\.yml$/i.test(fileName)

      const isUpdateArtifact =
        /\.(?:exe|dmg|appimage|blockmap)$/i.test(fileName)

      if (!fileName || (!isUpdateMetadata && !isUpdateArtifact)) {
        return res.status(404).end()
      }

      try {
        // Use GitHub's latest-release endpoint here rather than the public
        // /api/releases cache. The public download API intentionally exposes
        // installers only, while electron-updater also needs its YAML and
        // blockmap metadata files.
        const releaseResponse = await fetch(
          `${GITHUB_API_BASE}/releases/latest`,
          {
            headers: githubHeaders(),
            signal: AbortSignal.timeout(10_000),
          },
        )

        if (!releaseResponse.ok) {
          const body = await releaseResponse.text().catch(() => "")

          console.error(
            "[desktop-updates] Latest release lookup failed:",
            releaseResponse.status,
            body.slice(0, 500),
          )

          return res.status(502).end()
        }

        const latestRelease =
          (await releaseResponse.json()) as {
            assets?: Array<{
              id?: number
              name?: string
            }>
          }

        const knownAsset =
          latestRelease.assets?.find(
            (asset) =>
              Number.isSafeInteger(Number(asset.id)) &&
              Number(asset.id) > 0 &&
              typeof asset.name === "string" &&
              asset.name.toLowerCase() ===
                fileName.toLowerCase(),
          )

        if (!knownAsset) {
          return res.status(404).end()
        }

        const response = await fetch(
          `${GITHUB_API_BASE}/releases/assets/${Number(
            knownAsset.id,
          )}`,
          {
            headers: githubHeaders(
              "application/octet-stream",
            ),
            redirect: "follow",
            signal: AbortSignal.timeout(60_000),
          },
        )

        if (!response.ok || !response.body) {
          const body = await response.text().catch(() => "")

          console.error(
            "[desktop-updates] GitHub asset request failed:",
            response.status,
            body.slice(0, 500),
          )

          return res.status(502).end()
        }

        res.setHeader(
          "Content-Type",
          isUpdateMetadata
            ? "text/yaml; charset=utf-8"
            : (
                response.headers.get("content-type") ||
                "application/octet-stream"
              ),
        )
        res.setHeader(
          "Cache-Control",
          isUpdateMetadata
            ? "no-store"
            : "public, max-age=300",
        )
        res.setHeader("X-Content-Type-Options", "nosniff")

        const contentLength =
          response.headers.get("content-length")

        if (contentLength) {
          res.setHeader(
            "Content-Length",
            contentLength,
          )
        }

        Readable.fromWeb(
          response.body as unknown as Parameters<
            typeof Readable.fromWeb
          >[0],
        ).on("error", (error) => {
          console.error(
            "[desktop-updates] Streaming failed:",
            error,
          )

          if (!res.headersSent) {
            res.status(502).end()
          } else {
            res.destroy()
          }
        }).pipe(res)
      } catch (error) {
        console.error(
          "[desktop-updates] Failed:",
          error,
        )

        return res.status(502).end()
      }
    },
  )

  /*
   * Private-repository download proxy.
   *
   * The client supplies only the numeric GitHub asset ID returned by
   * /api/releases. The server verifies that the asset belongs to the current
   * allowed release list, then downloads it from GitHub using the private
   * server-side token and streams it to the browser.
   */
  app.get(
    "/api/releases/download/:assetId",
    async (req, res) => {
      const assetId = Number(
        req.params.assetId,
      )

      if (
        !Number.isSafeInteger(assetId) ||
        assetId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid release asset.",
        })
      }

      try {
        let releases =
          cachedReleasePayload?.releases ?? null

        if (!releases) {
          releases =
            await fetchGitHubReleases()

          cachedReleasePayload = {
            releases,
            cachedAt: Date.now(),
          }
        }

        let knownAsset:
          SafeDesktopAsset | null = null

        for (const release of releases) {
          const match =
            release.assets.find(
              (asset) =>
                asset.id === assetId,
            )

          if (match) {
            knownAsset = match
            break
          }
        }

        if (!knownAsset) {
          return res.status(404).json({
            success: false,
            error: "Release asset not found.",
          })
        }

        if (!isAllowedAssetName(knownAsset.name)) {
          return res.status(404).json({
            success: false,
            error: "Release asset not found.",
          })
        }

        const response = await fetch(
          `${GITHUB_API_BASE}/releases/assets/${assetId}`,
          {
            headers: githubHeaders(
              "application/octet-stream",
            ),
            redirect: "follow",
            signal: AbortSignal.timeout(60_000),
          },
        )

        if (!response.ok || !response.body) {
          const body = await response
            .text()
            .catch(() => "")

          console.error(
            "[releases] Asset download failed:",
            response.status,
            body.slice(0, 300),
          )

          return res.status(502).json({
            success: false,
            error:
              "The desktop download is temporarily unavailable.",
          })
        }

        const contentType =
          response.headers.get(
            "content-type",
          ) ||
          knownAsset.content_type ||
          "application/octet-stream"

        const contentLength =
          response.headers.get(
            "content-length",
          )

        res.status(200)
        res.setHeader(
          "Content-Type",
          contentType,
        )
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${knownAsset.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        )
        res.setHeader(
          "Cache-Control",
          "private, max-age=0, no-store",
        )
        res.setHeader(
          "X-Content-Type-Options",
          "nosniff",
        )

        if (contentLength) {
          res.setHeader(
            "Content-Length",
            contentLength,
          )
        }

        Readable.fromWeb(
          response.body as globalThis.ReadableStream,
        ).pipe(res)

        return undefined
      } catch (error) {
        console.error(
          "[releases] Asset download proxy failed:",
          error,
        )

        if (!res.headersSent) {
          return res.status(502).json({
            success: false,
            error:
              "The desktop download is temporarily unavailable.",
          })
        }

        res.end()
        return undefined
      }
    },
  )

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
        // Never send the underlying OAuth/Discord error to the browser.
        // Authentication failures can contain provider details, request
        // information, or other implementation details that should remain
        // server-side. Log the real error for diagnostics and expose only a
        // stable, generic error code to the user.
        console.error("[auth] Discord OAuth callback failed:", error)

        res.redirect(
          "/sign-in?error=authentication_failed",
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
      const permission =
        typeof req.query.permission === "string"
          ? req.query.permission
          : null

      const requestedUrl =
        typeof req.query.url === "string"
          ? req.query.url
          : null

      /*
       * There are two consumers of this endpoint:
       *
       * 1. PageProtection uses ?url=/some/page to determine whether the
       *    browser route itself requires authentication.
       * 2. Public pages such as Events and Gallery use ?permission=events
       *    or ?permission=gallery to determine whether the current visitor
       *    has management access.
       *
       * These are deliberately handled separately. A public page must NOT
       * become private just because its management controls use this endpoint.
       */
      if (requestedUrl !== null) {
        const protectedPage =
          await isPageProtected(requestedUrl)

        /*
         * Public browser route: no session is required. This is the important
         * branch that prevents /, /events, /gallery, and other unprotected
         * routes from being redirected to /sign-in.
         */
        if (!protectedPage) {
          return res.json({
            allowed: true,
            protected: false,
          })
        }

        const user =
          await getRequestUser(req)

        if (!user) {
          return res.status(401).json({
            error: "Unauthorized",
            protected: true,
          })
        }

        const allowed =
          await canAccessPage(
            user,
            requestedUrl,
          )

        if (!allowed) {
          return res.status(403).json({
            error: "Forbidden",
            protected: true,
          })
        }

        return res.json({
          allowed: true,
          protected: true,
          user,
        })
      }

      /*
       * Permission-only check. This is used by public pages to decide whether
       * to show authenticated management actions. Anonymous visitors simply
       * receive 401, which the page interprets as "cannot manage" rather than
       * redirecting the visitor away from the public page.
       */
      const user =
        await getRequestUser(req)

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
        })
      }

      if (
        permission &&
        !hasPermission(
          user,
          permission,
        )
      ) {
        return res.status(403).json({
          error: "Forbidden",
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

  app.get("/gallery/:type/:slug.:extension", async (req, res) => {
    try {
      const type = req.params.type === "video" ? "video" : req.params.type === "image" ? "image" : ""
      const slug = cleanGalleryString(req.params.slug)
      const extension = cleanGalleryString(req.params.extension).toLowerCase()

      if (!type || !slug || !extension) {
        return res.status(404).send("Gallery media not found")
      }

      const bucket = await getGalleryBucket()
      const files = await bucket.find({
        "metadata.publicSlug": slug,
        "metadata.publicExtension": extension,
        "metadata.mediaType": type,
      }).limit(1).toArray()

      const file = files[0]
      if (!file) return res.status(404).send("Gallery media not found")

      const contentType = getGalleryContentType(
        typeof file.contentType === "string" ? file.contentType : "",
        typeof file.filename === "string" ? file.filename : `gallery.${extension}`,
        type,
      )

      const raw = req.query.raw === "1"
      const acceptsHtml = String(req.headers.accept ?? "").includes("text/html")

      if (!raw && acceptsHtml) {
        const title = typeof file.metadata?.galleryTitle === "string"
          ? file.metadata.galleryTitle
          : typeof file.metadata?.originalName === "string"
            ? file.metadata.originalName
            : `Gallery ${type}`
        const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        const mediaUrl = `/gallery/${type}/${slug}.${extension}?raw=1`
        const mediaMarkup = type === "image"
          ? `<img src="${mediaUrl}" alt="${safeTitle}" style="max-width:96vw;max-height:90vh;object-fit:contain;display:block;margin:auto" />`
          : `<video src="${mediaUrl}" controls autoplay muted playsinline style="max-width:96vw;max-height:90vh;display:block;margin:auto"></video>`

        res.setHeader("Content-Type", "text/html; charset=utf-8")
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
        return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle} | Metro Police Department</title><link rel="icon" href="/logo.png"></head><body style="margin:0;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center">${mediaMarkup}</body></html>`)
      }

      res.setHeader("Content-Type", contentType)
      res.setHeader("Content-Disposition", "inline")
      res.setHeader("Accept-Ranges", "bytes")
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")

      const totalLength = Number(file.length)
      const range = req.headers.range
      const objectId = file._id

      if (!range) {
        res.status(200).setHeader("Content-Length", String(totalLength))
        const stream = bucket.openDownloadStream(objectId)
        stream.once("error", () => { if (!res.headersSent) res.status(500).end(); else res.end() })
        stream.pipe(res)
        return
      }

      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
      if (!match) return res.status(416).end()
      const requestedStart = match[1] ? Number(match[1]) : null
      const requestedEnd = match[2] ? Number(match[2]) : null
      const start = requestedStart === null ? Math.max(0, totalLength - (requestedEnd ?? 0)) : requestedStart
      let end = requestedStart === null ? totalLength - 1 : (requestedEnd ?? totalLength - 1)
      if (start < 0 || start >= totalLength || end < start) return res.status(416).end()
      end = Math.min(end, totalLength - 1)
      const length = end - start + 1
      res.status(206)
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalLength}`)
      res.setHeader("Content-Length", String(length))
      bucket.openDownloadStream(objectId, { start, end: end + 1 }).pipe(res)
      return
    } catch (error) {
      console.error("GET /gallery/:type/:slug.:extension failed:", error)
      return res.status(404).send("Gallery media not found")
    }
  })

  app.get("/api/gallery", async (_req, res) => {
    try {
      // Public read endpoint: guests can view the gallery.
      // Upload/edit/delete endpoints below still require authentication + permission.
      const gallery =
        await getCollection<GalleryDocument>(
          "gallery",
        )

      const results = await gallery
        .find({ _galleryConfig: { $ne: true } })
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

  app.get("/api/gallery/options", async (_req, res) => {
    try {
      const options = await getGalleryConfig()
      return res.json({ success: true, ...options })
    } catch (error) {
      console.error("GET /api/gallery/options failed:", error)
      return res.status(500).json({ success: false, error: "Failed to load gallery options" })
    }
  })

  app.post("/api/gallery/options", async (req, res) => {
    try {
      const user = await getRequestUser(req)
      if (!user) return res.status(401).json({ success: false, error: "Not authenticated" })
      if (!hasPermission(user, "gallery")) return res.status(403).json({ success: false, error: "You do not have permission to manage the gallery" })

      const type = req.body?.type === "category" || req.body?.type === "tag" ? req.body.type : ""
      const value = cleanGalleryString(req.body?.value)
      const requestedCategories = Array.isArray(req.body?.categories)
        ? Array.from(new Set(req.body.categories.map((entry: unknown) => cleanGalleryString(entry)).filter(Boolean)))
        : []
      const legacyCategory = cleanGalleryString(req.body?.category)
      const categoriesForTag = requestedCategories.length
        ? requestedCategories
        : (legacyCategory ? [legacyCategory] : [])
      const color = normalizeGalleryColor(req.body?.color)
      if (!type || !value) return res.status(400).json({ success: false, error: "A valid category or tag name is required." })
      if (type === "tag" && categoriesForTag.length === 0) return res.status(400).json({ success: false, error: "Select at least one category for this tag." })
      if (value.length > 40) return res.status(400).json({ success: false, error: "Names must be 40 characters or fewer." })

      const gallery = await getCollection<GalleryTagsConfigDocument>("galleryTags")
      const config = await getGalleryConfig()
      const target = type === "category" ? config.categories : config.tags
      if (target.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
        return res.status(409).json({ success: false, error: `${type === "category" ? "Category" : "Tag"} already exists.` })
      }

      const next = [...target, value]
      const colors = type === "category" ? { ...config.categoryColors, [value]: color } : { ...config.tagColors, [value]: color }
      const tagCategories = { ...(config.tagCategories ?? {}) }

      if (type === "category") {
        tagCategories[value] = []
      } else {
        for (const categoryName of categoriesForTag) {
          if (config.categories.includes(categoryName)) {
            tagCategories[categoryName] = Array.from(new Set([...(tagCategories[categoryName] ?? []), value]))
          }
        }
      }

      await gallery.updateOne(
        { key: "default" },
        { $set: type === "category"
          ? { categories: next, categoryColors: colors, tagCategories, updatedAt: new Date() }
          : { tags: next, tagColors: colors, tagCategories, updatedAt: new Date() } },
        { upsert: true },
      )

      return res.status(201).json({ success: true, ...(await getGalleryConfig()) })
    } catch (error) {
      console.error("POST /api/gallery/options failed:", error)
      return res.status(500).json({ success: false, error: "Failed to create gallery option" })
    }
  })

  app.put("/api/gallery/options", async (req, res) => {
    try {
      const user = await getRequestUser(req)
      if (!user) return res.status(401).json({ success: false, error: "Not authenticated" })
      if (!hasPermission(user, "gallery")) return res.status(403).json({ success: false, error: "You do not have permission to manage the gallery" })

      const type = req.body?.type === "category" || req.body?.type === "tag" ? req.body.type : ""
      const value = cleanGalleryString(req.body?.value)
      const newValue = cleanGalleryString(req.body?.newValue || value)
      const requestedCategories = Array.isArray(req.body?.categories)
        ? Array.from(new Set(req.body.categories.map((entry: unknown) => cleanGalleryString(entry)).filter(Boolean)))
        : []
      const legacyCategory = cleanGalleryString(req.body?.category)
      const requestedTagCategories = requestedCategories.length
        ? requestedCategories
        : (legacyCategory ? [legacyCategory] : [])
      const color = normalizeGalleryColor(req.body?.color, "#3b82f6")
      if (!type || !value || !newValue) return res.status(400).json({ success: false, error: "A valid option name is required." })
      if (newValue.length > 40) return res.status(400).json({ success: false, error: "Names must be 40 characters or fewer." })
      if (!/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ success: false, error: "Enter a valid 6-digit hex color." })

      const config = await getGalleryConfig()
      const source = type === "category" ? config.categories : config.tags
      if (!source.includes(value)) return res.status(404).json({ success: false, error: "Gallery option not found." })
      if (source.some((entry) => entry !== value && entry.toLowerCase() === newValue.toLowerCase())) {
        return res.status(409).json({ success: false, error: `${type === "category" ? "Category" : "Tag"} already exists.` })
      }

      const gallery = await getCollection<GalleryTagsConfigDocument>("galleryTags")
      const tagCategories = Object.fromEntries(
        Object.entries(config.tagCategories ?? {}).map(([key, tags]) => [key, [...(tags ?? [])]]),
      )
      let categories = [...config.categories]
      let tags = [...config.tags]
      let categoryColors = { ...config.categoryColors }
      let tagColors = { ...config.tagColors }

      if (type === "category") {
        categories = categories.map((entry) => entry === value ? newValue : entry)
        const assignedTags = tagCategories[value] ?? []
        delete tagCategories[value]
        tagCategories[newValue] = assignedTags
        categoryColors[newValue] = color
        delete categoryColors[value]

        const fallbackCategory = categories[0] ?? newValue
        const galleryItems = await getCollection<GalleryDocument>("gallery")
        await galleryItems.updateMany({ category: value }, { $set: { category: newValue } })
        if (fallbackCategory !== value) {
          await galleryItems.updateMany({ _galleryConfig: true, category: value }, { $set: { category: fallbackCategory } })
        }
      } else {
        tags = tags.map((entry) => entry === value ? newValue : entry)
        for (const key of Object.keys(tagCategories)) {
          tagCategories[key] = (tagCategories[key] ?? []).map((entry) => entry === value ? newValue : entry)
        }
        tagColors[newValue] = color
        delete tagColors[value]

        const galleryItems = await getCollection<GalleryDocument>("gallery")
        await galleryItems.updateMany(
          { tags: value },
          { $set: { "tags.$[tag]": newValue } },
          { arrayFilters: [{ tag: value }] },
        )
      }

      if (type === "tag") {
        // Rebuild all assignments from the submitted multi-select. This also
        // allows a tag to be reset to zero categories (Unassigned).
        for (const key of Object.keys(tagCategories)) {
          tagCategories[key] = (tagCategories[key] ?? []).filter((tag) => tag !== newValue && tag !== value)
        }
        for (const categoryName of requestedTagCategories) {
          if (categories.includes(categoryName)) {
            tagCategories[categoryName] = Array.from(new Set([...(tagCategories[categoryName] ?? []), newValue]))
          }
        }
      }

      await gallery.updateOne(
        { key: "default" },
        { $set: { categories, tags, categoryColors, tagColors, tagCategories, updatedAt: new Date() } },
        { upsert: true },
      )

      return res.json({ success: true, ...(await getGalleryConfig()) })
    } catch (error) {
      console.error("PUT /api/gallery/options failed:", error)
      return res.status(500).json({ success: false, error: "Failed to update gallery option" })
    }
  })

  app.delete("/api/gallery/options", async (req, res) => {
    try {
      const user = await getRequestUser(req)
      if (!user) return res.status(401).json({ success: false, error: "Not authenticated" })
      if (!hasPermission(user, "gallery")) return res.status(403).json({ success: false, error: "You do not have permission to manage the gallery" })

      const type = req.body?.type === "category" || req.body?.type === "tag" ? req.body.type : ""
      const value = cleanGalleryString(req.body?.value)
      if (!type || !value) return res.status(400).json({ success: false, error: "A valid option is required." })

      const config = await getGalleryConfig()
      const source = type === "category" ? config.categories : config.tags
      if (!source.includes(value)) return res.status(404).json({ success: false, error: "Gallery option not found." })

      if (type === "category" && config.categories.length <= 1) {
        return res.status(400).json({ success: false, error: "At least one gallery category must remain." })
      }

      const categories = type === "category" ? config.categories.filter((entry) => entry !== value) : [...config.categories]
      const tags = type === "tag" ? config.tags.filter((entry) => entry !== value) : [...config.tags]
      const categoryColors = { ...config.categoryColors }
      const tagColors = { ...config.tagColors }
      delete categoryColors[value]
      delete tagColors[value]

      const tagCategories = Object.fromEntries(
        Object.entries(config.tagCategories ?? {}).map(([key, values]) => [
          key, (values ?? []).filter((tag) => tag !== value),
        ]),
      )

      if (type === "category") {
        delete tagCategories[value]
      }

      const galleryItems = await getCollection<GalleryDocument>("gallery")
      if (type === "tag") {
        await galleryItems.updateMany(
          { tags: value },
          { $pull: { tags: value } },
        )
      } else {
        const fallbackCategory = categories[0]
        if (fallbackCategory) {
          await galleryItems.updateMany({ category: value }, { $set: { category: fallbackCategory } })
        }
      }

      const gallery = await getCollection<GalleryTagsConfigDocument>("galleryTags")
      await gallery.updateOne(
        { key: "default" },
        { $set: { categories, tags, categoryColors, tagColors, tagCategories, updatedAt: new Date() } },
        { upsert: true },
      )

      return res.json({ success: true, ...(await getGalleryConfig()) })
    } catch (error) {
      console.error("DELETE /api/gallery/options failed:", error)
      return res.status(500).json({ success: false, error: "Failed to delete gallery option" })
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

        const title = cleanGalleryString(req.body?.title) || "gallery"
        const uploaded: GalleryMedia[] = []

        try {
          for (let index = 0; index < files.length; index += 1) {
            const file = files[index]
            uploaded.push(
              await storeGalleryFile(
                file,
                index === 0 ? title : `${title}_${index + 1}`,
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
        const requestedType: GalleryMediaType = req.body?.type === "video" ? "video" : "image"
        const title = cleanGalleryString(req.body?.title) || "gallery"
        const publicIndex = Number.isFinite(Number(req.body?.index)) ? Math.max(0, Number(req.body.index)) : 0

        if (!url) {
          return res.status(400).json({
            success: false,
            error: "A media URL is required.",
          })
        }

        const media = await importGalleryMediaUrl(url, requestedType, `${title}${publicIndex ? `_${publicIndex + 1}` : ""}`)

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
