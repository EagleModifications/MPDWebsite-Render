import {
  ChevronDown,
  ChevronUp,
  Clipboard,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Category =
  | "roster"
  | "import"
  | "requirements"
  | "navigation"
  | ""

type Division =
  | "department"
  | "swat"
  | "mtf7"
  | "mcd"
  | "tru"
  | "teu"
  | "sar"
  | ""

type ActionLog = {
  id: string
  createdAt: string
  userId: string
  userName: string
  username: string
  rank: string
  callsign: string
  badgeNumber: string
  action: string
  category: Exclude<Category, "">
  division: Exclude<Division, ""> | null
  targetUserId: string | null
  targetName: string | null
  targetRank: string | null
  summary: string
  details: Record<string, unknown> | null
  path: string | null
}

type ApiResponse = {
  success?: boolean
  error?: string
  logs?: ActionLog[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

type ContextMenu = {
  x: number
  y: number
  discordId: string
  label: string
} | null

const categoryOptions: Array<{
  value: Category
  label: string
}> = [
  { value: "", label: "All Categories" },
  { value: "roster", label: "Roster" },
  { value: "import", label: "Imports" },
  { value: "requirements", label: "Requirements" },
  { value: "navigation", label: "Navigation" },
]

const divisionOptions: Array<{
  value: Division
  label: string
}> = [
  { value: "", label: "All Divisions" },
  { value: "department", label: "Department" },
  { value: "swat", label: "SWAT" },
  { value: "mtf7", label: "MTF-7" },
  { value: "mcd", label: "MCD" },
  { value: "tru", label: "TRU" },
  { value: "teu", label: "TEU" },
  { value: "sar", label: "SAR" },
]

const divisionLabel = (division: string | null) =>
  divisionOptions.find(
    (item) => item.value === division,
  )?.label ?? division ?? "—"

const categoryLabel = (category: string) =>
  categoryOptions.find(
    (item) => item.value === category,
  )?.label ?? category

const actionLabel = (action: string) =>
  action
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDateTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date)
}

const formatDetailValue = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return "—"

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function UserIdentity({
  name,
  username,
  rank,
  discordId,
  onContextMenu,
}: {
  name: string
  username: string
  rank: string
  discordId: string
  onContextMenu: (
    event: React.MouseEvent,
  ) => void
}) {
  const displayName =
    name || username || "Unknown User"

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <UserRound className="h-4 w-4 shrink-0 text-blue-400" />

        <button
          type="button"
          onContextMenu={onContextMenu}
          className="min-w-0 truncate text-left text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
          title={`${displayName} (${discordId})`}
        >
          <span className="truncate">
            {displayName}
          </span>
          <span className="ml-1 font-mono text-xs text-blue-400/80">
            ({discordId})
          </span>
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {username && <span>@{username}</span>}
        {rank && <span>{rank}</span>}
        {discordId && (
          <button
            type="button"
            className="font-mono text-blue-400/70 hover:text-blue-300"
            onContextMenu={onContextMenu}
          >
            {discordId}
          </button>
        )}
      </div>
    </div>
  )
}

