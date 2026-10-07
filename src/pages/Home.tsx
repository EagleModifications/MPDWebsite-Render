import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  LayoutDashboard,
  LogIn,
  MapPin,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useState,
} from "react"
import { Link } from "react-router-dom"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"

type GalleryTag =
  | "Dept"
  | "SWAT"
  | "MTF-7"
  | "MCD"
  | "TRU"
  | "SAR"

type GalleryMedia = {
  id: string
  type: "image" | "video"
  url: string
  thumbnailUrl?: string
  source?: "upload" | "url"
}

type GalleryItem = {
  id: string
  title: string
  description?: string
  category?: "Community" | "Fleet"
  tags?: unknown[]
  media: GalleryMedia[]
  createdAt: string
}

type CalendarEvent = {
  id: string
  title: string
  description?: string
  category:
    | "Activities"
    | "Patrol"
    | "Operations"
    | "Meetings"
  date: string
  startTime?: string
  endTime?: string
  location?: string
  discordUrl?: string
}

type AmbientDot = {
  left: string
  top: string
  size: string
  opacity: number
  delay: string
  duration: string
  driftX: string
  driftY: string
  blur: string
}

const ambientDots: AmbientDot[] = [
  {
    left: "3%",
    top: "7%",
    size: "2px",
    opacity: 0.38,
    delay: "1.4s",
    duration: "13s",
    driftX: "18px",
    driftY: "-12px",
    blur: "0px",
  },
  {
    left: "8%",
    top: "17%",
    size: "3px",
    opacity: 0.24,
    delay: "5.8s",
    duration: "17s",
    driftX: "-14px",
    driftY: "16px",
    blur: "0.2px",
  },
  {
    left: "13%",
    top: "31%",
    size: "2px",
    opacity: 0.32,
    delay: "3.2s",
    duration: "15s",
    driftX: "11px",
    driftY: "-18px",
    blur: "0px",
  },
  {
    left: "18%",
    top: "10%",
    size: "2px",
    opacity: 0.45,
    delay: "8.4s",
    duration: "19s",
    driftX: "-17px",
    driftY: "11px",
    blur: "0px",
  },
  {
    left: "23%",
    top: "24%",
    size: "3px",
    opacity: 0.2,
    delay: "2.1s",
    duration: "16s",
    driftX: "15px",
    driftY: "13px",
    blur: "0.3px",
  },
  {
    left: "28%",
    top: "5%",
    size: "2px",
    opacity: 0.4,
    delay: "7.3s",
    duration: "14s",
    driftX: "-12px",
    driftY: "-15px",
    blur: "0px",
  },
  {
    left: "33%",
    top: "18%",
    size: "2px",
    opacity: 0.3,
    delay: "10.1s",
    duration: "18s",
    driftX: "19px",
    driftY: "9px",
    blur: "0px",
  },
  {
    left: "38%",
    top: "36%",
    size: "3px",
    opacity: 0.23,
    delay: "4.5s",
    duration: "20s",
    driftX: "-13px",
    driftY: "-14px",
    blur: "0.2px",
  },
  {
    left: "43%",
    top: "13%",
    size: "2px",
    opacity: 0.42,
    delay: "1.8s",
    duration: "15s",
    driftX: "16px",
    driftY: "17px",
    blur: "0px",
  },
  {
    left: "48%",
    top: "28%",
    size: "2px",
    opacity: 0.28,
    delay: "6.7s",
    duration: "18s",
    driftX: "-18px",
    driftY: "12px",
    blur: "0px",
  },
  {
    left: "53%",
    top: "7%",
    size: "3px",
    opacity: 0.36,
    delay: "11.2s",
    duration: "16s",
    driftX: "13px",
    driftY: "-11px",
    blur: "0.3px",
  },
  {
    left: "58%",
    top: "20%",
    size: "2px",
    opacity: 0.24,
    delay: "3.9s",
    duration: "21s",
    driftX: "-15px",
    driftY: "18px",
    blur: "0px",
  },
  {
    left: "63%",
    top: "40%",
    size: "2px",
    opacity: 0.38,
    delay: "8.1s",
    duration: "17s",
    driftX: "17px",
    driftY: "-13px",
    blur: "0px",
  },
  {
    left: "68%",
    top: "12%",
    size: "3px",
    opacity: 0.2,
    delay: "5.2s",
    duration: "19s",
    driftX: "-11px",
    driftY: "15px",
    blur: "0.2px",
  },
  {
    left: "73%",
    top: "27%",
    size: "2px",
    opacity: 0.44,
    delay: "9.7s",
    duration: "15s",
    driftX: "14px",
    driftY: "11px",
    blur: "0px",
  },
  {
    left: "78%",
    top: "8%",
    size: "2px",
    opacity: 0.31,
    delay: "2.8s",
    duration: "20s",
    driftX: "-19px",
    driftY: "-10px",
    blur: "0px",
  },
  {
    left: "83%",
    top: "35%",
    size: "3px",
    opacity: 0.26,
    delay: "7.6s",
    duration: "18s",
    driftX: "12px",
    driftY: "16px",
    blur: "0.3px",
  },
  {
    left: "88%",
    top: "15%",
    size: "2px",
    opacity: 0.4,
    delay: "4.1s",
    duration: "14s",
    driftX: "-16px",
    driftY: "13px",
    blur: "0px",
  },
  {
    left: "94%",
    top: "6%",
    size: "3px",
    opacity: 0.23,
    delay: "10.5s",
    duration: "19s",
    driftX: "18px",
    driftY: "-16px",
    blur: "0.2px",
  },

  {
    left: "5%",
    top: "44%",
    size: "2px",
    opacity: 0.35,
    delay: "6.2s",
    duration: "17s",
    driftX: "-13px",
    driftY: "17px",
    blur: "0px",
  },
  {
    left: "11%",
    top: "57%",
    size: "3px",
    opacity: 0.22,
    delay: "1.7s",
    duration: "21s",
    driftX: "15px",
    driftY: "-12px",
    blur: "0.3px",
  },
  {
    left: "16%",
    top: "72%",
    size: "2px",
    opacity: 0.42,
    delay: "9.3s",
    duration: "16s",
    driftX: "-18px",
    driftY: "14px",
    blur: "0px",
  },
  {
    left: "22%",
    top: "51%",
    size: "2px",
    opacity: 0.27,
    delay: "3.4s",
    duration: "18s",
    driftX: "11px",
    driftY: "-17px",
    blur: "0px",
  },
  {
    left: "27%",
    top: "67%",
    size: "3px",
    opacity: 0.34,
    delay: "7.9s",
    duration: "20s",
    driftX: "17px",
    driftY: "12px",
    blur: "0.2px",
  },
  {
    left: "32%",
    top: "48%",
    size: "2px",
    opacity: 0.21,
    delay: "11.8s",
    duration: "15s",
    driftX: "-14px",
    driftY: "-11px",
    blur: "0px",
  },
  {
    left: "37%",
    top: "76%",
    size: "2px",
    opacity: 0.4,
    delay: "5.5s",
    duration: "19s",
    driftX: "13px",
    driftY: "16px",
    blur: "0px",
  },
  {
    left: "42%",
    top: "59%",
    size: "3px",
    opacity: 0.25,
    delay: "2.4s",
    duration: "22s",
    driftX: "-17px",
    driftY: "10px",
    blur: "0.3px",
  },
  {
    left: "47%",
    top: "84%",
    size: "2px",
    opacity: 0.36,
    delay: "8.8s",
    duration: "17s",
    driftX: "19px",
    driftY: "-15px",
    blur: "0px",
  },
  {
    left: "52%",
    top: "52%",
    size: "2px",
    opacity: 0.29,
    delay: "4.7s",
    duration: "16s",
    driftX: "-12px",
    driftY: "18px",
    blur: "0px",
  },
  {
    left: "57%",
    top: "70%",
    size: "3px",
    opacity: 0.43,
    delay: "10.2s",
    duration: "20s",
    driftX: "16px",
    driftY: "-13px",
    blur: "0.2px",
  },
  {
    left: "62%",
    top: "49%",
    size: "2px",
    opacity: 0.2,
    delay: "1.3s",
    duration: "18s",
    driftX: "-19px",
    driftY: "11px",
    blur: "0px",
  },
  {
    left: "67%",
    top: "82%",
    size: "2px",
    opacity: 0.38,
    delay: "6.9s",
    duration: "21s",
    driftX: "14px",
    driftY: "15px",
    blur: "0px",
  },
  {
    left: "72%",
    top: "58%",
    size: "3px",
    opacity: 0.24,
    delay: "3.6s",
    duration: "15s",
    driftX: "-15px",
    driftY: "-16px",
    blur: "0.3px",
  },
  {
    left: "77%",
    top: "74%",
    size: "2px",
    opacity: 0.41,
    delay: "9.1s",
    duration: "19s",
    driftX: "18px",
    driftY: "13px",
    blur: "0px",
  },
  {
    left: "82%",
    top: "52%",
    size: "2px",
    opacity: 0.28,
    delay: "5.4s",
    duration: "17s",
    driftX: "-13px",
    driftY: "17px",
    blur: "0px",
  },
  {
    left: "87%",
    top: "68%",
    size: "3px",
    opacity: 0.35,
    delay: "11.1s",
    duration: "22s",
    driftX: "12px",
    driftY: "-14px",
    blur: "0.2px",
  },
  {
    left: "93%",
    top: "47%",
    size: "2px",
    opacity: 0.23,
    delay: "2.6s",
    duration: "16s",
    driftX: "-18px",
    driftY: "12px",
    blur: "0px",
  },

  {
    left: "4%",
    top: "88%",
    size: "3px",
    opacity: 0.3,
    delay: "7.2s",
    duration: "20s",
    driftX: "15px",
    driftY: "-13px",
    blur: "0.2px",
  },
  {
    left: "9%",
    top: "78%",
    size: "2px",
    opacity: 0.43,
    delay: "4.3s",
    duration: "18s",
    driftX: "-16px",
    driftY: "15px",
    blur: "0px",
  },
  {
    left: "14%",
    top: "94%",
    size: "2px",
    opacity: 0.22,
    delay: "10.8s",
    duration: "21s",
    driftX: "18px",
    driftY: "10px",
    blur: "0px",
  },
  {
    left: "20%",
    top: "85%",
    size: "3px",
    opacity: 0.36,
    delay: "1.9s",
    duration: "17s",
    driftX: "-12px",
    driftY: "-18px",
    blur: "0.3px",
  },
  {
    left: "26%",
    top: "96%",
    size: "2px",
    opacity: 0.27,
    delay: "6.4s",
    duration: "19s",
    driftX: "16px",
    driftY: "13px",
    blur: "0px",
  },
  {
    left: "34%",
    top: "91%",
    size: "2px",
    opacity: 0.39,
    delay: "3.1s",
    duration: "15s",
    driftX: "-17px",
    driftY: "12px",
    blur: "0px",
  },
  {
    left: "40%",
    top: "97%",
    size: "3px",
    opacity: 0.2,
    delay: "8.6s",
    duration: "22s",
    driftX: "13px",
    driftY: "-15px",
    blur: "0.2px",
  },
  {
    left: "46%",
    top: "93%",
    size: "2px",
    opacity: 0.34,
    delay: "5.1s",
    duration: "18s",
    driftX: "-14px",
    driftY: "16px",
    blur: "0px",
  },
  {
    left: "55%",
    top: "89%",
    size: "3px",
    opacity: 0.25,
    delay: "11.4s",
    duration: "20s",
    driftX: "19px",
    driftY: "-12px",
    blur: "0.3px",
  },
  {
    left: "61%",
    top: "96%",
    size: "2px",
    opacity: 0.4,
    delay: "2.7s",
    duration: "16s",
    driftX: "-11px",
    driftY: "14px",
    blur: "0px",
  },
  {
    left: "69%",
    top: "92%",
    size: "2px",
    opacity: 0.3,
    delay: "7.7s",
    duration: "21s",
    driftX: "17px",
    driftY: "11px",
    blur: "0px",
  },
  {
    left: "75%",
    top: "87%",
    size: "3px",
    opacity: 0.42,
    delay: "4.9s",
    duration: "17s",
    driftX: "-15px",
    driftY: "-14px",
    blur: "0.2px",
  },
  {
    left: "81%",
    top: "95%",
    size: "2px",
    opacity: 0.23,
    delay: "9.6s",
    duration: "19s",
    driftX: "12px",
    driftY: "18px",
    blur: "0px",
  },
  {
    left: "88%",
    top: "84%",
    size: "2px",
    opacity: 0.37,
    delay: "1.1s",
    duration: "15s",
    driftX: "-19px",
    driftY: "13px",
    blur: "0px",
  },
  {
    left: "96%",
    top: "92%",
    size: "3px",
    opacity: 0.28,
    delay: "6.8s",
    duration: "22s",
    driftX: "14px",
    driftY: "-16px",
    blur: "0.3px",
  },
]

