import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"

import {
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  FileInput,
  History,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Category = "" | "roster" | "import" | "requirements" | "navigation"
type Division = "" | "department" | "swat" | "mtf7" | "mcd" | "tru" | "teu" | "sar"

type ActionLog = {
  id: string
  createdAt: string
  userId: string
  userName: string
  username: string
  avatar?: string | null
  rank: string
  callsign: string
  badgeNumber: string
  action: string
  category: Exclude<Category, "">
  division?: Exclude<Division, ""> | null
  targetUserId?: string | null
  targetName?: string | null
  targetRank?: string | null
  summary: string
  details?: Record<string, unknown> | null
  path?: string | null
}

type RosterMember = {
  name: string
  rank: string
  callsign: string
  badgeNumber: string
  discordId: string
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

type Option = { value: string; label: string }

const categoryOptions: Option[] = [
  { value: "", label: "All categories" },
  { value: "requirements", label: "Requirements" },
  { value: "import", label: "Imports" },
  { value: "roster", label: "Roster" },
  { value: "navigation", label: "Navigation" },
]

const divisionLabels: Record<string, string> = {
  department: "Department",
  swat: "SWAT",
  mtf7: "MTF-7",
  mcd: "MCD",
  tru: "TRU",
  teu: "TEU",
  sar: "SAR",
}

const divisionOptions: Option[] = [
  { value: "", label: "All divisions" },
  ...Object.entries(divisionLabels).map(([value, label]) => ({ value, label })),
]

const moduleLabel = () => "Promotion"

const actionLabel = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const divisionLabel = (value?: string | null) =>
  value ? divisionLabels[value] ?? actionLabel(value) : "Department"

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"

const getAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!discordId) return undefined
  if (avatar?.startsWith("http://") || avatar?.startsWith("https://")) return avatar
  if (avatar) {
    const extension = avatar.startsWith("a_") ? "gif" : "png"
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${extension}?size=128`
  }
  try {
    const index = Number(BigInt(discordId) % 6n)
    return `https://cdn.discordapp.com/embed/avatars/${index}.png?size=128`
  } catch {
    return undefined
  }
}

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "Unknown time"

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp)
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

const dateHeading = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "UNKNOWN DATE"
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date).toUpperCase()
}

function tagClass(type: "division" | "category", value?: string | null) {
  const key = (value ?? "").toLowerCase()
  if (type === "division") {
    if (key === "department") return "border-blue-500/20 bg-blue-500/10 text-blue-400"
    if (key === "swat" || key === "sar") return "border-blue-500/20 bg-blue-500/5 text-blue-300"
    if (key === "mcd") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
    if (key === "tru") return "border-red-500/20 bg-red-500/10 text-red-400"
  }
  if (key === "import" || key === "roster") return "border-blue-500/20 bg-blue-500/10 text-blue-400"
  return "border-border bg-muted/30 text-muted-foreground"
}

function statusLabel(log: ActionLog) {
  const value = log.action.toLowerCase()
  if (value.includes("copy")) return "Copied"
  if (value.includes("select")) return "Selected"
  if (value.includes("import")) return "Imported"
  if (value.includes("delete") || value.includes("remove") || value.includes("deselect")) return "Removed"
  if (value.includes("create") || value.includes("add")) return "Created"
  return "Updated"
}

function statusClass(log: ActionLog) {
  const status = statusLabel(log).toLowerCase()
  if (status === "created") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
  if (status === "removed") return "border-red-500/20 bg-red-500/10 text-red-400"
  return "border-blue-500/20 bg-blue-500/10 text-blue-400"
}

function getActionIcon(action: string, category: string): ComponentType<{ className?: string }> {
  const value = `${action} ${category}`.toLowerCase()
  if (value.includes("copy")) return Copy
  if (value.includes("select") || value.includes("deselect")) return ListChecks
  if (value.includes("import")) return FileInput
  if (value.includes("delete") || value.includes("remove")) return Trash2
  if (value.includes("create") || value.includes("add")) return Plus
  if (value.includes("update") || value.includes("edit") || value.includes("requirement")) return Pencil
  if (value.includes("navigation") || value.includes("change-division")) return Settings2
  return History
}

