import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react"

import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  FileEdit,
  Filter,
  History,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Upload,
  UserCheck,
  Users,
  X,
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
  entryNumber: number
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

type Option = {
  value: string
  label: string
}

const moduleOptions: Option[] = [
  { value: "", label: "All modules" },
  { value: "promotion", label: "Promotion" },
  { value: "activity", label: "Activity" },
]

const categoryOptions: Option[] = [
  { value: "", label: "All categories" },
  { value: "requirements", label: "Requirements" },
  { value: "import", label: "Imports" },
  { value: "roster", label: "Roster" },
  { value: "navigation", label: "Navigation" },
  { value: "management", label: "Management" },
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
  ...Object.entries(divisionLabels).map(([value, label]) => ({
    value,
    label,
  })),
]

const moduleLabel = (value: string) => {
  if (value === "promotion") return "Promotion"
  if (value === "activity") return "Activity"
  return value || "All modules"
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

const getAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!discordId) return undefined

  if (avatar?.startsWith("http://") || avatar?.startsWith("https://")) {
    return avatar
  }

  if (avatar?.startsWith("a_")) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.gif?size=64`
  }

  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
  }

  try {
    const index = Number(BigInt(discordId) % 6n)
    return `https://cdn.discordapp.com/embed/avatars/${index}.png?size=64`
  } catch {
    return undefined
  }
}

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    return "Unknown time"
  }

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  )

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

  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }

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

  if (Number.isNaN(date.getTime())) {
    return "UNKNOWN DATE"
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(date)
    .toUpperCase()
}

function getLogIcon(log: ActionLog) {
  const action = log.action.toLowerCase()

  if (action.includes("copy")) return Copy
  if (action.includes("select")) return UserCheck
  if (action.includes("import")) return Upload
  if (action.includes("requirement")) return Settings2
  if (action.includes("refresh")) return RefreshCw
  if (action.includes("filter") || action.includes("search")) return Filter
  if (log.category === "management") return Shield
  if (log.category === "roster") return Users
  if (log.module === "activity") return Activity

  return FileEdit
}

function Avatar({
  name,
  id,
  avatar,
  className = "h-6 w-6",
}: {
  name: string
  id: string
  avatar?: string | null
  className?: string
}) {
  const url = getAvatarUrl(id, avatar)

  return (
    <span
      className={`${className} shrink-0 overflow-hidden rounded-full border border-border bg-muted`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
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
  avatar,
}: {
  name: string
  id?: string
  avatar?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
  })

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const copy = async (value: string, label: string) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)

      toast.success(`${label} copied`, {
        description: value,
      })

      setOpen(false)
    } catch {
      toast.error("Copy failed")
    }
  }

  const display = name || "Unknown User"

  return (
    <div
      ref={ref}
      className="relative inline-flex min-w-0"
      onContextMenu={(event: ReactMouseEvent) => {
        event.preventDefault()
        event.stopPropagation()

        setPosition({
          left: event.clientX,
          top: event.clientY + 4,
        })

        setOpen(true)
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()

          const rect = event.currentTarget.getBoundingClientRect()

          setPosition({
            left: rect.left,
            top: rect.bottom + 5,
          })

          setOpen((current) => !current)
        }}
        className="inline-flex max-w-full items-center gap-2 rounded-md py-0.5 text-left transition-colors hover:text-blue-400"
      >
        <Avatar name={display} id={id ?? ""} avatar={avatar} />

        <span className="truncate text-xs font-medium text-blue-400">
          {display}
        </span>
      </button>

      {open ? (
        <div
          className="fixed z-[100] min-w-[205px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-2xl"
          style={{
            left: Math.min(position.left, window.innerWidth - 220),
            top: Math.min(position.top, window.innerHeight - 190),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Copy
          </div>

          <button
            type="button"
            onClick={() => void copy(display, "Name")}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-blue-500/10 hover:text-blue-400"
          >
            <Clipboard className="h-3.5 w-3.5 text-blue-400" />
            Copy name
          </button>

          <button
            type="button"
            disabled={!id}
            onClick={() => id && void copy(id, "Discord ID")}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-blue-500/10 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Clipboard className="h-3.5 w-3.5 text-blue-400" />
            Copy Discord ID
          </button>

          <button
            type="button"
            disabled={!id}
            onClick={() =>
              id && void copy(`<@${id}>`, "Discord mention")
            }
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-blue-500/10 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Clipboard className="h-3.5 w-3.5 text-blue-400" />
            Copy Discord mention
          </button>

          <button
            type="button"
            disabled={!id}
            onClick={() =>
              id && void copy(`${display} — ${id}`, "Name and ID")
            }
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-blue-500/10 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Clipboard className="h-3.5 w-3.5 text-blue-400" />
            Copy name + ID
          </button>
        </div>
      ) : null}
    </div>
  )
}

function FilterSelect({
  value,
  options,
  onChange,
  icon: Icon,
  ariaLabel,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  icon?: typeof Users
  ariaLabel: string
}) {
  return (
    <div className="relative min-w-0">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-blue-400" />
      ) : null}

      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full appearance-none rounded-lg border border-border bg-transparent pr-9 text-xs outline-none transition-colors hover:border-blue-500/40 focus:border-blue-500/70 ${
          Icon ? "pl-9" : "pl-3"
        }`}
      >
        {options.map((option) => (
          <option
            key={option.value || `all-${ariaLabel}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
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
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function displayChangeValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—"
  }

  if (typeof value === "object") {
    return formatValue(value)
  }

  return String(value)
}

