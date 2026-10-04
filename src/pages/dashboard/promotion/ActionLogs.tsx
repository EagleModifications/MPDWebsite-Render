import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  History,
  PenLine,
  Settings2,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ModuleFilter = "all" | "promotion" | "activity"

type Division =
  | "department"
  | "swat"
  | "mtf7"
  | "mcd"
  | "tru"
  | "teu"
  | "sar"

type ActionLog = {
  id: string
  createdAt: string
  userId: string
  userName: string
  username: string
  displayName: string
  avatar?: string | null
  rank: string
  callsign: string
  badgeNumber: string
  module: "promotion" | "activity"
  action: string
  status:
    | "updated"
    | "imported"
    | "created"
    | "deleted"
    | "completed"
  division?: Division
  targetUserId?: string
  targetName?: string
  targetRank?: string
  summary: string
  details?: Record<string, unknown>
  path?: string
}

type ApiResponse = {
  success?: boolean
  error?: string
  logs?: ActionLog[]
  actors?: Array<{
    userId: string
    name: string
  }>
  actions?: string[]
  retentionDays?: number
  total?: number
}

const divisionLabels: Record<
  Division,
  string
> = {
  department: "Department",
  swat: "SWAT",
  mtf7: "MTF-7",
  mcd: "MCD",
  tru: "TRU",
  teu: "TEU",
  sar: "SAR",
}

const statusLabels: Record<
  ActionLog["status"],
  string
> = {
  updated: "Updated",
  imported: "Imported",
  created: "Created",
  deleted: "Deleted",
  completed: "Completed",
}

function actionLabel(
  value: string,
) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function formatDetailValue(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—"
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }

  try {
    return JSON.stringify(
      value,
      null,
      2,
    )
  } catch {
    return String(value)
  }
}

function relativeTime(
  value: string,
) {
  const timestamp = new Date(
    value,
  ).getTime()

  if (!Number.isFinite(timestamp)) {
    return "Unknown time"
  }

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() - timestamp) /
        1000,
    ),
  )

  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(
    seconds / 60,
  )

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(
    minutes / 60,
  )

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(
    hours / 24,
  )

  if (days < 30) {
    return `${days}d ago`
  }

  const months = Math.floor(
    days / 30,
  )

  return `${months}mo ago`
}

function formatDateTime(
  value: string,
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date)
}

function dateHeading(
  value: string,
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  )
    .format(date)
    .toUpperCase()
}

function moduleLabel(
  module: ActionLog["module"],
) {
  return module === "promotion"
    ? "Promotion"
    : "Activity"
}

function LogIcon({
  log,
}: {
  log: ActionLog
}) {
  if (
    log.status === "imported"
  ) {
    return (
      <Upload className="h-4 w-4" />
    )
  }

  if (
    log.action.includes(
      "requirements",
    )
  ) {
    return (
      <Settings2 className="h-4 w-4" />
    )
  }

  return (
    <PenLine className="h-4 w-4" />
  )
}

