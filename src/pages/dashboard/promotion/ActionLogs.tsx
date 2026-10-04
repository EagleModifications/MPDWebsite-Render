import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  FileEdit,
  FileText,
  Settings2,
  Shield,
  Upload,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"

type Module = "" | "promotion" | "activity"
type Category =
  | ""
  | "roster"
  | "import"
  | "requirements"
  | "navigation"
  | "management"
type Division =
  | ""
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
  rank: string
  callsign: string
  badgeNumber: string
  avatar?: string | null
  action: string
  module: Exclude<Module, "">
  category: Exclude<Category, "">
  division?: Exclude<Division, ""> | null
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
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const moduleOptions = [
  { value: "", label: "All modules" },
  { value: "promotion", label: "Promotion" },
  { value: "activity", label: "Activity" },
] as const

const actionOptions = [
  "import-promotion",
  "import-activity",
  "save-requirements",
  "reset-requirements",
  "change-division",
  "select-member",
  "deselect-member",
  "select-all-visible",
  "copy-roster",
  "copy-discord-id",
  "search-roster",
  "filter-status",
  "filter-rank",
  "clear-filters",
  "refresh-roster",
] as const

const divisionLabels: Record<string, string> = {
  department: "Department",
  swat: "SWAT",
  mtf7: "MTF-7",
  mcd: "MCD",
  tru: "TRU",
  teu: "TEU",
  sar: "SAR",
}

const actionLabel = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const divisionLabel = (value?: string | null) =>
  value ? divisionLabels[value] ?? actionLabel(value) : "Department"

const formatDetailValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"

const getDefaultAvatar = (discordId: string) => {
  try {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordId) % 6n)}.png?size=64`
  } catch {
    return undefined
  }
}

const getAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!avatar) return getDefaultAvatar(discordId)
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar
  if (avatar.startsWith("a_")) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.gif?size=64`
  }
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
}

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "unknown"

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  return `${Math.floor(months / 12)}y ago`
}

const dateHeading = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "UNKNOWN DATE"

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(date)
    .toUpperCase()
}

const getStatusLabel = (log: ActionLog) => {
  const action = log.action.toLowerCase()
  if (action.includes("import")) return "Imported"
  if (action.includes("promot")) return "Promoted"
  if (action.includes("demot")) return "Demoted"
  if (action.includes("delete") || action.includes("remove")) return "Deleted"
  if (action.includes("reset")) return "Reset"
  return "Updated"
}

const getStatusClass = (label: string) => {
  if (label === "Deleted" || label === "Demoted") {
    return "border-red-500/30 bg-red-500/10 text-red-400"
  }
  if (label === "Imported") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
  }
  if (label === "Promoted") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-400"
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-400"
}

function LogIcon({ log }: { log: ActionLog }) {
  const Icon =
    log.category === "import"
      ? Upload
      : log.category === "requirements"
        ? Settings2
        : log.category === "roster"
          ? Users
          : log.category === "management"
            ? Shield
            : log.module === "activity"
              ? Activity
              : FileEdit

  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10">
      <Icon className="h-3.5 w-3.5 text-blue-400" />
    </div>
  )
}

function Actor({ log }: { log: ActionLog }) {
  const displayName = log.userName || log.username || "Unknown User"
  const avatar = getAvatarUrl(log.userId, log.avatar)

  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-1.5 text-left"
      onClick={(event) => {
        event.stopPropagation()
        if (!log.userId) return
        void navigator.clipboard
          .writeText(log.userId)
          .then(() => toast.success("Discord ID copied", { description: log.userId }))
          .catch(() => toast.error("Copy failed"))
      }}
      title="Click to copy Discord ID"
    >
      <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[8px] font-semibold">
            {getInitials(displayName)}
          </span>
        )}
      </span>
      <span className="truncate text-xs font-medium text-blue-400 hover:text-blue-300">
        {displayName}
      </span>
    </button>
  )
}

