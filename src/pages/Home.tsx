import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Image as ImageIcon,
  LayoutDashboard,
  LogIn,
  MapPin,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
  thumbnailUrl: string
  source: "upload" | "url"
}

type GalleryItem = {
  id: string
  title: string
  description: string
  category?: "Community" | "Fleet"
  tags?: GalleryTag[]
  media: GalleryMedia[]
  createdAt: string
}

type EventCategory =
  | "Activities"
  | "Patrol"
  | "Operations"
  | "Meetings"

type CalendarEvent = {
  id: string
  title: string
  description: string
  category: EventCategory
  date: string
  startTime: string
  endTime: string
  location: string
  discordUrl: string
}

const GALLERY_TAG_CLASSES: Record<GalleryTag, string> = {
  Dept:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  SWAT:
    "border-slate-500/40 bg-slate-800/80 text-slate-100",
  "MTF-7":
    "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  MCD:
    "border-blue-950/40 bg-blue-950/15 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200",
  TRU:
    "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  SAR:
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
}

const EVENT_CATEGORY_CLASSES: Record<EventCategory, string> = {
  Activities:
    "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300",
  Patrol:
    "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  Operations:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  Meetings:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
}

function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getGalleryMediaUrl(media: GalleryMedia) {
  return media.thumbnailUrl || media.url
}

function isEventUpcoming(event: CalendarEvent) {
  const eventDate = new Date(`${event.date}T${event.endTime || "23:59"}`)
  return eventDate.getTime() >= Date.now()
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(
      `${b.date} ${b.startTime}`,
    ),
  )
}