export default function ActionLogs() {
  const [logs, setLogs] =
    useState<ActionLog[]>([])
  const [actors, setActors] =
    useState<
      Array<{
        userId: string
        name: string
      }>
    >([])
  const [actions, setActions] =
    useState<string[]>([])
  const [module, setModule] =
    useState<ModuleFilter>("all")
  const [actor, setActor] =
    useState("")
  const [action, setAction] =
    useState("")
  const [search, setSearch] =
    useState("")
  const [expanded, setExpanded] =
    useState<string | null>(null)
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState<string | null>(null)
  const [total, setTotal] =
    useState(0)
  const [retentionDays, setRetentionDays] =
    useState(14)

  const loadLogs = useCallback(
    async () => {
      setLoading(true)
      setError(null)

      try {
        const params =
          new URLSearchParams()

        if (module !== "all") {
          params.set(
            "module",
            module,
          )
        }

        if (actor) {
          params.set("actor", actor)
        }

        if (action) {
          params.set(
            "action",
            action,
          )
        }

        if (search.trim()) {
          params.set(
            "search",
            search.trim(),
          )
        }

        const response =
          await fetch(
            `/api/action-logs?${params.toString()}`,
            {
              credentials: "include",
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            },
          )

        const data =
          (await response.json()) as ApiResponse

        if (
          !response.ok ||
          data.success !== true
        ) {
          throw new Error(
            data.error ||
              `Failed to load action logs (${response.status}).`,
          )
        }

        setLogs(
          Array.isArray(
            data.logs,
          )
            ? data.logs
            : [],
        )

        setActors(
          Array.isArray(
            data.actors,
          )
            ? data.actors
            : [],
        )

        setActions(
          Array.isArray(
            data.actions,
          )
            ? data.actions
            : [],
        )

        setTotal(
          typeof data.total ===
            "number"
            ? data.total
            : data.logs?.length ??
                0,
        )

        setRetentionDays(
          data.retentionDays ??
            14,
        )
      } catch (err) {
        setLogs([])
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load action logs.",
        )
      } finally {
        setLoading(false)
      }
    },
    [
      action,
      actor,
      module,
      search,
    ],
  )

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const groupedLogs = useMemo(
    () => {
      const groups =
        new Map<
          string,
          ActionLog[]
        >()

      for (const log of logs) {
        const heading =
          dateHeading(
            log.createdAt,
          )

        const existing =
          groups.get(heading)

        if (existing) {
          existing.push(log)
        } else {
          groups.set(
            heading,
            [log],
          )
        }
      }

      return Array.from(
        groups.entries(),
      )
    },
    [logs],
  )

  const clearFilters = () => {
    setModule("all")
    setActor("")
    setAction("")
    setSearch("")
    setExpanded(null)
  }

  const hasFilters =
    module !== "all" ||
    Boolean(actor) ||
    Boolean(action) ||
    Boolean(search.trim())

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 pb-8 pt-2 sm:px-5">
        <header className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
            <History className="h-5 w-5 text-blue-400" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Activity Log
              </h1>

              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                Last {retentionDays} days
              </span>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Every change your command
              team has made. Older
              entries aren't kept here.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ["all", "All modules"],
                [
                  "promotion",
                  "Promotion",
                ],
                ["activity", "Activity"],
              ] as const
            ).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setModule(value)
                    setExpanded(null)
                  }}
                  className={
                    module === value
                      ? "rounded-md border border-violet-500/50 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300"
                      : "rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <select
                value={actor}
                onChange={(event) => {
                  setActor(
                    event.target.value,
                  )
                  setExpanded(null)
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none"
              >
                <option value="">
                  Anyone
                </option>

                {actors.map(
                  (item) => (
                    <option
                      key={item.userId}
                      value={item.userId}
                    >
                      {item.name}
                    </option>
                  ),
                )}
              </select>

              <select
                value={action}
                onChange={(event) => {
                  setAction(
                    event.target.value,
                  )
                  setExpanded(null)
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none"
              >
                <option value="">
                  All actions
                </option>

                {actions.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {actionLabel(
                        item,
                      )}
                    </option>
                  ),
                )}
              </select>

              <Input
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value,
                  )
                  setExpanded(null)
                }}
                placeholder="Search logs..."
                className="h-9 flex-1 text-xs"
              />

              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 gap-1 px-2 text-xs"
                  onClick={
                    clearFilters
                  }
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>
                {total.toLocaleString()}{" "}
                {total === 1
                  ? "change"
                  : "changes"}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() =>
                  void loadLogs()
                }
                disabled={loading}
              >
                <Clock3
                  className={
                    loading
                      ? "h-3.5 w-3.5 animate-spin"
                      : "h-3.5 w-3.5"
                  }
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-5">
          {loading ? (
            Array.from(
              { length: 6 },
              (_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-lg border bg-muted/10"
                />
              ),
            )
          ) : logs.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border bg-card px-5 text-center">
              <History className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">
                No changes found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                New promotion and activity
                changes will appear here.
              </p>
            </div>
          ) : (
            groupedLogs.map(
              ([heading, items]) => (
                <section
                  key={heading}
                  className="flex flex-col gap-2"
                >
                  <h2 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
                    {heading}
                  </h2>

                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                    {items.map(
                      (log) => {
                        const isExpanded =
                          expanded ===
                          log.id

                        return (
                          <div
                            key={log.id}
                            className="border-b last:border-b-0"
                          >
                            <button
                              type="button"
                              className="w-full text-left transition-colors hover:bg-muted/20"
                              onClick={() =>
                                setExpanded(
                                  (
                                    current,
                                  ) =>
                                    current ===
                                    log.id
                                      ? null
                                      : log.id,
                                )
                              }
                            >
                              <div className="flex items-center gap-3 px-4 py-3.5">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-400">
                                  <LogIcon
                                    log={log}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-sm font-medium">
                                      {log.summary}
                                    </span>
                                  </div>

                                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span className="font-medium text-blue-400">
                                      {log.displayName ||
                                        log.userName ||
                                        log.username ||
                                        "Unknown User"}
                                    </span>

                                    <span>
                                      ·
                                    </span>

                                    <span>
                                      {relativeTime(
                                        log.createdAt,
                                      )}
                                    </span>

                                    <span className="rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-[10px]">
                                      {moduleLabel(
                                        log.module,
                                      )}
                                    </span>

                                    {log.division && (
                                      <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-1.5 py-0.5 text-[10px] text-blue-400">
                                        {
                                          divisionLabels[
                                            log.division
                                          ]
                                        }
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span className="hidden shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 sm:inline-flex">
                                  {
                                    statusLabels[
                                      log.status
                                    ]
                                  }
                                </span>

                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t bg-muted/5 px-4 py-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="rounded-lg border bg-background/70 p-3">
                                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      <UserRound className="h-3.5 w-3.5" />
                                      Changed By
                                    </div>

                                    <div className="grid gap-1 text-xs">
                                      <span>
                                        <b>Name:</b>{" "}
                                        {log.displayName ||
                                          log.userName ||
                                          "—"}
                                      </span>
                                      <span>
                                        <b>Rank:</b>{" "}
                                        {log.rank ||
                                          "—"}
                                      </span>
                                      <span>
                                        <b>Callsign:</b>{" "}
                                        {log.callsign ||
                                          "—"}
                                      </span>
                                      <span>
                                        <b>Discord:</b>{" "}
                                        {log.username
                                          ? `@${log.username}`
                                          : "—"}
                                      </span>
                                      <span className="font-mono text-[10px] text-blue-400">
                                        {
                                          log.userId
                                        }
                                      </span>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border bg-background/70 p-3">
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      Change
                                    </div>

                                    <div className="grid gap-1 text-xs">
                                      <span>
                                        <b>Module:</b>{" "}
                                        {moduleLabel(
                                          log.module,
                                        )}
                                      </span>
                                      <span>
                                        <b>Action:</b>{" "}
                                        {actionLabel(
                                          log.action,
                                        )}
                                      </span>
                                      <span>
                                        <b>Status:</b>{" "}
                                        {statusLabels[
                                          log.status
                                        ]}
                                      </span>
                                      <span>
                                        <b>Division:</b>{" "}
                                        {log.division
                                          ? divisionLabels[
                                              log.division
                                            ]
                                          : "—"}
                                      </span>
                                      <span>
                                        <b>Time:</b>{" "}
                                        {formatDateTime(
                                          log.createdAt,
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border bg-background/70 p-3">
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      Target
                                    </div>

                                    <div className="grid gap-1 text-xs">
                                      <span>
                                        <b>Name:</b>{" "}
                                        {log.targetName ||
                                          "—"}
                                      </span>
                                      <span>
                                        <b>Rank:</b>{" "}
                                        {log.targetRank ||
                                          "—"}
                                      </span>
                                      <span className="break-all font-mono text-[10px] text-blue-400">
                                        {log.targetUserId ||
                                          "—"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 rounded-lg border bg-background/70 p-3">
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Summary
                                  </p>
                                  <p className="text-xs leading-5">
                                    {log.summary}
                                  </p>
                                </div>

                                {log.details &&
                                  Object.keys(
                                    log.details,
                                  ).length >
                                    0 && (
                                    <div className="mt-3 rounded-lg border bg-background/70 p-3">
                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Details
                                      </p>

                                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {Object.entries(
                                          log.details,
                                        ).map(
                                          ([
                                            key,
                                            value,
                                          ]) => (
                                            <div
                                              key={key}
                                              className="min-w-0 rounded-md border bg-muted/10 px-2.5 py-2"
                                            >
                                              <p className="truncate text-[10px] font-medium text-muted-foreground">
                                                {actionLabel(
                                                  key,
                                                )}
                                              </p>
                                              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4">
                                                {formatDetailValue(
                                                  value,
                                                )}
                                              </pre>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {log.path && (
                                  <p className="mt-3 text-[10px] text-muted-foreground">
                                    Page:{" "}
                                    {log.path}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      },
                    )}
                  </div>
                </section>
              ),
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
