import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogIn,
  MapPin,
  Image as ImageIcon,
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
}

const ambientDots: AmbientDot[] = [
  {
    left: "4%",
    top: "9%",
    size: "2px",
    opacity: 0.35,
    delay: "1.2s",
    duration: "8s",
  },
  {
    left: "11%",
    top: "16%",
    size: "3px",
    opacity: 0.2,
    delay: "4.8s",
    duration: "11s",
  },
  {
    left: "17%",
    top: "7%",
    size: "2px",
    opacity: 0.45,
    delay: "7.1s",
    duration: "9s",
  },
  {
    left: "24%",
    top: "20%",
    size: "2px",
    opacity: 0.28,
    delay: "2.5s",
    duration: "13s",
  },
  {
    left: "31%",
    top: "12%",
    size: "3px",
    opacity: 0.18,
    delay: "6.2s",
    duration: "10s",
  },
  {
    left: "39%",
    top: "25%",
    size: "2px",
    opacity: 0.3,
    delay: "9s",
    duration: "12s",
  },
  {
    left: "47%",
    top: "8%",
    size: "2px",
    opacity: 0.4,
    delay: "3.7s",
    duration: "9s",
  },
  {
    left: "54%",
    top: "17%",
    size: "3px",
    opacity: 0.2,
    delay: "8.5s",
    duration: "14s",
  },
  {
    left: "62%",
    top: "11%",
    size: "2px",
    opacity: 0.34,
    delay: "5.3s",
    duration: "10s",
  },
  {
    left: "69%",
    top: "22%",
    size: "2px",
    opacity: 0.26,
    delay: "1.8s",
    duration: "12s",
  },
  {
    left: "76%",
    top: "8%",
    size: "3px",
    opacity: 0.42,
    delay: "10s",
    duration: "15s",
  },
  {
    left: "84%",
    top: "17%",
    size: "2px",
    opacity: 0.3,
    delay: "6.8s",
    duration: "11s",
  },
  {
    left: "92%",
    top: "10%",
    size: "2px",
    opacity: 0.4,
    delay: "2.2s",
    duration: "9s",
  },
  {
    left: "97%",
    top: "27%",
    size: "3px",
    opacity: 0.22,
    delay: "7.5s",
    duration: "13s",
  },
  {
    left: "6%",
    top: "31%",
    size: "2px",
    opacity: 0.28,
    delay: "4.1s",
    duration: "12s",
  },
  {
    left: "14%",
    top: "39%",
    size: "3px",
    opacity: 0.2,
    delay: "9.4s",
    duration: "14s",
  },
  {
    left: "21%",
    top: "28%",
    size: "2px",
    opacity: 0.38,
    delay: "2.7s",
    duration: "10s",
  },
  {
    left: "28%",
    top: "43%",
    size: "2px",
    opacity: 0.24,
    delay: "6.1s",
    duration: "13s",
  },
  {
    left: "35%",
    top: "34%",
    size: "3px",
    opacity: 0.18,
    delay: "11s",
    duration: "15s",
  },
  {
    left: "43%",
    top: "46%",
    size: "2px",
    opacity: 0.32,
    delay: "3.2s",
    duration: "11s",
  },
  {
    left: "51%",
    top: "31%",
    size: "2px",
    opacity: 0.4,
    delay: "8.2s",
    duration: "12s",
  },
  {
    left: "58%",
    top: "43%",
    size: "3px",
    opacity: 0.2,
    delay: "5.7s",
    duration: "14s",
  },
  {
    left: "66%",
    top: "34%",
    size: "2px",
    opacity: 0.34,
    delay: "1.5s",
    duration: "10s",
  },
  {
    left: "73%",
    top: "47%",
    size: "2px",
    opacity: 0.24,
    delay: "9.8s",
    duration: "13s",
  },
  {
    left: "81%",
    top: "32%",
    size: "3px",
    opacity: 0.3,
    delay: "4.4s",
    duration: "11s",
  },
  {
    left: "89%",
    top: "41%",
    size: "2px",
    opacity: 0.42,
    delay: "7.3s",
    duration: "15s",
  },
  {
    left: "95%",
    top: "35%",
    size: "2px",
    opacity: 0.26,
    delay: "2.9s",
    duration: "12s",
  },
  {
    left: "8%",
    top: "54%",
    size: "3px",
    opacity: 0.18,
    delay: "10.2s",
    duration: "14s",
  },
  {
    left: "18%",
    top: "61%",
    size: "2px",
    opacity: 0.32,
    delay: "5.1s",
    duration: "11s",
  },
  {
    left: "26%",
    top: "55%",
    size: "2px",
    opacity: 0.25,
    delay: "8.7s",
    duration: "13s",
  },
  {
    left: "34%",
    top: "67%",
    size: "3px",
    opacity: 0.2,
    delay: "3.9s",
    duration: "15s",
  },
  {
    left: "42%",
    top: "58%",
    size: "2px",
    opacity: 0.36,
    delay: "11.5s",
    duration: "12s",
  },
  {
    left: "50%",
    top: "70%",
    size: "2px",
    opacity: 0.22,
    delay: "6.4s",
    duration: "10s",
  },
  {
    left: "59%",
    top: "56%",
    size: "3px",
    opacity: 0.3,
    delay: "1.1s",
    duration: "14s",
  },
  {
    left: "68%",
    top: "65%",
    size: "2px",
    opacity: 0.4,
    delay: "8.1s",
    duration: "13s",
  },
  {
    left: "77%",
    top: "57%",
    size: "2px",
    opacity: 0.25,
    delay: "4.7s",
    duration: "11s",
  },
  {
    left: "86%",
    top: "69%",
    size: "3px",
    opacity: 0.2,
    delay: "9.1s",
    duration: "15s",
  },
  {
    left: "94%",
    top: "59%",
    size: "2px",
    opacity: 0.35,
    delay: "2.4s",
    duration: "12s",
  },
  {
    left: "5%",
    top: "78%",
    size: "2px",
    opacity: 0.24,
    delay: "7.7s",
    duration: "13s",
  },
  {
    left: "15%",
    top: "87%",
    size: "3px",
    opacity: 0.18,
    delay: "3.1s",
    duration: "15s",
  },
  {
    left: "25%",
    top: "76%",
    size: "2px",
    opacity: 0.32,
    delay: "10.7s",
    duration: "11s",
  },
  {
    left: "37%",
    top: "88%",
    size: "2px",
    opacity: 0.26,
    delay: "5.8s",
    duration: "14s",
  },
  {
    left: "48%",
    top: "80%",
    size: "3px",
    opacity: 0.2,
    delay: "1.9s",
    duration: "12s",
  },
  {
    left: "57%",
    top: "91%",
    size: "2px",
    opacity: 0.34,
    delay: "8.9s",
    duration: "15s",
  },
  {
    left: "69%",
    top: "79%",
    size: "2px",
    opacity: 0.28,
    delay: "4.2s",
    duration: "10s",
  },
  {
    left: "79%",
    top: "89%",
    size: "3px",
    opacity: 0.18,
    delay: "11.1s",
    duration: "14s",
  },
  {
    left: "88%",
    top: "77%",
    size: "2px",
    opacity: 0.38,
    delay: "6.6s",
    duration: "12s",
  },
  {
    left: "97%",
    top: "88%",
    size: "2px",
    opacity: 0.24,
    delay: "2.8s",
    duration: "13s",
  },
]