function SelectField({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string
  onChange: (value: string) => void
  children: import("react").ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-border bg-card px-3 pr-9 text-xs text-foreground outline-none transition-colors hover:bg-muted/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export default function ActionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [module, setModule] = useState<Module>("")
  const [actor, setActor] = useState("")
  const [action, setAction] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page), limit: "100" })
      if (module) params.set("module", module)
      if (actor) params.set("actor", actor)
      if (action) params.set("action", action)

      const response = await fetch(`/api/action-logs?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })

      const raw = await response.text()
      let data: ApiResponse = {}
      try {
        data = raw ? (JSON.parse(raw) as ApiResponse) : {}
      } catch {
        throw new Error("The action logs API returned an invalid response.")
      }

      if (!response.ok || data.success !== true) {
        throw new Error(data.error || `Failed to load action logs (${response.status}).`)
      }

      const nextLogs = Array.isArray(data.logs) ? data.logs : []
      setLogs(nextLogs)
      setTotal(data.pagination?.total ?? nextLogs.length)
      setPages(data.pagination?.pages ?? 1)
    } catch (err) {
      setLogs([])
      setTotal(0)
      setPages(1)
      setError(err instanceof Error ? err.message : "Failed to load action logs.")
    } finally {
      setLoading(false)
    }
  }, [action, actor, module, page])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (!expanded) return
    if (!logs.some((log) => log.id === expanded)) setExpanded(null)
  }, [expanded, logs])

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, ActionLog[]>()

    for (const log of logs) {
      const heading = dateHeading(log.createdAt)
      const existing = groups.get(heading)
      if (existing) existing.push(log)
      else groups.set(heading, [log])
    }

    return Array.from(groups.entries())
  }, [logs])

  const clearFilters = () => {
    setActor("")
    setAction("")
    setModule("")
    setPage(1)
    setExpanded(null)
  }

  const filterChanged = Boolean(module || actor || action)

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[940px] px-3 py-5 sm:px-5 lg:px-0">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {moduleOptions.map((item) => (
              <button
                key={item.value || "all"}
                type="button"
                onClick={() => {
                  setModule(item.value as Module)
                  setPage(1)
                  setExpanded(null)
                }}
                className={
                  module === item.value
                    ? "rounded-md border border-purple-500/50 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300"
                    : "rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SelectField
              value={actor}
              onChange={(value) => {
                setActor(value)
                setPage(1)
                setExpanded(null)
              }}
              className="w-full sm:w-[208px]"
            >
              <option value="">Anyone</option>
              {Array.from(new Set(logs.map((log) => log.userName || log.username).filter(Boolean)))
                .sort((a, b) => a.localeCompare(b))
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </SelectField>

            <SelectField
              value={action}
              onChange={(value) => {
                setAction(value)
                setPage(1)
                setExpanded(null)
              }}
              className="w-full sm:w-[160px]"
            >
              <option value="">All actions</option>
              {Array.from(new Set([...actionOptions, ...logs.map((log) => log.action)]))
                .sort()
                .map((item) => (
                  <option key={item} value={item}>
                    {actionLabel(item)}
                  </option>
                ))}
            </SelectField>

            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>{total.toLocaleString()} changes</span>
              {filterChanged && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-[68px] animate-pulse rounded-xl border border-border bg-card/60" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-border bg-card/60 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">No action logs found</p>
              <p className="text-xs text-muted-foreground">Try another module or action.</p>
            </div>
          ) : (
            <div className="space-y-7">
              {groupedLogs.map(([heading, group]) => (
                <section key={heading}>
                  <h2 className="mb-2.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80">
                    {heading}
                  </h2>

                  <div className="space-y-1.5">
                    {group.map((log) => {
                      const isExpanded = expanded === log.id
                      const status = getStatusLabel(log)
                      const detailEntries = Object.entries(log.details ?? {})

                      return (
                        <div
                          key={log.id}
                          className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80"
                        >
                          <button
                            type="button"
                            className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
                            onClick={() => setExpanded((current) => (current === log.id ? null : log.id))}
                          >
                            <LogIcon log={log} />

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-start gap-2">
                                <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-foreground sm:text-sm">
                                  {log.summary}
                                </p>

                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium ${getStatusClass(status)}`}
                                >
                                  {status}
                                </span>

                                {isExpanded ? (
                                  <ChevronUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                              </div>

                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                                <Actor log={log} />
                                <span>·</span>
                                <span>{relativeTime(log.createdAt)}</span>
                                <span className="rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                  {log.module === "promotion" ? "Promotion" : "Activity"}
                                </span>
                                {log.division && (
                                  <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-1.5 py-0.5 text-[9px] text-blue-400">
                                    {divisionLabel(log.division)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-border bg-muted/[0.03] px-4 py-4 sm:px-14">
                              <div className="grid divide-y divide-border rounded-none border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                {log.targetName && (
                                  <div className="py-3 sm:pr-5">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                      Target
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-foreground">
                                      {log.targetName}
                                    </p>
                                    {log.targetRank && (
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {log.targetRank}
                                      </p>
                                    )}
                                    {log.targetUserId && (
                                      <button
                                        type="button"
                                        className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-blue-400 hover:text-blue-300"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          void navigator.clipboard
                                            .writeText(log.targetUserId ?? "")
                                            .then(() => toast.success("Target Discord ID copied"))
                                            .catch(() => toast.error("Copy failed"))
                                        }}
                                      >
                                        <Clipboard className="h-3 w-3" />
                                        {log.targetUserId}
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className={`py-3 ${log.targetName ? "sm:pl-5" : "sm:col-span-2"}`}>
                                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Changed By
                                  </p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <Actor log={log} />
                                  </div>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {log.rank || "No rank"} {log.callsign ? `· ${log.callsign}` : ""} {log.badgeNumber ? `· #${log.badgeNumber}` : ""}
                                  </p>
                                  {log.userId && (
                                    <button
                                      type="button"
                                      className="mt-0.5 font-mono text-[10px] text-blue-400 hover:text-blue-300"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void navigator.clipboard
                                          .writeText(log.userId)
                                          .then(() => toast.success("Discord ID copied"))
                                          .catch(() => toast.error("Copy failed"))
                                      }}
                                    >
                                      {log.userId}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 border-b border-border pb-3">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                  {log.category === "requirements" ? "Requirements" : "Details"}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-foreground/90">
                                  {log.summary}
                                </p>
                              </div>

                              {detailEntries.length > 0 && (
                                <div className="divide-y divide-border">
                                  {detailEntries.map(([key, value]) => (
                                    <div key={key} className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr] sm:items-start">
                                      <span className="text-[11px] text-muted-foreground">
                                        {actionLabel(key)}
                                      </span>
                                      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-xs text-foreground/90">
                                        {formatDetailValue(value)}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                                <span>
                                  {log.module === "promotion" ? "Promotion" : "Activity"}
                                </span>
                                <span>·</span>
                                <span>{actionLabel(log.action)}</span>
                                <span>·</span>
                                <span>{divisionLabel(log.division)}</span>
                                {log.path && (
                                  <span className="truncate" title={log.path}>
                                    · {log.path}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {!loading && logs.length > 0 && pages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">
              Page {page} of {pages}
            </span>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1))
                  setExpanded(null)
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={page >= pages}
                onClick={() => {
                  setPage((current) => Math.min(pages, current + 1))
                  setExpanded(null)
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