function Tag({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${className}`}>
      {children}
    </span>
  )
}

function Avatar({
  name,
  id,
  avatar,
  className = "h-6 w-6",
}: {
  name: string
  id?: string
  avatar?: string | null
  className?: string
}) {
  const url = id ? getAvatarUrl(id, avatar) : undefined
  return (
    <span className={`${className} shrink-0 overflow-hidden rounded-full border border-border bg-muted`}>
      {url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[8px] font-semibold text-muted-foreground">
          {getInitials(name)}
        </span>
      )}
    </span>
  )
}

function CopyMenu({
  name,
  id,
  callsign,
  badgeNumber,
  rank,
  avatar,
  large = false,
}: {
  name: string
  id?: string | null
  callsign?: string
  badgeNumber?: string
  rank?: string
  avatar?: string | null
  large?: boolean
}) {
  const display = name.trim() || "Unknown User"
  const safeId = id?.trim() || ""
  const safeCallsign = callsign?.trim() || ""
  const safeBadge = badgeNumber?.trim() || ""
  const safeRank = rank?.trim() || ""

  const items = [
    ["discord", "Copy Discord ID", safeId],
    ["mention", "Copy Discord Mention", safeId ? `<@${safeId}>` : ""],
    ["name", "Copy Name", display],
    ["callsign", "Copy Callsign", safeCallsign],
    ["badge", "Copy Badge Number", safeBadge],
    ["rank", "Copy Rank", safeRank],
  ] as const

  const combined = [
    ["name-discord", "Name + Discord ID", safeId ? `${display} — ${safeId}` : ""],
    ["callsign-discord", "Callsign + Discord ID", safeCallsign && safeId ? `${safeCallsign} — ${safeId}` : ""],
    ["callsign-name", "Callsign + Name", safeCallsign ? `${safeCallsign} — ${display}` : ""],
    ["callsign-badge", "Callsign + Badge Number", safeCallsign && safeBadge ? `${safeCallsign} — ${safeBadge}` : ""],
    ["badge-name", "Badge Number + Name", safeBadge ? `${safeBadge} — ${display}` : ""],
    ["badge-discord", "Badge Number + Discord ID", safeBadge && safeId ? `${safeBadge} — ${safeId}` : ""],
  ] as const

  const copy = async (value: string, label: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, { description: value })
    } catch {
      toast.error("Copy failed")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Copy options"
          className="inline-flex max-w-full items-center gap-2 rounded-md bg-transparent py-0.5 text-left outline-none transition-colors hover:bg-transparent hover:text-blue-300 hover:underline hover:decoration-blue-400/60 hover:underline-offset-2 focus:bg-transparent focus:outline-none data-[state=open]:bg-transparent"
        >
          <Avatar name={display} id={safeId} avatar={avatar} className={large ? "h-10 w-10" : "h-6 w-6"} />
          <span className={`truncate font-medium text-blue-400 ${large ? "text-sm" : "text-xs"}`}>{display}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={4} avoidCollisions={false} className="w-[285px] max-h-80 overflow-y-auto p-1">
        {items.map(([type, label, value]) => (
          <DropdownMenuItem key={type} disabled={!value} onClick={() => void copy(value, label)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs">
            <Clipboard className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
        <div className="my-0.5 h-px bg-border" />
        {combined.map(([type, label, value]) => (
          <DropdownMenuItem key={type} disabled={!value} onClick={() => void copy(value, label)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs">
            <Clipboard className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
}) {
  const selected = options.find((option) => option.value === value) ?? options[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={`inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground outline-none transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-white focus:outline-none ${className}`}>
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? ariaLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={4} avoidCollisions={false} className="max-h-80 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1">
        {options.map((option) => (
          <DropdownMenuItem key={option.value || `all-${ariaLabel}`} onClick={() => onChange(option.value)} className={`h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs ${option.value === value ? "bg-blue-500/10 text-blue-400 focus:bg-blue-500/15 focus:text-blue-300" : ""}`}>
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.value === value ? <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-blue-400" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function displayChangeValue(value: unknown) {
  return formatValue(value)
}

function ChangeList({ changes }: { changes: unknown }) {
  if (!Array.isArray(changes) || changes.length === 0) return null
  const visible = changes.slice(0, 120) as Array<Record<string, unknown>>

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {visible.map((change, index) => {
        const rank = String(change.rank ?? change.name ?? change.discordId ?? `Change ${index + 1}`)
        return (
          <div key={`${rank}-${index}`} className="grid gap-4 border-b border-border p-3 last:border-b-0 md:grid-cols-[1.1fr_1fr_1fr]">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{String(change.field ?? change.label ?? change.key ?? (change.rank ? "Rank" : "Change"))}</p>
              <p className="mt-1 break-words text-xs font-medium text-foreground">{rank}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Old</p>
              <p className="mt-1 break-words text-xs text-muted-foreground line-through decoration-red-500/70">{displayChangeValue(change.old)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">New</p>
              <p className="mt-1 break-words text-xs font-semibold text-emerald-400">{displayChangeValue(change.new)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DetailPanel({
  log,
  actorName,
  targetName,
}: {
  log: ActionLog
  actorName: string
  targetName: string
}) {
  const details = log.details ?? {}
  const additionalDetails = Object.entries(details).filter(([key]) => key !== "changes" && key !== "old" && key !== "new")

  return (
    <div className="border-t border-border bg-muted/10 px-4 py-4">
      <div className="grid gap-4">
        <ChangeList changes={details.changes} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Changed by</p>
            <div className="mt-1">
              <CopyMenu name={actorName} id={log.userId} callsign={log.callsign} badgeNumber={log.badgeNumber} rank={log.rank} avatar={log.avatar} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Entry</p>
            <p className="mt-1 font-mono text-xs font-medium text-foreground">Promotion Log</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Discord ID</p>
            <p className="mt-1 break-all text-xs font-medium text-foreground">{log.userId || "—"}</p>
          </div>
        </div>

        {log.targetName || log.targetRank || log.targetUserId ? (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {log.targetName || targetName ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">Name</p>
                  <div className="mt-1">
                    <CopyMenu name={targetName || log.targetName || "Unknown User"} id={log.targetUserId} rank={log.targetRank ?? undefined} />
                  </div>
                </div>
              ) : null}
              {log.targetRank ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">Rank</p>
                  <p className="mt-1 text-xs font-medium">{log.targetRank}</p>
                </div>
              ) : null}
              {log.targetUserId ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">Discord ID</p>
                  <p className="mt-1 break-all text-xs font-medium">{log.targetUserId}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {additionalDetails.length > 0 ? (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Additional details</p>
            <div className="divide-y divide-border">
              {additionalDetails.map(([key, value]) => (
                <div key={key} className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{actionLabel(key)}</span>
                  <pre className="m-0 whitespace-pre-wrap break-words font-sans text-xs text-foreground/90">{formatValue(value)}</pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Action</p>
            <p className="mt-1 text-xs font-medium">{actionLabel(log.action)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recorded</p>
            <p className="mt-1 text-xs font-medium">{formatDateTime(log.createdAt)}</p>
          </div>
        </div>

        {log.path ? <p className="break-all border-t border-border pt-3 text-[10px] text-muted-foreground">{log.path}</p> : null}
      </div>
    </div>
  )
}

export default function PromotionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>("")
  const [division, setDivision] = useState<Division>("")
  const [actor, setActor] = useState("")
  const [action, setAction] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [rosterByDiscord, setRosterByDiscord] = useState<Record<string, RosterMember>>({})

  const loadRoster = useCallback(async (divisionValue: string) => {
    if (!divisionValue) return
    try {
      const response = await fetch(`/api/promotion/roster/${encodeURIComponent(divisionValue)}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      if (!response.ok) return
      const data = (await response.json()) as { success?: boolean; members?: Array<Record<string, unknown>> }
      if (!data.success || !Array.isArray(data.members)) return

      setRosterByDiscord((current) => {
        const next = { ...current }
        for (const member of data.members) {
          const discordId = String(member.discordId ?? "").trim()
          if (!discordId) continue
          next[discordId] = {
            name: String(member.name ?? "").trim(),
            rank: String(member.rank ?? "").trim(),
            callsign: String(member.callsign ?? "").trim(),
            badgeNumber: String(member.badgeNumber ?? "").trim(),
            discordId,
          }
        }
        return next
      })
    } finally {
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (category) params.set("category", category)
      if (division) params.set("division", division)
      if (actor) params.set("actor", actor)
      if (action) params.set("action", action)
      if (search.trim()) params.set("search", search.trim())

      const response = await fetch(`/api/promotion/action-logs?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to load promotion action logs (${response.status}).`)
      }

      const nextLogs = Array.isArray(data.logs) ? data.logs : []
      setLogs(nextLogs)
      setTotal(data.pagination?.total ?? 0)
      setPages(Math.max(1, data.pagination?.pages ?? 1))
      if (data.pagination?.page && data.pagination.page !== page) setPage(data.pagination.page)
    } catch (err) {
      setLogs([])
      setTotal(0)
      setPages(1)
      setError(err instanceof Error ? err.message : "Failed to load promotion action logs.")
    } finally {
      setLoading(false)
    }
  }, [action, actor, category, division, page, pageSize, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadLogs, search])

  useEffect(() => {
    const divisions = new Set(logs.map((log) => log.division || "department"))
    for (const value of divisions) void loadRoster(value)
  }, [logs, loadRoster])

  const getActorName = useCallback((log: ActionLog) => {
    return rosterByDiscord[log.userId]?.name || log.userName || log.username || "Unknown User"
  }, [rosterByDiscord])

  const getTargetName = useCallback((log: ActionLog) => {
    return (log.targetUserId ? rosterByDiscord[log.targetUserId]?.name : "") || log.targetName || "Unknown User"
  }, [rosterByDiscord])

  const actorOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>()
    for (const log of logs) {
      if (!log.userId) continue
      map.set(log.userId, getActorName(log))
    }
    return [
      { value: "", label: "Anyone" },
      ...Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ]
  }, [getActorName, logs])

  const actionOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>()
    for (const log of logs) if (log.action) map.set(log.action, actionLabel(log.action))
    return [
      { value: "", label: "All actions" },
      ...Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ]
  }, [logs])

  const grouped = useMemo(() => {
    const map = new Map<string, ActionLog[]>()
    for (const log of logs) {
      const key = dateHeading(log.createdAt)
      map.set(key, [...(map.get(key) ?? []), log])
    }
    return Array.from(map.entries())
  }, [logs])

  const clearFilters = () => {
    setCategory("")
    setDivision("")
    setActor("")
    setAction("")
    setSearch("")
    setPage(1)
    setExpanded(null)
  }

  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = total ? Math.min(page * pageSize, total) : 0
  const hasFilters = Boolean(category || division || actor || action || search)

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:px-0">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10">
              <History className="h-5 w-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Promotion Action Logs</h1>
                <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">60 days</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">A numbered audit trail for promotion roster, import, requirement, selection and management changes. Entries are retained for 60 days.</p>
            </div>
          </div>

          <button type="button" onClick={() => void loadLogs()} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-blue-500/40 hover:bg-blue-500/5">
            <RefreshCw className={`h-3.5 w-3.5 text-blue-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex w-full min-w-0 max-w-[430px] flex-1 items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                placeholder="Search entries, people, ranks, IDs..."
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500/60"
              />
            </div>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="inline-flex h-9 shrink-0 items-center gap-1.5 px-1 text-xs font-medium text-white transition-colors hover:text-blue-300">
                <X className="h-3.5 w-3.5 text-white" />
                Clear
              </button>
            ) : null}
          </div>

          <FilterSelect value={actor} options={actorOptions} onChange={(value) => { setActor(value); setPage(1); setExpanded(null) }} ariaLabel="People" className="w-[170px]" />
          <FilterSelect value={action} options={actionOptions} onChange={(value) => { setAction(value); setPage(1); setExpanded(null) }} ariaLabel="Actions" className="w-[160px]" />
          <FilterSelect value={category} options={categoryOptions} onChange={(value) => { setCategory(value as Category); setPage(1); setExpanded(null) }} ariaLabel="Categories" className="w-[175px]" />
          <FilterSelect value={division} options={divisionOptions} onChange={(value) => { setDivision(value as Division); setPage(1); setExpanded(null) }} ariaLabel="Divisions" className="w-[175px]" />

          <span className="ml-auto text-xs text-muted-foreground">{total.toLocaleString()} {total === 1 ? "change" : "changes"}</span>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div> : null}

        <section>
          {loading && !logs.length ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading promotion action logs...
            </div>
          ) : null}

          {!loading && !logs.length ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <History className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No promotion action logs found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try clearing the filters or perform a promotion dashboard action.</p>
            </div>
          ) : null}

          {grouped.map(([heading, group]) => (
            <div key={heading} className="mb-6">
              <div className="mb-2 px-0"><span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">{heading}</span></div>
              <div className="space-y-1.5">
                {group.map((log) => {
                  const isOpen = expanded === log.id
                  const globalIndex = (page - 1) * pageSize + logs.indexOf(log)
                  const entryNumber = Math.max(1, total - globalIndex)
                  const Icon = getActionIcon(log.action, log.category)
                  const actorName = getActorName(log)
                  const targetName = getTargetName(log)

                  return (
                    <article key={log.id} className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-blue-500/25 hover:bg-muted/20">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20 md:grid-cols-[44px_36px_minmax(165px,0.65fr)_minmax(280px,2fr)_auto] md:items-center"
                      >
                        <div className="flex items-center"><span className="font-mono text-[10px] font-semibold text-blue-400">#{entryNumber}</span></div>

                        <div className="flex h-full items-center justify-center">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10">
                            <Icon className="h-4 w-4 text-blue-400" />
                          </span>
                        </div>

                        <div className="min-w-0">
                          <CopyMenu name={actorName} id={log.userId} callsign={log.callsign} badgeNumber={log.badgeNumber} rank={log.rank} avatar={log.avatar} large />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-5 text-foreground">{log.summary}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="text-blue-300/80">{relativeTime(log.createdAt)}</span>
                            <span className="text-muted-foreground/60">•</span>
                            <Tag className="border-blue-500/20 bg-blue-500/10 text-blue-400">{moduleLabel()}</Tag>
                            <Tag className={tagClass("division", log.division)}>{divisionLabel(log.division)}</Tag>
                            {log.category ? <Tag className={tagClass("category", log.category)}>{actionLabel(log.category)}</Tag> : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <Tag className={statusClass(log)}>{statusLabel(log)}</Tag>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isOpen ? <DetailPanel log={log} actorName={actorName} targetName={targetName} /> : null}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {total > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Page {page} of {pages}</span>
              <FilterSelect value={String(pageSize)} options={[{ value: "25", label: "25 / page" }, { value: "50", label: "50 / page" }, { value: "75", label: "75 / page" }, { value: "100", label: "100 / page" }]} onChange={(value) => { setPageSize(Number(value)); setPage(1) }} ariaLabel="Pages" className="w-[112px]" />
              <span>{start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="h-8 rounded-md border border-border px-3 text-xs transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} className="h-8 rounded-md border border-border px-3 text-xs transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
