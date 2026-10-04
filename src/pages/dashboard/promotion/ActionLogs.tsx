import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clipboard,
  FileEdit,
  FileText,
  History,
  Search,
  Settings2,
  Shield,
  Upload,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"


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

type DropdownOption = {
  value: string
  label: string
}

const moduleOptions = [
  { value: "", label: "All modules" },
  { value: "promotion", label: "Promotion" },
  { value: "activity", label: "Activity" },
] satisfies DropdownOption[]

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

const divisionClasses: Record<string, string> = {
  department: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  swat: "border-red-500/30 bg-red-500/10 text-red-400",
  mtf7: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  mcd: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  tru: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  teu: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  sar: "border-pink-500/30 bg-pink-500/10 text-pink-400",
}

const actionClasses: Record<string, string> = {
  "import-promotion": "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  "import-activity": "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  "save-requirements": "border-blue-500/30 bg-blue-500/10 text-blue-400",
  "reset-requirements": "border-red-500/30 bg-red-500/10 text-red-400",
  "change-division": "border-purple-500/30 bg-purple-500/10 text-purple-400",
  "copy-roster": "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  "copy-discord-id": "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  "select-member": "border-blue-500/30 bg-blue-500/10 text-blue-400",
  "deselect-member": "border-orange-500/30 bg-orange-500/10 text-orange-400",
  "select-all-visible": "border-blue-500/30 bg-blue-500/10 text-blue-400",
  "search-roster": "border-slate-500/30 bg-slate-500/10 text-slate-400",
  "filter-status": "border-slate-500/30 bg-slate-500/10 text-slate-400",
  "filter-rank": "border-slate-500/30 bg-slate-500/10 text-slate-400",
  "clear-filters": "border-red-500/30 bg-red-500/10 text-red-400",
  "refresh-roster": "border-blue-500/30 bg-blue-500/10 text-blue-400",
}

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
  if (action.includes("select") || action.includes("copy")) return "Action"
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
  if (label === "Action") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-400"
  }
  if (label === "Reset") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-400"
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-400"
}

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

  const iconClass = actionClasses[log.action] ?? "border-blue-500/30 bg-blue-500/10 text-blue-400"

  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconClass}`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  )
}

function Avatar({ name, id, avatar, className = "h-5 w-5" }: { name: string; id: string; avatar?: string | null; className?: string }) {
  const avatarUrl = getAvatarUrl(id, avatar)

  return (
    <span className={`${className} shrink-0 overflow-hidden rounded-full border border-border bg-muted`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[8px] font-semibold text-muted-foreground">
          {getInitials(name)}
        </span>
      )}
    </span>
  )
}

function CopyIdentity({
  name,
  id,
  avatar,
  className = "",
}: {
  name: string
  id?: string
  avatar?: string | null
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const displayName = name || "Unknown User"

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handlePointer)
    return () => document.removeEventListener("mousedown", handlePointer)
  }, [open])

  const copy = async (value: string, label: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, { description: value })
      setOpen(false)
    } catch {
      toast.error("Copy failed")
    }
  }

  return (
    <div ref={ref} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition-colors hover:bg-muted/40"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        title="Copy options"
      >
        <Avatar name={displayName} id={id ?? ""} avatar={avatar} />
        <span className="truncate text-xs font-medium text-blue-400 hover:text-blue-300">
          {displayName}
          {id ? <span className="text-muted-foreground"> ({id})</span> : null}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground hover:bg-muted"
            onClick={(event) => {
              event.stopPropagation()
              void copy(displayName, "Name")
            }}
          >
            <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
            Copy name
          </button>
          <button
            type="button"
            disabled={!id}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            onClick={(event) => {
              event.stopPropagation()
              if (id) void copy(id, "Discord ID")
            }}
          >
            <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
            Copy Discord ID
          </button>
        </div>
      )}
    </div>
  )
}

function Dropdown({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select"

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handlePointer)
    return () => document.removeEventListener("mousedown", handlePointer)
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none transition-colors hover:border-blue-500/40 hover:bg-muted/30 focus:border-blue-500/60"
      >
        <span className="truncate">{selected}</span>
        <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-2xl">
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value || "all"}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  active ? "bg-blue-500/10 text-blue-400" : "text-foreground hover:bg-muted"
                }`}
              >
                <span>{option.label}</span>
                {active && <span className="text-[10px]">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PageSizeDropdown({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Dropdown
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      className="w-[112px]"
      options={[25, 50, 75, 100].map((size) => ({ value: String(size), label: `${size} per page` }))}
    />
  )
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null

  const items: Array<number | "ellipsis"> = []
  if (pages <= 7) {
    for (let index = 1; index <= pages; index += 1) items.push(index)
  } else {
    items.push(1)
    if (page > 4) items.push("ellipsis")
    const start = Math.max(2, page - 1)
    const end = Math.min(pages - 1, page + 1)
    for (let index = start; index <= end; index += 1) items.push(index)
    if (page < pages - 3) items.push("ellipsis")
    items.push(pages)
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{pages}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`h-8 min-w-8 rounded-md border px-2 text-xs transition-colors ${
                item === page
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:items-start">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="min-w-0 text-xs text-foreground/90">{value}</div>
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
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (module) params.set("module", module)
      if (actor) params.set("actor", actor)
      if (action) params.set("action", action)
      if (search.trim()) params.set("search", search.trim())

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
      const nextPage = data.pagination?.page ?? page
      setLogs(nextLogs)
      setTotal(data.pagination?.total ?? nextLogs.length)
      setPages(data.pagination?.pages ?? 1)
      if (nextPage !== page) setPage(nextPage)
    } catch (err) {
      setLogs([])
      setTotal(0)
      setPages(1)
      setError(err instanceof Error ? err.message : "Failed to load action logs.")
    } finally {
      setLoading(false)
    }
  }, [action, actor, module, page, pageSize, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadLogs, search])

  useEffect(() => {
    if (!expanded) return
    if (!logs.some((log) => log.id === expanded)) setExpanded(null)
  }, [expanded, logs])

  const actorOptions = useMemo<DropdownOption[]>(() => {
    const names = Array.from(
      new Map(
        logs
          .filter((log) => log.userId)
          .map((log) => [log.userId, log.userName || log.username || "Unknown User"]),
      ).entries(),
    ).sort((a, b) => a[1].localeCompare(b[1]))

    return [
      { value: "", label: "Anyone" },
      ...names.map(([id, name]) => ({ value: id, label: name })),
    ]
  }, [logs])

  const actionFilterOptions = useMemo<DropdownOption[]>(() => {
    const values = Array.from(new Set([...actionOptions, ...logs.map((log) => log.action).filter(Boolean)]))
      .sort((a, b) => actionLabel(a).localeCompare(actionLabel(b)))

    return [
      { value: "", label: "All actions" },
      ...values.map((value) => ({ value, label: actionLabel(value) })),
    ]
  }, [logs])

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
    setSearch("")
    setPage(1)
    setExpanded(null)
  }

  const filterChanged = Boolean(module || actor || action || search)
  const startNumber = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endNumber = Math.min(page * pageSize, total)

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-0">
        <header className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Activity Log</h1>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Last 14 days
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Every change your command team has made. Older entries aren&apos;t kept here.
            </p>
          </div>
        </header>

        <div className="space-y-3">
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
                    ? "rounded-md border border-purple-500/60 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300"
                    : "rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Dropdown
              value={actor}
              options={actorOptions}
              onChange={(value) => {
                setActor(value)
                setPage(1)
                setExpanded(null)
              }}
              className="w-full lg:w-[210px]"
            />

            <Dropdown
              value={action}
              options={actionFilterOptions}
              onChange={(value) => {
                setAction(value)
                setPage(1)
                setExpanded(null)
              }}
              className="w-full lg:w-[205px]"
            />

            <div className="relative w-full lg:ml-auto lg:w-[230px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                  setExpanded(null)
                }}
                placeholder="Search logs..."
                className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500/60"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground lg:ml-1">
              <span className="whitespace-nowrap">{total.toLocaleString()} changes</span>
              {filterChanged && (
                <button type="button" onClick={clearFilters} className="whitespace-nowrap text-blue-400 hover:text-blue-300">
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="text-[11px] text-muted-foreground">
              {total > 0 ? `Showing ${startNumber}–${endNumber} of ${total.toLocaleString()}` : "No changes to display"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Maximum per page</span>
              <PageSizeDropdown
                value={pageSize}
                onChange={(value) => {
                  setPageSize(value)
                  setPage(1)
                  setExpanded(null)
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[72px] animate-pulse rounded-xl border border-border bg-card/60" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-border bg-card/60 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">No action logs found</p>
              <p className="text-xs text-muted-foreground">Try another module, action, actor, or search.</p>
            </div>
          ) : (
            <div className="space-y-7">
              {groupedLogs.map(([heading, group]) => (
                <section key={heading}>
                  <h2 className="mb-2.5 px-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80">
                    {heading}
                  </h2>

                  <div className="space-y-1.5">
                    {group.map((log) => {
                      const isExpanded = expanded === log.id
                      const status = getStatusLabel(log)
                      const detailEntries = Object.entries(log.details ?? {})
                      const moduleLabel = log.module === "promotion" ? "Promotion" : "Activity"

                      return (
                        <article
                          key={log.id}
                          className="overflow-visible rounded-xl border border-border bg-card transition-colors hover:border-border/80"
                        >
                          <button
                            type="button"
                            className="flex w-full items-start gap-3 px-4 py-3 text-left"
                            onClick={() => setExpanded((current) => (current === log.id ? null : log.id))}
                          >
                            <LogIcon log={log} />

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-start gap-2">
                                <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-foreground sm:text-sm">
                                  {log.summary}
                                </p>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium ${getStatusClass(status)}`}>
                                  {status}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                              </div>

                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px]">
                                <CopyIdentity name={log.userName || log.username || "Unknown User"} id={log.userId} avatar={log.avatar} />
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">{relativeTime(log.createdAt)}</span>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${actionClasses[log.action] ?? "border-border bg-muted/30 text-muted-foreground"}`}>
                                  {moduleLabel}
                                </span>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${divisionClasses[log.division ?? "department"]}`}>
                                  {divisionLabel(log.division)}
                                </span>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-border px-4 py-4 sm:px-14 sm:py-5">
                              <div className="border-b border-border pb-4">
                                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Changed By</p>
                                <div className="mt-2">
                                  <CopyIdentity name={log.userName || log.username || "Unknown User"} id={log.userId} avatar={log.avatar} />
                                </div>
                              </div>

                              <div className="mt-4 border-b border-border pb-4">
                                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Details</p>
                                <p className="mt-2 text-xs leading-5 text-foreground/90">{log.summary}</p>
                              </div>

                              {log.targetName || log.targetUserId ? (
                                <div className="mt-4 border-b border-border pb-1">
                                  <DetailRow
                                    label="Target"
                                    value={
                                      <CopyIdentity
                                        name={log.targetName || "Unknown User"}
                                        id={log.targetUserId}
                                      />
                                    }
                                  />
                                  {log.targetRank && <DetailRow label="Previous / Rank" value={log.targetRank} />}
                                </div>
                              ) : null}

                              {detailEntries.length > 0 && (
                                <div className="mt-4 border-b border-border pb-1">
                                  {detailEntries.map(([key, value]) => (
                                    <DetailRow
                                      key={key}
                                      label={actionLabel(key)}
                                      value={
                                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground/90">
                                          {formatDetailValue(value)}
                                        </pre>
                                      }
                                    />
                                  ))}
                                </div>
                              )}

                              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                <span className="text-foreground/80">{moduleLabel}</span>
                                <span>·</span>
                                <span>{actionLabel(log.action)}</span>
                                <span>·</span>
                                <span>{divisionLabel(log.division)}</span>
                                {log.path && (
                                  <span className="max-w-full truncate" title={log.path}>
                                    · {log.path}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {!loading && logs.length > 0 && (
          <div className="mt-5">
            <Pagination
              page={page}
              pages={pages}
              onChange={(nextPage) => {
                setPage(nextPage)
                setExpanded(null)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
