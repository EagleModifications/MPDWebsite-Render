import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  RefreshCw,
  Shield,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import {
  getSession,
  type User,
} from "@/lib/auth"

/* ═════════════════════════════════════════════
   TYPES
═════════════════════════════════════════════ */

type BadgeLines = {
  "1": string
  "2": string
  "3": string
  "4": string
  "5": string
}

type BadgeOfficer = {
  name: string
  rank: string
  badgeNumber: string
  discordId: string
  callsign: string
  status: string
  timeInDept?: string
  timeInRank?: string
}

type BadgeData = {
  badgeId: string
  sealId: string
  finish: string
  lines: BadgeLines
}

type BadgeResponse = {
  success: boolean
  badge: BadgeData
  officer: BadgeOfficer
}

type ApiError = {
  success?: boolean
  error?: string
  message?: string
}

/* ═════════════════════════════════════════════
   SMALL COMPONENTS
═════════════════════════════════════════════ */

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="shrink-0 text-sm text-muted-foreground">
        {label}
      </span>

      <span className="min-w-0 truncate text-right text-sm font-medium text-foreground">
        {value || "—"}
      </span>
    </div>
  )
}

function ConfigCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
          {icon}
        </div>

        <h2 className="text-sm font-semibold text-foreground">
          {title}
        </h2>
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  )
}

function BadgeLine({
  number,
  value,
}: {
  number: number
  value: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-xs font-semibold text-blue-500">
        {number}
      </div>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {value || "—"}
      </span>
    </div>
  )
}

/* ═════════════════════════════════════════════
   PAGE
═════════════════════════════════════════════ */

