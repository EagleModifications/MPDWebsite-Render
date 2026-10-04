import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  RefreshCw,
  Search,
  Shield,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getSession,
  type User,
} from "@/lib/auth"

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
  error?: string
  message?: string
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">
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
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
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

export default function BadgeGenerator() {
  const [user, setUser] = useState<User | null>(null)
  const [discordId, setDiscordId] = useState("")
  const [badgeData, setBadgeData] =
    useState<BadgeResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  const loadBadge = useCallback(
    async (targetDiscordId: string) => {
      const trimmedDiscordId =
        targetDiscordId.trim()

      if (!trimmedDiscordId) {
        setBadgeData(null)
        return
      }

      setSearching(true)

      try {
        const response = await fetch(
          `/api/badges/${encodeURIComponent(
            trimmedDiscordId,
          )}`,
          {
            credentials: "include",
          },
        )

        const data =
          (await response.json()) as
            | BadgeResponse
            | ApiError

        if (!response.ok) {
          throw new Error(
            ("error" in data && data.error) ||
              ("message" in data && data.message) ||
              "Failed to load badge data.",
          )
        }

        setBadgeData(data as BadgeResponse)
      } catch (error) {
        console.error(
          "[BadgeGenerator] Failed to load badge:",
          error,
        )

        setBadgeData(null)

        toast.error("Unable to load badge", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        })
      } finally {
        setSearching(false)
      }
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        /*
         * getSession() returns User | null directly.
         *
         * Do NOT use session.user here.
         */
        const session = await getSession()

        if (!mounted) {
          return
        }

        setUser(session ?? null)

        if (session?.discordId) {
          setDiscordId(session.discordId)

          await loadBadge(session.discordId)
        }
      } catch (error) {
        if (!mounted) {
          return
        }

        console.error(
          "[BadgeGenerator] Failed to load session:",
          error,
        )

        setUser(null)
        setBadgeData(null)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      mounted = false
    }
  }, [loadBadge])

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    await loadBadge(discordId)
  }

  const handleRefresh = async () => {
    if (!discordId.trim()) {
      return
    }

    await loadBadge(discordId)
  }

  const handleCopy = async () => {
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
      await navigator.clipboard.writeText(text)

      toast.success("Badge lines copied", {
        description:
          "The five badge lines have been copied to your clipboard.",
      })
    } catch (error) {
      console.error(
        "[BadgeGenerator] Clipboard failed:",
        error,
      )

      toast.error("Copy failed", {
        description:
          "Your browser could not access the clipboard.",
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading badge generator...
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ============================================================
            HEADER
        ============================================================ */}

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
              Generate the badge configuration for an officer using
              their current roster information.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={searching || !discordId.trim()}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                searching ? "animate-spin" : ""
              }`}
            />

            Refresh
          </Button>
        </div>

        {/* ============================================================
            SEARCH
        ============================================================ */}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Find Officer
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Enter a Discord ID to load the officer's current
              name and rank from the database.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={discordId}
                onChange={(event) =>
                  setDiscordId(event.target.value)
                }
                placeholder="Discord ID"
                className="pl-9"
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

              Generate
            </Button>
          </div>
        </form>

        {!badgeData ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
            <div className="max-w-sm px-6 text-center">
              <BadgeCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />

              <h2 className="mt-4 text-sm font-semibold text-foreground">
                No badge loaded
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Enter an officer's Discord ID above to load their
                badge information.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            {/* ========================================================
                OFFICER
            ======================================================== */}

            <div className="space-y-6">
              <ConfigCard
                title="Officer Information"
                icon={<UserRound className="h-4 w-4" />}
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
                    label="Discord ID"
                    value={
                      badgeData.officer.discordId
                    }
                  />
                </div>
              </ConfigCard>

              {/* ======================================================
                  BADGE CONFIGURATION
              ====================================================== */}

              <ConfigCard
                title="Badge Configuration"
                icon={<Shield className="h-4 w-4" />}
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

              {/* ======================================================
                  BADGE LINES
              ====================================================== */}

              <ConfigCard
                title="Badge Lines"
                icon={<BadgeCheck className="h-4 w-4" />}
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
                  onClick={handleCopy}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Badge Lines
                </Button>
              </ConfigCard>
            </div>

            {/* ========================================================
                PREVIEW
            ======================================================== */}

            <div className="xl:sticky xl:top-6 xl:self-start">
              <ConfigCard
                title="Badge Preview"
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-border bg-muted/20 p-8">
                  <div className="w-full max-w-[290px]">
                    <div className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-b from-muted/70 to-background p-7 shadow-xl">
                      {/* Badge top */}
                      <div className="text-center">
                        <div className="text-[10px] font-bold tracking-[0.35em] text-muted-foreground">
                          {badgeData.badge.lines["1"]}
                        </div>

                        <div className="mt-5 flex justify-center">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                            <Shield className="h-10 w-10 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="mt-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground">
                          {badgeData.badge.lines["2"]}
                        </div>

                        <div className="mt-1 text-base font-semibold uppercase tracking-[0.08em] text-foreground">
                          {badgeData.badge.lines["3"]}
                        </div>

                        <div className="mt-5 text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">
                          {badgeData.badge.lines["4"]}
                        </div>

                        <div className="mt-1 text-[8px] font-medium tracking-[0.16em] text-muted-foreground">
                          {badgeData.badge.lines["5"]}
                        </div>
                      </div>

                      {/* Badge metadata */}
                      <div className="mt-7 border-t border-border pt-4 text-center">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                          {badgeData.badge.badgeId}
                        </div>

                        <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                          {badgeData.badge.finish}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current logged-in user */}
                {user && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                      <span className="text-xs text-muted-foreground">
                        Loaded for
                      </span>

                      <span className="truncate text-xs font-medium text-foreground">
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