const galleryTagClasses: Record<GalleryTag, string> = {
  Dept:
    "border-blue-400/40 bg-blue-500/20 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.14)]",

  SWAT:
    "border-slate-400/30 bg-slate-800/70 text-slate-100 shadow-[0_0_12px_rgba(148,163,184,0.08)]",

  "MTF-7":
    "border-sky-400/35 bg-sky-900/45 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.1)]",

  MCD:
    "border-blue-900/70 bg-blue-950/90 text-blue-300 shadow-[0_0_12px_rgba(30,64,175,0.12)]",

  TRU:
    "border-yellow-400/40 bg-yellow-500/15 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.1)]",

  SAR:
    "border-red-400/40 bg-red-500/15 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.1)]",
}

const galleryCategoryClasses: Record<
  NonNullable<GalleryItem["category"]>,
  string
> = {
  Community:
    "!border-blue-500/50 !bg-blue-500/10 !text-blue-500 dark:!border-blue-400/50 dark:!bg-blue-500/10 dark:!text-blue-400",

  Fleet:
    "!border-amber-500/50 !bg-amber-500/25 !text-amber-700 dark:!border-amber-400/50 dark:!bg-amber-500/20 dark:!text-amber-300",
}

function formatEventDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function normalizeGalleryMediaUrl(url: string) {
  const value = url.trim()

  if (!value) return ""

  // Gallery uploads are served by this app. If the API returned an
  // absolute URL from another configured origin, keep the request on
  // the current site so Home works on localhost, Render, and custom domains.
  try {
    const parsed = new URL(value, window.location.origin)

    if (parsed.pathname.startsWith("/api/gallery/")) {
      return `${parsed.pathname}${parsed.search}`
    }

    return parsed.href
  } catch {
    return value
  }
}

