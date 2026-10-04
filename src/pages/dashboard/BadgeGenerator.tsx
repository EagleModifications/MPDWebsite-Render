import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  RefreshCw,
  Search,
  Shield,
  UserRound,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useState,
} from "react"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getSession,
  type User,
} from "@/lib/auth"
import { toast } from "sonner"

type BadgeLines = {
  "1": string
  "2": string
  "3": string
  "4": string
  "5": string
}

type BadgeResponse = {
  success: boolean
  error?: string

  badge?: {
    badgeId: string
    sealId: string
    finish: string
    lines: BadgeLines
  }

  officer?: {
    name: string
    rank: string
    badgeNumber: string
    discordId: string
    callsign: string
    status: string
  }
}

export default function BadgeGenerator() {
  const [sessionUser, setSessionUser] =
    useState<User | null>(null)

  const [discordId, setDiscordId] =
    useState("")

  const [badge, setBadge] =
    useState<BadgeResponse | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [searching, setSearching] =
    useState(false)

  const [error, setError] =
    useState("")

  const loadBadge = useCallback(
    async (
      targetDiscordId: string,
      options?: {
        searching?: boolean
      },
    ) => {
      const cleanDiscordId =
        targetDiscordId.trim()

      if (
        !/^\d{17,20}$/.test(
          cleanDiscordId,
        )
      ) {
        setError(
          "Enter a valid Discord ID.",
        )
        return
      }

      if (options?.searching) {
        setSearching(true)
      } else {
        setRefreshing(true)
      }

      setError("")

      try {
        const response =
          await fetch(
            `/api/badges/${encodeURIComponent(
              cleanDiscordId,
            )}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            },
          )

        const data =
          (await response.json()) as BadgeResponse

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Failed to load badge.",
          )
        }

        setBadge(data)
        setDiscordId(cleanDiscordId)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load badge."

        setBadge(null)
        setError(message)

        toast.error(
          "Unable to load badge",
          {
            description: message,
          },
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
        setSearching(false)
      }
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    const loadSession =
      async () => {
        try {
          const session =
            await getSession()

          if (!mounted) {
            return
          }

          const user =
            session?.user ?? null

          setSessionUser(user)

          const userDiscordId =
            String(
              user?.discordId ?? "",
            ).trim()

          if (
            /^\d{17,20}$/.test(
              userDiscordId,
            )
          ) {
            setDiscordId(
              userDiscordId,
            )

            await loadBadge(
              userDiscordId,
            )
          } else {
            setLoading(false)
            setError(
              "Your account does not have a valid Discord ID.",
            )
          }
        } catch (err) {
          if (!mounted) {
            return
          }

          setLoading(false)

          const message =
            err instanceof Error
              ? err.message
              : "Failed to load your session."

          setError(message)

          toast.error(
            "Unable to load session",
            {
              description: message,
            },
          )
        }
      }

    void loadSession()

    return () => {
      mounted = false
    }
  }, [loadBadge])

  const handleRefresh =
    async () => {
      const userDiscordId =
        String(
          sessionUser?.discordId ?? "",
        ).trim()

      if (
        !/^\d{17,20}$/.test(
          userDiscordId,
        )
      ) {
        toast.error(
          "Your Discord ID could not be found.",
        )
        return
      }

      await loadBadge(
        userDiscordId,
      )
    }

  const handleSearch =
    async (
      event: React.FormEvent,
    ) => {
      event.preventDefault()

      await loadBadge(
        discordId,
        {
          searching: true,
        },
      )
    }

  const copyBadgeLines =
    async () => {
      if (!badge?.badge) {
        return
      }

      const lines = [
        badge.badge.lines["1"],
        badge.badge.lines["2"],
        badge.badge.lines["3"],
        badge.badge.lines["4"],
        badge.badge.lines["5"],
      ].join("\n")

      try {
        await navigator.clipboard.writeText(
          lines,
        )

        toast.success(
          "Badge lines copied",
        )
      } catch {
        toast.error(
          "Could not copy badge lines.",
        )
      }
    }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
              Badge Generator
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Metro Police Department Badge
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Generate the configured Smith & Warren
              badge information directly from the
              department database.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={
              loading ||
              refreshing
            }
          >
            <RefreshCw
              className={[
                "mr-2 h-4 w-4",
                refreshing
                  ? "animate-spin"
                  : "",
              ].join(" ")}
            />
            Refresh My Badge
          </Button>
        </div>

        <form
          onSubmit={handleSearch}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={discordId}
                onChange={(event) =>
                  setDiscordId(
                    event.target.value,
                  )
                }
                placeholder="Discord ID"
                className="pl-9"
                inputMode="numeric"
              />
            </div>

            <Button
              type="submit"
              disabled={
                searching ||
                !discordId.trim()
              }
            >
              {searching ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}

              Look Up Badge
            </Button>
          </div>
        </form>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />

            <p className="mt-3 text-sm text-muted-foreground">
              Loading badge information...
            </p>
          </div>
        ) : badge?.badge &&
          badge.officer ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50">
                  <UserRound className="h-5 w-5 text-muted-foreground" />
                </div>

                <div>
                  <h2 className="font-semibold">
                    Officer Information
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Loaded from MongoDB
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-border rounded-lg border border-border">
                <InfoRow
                  label="Name"
                  value={
                    badge.officer.name
                  }
                />

                <InfoRow
                  label="Rank"
                  value={
                    badge.officer.rank
                  }
                />

                <InfoRow
                  label="Badge Number"
                  value={
                    badge.officer.badgeNumber ||
                    "Not assigned"
                  }
                />

                <InfoRow
                  label="Callsign"
                  value={
                    badge.officer.callsign ||
                    "Not assigned"
                  }
                />

                <InfoRow
                  label="Discord ID"
                  value={
                    badge.officer.discordId
                  }
                />

                <InfoRow
                  label="Status"
                  value={
                    badge.officer.status ||
                    "Not specified"
                  }
                />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div>
                    <h2 className="font-semibold">
                      Badge Configuration
                    </h2>

                    <p className="text-xs text-muted-foreground">
                      Generated from database + badge config
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={
                    copyBadgeLines
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Lines
                </Button>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-muted/20 p-5">
                <div className="mx-auto flex max-w-sm flex-col items-center rounded-[2rem] border-4 border-border bg-card px-8 py-10 text-center shadow-sm">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-muted">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <BadgeLine>
                      {badge.badge.lines["1"]}
                    </BadgeLine>

                    <BadgeLine>
                      {badge.badge.lines["2"]}
                    </BadgeLine>

                    <BadgeLine>
                      {badge.badge.lines["3"]}
                    </BadgeLine>

                    <BadgeLine>
                      {badge.badge.lines["4"]}
                    </BadgeLine>

                    <BadgeLine>
                      {badge.badge.lines["5"]}
                    </BadgeLine>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <ConfigCard
                  label="Badge Model"
                  value={
                    badge.badge.badgeId
                  }
                />

                <ConfigCard
                  label="Seal"
                  value={
                    badge.badge.sealId
                  }
                />

                <ConfigCard
                  label="Finish"
                  value={
                    badge.badge.finish
                  }
                />
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />

                Name and rank are loaded from
                MongoDB. Finish is loaded from
                <code className="rounded bg-background px-1.5 py-0.5">
                  config/badges.json
                </code>
                .
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <BadgeCheck className="mx-auto h-8 w-8 text-muted-foreground" />

            <h2 className="mt-3 font-semibold">
              No badge found
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              No department roster record was found
              for this Discord ID.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

/* ─────────────────────────────────────────────
   Components
───────────────────────────────────────────── */

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>

      <span className="text-right text-sm font-medium">
        {value}
      </span>
    </div>
  )
}

function ConfigCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold">
        {value}
      </p>
    </div>
  )
}

function BadgeLine({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="text-sm font-semibold uppercase tracking-[0.08em]">
      {children}
    </div>
  )
}