export default function ActionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<Category>("")
  const [division, setDivision] = useState<Division>("")
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [contextMenu, setContextMenu] =
    useState<ContextMenu>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  })

  const [availableActions, setAvailableActions] =
    useState<string[]>([])

  const hasFilters = Boolean(
    search.trim() ||
      category ||
      division ||
      action ||
      from ||
      to,
  )

  const copyDiscordId = useCallback(
    async (discordId: string) => {
      try {
        await navigator.clipboard.writeText(discordId)
        toast.success("Discord ID copied", {
          description: discordId,
        })
      } catch {
        toast.error("Copy failed", {
          description:
            "Your browser could not access the clipboard.",
        })
      }

      setContextMenu(null)
    },
  )

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "50")

      if (search.trim()) params.set("search", search.trim())
      if (category) params.set("category", category)
      if (division) params.set("division", division)
      if (action) params.set("action", action)
      if (from) params.set("from", `${from}T00:00:00.000Z`)
      if (to) params.set("to", `${to}T23:59:59.999Z`)

      const response = await fetch(
        `/api/promotion/action-logs?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      )

      const text = await response.text()
      let data: ApiResponse = {}

      if (text.trim()) {
        try {
          data = JSON.parse(text) as ApiResponse
        } catch {
          throw new Error(
            "The action logs API returned an invalid response.",
          )
        }
      }

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error ||
            `Failed to load action logs (${response.status}).`,
        )
      }

      const nextLogs = Array.isArray(data.logs)
        ? data.logs
        : []

      setLogs(nextLogs)
      setPagination(
        data.pagination ?? {
          page,
          limit: 50,
          total: nextLogs.length,
          pages: 1,
        },
      )

      setAvailableActions((current) => {
        const merged = new Set(current)
        nextLogs.forEach((item) => merged.add(item.action))
        return Array.from(merged).sort()
      })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load promotion action logs."

      setLogs([])
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    search,
    category,
    division,
    action,
    from,
    to,
  ])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    const close = () => setContextMenu(null)

    window.addEventListener("click", close)
    window.addEventListener("scroll", close, true)

    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [])

  const actionOptions = useMemo(
    () =>
      availableActions.length > 0
        ? availableActions
        : [
            "view-roster",
            "change-division",
            "search-roster",
            "filter-roster",
            "copy-roster",
            "copy-discord-id",
            "import-promotion",
            "save-requirements",
            "reset-requirements",
          ],
    [availableActions],
  )

  const clearFilters = () => {
    setSearch("")
    setCategory("")
    setDivision("")
    setAction("")
    setFrom("")
    setTo("")
    setPage(1)
  }

  const openContextMenu = (
    event: React.MouseEvent,
    log: ActionLog,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    if (!log.userId) return

    const menuWidth = 190
    const menuHeight = 50
    const x = Math.min(
      event.clientX,
      window.innerWidth - menuWidth - 8,
    )
    const y = Math.min(
      event.clientY,
      window.innerHeight - menuHeight - 8,
    )

    setContextMenu({
      x: Math.max(8, x),
      y: Math.max(8, y),
      discordId: log.userId,
      label:
        log.userName ||
        log.username ||
        log.userId,
    })
  }

  return (
    <DashboardLayout>
      <div className="flex min-w-0 flex-col gap-6 p-3 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Promotion Action Logs
              </h1>
              <p className="text-sm text-muted-foreground">
                Search and review actions performed across Promotion Management.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="gap-2 self-start lg:self-auto"
            onClick={() => void loadLogs()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">
              Search & Filters
            </span>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1fr)_150px_150px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search user, action, target, ID, details..."
                className="pl-9"
              />
            </div>

            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as Category)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {categoryOptions.map((option) => (
                <option
                  key={option.value || "all"}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={division}
              onChange={(event) => {
                setDivision(event.target.value as Division)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {divisionOptions.map((option) => (
                <option
                  key={option.value || "all"}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Actions</option>
              {actionOptions.map((item) => (
                <option key={item} value={item}>
                  {actionLabel(item)}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
              title="From date"
            />

            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
              title="To date"
            />

            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={clearFilters}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : (
              <div />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {pagination.total.toLocaleString()} total logs
            </span>
            {hasFilters && (
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-blue-400">
                Filters active
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="hidden border-b bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[1.4fr_1.1fr_1fr_0.8fr_2fr_0.9fr] lg:gap-4">
            <span>User</span>
            <span>Action</span>
            <span>Category</span>
            <span>Division</span>
            <span>Details</span>
            <span>Time</span>
          </div>

          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse bg-muted/10"
                />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium">No action logs found</p>
              <p className="text-sm text-muted-foreground">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const isExpanded = expanded === log.id

                return (
                  <div key={log.id} className="group">
                    <button
                      type="button"
                      className="w-full text-left transition-colors hover:bg-muted/20"
                      onClick={() =>
                        setExpanded((current) =>
                          current === log.id ? null : log.id,
                        )
                      }
                    >
                      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.4fr_1.1fr_1fr_0.8fr_2fr_0.9fr] lg:items-center">
                        <UserIdentity
                          name={log.userName}
                          username={log.username}
                          rank={log.rank}
                          discordId={log.userId}
                          onContextMenu={(event) =>
                            openContextMenu(event, log)
                          }
                        />

                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">
                            {actionLabel(log.action)}
                          </span>
                        </div>

                        <span className="w-fit rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
                          {categoryLabel(log.category)}
                        </span>

                        <span className="text-sm text-muted-foreground">
                          {divisionLabel(log.division)}
                        </span>

                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm">
                            {log.summary}
                          </p>

                          {log.targetName && (
                            <p className="mt-1 truncate text-xs text-blue-400">
                              Target: {log.targetName}
                              {log.targetRank
                                ? ` — ${log.targetRank}`
                                : ""}
                            </p>
                          )}
                        </div>

                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/10 px-4 py-4">
                        <div className="grid gap-4 xl:grid-cols-3">
                          <div className="rounded-lg border bg-background p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <UserRound className="h-3.5 w-3.5" />
                              Actor
                            </div>
                            <div className="space-y-1 text-sm">
                              <p>
                                <span className="text-muted-foreground">Name:</span>{" "}
                                {log.userName || "Unknown"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Username:</span>{" "}
                                {log.username ? `@${log.username}` : "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Rank:</span>{" "}
                                {log.rank || "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Callsign:</span>{" "}
                                {log.callsign || "—"}
                              </p>
                              <button
                                type="button"
                                className="font-mono text-blue-400 hover:text-blue-300"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void copyDiscordId(log.userId)
                                }}
                              >
                                {log.userId}
                              </button>
                            </div>
                          </div>

                          <div className="rounded-lg border bg-background p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Shield className="h-3.5 w-3.5" />
                              Action
                            </div>
                            <div className="space-y-1 text-sm">
                              <p>
                                <span className="text-muted-foreground">Action:</span>{" "}
                                {actionLabel(log.action)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Category:</span>{" "}
                                {categoryLabel(log.category)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Division:</span>{" "}
                                {divisionLabel(log.division)}
                              </p>
                              <p className="break-all text-xs text-muted-foreground">
                                {log.path || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border bg-background p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Clipboard className="h-3.5 w-3.5" />
                              Target
                            </div>
                            <div className="space-y-1 text-sm">
                              <p>
                                <span className="text-muted-foreground">Name:</span>{" "}
                                {log.targetName || "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Rank:</span>{" "}
                                {log.targetRank || "—"}
                              </p>
                              <p className="font-mono text-xs text-blue-400">
                                {log.targetUserId || "—"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-lg border bg-background p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Summary
                          </p>
                          <p className="text-sm">
                            {log.summary}
                          </p>
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-4 rounded-lg border bg-background p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Additional Details
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {Object.entries(log.details).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className="rounded-md border bg-muted/10 p-2"
                                  >
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {actionLabel(key)}
                                    </p>
                                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs">
                                      {formatDetailValue(value)}
                                    </pre>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div className="flex flex-col gap-3 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} logs
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                >
                  Previous
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        pagination.pages,
                        current + 1,
                      ),
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[190px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() =>
              void copyDiscordId(contextMenu.discordId)
            }
          >
            <Clipboard className="h-4 w-4" />
            Copy User ID
          </button>
        </div>
      )}
    </DashboardLayout>
  )
}
