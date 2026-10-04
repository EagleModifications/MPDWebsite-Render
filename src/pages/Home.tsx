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
  tags?: GalleryTag[]
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
  drift: string
}

/**
 * Deterministic pseudo-random generator.
 *
 * This gives us randomized-looking stars without using Math.random()
 * during rendering.
 */
function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Generate a large field of subtle stars.
 *
 * The stars are intentionally spread across the whole page instead
 * of being concentrated around the CTA section.
 */
function createAmbientDots(count: number): AmbientDot[] {
  return Array.from(
    { length: count },
    (_, index) => {
      const x = seededRandom(index + 1)
      const y = seededRandom(index + 101)
      const sizeValue = seededRandom(index + 201)
      const opacityValue = seededRandom(index + 301)
      const delayValue = seededRandom(index + 401)
      const durationValue = seededRandom(index + 501)
      const driftValue = seededRandom(index + 601)

      return {
        left: `${(x * 98) + 1}%`,
        top: `${(y * 94) + 3}%`,
        size:
          sizeValue > 0.9
            ? "3px"
            : sizeValue > 0.62
              ? "2.5px"
              : "2px",
        opacity:
          0.12 +
          opacityValue * 0.3,
        delay: `${(delayValue * 14).toFixed(2)}s`,
        duration: `${(
          9 +
          durationValue * 10
        ).toFixed(2)}s`,
        drift: `${(
          4 +
          driftValue * 9
        ).toFixed(2)}px`,
      }
    },
  )
}

const galleryTagClasses: Record<
  GalleryTag,
  string
> = {
  Dept:
    "border-blue-500/30 bg-blue-500/10 text-blue-400",
  SWAT:
    "border-white/15 bg-white/10 text-foreground",
  "MTF-7":
    "border-slate-500/30 bg-slate-500/10 text-slate-300",
  MCD:
    "border-blue-900/40 bg-blue-950/30 text-blue-300",
  TRU:
    "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  SAR:
    "border-red-500/30 bg-red-500/10 text-red-400",
}

function formatEventDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    },
  )
}