function getGalleryPreview(item: GalleryItem) {
  const media = item.media?.[0]

  if (!media) {
    return null
  }

  const candidates =
    media.type === "image"
      ? [media.url, media.thumbnailUrl]
      : [media.thumbnailUrl, media.url]

  for (const candidate of candidates) {
    const normalized = candidate
      ? normalizeGalleryMediaUrl(candidate)
      : ""

    if (normalized) return normalized
  }

  return null
}

/**
 * Normalizes gallery tags so the home page still displays
 * the correct colored tag if the API returns different
 * casing or common alternate names.
 */
function normalizeGalleryTags(
  tags: unknown[] | undefined,
): GalleryTag[] {
  if (!Array.isArray(tags)) {
    return []
  }

  const normalized: GalleryTag[] = []

  for (const rawTag of tags) {
    let value = ""

    if (typeof rawTag === "string") {
      value = rawTag
    } else if (
      rawTag &&
      typeof rawTag === "object"
    ) {
      const objectTag =
        rawTag as Record<string, unknown>

      const possibleValue =
        objectTag.name ??
        objectTag.label ??
        objectTag.value ??
        objectTag.tag

      if (typeof possibleValue === "string") {
        value = possibleValue
      }
    }

    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")

    let normalizedTag: GalleryTag | null = null

    switch (cleaned) {
      case "dept":
      case "department":
        normalizedTag = "Dept"
        break

      case "swat":
        normalizedTag = "SWAT"
        break

      case "mtf7":
      case "mtf-7":
        normalizedTag = "MTF-7"
        break

      case "mcd":
        normalizedTag = "MCD"
        break

      case "tru":
        normalizedTag = "TRU"
        break

      case "sar":
        normalizedTag = "SAR"
        break

      default:
        normalizedTag = null
    }

    if (
      normalizedTag &&
      !normalized.includes(normalizedTag)
    ) {
      normalized.push(normalizedTag)
    }
  }

  return normalized
}

