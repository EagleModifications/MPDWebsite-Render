import type { Express, Request, Response } from "express"

import { env } from "./config"

const API_URL = "https://wheelofnames.com/api/v2/wheels/animate"
const MAX_ENTRIES = 1000
const WINDOW_MS = 60_000
const MAX_REQUESTS = 30
const API_TIMEOUT_MS = 15_000

type WheelEntry = {
  text: string
  color?: string
  weight?: number
}

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"]

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim()
  }

  return req.ip || req.socket.remoteAddress || "unknown"
}

function isRateLimited(req: Request) {
  const key = clientKey(req)
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    })
    return false
  }

  bucket.count += 1
  return bucket.count > MAX_REQUESTS
}

function cleanEntries(value: unknown): WheelEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim()
        return text ? { text } : null
      }

      if (!item || typeof item !== "object") return null

      const record = item as Record<string, unknown>
      const text = typeof record.text === "string" ? record.text.trim() : ""

      if (!text) return null

      const weight =
        typeof record.weight === "number" &&
        Number.isFinite(record.weight) &&
        record.weight > 0
          ? Math.min(record.weight, 1_000_000)
          : undefined

      const color =
        typeof record.color === "string" && /^#[0-9a-f]{6}$/i.test(record.color)
          ? record.color
          : undefined

      return {
        text: text.slice(0, 500),
        ...(color ? { color } : {}),
        ...(weight ? { weight } : {}),
      }
    })
    .filter((entry): entry is WheelEntry => Boolean(entry))
    .slice(0, MAX_ENTRIES)
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function errorMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.slice(0, 500)

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.error === "string") return record.error.slice(0, 500)
    if (typeof record.message === "string") return record.message.slice(0, 500)
  }

  return "Wheel of Names request failed."
}

export function registerWheelOfNamesRoutes(app: Express) {
  app.post("/api/spin-wheel/animate", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store")

    if (isRateLimited(req)) {
      return res.status(429).json({
        success: false,
        error: "Too many spins. Please wait a moment and try again.",
      })
    }

    if (!env.wheelOfNamesApiKey) {
      return res.status(503).json({
        success: false,
        error: "Wheel of Names API is not configured on the server.",
      })
    }

    const entries = cleanEntries(req.body?.entries)

    if (entries.length < 2) {
      return res.status(400).json({
        success: false,
        error: "At least two entries are required.",
      })
    }

    const spinTime = clampNumber(req.body?.spinTime, 1, 1, 30)
    const maxNames = Math.min(
      entries.length,
      clampNumber(req.body?.maxNames, entries.length, 2, 1000),
    )
    const imageFormat = req.body?.imageFormat === "gif" ? "gif" : "webp"

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const upstream = await fetch(API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": env.wheelOfNamesApiKey,
        },
        body: JSON.stringify({
          wheelConfig: {
            entries,
            spinTime,
            maxNames,
          },
          imageFormat,
          responseFormat: "json",
          initialAngle: Math.random() * Math.PI * 2,
        }),
        signal: controller.signal,
      })

      const contentType = upstream.headers.get("content-type") ?? ""
      const bodyText = await upstream.text()

      let body: Record<string, unknown> = {}

      if (contentType.includes("application/json")) {
        try {
          body = JSON.parse(bodyText) as Record<string, unknown>
        } catch {
          body = {}
        }
      }

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          success: false,
          error: errorMessage(body.error ?? body.message ?? bodyText),
        })
      }

      const winnerRecord =
        body.winner && typeof body.winner === "object"
          ? (body.winner as Record<string, unknown>)
          : null

      const winner =
        typeof winnerRecord?.text === "string"
          ? winnerRecord.text
          : typeof body.spinResult === "object" &&
              body.spinResult !== null &&
              typeof (body.spinResult as Record<string, unknown>).text === "string"
            ? String((body.spinResult as Record<string, unknown>).text)
            : null

      const animation =
        typeof body.animation === "string" && body.animation
          ? body.animation
          : null

      if (!winner) {
        return res.status(502).json({
          success: false,
          error: "Wheel of Names did not return a winner.",
        })
      }

      return res.json({
        success: true,
        winner,
        animation,
        imageFormat,
      })
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Wheel of Names took too long to respond. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to contact Wheel of Names."

      console.error("[wheel-of-names]", error)

      return res.status(502).json({
        success: false,
        error: message,
      })
    } finally {
      clearTimeout(timeout)

      if (buckets.size > 1000) {
        const now = Date.now()
        for (const [key, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(key)
        }
      }
    }
  })
}