function getGalleryPreview(
  item: GalleryItem,
) {
  const media = item.media?.[0]

  if (!media) {
    return null
  }

  return media.thumbnailUrl || media.url
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

  const [events, setEvents] = useState<
    CalendarEvent[]
  >([])

  const [contentLoading, setContentLoading] =
    useState(true)

  /**
   * Large star field.
   */
  const ambientDots = useMemo(
    () => createAmbientDots(95),
    [],
  )

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        const sessionResponse =
          await fetch(
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

        setIsAuthenticated(
          authenticated,
        )

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

    const loadPublicContent =
      async () => {
        try {
          const [
            galleryResponse,
            eventsResponse,
          ] =
            await Promise.allSettled([
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

          /*
           * Gallery
           */
          if (
            galleryResponse.status ===
              "fulfilled" &&
            galleryResponse.value.ok
          ) {
            try {
              const data =
                await galleryResponse.value.json()

              const items = Array.isArray(
                data,
              )
                ? data
                : Array.isArray(
                      data?.items,
                    )
                  ? data.items
                  : []

              setGallery(
                items
                  .filter(
                    (item: GalleryItem) =>
                      item &&
                      item.id &&
                      Array.isArray(
                        item.media,
                      ),
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
                  .slice(0, 6),
              )
            } catch {
              setGallery([])
            }
          }

          /*
           * Events
           */
          if (
            eventsResponse.status ===
              "fulfilled" &&
            eventsResponse.value.ok
          ) {
            try {
              const data =
                await eventsResponse.value.json()

              const items = Array.isArray(
                data,
              )
                ? data
                : Array.isArray(
                      data?.events,
                    )
                  ? data.events
                  : []

              const now = new Date()

              const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
              )

              setEvents(
                items
                  .filter(
                    (
                      event: CalendarEvent,
                    ) =>
                      event &&
                      event.id &&
                      event.title &&
                      event.date,
                  )
                  .filter(
                    (
                      event: CalendarEvent,
                    ) => {
                      const eventDate =
                        new Date(
                          event.date,
                        )

                      return (
                        !Number.isNaN(
                          eventDate.getTime(),
                        ) &&
                        eventDate >= today
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

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <Navbar />

      {/* =========================================================
          GLOBAL STARFIELD
          ========================================================= */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Very subtle central atmosphere */}
        <div className="absolute left-1/2 top-[28%] h-[600px] w-[850px] -translate-x-1/2 rounded-full bg-blue-600/[0.035] blur-[170px]" />

        {/* Small side atmosphere */}
        <div className="absolute left-[-10%] top-[38%] h-[500px] w-[500px] rounded-full bg-blue-500/[0.018] blur-[150px]" />

        <div className="absolute right-[-10%] top-[50%] h-[500px] w-[500px] rounded-full bg-blue-500/[0.018] blur-[150px]" />

        {/* Stars */}
        {ambientDots.map(
          (dot, index) => (
            <span
              key={`ambient-dot-${index}`}
              className="absolute rounded-full bg-blue-300 animate-mpd-star"
              style={
                {
                  left: dot.left,
                  top: dot.top,
                  width: dot.size,
                  height: dot.size,
                  opacity: dot.opacity,
                  animationDelay:
                    dot.delay,
                  animationDuration:
                    dot.duration,
                  "--star-drift":
                    dot.drift,
                } as React.CSSProperties
              }
            />
          ),
        )}
      </div>

      {/* =========================================================
          PAGE
          ========================================================= */}
      <main className="relative z-10 flex flex-1 flex-col">
        {/* =======================================================
            HERO
            ======================================================= */}
        <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
          <div className="flex w-full max-w-5xl flex-col items-center text-center">
            {/* Brand */}
            <div className="mb-7 flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Metro Police Department"
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
              The Metro Police Department
              is built around immersive
              law enforcement, dedicated
              officers, community
              interaction, and unforgettable
              stories across CaliRP.
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="https://discord.gg/metropd"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
              >
                <span>
                  Join Metro PD
                </span>

                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>

              {authChecked &&
                !isAuthenticated && (
                  <Link
                    to="/sign-in"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.035] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07]"
                  >
                    <LogIn className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />

                    <span>
                      Member Login
                    </span>
                  </Link>
                )}

              {authChecked &&
                isAuthenticated &&
                canViewDashboard && (
                  <Link
                    to="/dashboard"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.035] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07]"
                  >
                    <LayoutDashboard className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />

                    <span>
                      Dashboard
                    </span>
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

          {/* =====================================================
              BOUNCING DOWN ARROW
              ===================================================== */}
          <a
            href="#gallery"
            aria-label="Scroll to gallery"
            className="group absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-muted-foreground/50 transition-colors hover:text-blue-500"
          >
            <span className="text-[9px] font-semibold uppercase tracking-[0.28em] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Explore
            </span>

            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-sm">
              <ChevronDown className="h-4 w-4 animate-mpd-arrow" />
            </span>
          </a>
        </section>

        {/* =======================================================
            SEPARATOR
            ======================================================= */}
        <div
          id="gallery"
          className="mx-auto w-full max-w-6xl px-6"
        >
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/40" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.55)]" />

            <div className="h-px flex-1 bg-border/40" />
          </div>
        </div>

        {/* =======================================================
            GALLERY
            ======================================================= */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
                <ImageIcon className="h-4 w-4" />

                <span>
                  Department Gallery
                </span>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Latest From Metro
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Take a look at the latest
                moments, vehicles,
                operations, and community
                stories from the Metro
                Police Department.
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

          {contentLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="h-64 animate-pulse rounded-xl border border-border/40 bg-white/[0.02]"
                  />
                ),
              )}
            </div>
          ) : gallery.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map(
                (item) => {
                  const preview =
                    getGalleryPreview(
                      item,
                    )

                  return (
                    <Link
                      key={item.id}
                      to="/gallery"
                      className="group overflow-hidden rounded-xl border border-border/50 bg-background/40 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-blue-500/[0.025]"
                    >
                      {/* Image */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-black/30">
                        {preview ? (
                          item.media?.[0]
                            ?.type ===
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
                              alt={
                                item.title
                              }
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                        {item.category && (
                          <span className="absolute left-4 top-4 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                            {item.category}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="font-bold tracking-tight">
                          {item.title}
                        </h3>

                        {/* Color coded tags */}
                        {item.tags &&
                          item.tags.length >
                            0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {item.tags.map(
                                (tag) => (
                                  <span
                                    key={
                                      tag
                                    }
                                    className={`rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${galleryTagClasses[tag]}`}
                                  >
                                    {tag}
                                  </span>
                                ),
                              )}
                            </div>
                          )}

                        {item.description && (
                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {
                              item.description
                            }
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                },
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 bg-white/[0.015] px-6 py-16 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />

              <p className="mt-4 text-sm text-muted-foreground">
                No gallery posts are
                available yet.
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

        {/* =======================================================
            SEPARATOR
            ======================================================= */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/40" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.55)]" />

            <div className="h-px flex-1 bg-border/40" />
          </div>
        </div>

        {/* =======================================================
            EVENTS
            ======================================================= */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
                <CalendarDays className="h-4 w-4" />

                <span>
                  Department Events
                </span>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Upcoming Events
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Stay up to date with
                upcoming activities,
                patrols, operations, and
                meetings.
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
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-xl border border-border/40 bg-white/[0.02]"
                  />
                ),
              )}
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-3">
              {events.map(
                (event) => (
                  <Link
                    key={event.id}
                    to="/events"
                    className="group flex flex-col gap-5 rounded-xl border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:border-blue-500/30 hover:bg-blue-500/[0.025] sm:flex-row sm:items-center"
                  >
                    {/* Date */}
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.06]">
                      <CalendarDays className="mb-1 h-4 w-4 text-blue-500" />

                      <span className="text-center text-[9px] font-bold uppercase tracking-wide text-blue-400">
                        {formatEventDate(
                          event.date,
                        )}
                      </span>
                    </div>

                    {/* Main */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold tracking-tight transition-colors group-hover:text-blue-400">
                          {
                            event.title
                          }
                        </h3>

                        <span className="rounded-md border border-border/50 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {
                            event.category
                          }
                        </span>
                      </div>

                      {event.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {
                            event.description
                          }
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                        {(event.startTime ||
                          event.endTime) && (
                          <span>
                            {
                              event.startTime
                            }

                            {event.endTime
                              ? ` – ${event.endTime}`
                              : ""}
                          </span>
                        )}

                        {event.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />

                            {
                              event.location
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-blue-500 sm:block" />
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 bg-white/[0.015] px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40" />

              <p className="mt-4 text-sm text-muted-foreground">
                No upcoming events are
                currently scheduled.
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

        {/* =======================================================
            FINAL SEPARATOR
            ======================================================= */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/40" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.55)]" />

            <div className="h-px flex-1 bg-border/40" />
          </div>
        </div>

        {/* =======================================================
            FINAL DISCORD CTA
            ======================================================= */}
        <section className="relative isolate overflow-hidden">
          {/* Very subtle blue atmosphere.
              No large bottom glare. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.055),transparent_48%)]" />

          {/* A few additional stars inside the CTA */}
          <div className="pointer-events-none absolute inset-0">
            {ambientDots
              .slice(0, 35)
              .map(
                (dot, index) => (
                  <span
                    key={`cta-star-${index}`}
                    className="absolute rounded-full bg-blue-300 animate-mpd-star"
                    style={
                      {
                        left: dot.left,
                        top: dot.top,
                        width: dot.size,
                        height: dot.size,
                        opacity:
                          dot.opacity *
                          0.75,
                        animationDelay:
                          `${(
                            index *
                            0.31
                          ).toFixed(2)}s`,
                        animationDuration:
                          dot.duration,
                        "--star-drift":
                          dot.drift,
                      } as React.CSSProperties
                    }
                  />
                ),
              )}
          </div>

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
                Join the Discord, create a
                ticket, and start a story
                worth telling.
              </p>

              <div className="mt-9 flex justify-center">
                <a
                  href="https://discord.gg/metropd"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
                >
                  <span>
                    Join Discord
                  </span>

                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* =========================================================
          ANIMATIONS
          ========================================================= */}
      <style>{`
        @keyframes mpd-star-blink {
          0%,
          100% {
            opacity: 0.08;
            transform: translate3d(
              0,
              0,
              0
            ) scale(0.72);
          }

          18% {
            opacity: 0.16;
          }

          38% {
            opacity: 0.48;
            transform: translate3d(
              calc(var(--star-drift) * -0.35),
              calc(var(--star-drift) * 0.2),
              0
            ) scale(1);
          }

          52% {
            opacity: 0.72;
            transform: translate3d(
              calc(var(--star-drift) * 0.25),
              calc(var(--star-drift) * -0.25),
              0
            ) scale(1.18);
          }

          68% {
            opacity: 0.22;
          }

          82% {
            opacity: 0.42;
            transform: translate3d(
              calc(var(--star-drift) * -0.15),
              calc(var(--star-drift) * 0.25),
              0
            ) scale(0.92);
          }
        }

        @keyframes mpd-arrow-bounce {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(6px);
          }
        }

        .animate-mpd-star {
          animation-name: mpd-star-blink;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: opacity, transform;
        }

        .animate-mpd-arrow {
          animation: mpd-arrow-bounce 1.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-mpd-star,
          .animate-mpd-arrow {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