export default function Home() {
  const [authChecked, setAuthChecked] =
    useState(false)

  const [isAuthenticated, setIsAuthenticated] =
    useState(false)

  const [canViewDashboard, setCanViewDashboard] =
    useState(false)

  const [gallery, setGallery] = useState<
    GalleryItem[]
  >([])

  const [galleryCategory, setGalleryCategory] =
    useState<"All" | "Community" | "Fleet">("All")

  const [events, setEvents] = useState<
    CalendarEvent[]
  >([])

  const [contentLoading, setContentLoading] =
    useState(true)

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        const sessionResponse = await fetch(
          "/api/auth/session",
          {
            credentials: "include",
          },
        )

        if (!sessionResponse.ok) {
          if (mounted) {
            setIsAuthenticated(false)
            setCanViewDashboard(false)
          }

          return
        }

        const sessionData =
          await sessionResponse.json()

        if (!mounted) {
          return
        }

        const authenticated =
          Boolean(sessionData?.user)

        setIsAuthenticated(authenticated)

        if (!authenticated) {
          setCanViewDashboard(false)
          return
        }

        try {
          const permissionResponse =
            await fetch(
              "/api/auth/check?permission=view",
              {
                credentials: "include",
              },
            )

          if (!mounted) {
            return
          }

          setCanViewDashboard(
            permissionResponse.ok,
          )
        } catch {
          if (mounted) {
            setCanViewDashboard(false)
          }
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false)
          setCanViewDashboard(false)
        }
      } finally {
        if (mounted) {
          setAuthChecked(true)
        }
      }
    }

    void checkAuth()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadPublicContent = async () => {
      try {
        const [
          galleryResponse,
          eventsResponse,
        ] = await Promise.allSettled([
          fetch("/api/gallery", {
            credentials: "include",
          }),
          fetch("/api/events", {
            credentials: "include",
          }),
        ])

        if (!mounted) {
          return
        }

        if (
          galleryResponse.status ===
            "fulfilled" &&
          galleryResponse.value.ok
        ) {
          try {
            const data =
              await galleryResponse.value.json()

            const items = Array.isArray(data)
              ? data
              : Array.isArray(data?.items)
                ? data.items
                : []

            setGallery(
              items
                .filter(
                  (item: GalleryItem) =>
                    item &&
                    item.id &&
                    Array.isArray(item.media),
                )
                .sort(
                  (
                    a: GalleryItem,
                    b: GalleryItem,
                  ) =>
                    new Date(
                      b.createdAt,
                    ).getTime() -
                    new Date(
                      a.createdAt,
                    ).getTime(),
                )
                .slice(0, 12),
            )
          } catch {
            setGallery([])
          }
        }

        if (
          eventsResponse.status ===
            "fulfilled" &&
          eventsResponse.value.ok
        ) {
          try {
            const data =
              await eventsResponse.value.json()

            const items = Array.isArray(data)
              ? data
              : Array.isArray(data?.events)
                ? data.events
                : []

            const now = new Date()

            setEvents(
              items
                .filter(
                  (event: CalendarEvent) =>
                    event &&
                    event.id &&
                    event.title &&
                    event.date,
                )
                .filter(
                  (event: CalendarEvent) => {
                    const eventDate =
                      new Date(event.date)

                    return (
                      !Number.isNaN(
                        eventDate.getTime(),
                      ) &&
                      eventDate >=
                        new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate(),
                        )
                    )
                  },
                )
                .sort(
                  (
                    a: CalendarEvent,
                    b: CalendarEvent,
                  ) =>
                    new Date(
                      a.date,
                    ).getTime() -
                    new Date(
                      b.date,
                    ).getTime(),
                )
                .slice(0, 5),
            )
          } catch {
            setEvents([])
          }
        }
      } finally {
        if (mounted) {
          setContentLoading(false)
        }
      }
    }

    void loadPublicContent()

    return () => {
      mounted = false
    }
  }, [])

  const visibleDots = useMemo(
    () => ambientDots,
    [],
  )

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <Navbar />

      {/* ========================================================= */}
      {/* GLOBAL STAR FIELD                                         */}
      {/* ========================================================= */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Very subtle atmosphere */}
        <div className="absolute left-1/2 top-[18%] h-[650px] w-[850px] -translate-x-1/2 rounded-full bg-blue-700/[0.035] blur-[150px]" />

        <div className="absolute left-[8%] top-[30%] h-[350px] w-[350px] rounded-full bg-blue-500/[0.018] blur-[130px]" />

        <div className="absolute right-[8%] top-[48%] h-[400px] w-[400px] rounded-full bg-blue-600/[0.018] blur-[140px]" />

        {/* Moving / blinking stars */}
        {visibleDots.map((dot, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-blue-300 mpd-star-twinkle"
            style={
              {
                left: dot.left,
                top: dot.top,
                width: dot.size,
                height: dot.size,
                opacity: dot.opacity,
                filter: `blur(${dot.blur})`,
                animationDelay: dot.delay,
                animationDuration: `${2.4 + (index % 6) * 0.45}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <main className="relative z-10 flex flex-1 flex-col">
        {/* ========================================================= */}
        {/* HERO                                                       */}
        {/* ========================================================= */}
        <section
          id="top"
          className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6"
        >
          <div className="flex w-full max-w-5xl flex-col items-center text-center">
            {/* Brand */}
            <div className="mb-7 flex items-center gap-3">
              <img
                src="/logo.png"
                alt="MPD"
                className="h-9 w-9 object-contain"
              />

              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em]">
                <span className="text-foreground">
                  METRO POLICE DEPARTMENT
                </span>

                <span className="text-blue-500">
                  •
                </span>

                <span className="text-muted-foreground">
                  CALIFORNIA ROLEPLAY
                </span>
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-4xl font-black uppercase leading-[0.88] tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
              <span className="block">
                METRO POLICE
              </span>

              <span className="mt-2 block bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                DEPARTMENT
              </span>
            </h1>

            {/* Description */}
            <p className="mt-8 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              The Metro Police Department is
              built around immersive law
              enforcement, dedicated officers,
              community interaction, and
              unforgettable stories across CaliRP.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="https://discord.gg/metropd"
                className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
              >
                <span>Join Discord</span>

                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>

              {authChecked &&
                !isAuthenticated && (
                  <Link
                    to="/sign-in"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <LogIn className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />

                    <span>Member Login</span>
                  </Link>
                )}

              {authChecked &&
                isAuthenticated &&
                canViewDashboard && (
                  <Link
                    to="/dashboard"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <LayoutDashboard className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />

                    <span>Dashboard</span>
                  </Link>
                )}
            </div>

            {/* Secondary links */}
            <div className="mt-7 flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <a
                href="https://discord.gg/metropd"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-blue-500"
              >
                Discord
              </a>

              <span className="text-muted-foreground/30">
                •
              </span>

              <Link
                to="/events"
                className="transition-colors hover:text-blue-500"
              >
                Events
              </Link>

              <span className="text-muted-foreground/30">
                •
              </span>

              <Link
                to="/gallery"
                className="transition-colors hover:text-blue-500"
              >
                Gallery
              </Link>
            </div>
          </div>

          {/* Bouncing down arrow */}
          <a
            href="#gallery"
            aria-label="Scroll to gallery"
            className="group absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-muted-foreground/50 transition-colors hover:text-blue-400"
          >
            <span className="text-[9px] font-semibold uppercase tracking-[0.25em] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Explore
            </span>

            <ChevronDown className="h-5 w-5 mpd-arrow-bounce-real" />
          </a>
        </section>

        {/* ========================================================= */}
        {/* SEPARATOR                                                  */}
        {/* ========================================================= */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />

            <div className="h-px flex-1 bg-border/50" />
          </div>
        </div>

        {/* ========================================================= */}
        {/* GALLERY                                                    */}
        {/* ========================================================= */}
        <section
          id="gallery"
          className="mx-auto w-full max-w-6xl px-6 py-24"
        >
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
                <ImageIcon className="h-4 w-4" />

                <span>Department Gallery</span>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Latest From Metro
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Take a look at the latest moments,
                vehicles, operations, and community
                stories from the Metro Police Department.
              </p>
            </div>

            <Link
              to="/gallery"
              className="group hidden shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-blue-500 sm:flex"
            >
              View Gallery

              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Category tabs sit directly above the first image, on the left. */}
          <div className="mb-5 flex w-fit items-center gap-1 rounded-full border border-border/60 bg-background/60 p-1">
            {["All", "Community", "Fleet"].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setGalleryCategory(
                    category as "All" | "Community" | "Fleet",
                  )
                }
                className={[
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  galleryCategory === category
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                ].join(" ")}
              >
                {category}
              </button>
            ))}
          </div>

          {contentLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse rounded-xl border border-border/40 bg-white/[0.02]"
                />
              ))}
            </div>
          ) : gallery.filter(
              (item) =>
                galleryCategory === "All" ||
                item.category === galleryCategory,
            ).length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {gallery
                .filter(
                  (item) =>
                    galleryCategory === "All" ||
                    item.category === galleryCategory,
                )
                .slice(0, 8)
                .map((item) => {
                const preview =
                  getGalleryPreview(item)

                const tags =
                  normalizeGalleryTags(item.tags)

                return (
                  <Link
                    key={item.id}
                    to="/gallery"
                    className="group overflow-hidden rounded-xl border border-border/50 bg-background/40 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-blue-500/[0.025]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-black/30">
                      {preview ? (
                        item.media?.[0]?.type ===
                        "video" ? (
                          <video
                            src={preview}
                            muted
                            playsInline
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={preview}
                            alt={item.title}
                            onError={(event) => {
                              const image = event.currentTarget
                              const fallback = item.media?.[0]?.thumbnailUrl
                                ? normalizeGalleryMediaUrl(item.media[0].thumbnailUrl)
                                : ""

                              if (fallback && image.src !== fallback) {
                                image.src = fallback
                                return
                              }

                              image.style.display = "none"
                            }}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}

                      {/* Darker, cleaner image gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                      {/* Category */}
                      {item.category && (
                        <span
                          className={`absolute left-4 top-4 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            galleryCategoryClasses[
                              item.category
                            ]
                          }`}
                        >
                          {item.category}
                        </span>
                      )}

                      {/* Color-coded department tags */}
                      {tags.length > 0 && (
                        <div className="absolute left-4 top-[3.15rem] flex max-w-[calc(100%-2rem)] flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${galleryTagClasses[tag]}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="font-bold tracking-tight">
                        {item.title}
                      </h3>

                      {/* Tags also appear below the title on cards
                          when the image is too busy to read them */}
                      {tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span
                              key={`card-${tag}`}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${galleryTagClasses[tag]}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.description && (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 bg-white/[0.015] px-6 py-16 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />

              <p className="mt-4 text-sm text-muted-foreground">
                No gallery posts are available yet.
              </p>
            </div>
          )}

          <Link
            to="/gallery"
            className="group mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-blue-500 sm:hidden"
          >
            View Gallery

            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        {/* ========================================================= */}
        {/* SEPARATOR                                                  */}
        {/* ========================================================= */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />

            <div className="h-px flex-1 bg-border/50" />
          </div>
        </div>

        {/* ========================================================= */}
        {/* EVENTS                                                     */}
        {/* ========================================================= */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
                <CalendarDays className="h-4 w-4" />

                <span>Department Events</span>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Upcoming Events
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Stay up to date with upcoming activities,
                patrols, operations, and meetings.
              </p>
            </div>

            <Link
              to="/events"
              className="group hidden shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-blue-500 sm:flex"
            >
              View Events

              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {contentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-xl border border-border/40 bg-white/[0.02]"
                />
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to="/events"
                  className="group flex flex-col gap-5 rounded-xl border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:border-blue-500/30 hover:bg-blue-500/[0.025] sm:flex-row sm:items-center"
                >
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.06]">
                    <CalendarDays className="mb-1 h-4 w-4 text-blue-500" />

                    <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400">
                      {formatEventDate(event.date)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold tracking-tight transition-colors group-hover:text-blue-400">
                        {event.title}
                      </h3>

                      <span className="rounded-md border border-border/50 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {event.category}
                      </span>
                    </div>

                    {event.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                      {(event.startTime ||
                        event.endTime) && (
                        <span>
                          {event.startTime || ""}
                          {event.endTime
                            ? ` – ${event.endTime}`
                            : ""}
                        </span>
                      )}

                      {event.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />

                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-blue-500 sm:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 bg-white/[0.015] px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40" />

              <p className="mt-4 text-sm text-muted-foreground">
                No upcoming events are currently scheduled.
              </p>
            </div>
          )}

          <Link
            to="/events"
            className="group mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-blue-500 sm:hidden"
          >
            View Events

            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        {/* ========================================================= */}
        {/* FINAL SEPARATOR                                             */}
        {/* ========================================================= */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />

            <div className="h-px flex-1 bg-border/50" />
          </div>
        </div>

        {/* ========================================================= */}
        {/* JOIN THE DEPARTMENT CTA                                     */}
        {/* ========================================================= */}
        <section className="relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.055),transparent_55%)]" />

          {visibleDots.slice(0, 32).map((dot, index) => (
            <span
              key={`join-cta-dot-${index}`}
              className="absolute rounded-full bg-blue-300 mpd-star-twinkle"
              style={
                {
                  left: dot.left,
                  top: dot.top,
                  width: dot.size,
                  height: dot.size,
                  opacity: dot.opacity * 0.8,
                  filter: `blur(${dot.blur})`,
                  animationDelay: `${index * 0.18}s`,
                  animationDuration: `${2.2 + (index % 7) * 0.35}s`,
                } as React.CSSProperties
              }
            />
          ))}

          <div className="relative mx-auto flex min-h-[430px] w-full max-w-6xl items-center justify-center px-6 py-24 text-center">
            <div className="max-w-4xl">
              <h2 className="text-4xl font-black uppercase leading-[0.92] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="text-foreground">
                  READY TO JOIN THE
                  <br />
                  METRO POLICE
                </span>

                <span className="block bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                  DEPARTMENT?
                </span>
              </h2>

              <p className="mx-auto mt-7 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Take the next step, join our community, and begin your career with the Metro Police Department.
              </p>

              <div className="mt-9 flex justify-center">
                <a
                  href="https://discord.gg/metropd"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
                >
                  <span>Join Metro PD</span>

                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-blue-500/20" />
        </section>

        {/* ========================================================= */}
        {/* FINAL DISCORD CTA                                           */}
        {/* ========================================================= */}
        <section className="relative isolate overflow-hidden">
          {/* No large bottom glare.
              Just a very subtle blue atmospheric wash. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.055),transparent_55%)]" />

          {/* A few stars continue through the CTA */}
          {visibleDots.slice(0, 32).map(
            (dot, index) => (
              <span
                key={`cta-dot-${index}`}
                className="absolute rounded-full bg-blue-300 mpd-star-twinkle"
                style={
                  {
                    left: dot.left,
                    top: dot.top,
                    width: dot.size,
                    height: dot.size,
                    opacity: dot.opacity * 0.8,
                    filter: `blur(${dot.blur})`,
                    animationDelay: `${index * 0.18}s`,
                    animationDuration: `${2.2 + (index % 7) * 0.35}s`,
                  } as React.CSSProperties
                }
              />
            ),
          )}

          <div className="relative mx-auto flex min-h-[430px] w-full max-w-6xl items-center justify-center px-6 py-24 text-center">
            <div className="max-w-4xl">
              <h2 className="text-4xl font-black uppercase leading-[0.92] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="text-foreground">
                  THE METRO POLICE
                  <br />
                  DEPARTMENT{" "}
                </span>

                <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                  IS WAITING
                </span>
              </h2>

              <p className="mx-auto mt-7 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Join the Discord, create a ticket,
                and start a story worth telling.
              </p>

              <div className="mt-9 flex justify-center">
                <a
                  href="https://discord.gg/metropd"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
                >
                  <span>Join Discord</span>

                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>

          {/* Very subtle divider instead of heavy bottom glow */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-blue-500/20" />
        </section>
      </main>

      <Footer />

      {/* =========================================================== */}
      {/* ANIMATIONS                                                   */}
      {/* =========================================================== */}
      <style>{`
        /*
         * Fixed star field.
         * Stars never translate or drift; they only twinkle in place.
         */
        @keyframes mpd-star-twinkle {
          0%,
          100% {
            opacity: 0.18;
            transform: scale(0.72);
          }

          35% {
            opacity: 0.45;
            transform: scale(0.9);
          }

          50% {
            opacity: 1;
            transform: scale(1.35);
          }

          65% {
            opacity: 0.5;
            transform: scale(0.95);
          }
        }

        .mpd-star-twinkle {
          animation-name: mpd-star-twinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: opacity, transform;
        }

        @keyframes mpd-arrow-bounce-real {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.45;
          }

          50% {
            transform: translateY(10px);
            opacity: 1;
          }
        }

        .mpd-arrow-bounce-real {
          animation: mpd-arrow-bounce-real 1.1s ease-in-out infinite;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}
