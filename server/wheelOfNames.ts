import type {
  Express,
  Request,
  Response,
} from "express"

import { env } from "./config"

const WHEEL_API_URL =
  "https://wheelofnames.com/api/v2/wheels/animate"

const MAX_ENTRIES = 1000

const RATE_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20

const requestBuckets = new Map<
  string,
  {
    count: number
    resetAt: number
  }
>()

type WheelEntry = {
  text: string
  color?: string
  weight?: number
}

function getClientKey(
  req: Request,
) {
  const forwarded =
    req.headers[
      "x-forwarded-for"
    ]

  if (
    typeof forwarded ===
      "string" &&
    forwarded.trim()
  ) {
    return forwarded
      .split(",")[0]
      .trim()
  }

  return (
    req.ip ||
    req.socket.remoteAddress ||
    "unknown"
  )
}

function rateLimited(
  req: Request,
) {
  const key =
    getClientKey(req)

  const now = Date.now()

  const current =
    requestBuckets.get(key)

  if (
    !current ||
    current.resetAt <= now
  ) {
    requestBuckets.set(key, {
      count: 1,
      resetAt:
        now +
        RATE_WINDOW_MS,
    })

    return false
  }

  current.count += 1

  return (
    current.count >
    MAX_REQUESTS_PER_WINDOW
  )
}

function cleanEntries(
  value: unknown,
): WheelEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (
        typeof entry ===
        "string"
      ) {
        return {
          text: entry.trim(),
        }
      }

      if (
        !entry ||
        typeof entry !==
          "object"
      ) {
        return null
      }

      const text =
        typeof (
          entry as {
            text?: unknown
          }
        ).text ===
        "string"
          ? (
              entry as {
                text: string
              }
            ).text.trim()
          : ""

      if (!text) {
        return null
      }

      const color =
        typeof (
          entry as {
            color?: unknown
          }
        ).color ===
        "string"
          ? (
              entry as {
                color: string
              }
            ).color
          : undefined

      const weight =
        typeof (
          entry as {
            weight?: unknown
          }
        ).weight ===
          "number" &&
        Number.isFinite(
          (
            entry as {
              weight: number
            }
          ).weight,
        ) &&
        (
          entry as {
            weight: number
          }
        ).weight > 0
          ? (
              entry as {
                weight: number
              }
            ).weight
          : undefined

      return {
        text,
        ...(color
          ? { color }
          : {}),
        ...(weight
          ? { weight }
          : {}),
      }
    })
    .filter(
      (
        entry,
      ): entry is WheelEntry =>
        Boolean(entry),
    )
    .slice(
      0,
      MAX_ENTRIES,
    )
}

function numberInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return fallback
  }

  return Math.min(
    max,
    Math.max(
      min,
      number,
    ),
  )
}

export function registerWheelOfNamesRoutes(
  app: Express,
) {
  app.post(
    "/api/spin-wheel/animate",
    async (
      req: Request,
      res: Response,
    ) => {
      if (
        rateLimited(req)
      ) {
        return res
          .status(429)
          .json({
            success: false,
            error:
              "Too many wheel spins. Please wait a moment and try again.",
          })
      }

      if (
        !env.wheelOfNamesApiKey
      ) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Wheel of Names API is not configured. Add WHEEL_OF_NAMES_API_KEY to Render.",
          })
      }

      const entries =
        cleanEntries(
          req.body?.entries,
        )

      if (
        entries.length < 2
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "At least two wheel entries are required.",
          })
      }

      const spinTime =
        numberInRange(
          req.body?.spinTime,
          5,
          1,
          30,
        )

      const maxNames =
        numberInRange(
          req.body?.maxNames,
          Math.min(
            120,
            entries.length,
          ),
          2,
          120,
        )

      const imageFormat =
        req.body?.imageFormat ===
        "gif"
          ? "gif"
          : "webp"

      try {
        const response =
          await fetch(
            WHEEL_API_URL,
            {
              method: "POST",

              headers: {
                "x-api-key":
                  env.wheelOfNamesApiKey,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                wheelConfig: {
                  entries,
                  spinTime,
                  maxNames,
                },

                imageFormat,

                responseFormat:
                  "json",

                initialAngle:
                  Math.random() *
                  Math.PI *
                  2,
              }),
            },
          )

        const contentType =
          response.headers.get(
            "content-type",
          ) || ""

        if (
          !response.ok
        ) {
          let message =
            "Wheel of Names API request failed."

          if (
            contentType.includes(
              "application/json",
            )
          ) {
            const errorData =
              (await response.json()) as {
                error?: unknown
              }

            if (
              typeof errorData.error ===
              "string"
            ) {
              message =
                errorData.error
            }
          } else {
            const text =
              await response.text()

            if (
              text.trim()
            ) {
              message =
                text.slice(
                  0,
                  500,
                )
            }
          }

          return res
            .status(
              response.status,
            )
            .json({
              success: false,
              error: message,
            })
        }

        if (
          !contentType.includes(
            "application/json",
          )
        ) {
          return res
            .status(502)
            .json({
              success: false,
              error:
                "Wheel of Names returned an unexpected response format.",
            })
        }

        const data =
          (await response.json()) as {
            animation?: unknown

            winner?: {
              text?: unknown
              [key: string]: unknown
            }

            error?: unknown
          }

        if (
          typeof data.animation !==
            "string" ||
          !data.animation
        ) {
          return res
            .status(502)
            .json({
              success: false,
              error:
                typeof data.error ===
                "string"
                  ? data.error
                  : "Wheel of Names did not return an animation.",
            })
        }

        const winner =
          typeof data.winner?.text ===
          "string"
            ? data.winner.text
            : null

        return res.json({
          success: true,
          animation:
            data.animation,
          imageFormat,
          winner,
        })
      } catch (error) {
        console.error(
          "Wheel of Names API error:",
          error,
        )

        return res
          .status(502)
          .json({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to contact Wheel of Names.",
          })
      }
    },
  )
}