function ChangeList({ changes }: { changes: unknown }) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return null
  }

  const visible = changes.slice(0, 120) as Array<
    Record<string, unknown>
  >

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {visible.map((change, index) => {
        const oldValue = change.old
        const newValue = change.new

        const rank = String(
          change.rank ??
            change.name ??
            change.discordId ??
            `Change ${index + 1}`,
        )

        return (
          <div
            key={`${rank}-${index}`}
            className="grid gap-4 border-b border-border p-3 last:border-b-0 md:grid-cols-[1.1fr_1fr_1fr]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Requirement
              </p>

              <p className="mt-1 break-words text-xs font-medium text-foreground">
                {rank}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Old
              </p>

              <p className="mt-1 break-words text-xs text-muted-foreground line-through decoration-red-500/70">
                {displayChangeValue(oldValue)}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                New
              </p>

              <p className="mt-1 break-words text-xs font-semibold text-emerald-400">
                {displayChangeValue(newValue)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DetailPanel({ log }: { log: ActionLog }) {
  const details = log.details ?? {}

  const additionalDetails = Object.entries(details).filter(
    ([key]) =>
      key !== "changes" &&
      key !== "old" &&
      key !== "new",
  )

  return (
    <div className="border-t border-border bg-muted/5 px-4 py-4">
      <div className="grid gap-4">
        <ChangeList changes={details.changes} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Changed by
            </p>

            <p className="mt-1 text-xs font-medium text-blue-400">
              {log.username || log.userName || "Unknown user"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Entry
            </p>

            <p className="mt-1 font-mono text-xs font-medium text-foreground">
              #{log.entryNumber}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Discord ID
            </p>

            <p className="mt-1 break-all text-xs font-medium text-foreground">
              {log.userId || "—"}
            </p>
          </div>
        </div>

        {log.targetName || log.targetRank || log.targetUserId ? (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Target
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {log.targetName ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Name
                  </p>

                  <p className="mt-1 text-xs font-medium">
                    {log.targetName}
                  </p>
                </div>
              ) : null}

              {log.targetRank ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Rank
                  </p>

                  <p className="mt-1 text-xs font-medium">
                    {log.targetRank}
                  </p>
                </div>
              ) : null}

              {log.targetUserId ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Discord ID
                  </p>

                  <p className="mt-1 break-all text-xs font-medium">
                    {log.targetUserId}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {additionalDetails.length > 0 ? (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Additional details
            </p>

            <div className="divide-y divide-border">
              {additionalDetails.map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {actionLabel(key)}
                  </span>

                  <pre className="m-0 whitespace-pre-wrap break-words font-sans text-xs text-foreground/90">
                    {formatValue(value)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Action
            </p>

            <p className="mt-1 text-xs font-medium">
              {actionLabel(log.action)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recorded
            </p>

            <p className="mt-1 text-xs font-medium">
              {formatDateTime(log.createdAt)}
            </p>
          </div>
        </div>

        {log.path ? (
          <p className="break-all border-t border-border pt-3 text-[10px] text-muted-foreground">
            {log.path}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function ActionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [module, setModule] = useState<Module>("")
  const [category, setCategory] = useState<Category>("")
  const [division, setDivision] = useState<Division>("")
  const [userId, setUserId] = useState("")
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
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      })

      if (module) params.set("module", module)
      if (category) params.set("category", category)
      if (division) params.set("division", division)
      if (userId) params.set("userId", userId)
      if (search.trim()) params.set("search", search.trim())

      const response = await fetch(
        `/api/action-logs?${params.toString()}`,
        {
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      )

      const data = (await response.json()) as ApiResponse

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            `Failed to load action logs (${response.status}).`,
        )
      }

      const nextLogs = Array.isArray(data.logs) ? data.logs : []

      setLogs(nextLogs)
      setTotal(data.pagination?.total ?? 0)
      setPages(data.pagination?.pages ?? 1)

      if (
        data.pagination?.page &&
        data.pagination.page !== page
      ) {
        setPage(data.pagination.page)
      }
    } catch (err) {
      setLogs([])
      setTotal(0)
      setPages(1)

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load action logs.",
      )
    } finally {
      setLoading(false)
    }
  }, [
    category,
    division,
    module,
    page,
    pageSize,
    search,
    userId,
  ])

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadLogs(),
      search ? 250 : 0,
    )

    return () => window.clearTimeout(timer)
  }, [loadLogs, search])

  const userOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>()

    for (const log of logs) {
      if (!log.userId) continue

      const label =
        log.userName ||
        log.username ||
        log.userId

      map.set(log.userId, label)
    }

    return [
      { value: "", label: "All users" },
      ...Array.from(map.entries())
        .sort((a, b) =>
          a[1].localeCompare(b[1]),
        )
        .map(([value, label]) => ({
          value,
          label,
        })),
    ]
  }, [logs])

  const grouped = useMemo(() => {
    const map = new Map<string, ActionLog[]>()

    for (const log of logs) {
      const key = dateHeading(log.createdAt)
      const current = map.get(key) ?? []

      current.push(log)
      map.set(key, current)
    }

    return Array.from(map.entries())
  }, [logs])

  const clearFilters = () => {
    setCategory("")
    setDivision("")
    setUserId("")
    setSearch("")
    setPage(1)
    setExpanded(null)
  }

  const selectModule = (value: Module) => {
    setModule(value)
    setPage(1)
    setExpanded(null)
  }

  const start = total
    ? (page - 1) * pageSize + 1
    : 0

  const end = total
    ? Math.min(page * pageSize, total)
    : 0

  const hasFilters = Boolean(
    category ||
      division ||
      userId ||
      search,
  )

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-0">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <History className="h-5 w-5 text-blue-400" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  Action Logs
                </h1>

                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  60 days
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Every change your command team has made. Older
                entries aren't kept here.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadLogs()}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-blue-400 ${
                loading ? "animate-spin" : ""
              }`}
            />

            Refresh
          </button>
        </header>

        {/* Module tabs */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {moduleOptions.map((option) => {
            const active = module === option.value

            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() =>
                  selectModule(
                    option.value as Module,
                  )
                }
                className={`h-9 rounded-lg px-3.5 text-xs font-medium transition-colors ${
                  active
                    ? "border border-blue-500/60 bg-blue-500/10 text-blue-400"
                    : "border border-border bg-transparent text-muted-foreground hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {/* Search + filters — deliberately no surrounding box */}
        <section className="mb-4">
          <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_170px_170px_170px_170px_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search entries, people, ranks, IDs..."
                className="h-10 w-full rounded-lg border border-border bg-transparent pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/60"
              />
            </div>

            <FilterSelect
              value={category}
              options={categoryOptions}
              onChange={(value) => {
                setCategory(value as Category)
                setPage(1)
                setExpanded(null)
              }}
              ariaLabel="Category"
            />

            <FilterSelect
              value={division}
              options={divisionOptions}
              onChange={(value) => {
                setDivision(value as Division)
                setPage(1)
                setExpanded(null)
              }}
              ariaLabel="Division"
            />

            <FilterSelect
              value={userId}
              options={userOptions}
              onChange={(value) => {
                setUserId(value)
                setPage(1)
                setExpanded(null)
              }}
              icon={Users}
              ariaLabel="User"
            />

            <FilterSelect
              value=""
              options={[
                { value: "", label: "All actions" },
              ]}
              onChange={() => {
                // Reserved for future action-level filtering.
              }}
              ariaLabel="Action"
            />

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-3 text-[11px] text-muted-foreground">
            <span>
              {total.toLocaleString()} entries
            </span>

            <span>
              {total
                ? `Showing ${start.toLocaleString()}–${end.toLocaleString()}`
                : "Showing 0–0"}
            </span>
          </div>
        </section>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {/* Logs */}
        <section>
          {loading && !logs.length ? (
            <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading action logs...
            </div>
          ) : null}

          {!loading && !logs.length ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <History className="h-8 w-8 text-muted-foreground" />

              <p className="mt-3 font-medium">
                No action logs found
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Try clearing the filters or perform a dashboard action.
              </p>
            </div>
          ) : null}

          {grouped.map(([heading, group]) => (
            <div key={heading} className="mb-6">
              <div className="mb-2">
                <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                  {heading}
                </span>
              </div>

              <div className="space-y-2">
                {group.map((log) => {
                  const Icon = getLogIcon(log)
                  const isOpen = expanded === log.id

                  return (
                    <article
                      key={log.id}
                      className="overflow-hidden rounded-lg border border-border bg-transparent transition-colors hover:border-blue-500/30"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            isOpen ? null : log.id,
                          )
                        }
                        className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-500/[0.025] md:grid-cols-[50px_42px_minmax(150px,0.7fr)_minmax(280px,2fr)_auto] md:items-center"
                      >
                        <div className="font-mono text-xs font-bold text-blue-400">
                          #{log.entryNumber}
                        </div>

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
                          <Icon className="h-4 w-4 text-blue-400" />
                        </div>

                        <div className="min-w-0">
                          <CopyMenu
                            name={
                              log.userName ||
                              log.username ||
                              "Unknown User"
                            }
                            id={log.userId}
                            avatar={log.avatar}
                          />

                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>
                              {log.rank ||
                                "Unknown rank"}
                            </span>

                            {log.callsign ? (
                              <>
                                <span>•</span>
                                <span>
                                  {log.callsign}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-400">
                              {moduleLabel(log.module)}
                            </span>

                            <span className="rounded-full border border-border px-2 py-0.5 text-[9px] text-muted-foreground">
                              {divisionLabel(
                                log.division,
                              )}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {log.summary}
                          </p>

                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {actionLabel(log.action)}{" "}
                            · {relativeTime(log.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                          <span className="hidden rounded-full border border-blue-500/40 px-2 py-0.5 text-[9px] font-semibold text-blue-400 lg:inline-flex">
                            Updated
                          </span>

                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-blue-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isOpen ? (
                        <DetailPanel log={log} />
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Pagination */}
        {total > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {pages}
              </span>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(
                    Number(event.target.value),
                  )
                  setPage(1)
                }}
                className="h-8 rounded-md border border-border bg-transparent px-2 text-xs outline-none focus:border-blue-500/60"
              >
                <option value={25}>
                  25 / page
                </option>
                <option value={50}>
                  50 / page
                </option>
                <option value={75}>
                  75 / page
                </option>
                <option value={100}>
                  100 / page
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() =>
                  setPage((value) => value - 1)
                }
                className="h-8 rounded-md border border-border px-3 text-xs transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={
                  page >= pages || loading
                }
                onClick={() =>
                  setPage((value) => value + 1)
                }
                className="h-8 rounded-md border border-border px-3 text-xs transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