const galleryTagClasses: Record<GalleryTag, string> = {
  Dept: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  SWAT: "border-white/15 bg-white/10 text-foreground",
  "MTF-7": "border-slate-500/30 bg-slate-500/10 text-slate-300",
  MCD: "border-blue-900/40 bg-blue-950/30 text-blue-300",
  TRU: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  SAR: "border-red-500/30 bg-red-500/10 text-red-400",
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

function getGalleryPreview(item: GalleryItem) {
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
        const [galleryResponse, eventsResponse] =
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

        if (
          galleryResponse.status === "fulfilled" &&
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
                .slice(0, 6),
            )
          } catch {
            setGallery([])
          }
        }

        if (
          eventsResponse.status === "fulfilled" &&
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
                .filter((event: CalendarEvent) => {
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
                })
                .sort(
                  (
                    a: CalendarEvent,
                    b: CalendarEvent,
                  ) => {
                    const aDate =
                      new Date(a.date).getTime()

                    const bDate =
                      new Date(b.date).getTime()

                    return aDate - bDate
                  },
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

      {/* Global atmospheric background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Main blue atmospheric glow */}
        <div className="absolute left-1/2 top-[30%] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-blue-700/[0.055] blur-[150px]" />

        <div className="absolute left-[8%] top-[20%] h-[400px] w-[400px] rounded-full bg-blue-500/[0.025] blur-[130px]" />

        <div className="absolute right-[5%] top-[35%] h-[500px] w-[500px] rounded-full bg-blue-600/[0.025] blur-[150px]" />

        {/* Lower blue atmosphere */}
        <div className="absolute bottom-[5%] left-1/2 h-[550px] w-[1000px] -translate-x-1/2 rounded-full bg-blue-950/[0.18] blur-[160px]" />

        {/* Dots */}
        {visibleDots.map((dot, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-blue-400 animate-mpd-dot"
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              opacity: dot.opacity,
              animationDelay: dot.delay,
              animationDuration: dot.duration,
            }}
          />
        ))}
      </div>

      {/* Page content */}
      <main className="relative z-10 flex flex-1 flex-col">
        {/* Hero */}
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
        </section>

        {/* Section separator */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />

            <div className="h-px flex-1 bg-border/50" />
          </div>
        </div>

        {/* Gallery */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mb-10 flex items-end justify-between gap-6">
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

          {contentLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse rounded-xl border border-border/40 bg-white/[0.02]"
                />
              ))}
            </div>
          ) : gallery.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((item) => {
                const preview =
                  getGalleryPreview(item)

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

                    <div className="p-5">
                      <h3 className="font-bold tracking-tight">
                        {item.title}
                      </h3>

                      {item.tags &&
                        item.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.tags
                              .slice(0, 3)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className={`rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${galleryTagClasses[tag]}`}
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

        {/* Section separator */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />

            <div className="h-px flex-1 bg-border/50" />
          </div>
        </div>

        {/* Events */}
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
                  {/* Date */}
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.06]">
                    <CalendarDays className="mb-1 h-4 w-4 text-blue-500" />

                    <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400">
                      {formatEventDate(
                        event.date,
                      )}
                    </span>
                  </div>

                  {/* Main */}
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

        {/* Final separator */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />

            <div className="h-px flex-1 bg-border/50" />
          </div>
        </div>

        {/* Final Discord CTA */}
        <section className="relative isolate overflow-hidden">
          {/* Same atmospheric background as the rest of the page */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/[0.12] via-background/20 to-background" />

          <div className="absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/[0.055] blur-[150px]" />

          <div className="absolute left-[12%] top-[35%] h-[250px] w-[250px] rounded-full bg-blue-500/[0.025] blur-[120px]" />

          <div className="absolute right-[10%] bottom-[15%] h-[300px] w-[300px] rounded-full bg-blue-500/[0.025] blur-[130px]" />

          {/* Additional CTA dots */}
          {ambientDots
            .slice(0, 24)
            .map((dot, index) => (
              <span
                key={`cta-dot-${index}`}
                className="absolute rounded-full bg-blue-400 animate-mpd-dot"
                style={{
                  left: dot.left,
                  top: dot.top,
                  width: dot.size,
                  height: dot.size,
                  opacity:
                    dot.opacity * 0.7,
                  animationDelay: `${
                    index * 0.37
                  }s`,
                  animationDuration:
                    dot.duration,
                }}
              />
            ))}

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

          {/* Subtle bottom atmosphere */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-blue-950/[0.08] to-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-blue-500/20" />
        </section>
      </main>

      <Footer />

      {/* Slow randomized dot animation */}
      <style>{`
        @keyframes mpd-dot-blink {
          0%,
          100% {
            opacity: 0.12;
            transform: scale(0.75);
          }

          25% {
            opacity: 0.32;
            transform: scale(1);
          }

          50% {
            opacity: 0.7;
            transform: scale(1.18);
          }

          72% {
            opacity: 0.25;
            transform: scale(0.9);
          }
        }

        .animate-mpd-dot {
          animation-name: mpd-dot-blink;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: opacity, transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-mpd-dot {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