export default function Home() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [canViewDashboard, setCanViewDashboard] = useState(false)

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)

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

  /*
   * Public Gallery / Events preview data.
   *
   * These requests intentionally do not check management
   * permissions. The Home page is view-only.
   */
  useEffect(() => {
    let mounted = true

    async function loadHomeContent() {
      try {
        const [
          galleryResponse,
          eventsResponse,
        ] = await Promise.all([
          fetch("/api/gallery"),
          fetch("/api/events"),
        ])

        if (!mounted) {
          return
        }

        if (galleryResponse.ok) {
          const galleryData =
            await galleryResponse.json()

          setGalleryItems(
            Array.isArray(galleryData.items)
              ? galleryData.items
              : [],
          )
        }

        if (eventsResponse.ok) {
          const eventsData =
            await eventsResponse.json()

          setEvents(
            Array.isArray(eventsData.events)
              ? eventsData.events
              : [],
          )
        }
      } catch (error) {
        console.error(
          "Failed to load Home page content:",
          error,
        )
      } finally {
        if (mounted) {
          setGalleryLoading(false)
          setEventsLoading(false)
        }
      }
    }

    void loadHomeContent()

    return () => {
      mounted = false
    }
  }, [])

  const recentGallery = useMemo(() => {
    return [...galleryItems]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .slice(0, 6)
  }, [galleryItems])

  const upcomingEvents = useMemo(() => {
    return sortEvents(
      events.filter(isEventUpcoming),
    ).slice(0, 5)
  }, [events])

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <Navbar />

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[42%] h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[140px]" />

        <div className="absolute left-[15%] top-[30%] h-[250px] w-[250px] rounded-full bg-blue-500/5 blur-[100px]" />

        <div className="absolute right-[10%] top-[25%] h-[300px] w-[300px] rounded-full bg-blue-400/5 blur-[120px]" />

        <div className="absolute left-[12%] top-[35%] h-1 w-1 rounded-full bg-blue-400/50" />

        <div className="absolute left-[22%] top-[48%] h-1 w-1 rounded-full bg-blue-500/30" />

        <div className="absolute right-[16%] top-[38%] h-1 w-1 rounded-full bg-blue-400/40" />

        <div className="absolute right-[9%] top-[50%] h-1 w-1 rounded-full bg-blue-500/30" />
      </div>

      {/* Hero */}
      <main className="relative z-10 flex-1">
        <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
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
              The Metro Police Department is built
              around immersive law enforcement,
              dedicated officers, community
              interaction, and unforgettable stories
              across CaliRP.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="https://discord.gg/metropd"
                className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
              >
                <span>Join Metro PD</span>

                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>

              {authChecked &&
                !isAuthenticated && (
                  <Link
                    to="/sign-in"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
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
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
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
        </section>

        {/* ================================================================ */}
        {/* Gallery separator                                                */}
        {/* ================================================================ */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/60" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />

            <div className="h-px flex-1 bg-border/60" />
          </div>
        </div>

        {/* Gallery */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-500">
                <ImageIcon className="h-4 w-4" />
                Community
              </div>

              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Gallery
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Recent Metro Police Department
                photos, fleet showcases, and
                community moments.
              </p>
            </div>

            <Link
              to="/gallery"
              className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-500 transition-colors hover:text-blue-400"
            >
              View Gallery

              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {galleryLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="aspect-[4/3] animate-pulse rounded-2xl border border-border/60 bg-muted/40"
                  />
                ),
              )}
            </div>
          ) : recentGallery.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 px-6 py-14 text-center">
              <ImageIcon className="mx-auto h-9 w-9 text-muted-foreground/60" />

              <p className="mt-3 text-sm font-medium">
                No gallery items yet
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Check back later for Metro PD
                photos and media.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentGallery.map((item) => {
                const media = item.media[0]

                if (!media) {
                  return null
                }

                return (
                  <Link
                    key={item.id}
                    to="/gallery"
                    className="group overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={getGalleryMediaUrl(media)}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                        loading="lazy"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80" />

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.category && (
                            <span
                              className={[
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                item.category ===
                                "Community"
                                  ? "border-blue-400/30 bg-blue-500/15 text-blue-100"
                                  : "border-amber-400/30 bg-amber-500/15 text-amber-100",
                              ].join(" ")}
                            >
                              {item.category}
                            </span>
                          )}

                          {item.tags
                            ?.slice(0, 3)
                            .map((tag) => (
                              <span
                                key={tag}
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                  GALLERY_TAG_CLASSES[
                                    tag
                                  ],
                                ].join(" ")}
                              >
                                {tag}
                              </span>
                            ))}
                        </div>

                        <h3 className="mt-2 truncate text-base font-bold text-white">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ================================================================ */}
        {/* Events separator                                                  */}
        {/* ================================================================ */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/60" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />

            <div className="h-px flex-1 bg-border/60" />
          </div>
        </div>

        {/* Events */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-500">
                <CalendarDays className="h-4 w-4" />
                Community
              </div>

              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Upcoming Events
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Stay up to date with upcoming
                activities, patrols, operations, and
                department meetings.
              </p>
            </div>

            <Link
              to="/events"
              className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-500 transition-colors hover:text-blue-400"
            >
              View Events

              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {eventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
                  />
                ),
              )}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 px-6 py-14 text-center">
              <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/60" />

              <p className="mt-3 text-sm font-medium">
                No upcoming events
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                There are currently no upcoming
                Metro PD events scheduled.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
              <div className="divide-y divide-border/60">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    to="/events"
                    className="group flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
                  >
                    {/* Date */}
                    <div
                      className={[
                        "flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl border",
                        EVENT_CATEGORY_CLASSES[
                          event.category
                        ],
                      ].join(" ")}
                    >
                      <span className="text-[9px] font-bold uppercase opacity-80">
                        {new Date(
                          `${event.date}T00:00:00`,
                        ).toLocaleDateString(
                          "en-GB",
                          {
                            month: "short",
                          },
                        )}
                      </span>

                      <span className="text-xl font-bold leading-none">
                        {new Date(
                          `${event.date}T00:00:00`,
                        ).getDate()}
                      </span>
                    </div>

                    {/* Event information */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold sm:text-base">
                          {event.title}
                        </h3>

                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            EVENT_CATEGORY_CLASSES[
                              event.category
                            ],
                          ].join(" ")}
                        >
                          {event.category}
                        </span>
                      </div>

                      {event.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {formatEventDate(
                            event.date,
                          )}
                        </span>

                        {event.startTime && (
                          <span>
                            {event.startTime}
                            {event.endTime
                              ? ` – ${event.endTime}`
                              : ""}
                          </span>
                        )}

                        {event.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />

                            <span className="truncate">
                              {event.location}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 sm:block" />
                  </Link>
                ))}
              </div>

              <div className="border-t border-border/60 px-5 py-4">
                <Link
                  to="/events"
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-blue-500"
                >
                  View the full events calendar

                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