export default function BadgeGenerator() {
  const [user, setUser] =
    useState<User | null>(null)

  const [badgeData, setBadgeData] =
    useState<BadgeResponse | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  /*
   * Prevent duplicate initial requests
   * during React Strict Mode development
   * mounting.
   */
  const initialLoadRef =
    useRef(false)

  /* ═════════════════════════════════════════
     LOAD BADGE
  ═════════════════════════════════════════ */

  const loadBadge =
    useCallback(async () => {
      setRefreshing(true)

      try {
        /*
         * The backend gets the Discord ID
         * directly from the authenticated
         * mpd_session cookie.
         *
         * We therefore do NOT send a
         * Discord ID from the browser.
         */
        const response =
          await fetch(
            "/api/badges/me",
            {
              method: "GET",

              credentials:
                "include",

              cache: "no-store",

              headers: {
                Accept:
                  "application/json",
              },
            },
          )

        const data =
          (await response.json()) as
            | BadgeResponse
            | ApiError

        if (!response.ok) {
          throw new Error(
            data &&
              typeof data ===
                "object" &&
              "error" in data &&
              typeof data.error ===
                "string"
              ? data.error
              : `Failed to load badge (${response.status}).`,
          )
        }

        if (
          !data ||
          typeof data !==
            "object" ||
          !("badge" in data) ||
          !("officer" in data)
        ) {
          throw new Error(
            "The badge API returned an invalid response.",
          )
        }

        setBadgeData(
          data as BadgeResponse,
        )
      } catch (error) {
        console.error(
          "[BadgeGenerator] Badge request failed:",
          error,
        )

        setBadgeData(null)

        /*
         * Do not show a toast for a cancelled
         * component request.
         */
        if (
          error instanceof DOMException &&
          error.name ===
            "AbortError"
        ) {
          return
        }

        toast.error(
          "Unable to load badge",
          {
            description:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred.",
          },
        )
      } finally {
        setRefreshing(false)
      }
    }, [])

  /* ═════════════════════════════════════════
     SESSION + INITIAL BADGE
  ═════════════════════════════════════════ */

  useEffect(() => {
    let active = true

    /*
     * React Strict Mode can run an effect
     * twice in development. Only perform
     * the initial badge request once.
     */
    if (
      initialLoadRef.current
    ) {
      return () => {
        active = false
      }
    }

    initialLoadRef.current =
      true

    const load = async () => {
      try {
        const session =
          await getSession()

        if (!active) {
          return
        }

        /*
         * getSession() returns User | null.
         *
         * There is no session.user here.
         */
        setUser(
          session ?? null,
        )

        if (!session) {
          setBadgeData(null)

          toast.error(
            "Unable to load badge",
            {
              description:
                "You are not authenticated.",
            },
          )

          return
        }

        await loadBadge()
      } catch (error) {
        console.error(
          "[BadgeGenerator] Session load failed:",
          error,
        )

        if (!active) {
          return
        }

        setUser(null)
        setBadgeData(null)

        toast.error(
          "Unable to load badge",
          {
            description:
              error instanceof Error
                ? error.message
                : "Unable to verify your session.",
          },
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [loadBadge])

  /* ═════════════════════════════════════════
     REFRESH
  ═════════════════════════════════════════ */

  const handleRefresh =
    async () => {
      await loadBadge()
    }

  /* ═════════════════════════════════════════
     COPY
  ═════════════════════════════════════════ */

  const handleCopy =
    async () => {
      if (!badgeData) {
        return
      }

      const text = [
        badgeData.badge.lines["1"],
        badgeData.badge.lines["2"],
        badgeData.badge.lines["3"],
        badgeData.badge.lines["4"],
        badgeData.badge.lines["5"],
      ].join("\n")

      try {
        await navigator.clipboard.writeText(
          text,
        )

        toast.success(
          "Badge lines copied",
          {
            description:
              "The five badge lines have been copied to your clipboard.",
          },
        )
      } catch (error) {
        console.error(
          "[BadgeGenerator] Clipboard error:",
          error,
        )

        toast.error(
          "Copy failed",
          {
            description:
              "Your browser could not access the clipboard.",
          },
        )
      }
    }

  /* ═════════════════════════════════════════
     LOADING
  ═════════════════════════════════════════ */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />

            <span>
              Loading badge generator...
            </span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  /* ═════════════════════════════════════════
     PAGE
  ═════════════════════════════════════════ */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ───────────────────────────────────
            HEADER
        ─────────────────────────────────── */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-500">
              <BadgeCheck className="h-5 w-5" />

              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Badge Generator
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Department Badge
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Generate your department badge using
              your current Metro Police Department
              roster information.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={
              handleRefresh
            }
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </Button>
        </div>

        {/* ───────────────────────────────────
            NO BADGE
        ─────────────────────────────────── */}

        {!badgeData ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
            <div className="max-w-md px-6 text-center">
              <BadgeCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />

              <h2 className="mt-4 text-sm font-semibold text-foreground">
                Badge unavailable
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Your badge could not be generated from
                the current roster information.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-5"
                onClick={
                  handleRefresh
                }
                disabled={
                  refreshing
                }
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            {/* ───────────────────────────────
                LEFT
            ─────────────────────────────── */}

            <div className="space-y-6">
              {/* OFFICER */}

              <ConfigCard
                title="Officer Information"
                icon={
                  <UserRound className="h-4 w-4" />
                }
              >
                <div className="divide-y divide-border/60">
                  <InfoRow
                    label="Name"
                    value={
                      badgeData.officer.name
                    }
                  />

                  <InfoRow
                    label="Rank"
                    value={
                      badgeData.officer.rank
                    }
                  />

                  <InfoRow
                    label="Badge Number"
                    value={
                      badgeData.officer.badgeNumber
                    }
                  />

                  <InfoRow
                    label="Callsign"
                    value={
                      badgeData.officer.callsign
                    }
                  />

                  <InfoRow
                    label="Status"
                    value={
                      badgeData.officer.status
                    }
                  />

                  <InfoRow
                    label="Time in Department"
                    value={
                      badgeData.officer
                        .timeInDept ??
                      ""
                    }
                  />

                  <InfoRow
                    label="Time in Rank"
                    value={
                      badgeData.officer
                        .timeInRank ??
                      ""
                    }
                  />

                  <InfoRow
                    label="Discord ID"
                    value={
                      badgeData.officer.discordId
                    }
                  />
                </div>
              </ConfigCard>

              {/* BADGE CONFIGURATION */}

              <ConfigCard
                title="Badge Configuration"
                icon={
                  <Shield className="h-4 w-4" />
                }
              >
                <div className="divide-y divide-border/60">
                  <InfoRow
                    label="Badge Model"
                    value={
                      badgeData.badge.badgeId
                    }
                  />

                  <InfoRow
                    label="Seal"
                    value={
                      badgeData.badge.sealId
                    }
                  />

                  <InfoRow
                    label="Finish"
                    value={
                      badgeData.badge.finish
                    }
                  />
                </div>
              </ConfigCard>

              {/* BADGE LINES */}

              <ConfigCard
                title="Badge Lines"
                icon={
                  <BadgeCheck className="h-4 w-4" />
                }
              >
                <div className="space-y-2">
                  <BadgeLine
                    number={1}
                    value={
                      badgeData.badge.lines["1"]
                    }
                  />

                  <BadgeLine
                    number={2}
                    value={
                      badgeData.badge.lines["2"]
                    }
                  />

                  <BadgeLine
                    number={3}
                    value={
                      badgeData.badge.lines["3"]
                    }
                  />

                  <BadgeLine
                    number={4}
                    value={
                      badgeData.badge.lines["4"]
                    }
                  />

                  <BadgeLine
                    number={5}
                    value={
                      badgeData.badge.lines["5"]
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={
                    handleCopy
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />

                  Copy Badge Lines
                </Button>
              </ConfigCard>
            </div>

            {/* ───────────────────────────────
                RIGHT — PREVIEW
            ─────────────────────────────── */}

            <div className="xl:sticky xl:top-6 xl:self-start">
              <ConfigCard
                title="Badge Preview"
                icon={
                  <CheckCircle2 className="h-4 w-4" />
                }
              >
                <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-border bg-muted/20 p-8">
                  <div className="w-full max-w-[290px]">
                    <div className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-b from-muted/70 to-background p-7 shadow-xl">
                      <div className="text-center">
                        {/* LINE 1 */}

                        <div className="text-[10px] font-bold tracking-[0.35em] text-muted-foreground">
                          {
                            badgeData.badge.lines[
                              "1"
                            ]
                          }
                        </div>

                        {/* SEAL */}

                        <div className="mt-5 flex justify-center">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                            <Shield className="h-10 w-10 text-muted-foreground" />
                          </div>
                        </div>

                        {/* LINE 2 */}

                        <div className="mt-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground">
                          {
                            badgeData.badge.lines[
                              "2"
                            ]
                          }
                        </div>

                        {/* LINE 3 */}

                        <div className="mt-1 text-base font-semibold uppercase tracking-[0.08em] text-foreground">
                          {
                            badgeData.badge.lines[
                              "3"
                            ]
                          }
                        </div>

                        {/* LINE 4 */}

                        <div className="mt-5 text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">
                          {
                            badgeData.badge.lines[
                              "4"
                            ]
                          }
                        </div>

                        {/* LINE 5 */}

                        <div className="mt-1 text-[8px] font-medium tracking-[0.16em] text-muted-foreground">
                          {
                            badgeData.badge.lines[
                              "5"
                            ]
                          }
                        </div>
                      </div>

                      {/* METADATA */}

                      <div className="mt-7 border-t border-border pt-4 text-center">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                          {
                            badgeData.badge.badgeId
                          }
                        </div>

                        <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                          {
                            badgeData.badge.finish ||
                            "Configured Finish"
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CURRENT USER */}

                {user && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />

                      <span className="text-xs text-muted-foreground">
                        Authenticated as
                      </span>

                      <span className="min-w-0 truncate text-xs font-medium text-foreground">
                        {user.discordId}
                      </span>
                    </div>
                  </div>
                )}
              </ConfigCard>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
