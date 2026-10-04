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
  ArrowRight,
  Check,
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
type Category = "" | "roster" | "import" | "requirements" | "navigation" | "management"
type Division = "" | "department" | "swat" | "mtf7" | "mcd" | "tru" | "teu" | "sar"

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
  pagination?: { page: number; limit: number; total: number; pages: number }
}

type Option = { value: string; label: string }

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
  ...Object.entries(divisionLabels).map(([value, label]) => ({ value, label })),
]

const actionLabel = (value: string) =>
  value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())

const divisionLabel = (value?: string | null) =>
  value ? divisionLabels[value] ?? actionLabel(value) : "Department"

const getInitials = (value: string) =>
  value.trim().split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase() || "U"

const getAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!discordId) return undefined
  if (avatar?.startsWith("http://") || avatar?.startsWith("https://")) return avatar
  if (avatar?.startsWith("a_")) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.gif?size=64`
  if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
  try {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordId) % 6n)}.png?size=64`
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
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(timestamp)
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

function getLogIcon(log: ActionLog) {
  const action = log.action.toLowerCase()
  if (action.includes("copy")) return Copy
  if (action.includes("select")) return UserCheck
  if (action.includes("import")) return Upload
  if (action.includes("requirement")) return Settings2
  if (action.includes("refresh")) return RefreshCw
  if (action.includes("filter") || action.includes("search")) return Filter
  if (action.includes("division") || action.includes("navigate")) return ArrowRight
  if (log.category === "management") return Shield
  if (log.category === "roster") return Users
  if (log.module === "activity") return Activity
  return FileEdit
}

function Avatar({ name, id, avatar, className = "h-6 w-6" }: { name: string; id: string; avatar?: string | null; className?: string }) {
  const url = getAvatarUrl(id, avatar)
  return (
    <span className={`${className} shrink-0 overflow-hidden rounded-full border border-border bg-muted`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[8px] font-semibold text-muted-foreground">{getInitials(name)}</span>}
    </span>
  )
}

function CopyMenu({ name, id, avatar }: { name: string; id?: string; avatar?: string | null }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", down)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("mousedown", down)
      document.removeEventListener("keydown", escape)
    }
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

  const display = name || "Unknown User"
  return (
    <div
      ref={ref}
      className="relative inline-flex min-w-0"
      onContextMenu={(event: ReactMouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setCursor({ x: event.clientX, y: event.clientY })
        setOpen(true)
      }}
    >
      <button type="button" onClick={(event) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        setCursor({ x: rect.left, y: rect.bottom + 4 })
        setOpen((value) => !value)
      }} className="inline-flex max-w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/50">
        <Avatar name={display} id={id ?? ""} avatar={avatar} />
        <span className="truncate text-xs font-medium text-blue-400 hover:text-blue-300">{display}</span>
      </button>
      {open && (
        <div
          className="fixed z-[100] min-w-[190px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-2xl"
          style={{ left: cursor.x, top: cursor.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Copy</div>
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-blue-500/10 hover:text-blue-400" onClick={() => void copy(display, "Name")}><Clipboard className="h-3.5 w-3.5 text-blue-400" />Copy name</button>
          <button type="button" disabled={!id} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-blue-500/10 hover:text-blue-400 disabled:opacity-40" onClick={() => id && void copy(id, "Discord ID")}><Clipboard className="h-3.5 w-3.5 text-blue-400" />Copy Discord ID</button>
          <button type="button" disabled={!id} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-blue-500/10 hover:text-blue-400 disabled:opacity-40" onClick={() => id && void copy(`<@${id}>`, "Discord mention")}><Clipboard className="h-3.5 w-3.5 text-blue-400" />Copy Discord mention</button>
          <button type="button" disabled={!id} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-blue-500/10 hover:text-blue-400 disabled:opacity-40" onClick={() => id && void copy(`${display} — ${id}`, "Name and ID")}><Clipboard className="h-3.5 w-3.5 text-blue-400" />Copy name + ID</button>
        </div>
      )}
    </div>
  )
}

function SelectBox({ value, options, onChange, className = "" }: { value: string; options: Option[]; onChange: (value: string) => void; className?: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-9 rounded-md border border-border bg-card px-3 text-xs outline-none transition-colors focus:border-blue-500/60 ${className}`}>
      {options.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function ChangeList({ changes }: { changes: unknown }) {
  if (!Array.isArray(changes) || !changes.length) return null
  const visible = changes.slice(0, 120) as Array<Record<string, unknown>>
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Changes</div>
      <div className="overflow-hidden rounded-lg border border-border">
        {visible.map((change, index) => {
          const oldValue = change.old && typeof change.old === "object" ? (change.old as Record<string, unknown>) : change.old
          const newValue = change.new && typeof change.new === "object" ? (change.new as Record<string, unknown>) : change.new
          const rank = String(change.rank ?? change.name ?? change.discordId ?? `Change ${index + 1}`)
          const oldText = formatValue(oldValue)
          const newText = formatValue(newValue)
          return (
            <div key={`${rank}-${index}`} className="grid gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[minmax(120px,0.8fr)_1fr]">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{rank}</p>
                {change.discordId ? <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{String(change.discordId)}</p> : null}
              </div>
              <div className="min-w-0 space-y-1 text-xs">
                <div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">OLD</span><span className="break-words text-muted-foreground">{oldText}</span></div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">NEW</span><span className="break-words font-medium text-foreground">{newText}</span></div>
              </div>
            </div>
          )
        })}
      </div>
      {changes.length > visible.length ? <p className="text-[10px] text-muted-foreground">Showing the first {visible.length} changes. The import stored {changes.length} changed values in the audit summary limit.</p> : null}
    </div>
  )
}

function DetailPanel({ log }: { log: ActionLog }) {
  const details = log.details ?? {}
  return (
    <div className="space-y-4 border-t border-border bg-muted/10 px-4 py-4">
      <ChangeList changes={details.changes} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Action</p><p className="mt-1 text-xs font-medium">{actionLabel(log.action)}</p></div>
        <div className="rounded-lg border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Recorded</p><p className="mt-1 text-xs font-medium">{formatDateTime(log.createdAt)}</p></div>
      </div>
      {log.targetName || log.targetRank || log.targetUserId ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {log.targetName ? <div><p className="text-[10px] text-muted-foreground">Name</p><p className="text-xs font-medium">{log.targetName}</p></div> : null}
            {log.targetRank ? <div><p className="text-[10px] text-muted-foreground">Rank</p><p className="text-xs font-medium">{log.targetRank}</p></div> : null}
            {log.targetUserId ? <div><p className="text-[10px] text-muted-foreground">Discord ID</p><p className="break-all text-xs font-medium">{log.targetUserId}</p></div> : null}
          </div>
        </div>
      ) : null}
      {Object.entries(details).filter(([key]) => key !== "changes").length ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Additional details</p>
          <div className="divide-y divide-border">
            {Object.entries(details).filter(([key]) => key !== "changes").map(([key, value]) => <div key={key} className="grid gap-1 py-2 sm:grid-cols-[150px_1fr]"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{actionLabel(key)}</span><pre className="m-0 whitespace-pre-wrap break-words font-sans text-xs text-foreground/90">{formatValue(value)}</pre></div>)}
          </div>
        </div>
      ) : null}
      {log.path ? <p className="break-all text-[10px] text-muted-foreground">{log.path}</p> : null}
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
      if (category) params.set("category", category)
      if (division) params.set("division", division)
      if (search.trim()) params.set("search", search.trim())
      const response = await fetch(`/api/action-logs?${params.toString()}`, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.success) throw new Error(data.error || `Failed to load action logs (${response.status}).`)
      setLogs(Array.isArray(data.logs) ? data.logs : [])
      setTotal(data.pagination?.total ?? 0)
      setPages(data.pagination?.pages ?? 1)
      if (data.pagination?.page && data.pagination.page !== page) setPage(data.pagination.page)
    } catch (err) {
      setLogs([]); setTotal(0); setPages(1)
      setError(err instanceof Error ? err.message : "Failed to load action logs.")
    } finally { setLoading(false) }
  }, [category, division, module, page, pageSize, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadLogs, search])

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
    setModule(""); setCategory(""); setDivision(""); setSearch(""); setPage(1); setExpanded(null)
  }

  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, total)
  const hasFilters = Boolean(module || category || division || search)

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-0">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10"><History className="h-5 w-5 text-blue-400" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">Action Logs</h1><span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Persistent</span></div>
              <p className="mt-1 text-sm text-muted-foreground">A permanent, numbered audit trail for roster, import, requirement, selection and management changes.</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadLogs()} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted"><RefreshCw className={`h-3.5 w-3.5 text-blue-400 ${loading ? "animate-spin" : ""}`} />Refresh</button>
        </header>

        <section className="mb-5 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_150px_150px_150px_auto]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search entries, people, ranks, IDs..." className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-blue-500/60" /></div>
            <SelectBox value={module} options={moduleOptions} onChange={(value) => { setModule(value as Module); setPage(1) }} />
            <SelectBox value={category} options={categoryOptions} onChange={(value) => { setCategory(value as Category); setPage(1) }} />
            <SelectBox value={division} options={divisionOptions} onChange={(value) => { setDivision(value as Division); setPage(1) }} />
            {hasFilters ? <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" />Clear</button> : <div />}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground"><span>{total.toLocaleString()} total entries</span><span>Showing {start.toLocaleString()}–{end.toLocaleString()}</span></div>
        </section>

        {error ? <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div> : null}

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {loading && !logs.length ? <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground"><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />Loading action logs...</div> : null}
          {!loading && !logs.length ? <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center"><History className="h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No action logs found</p><p className="mt-1 text-sm text-muted-foreground">Try clearing the filters or perform a dashboard action.</p></div> : null}

          {grouped.map(([heading, group]) => (
            <div key={heading}>
              <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2 backdrop-blur"><span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">{heading}</span></div>
              <div>
                {group.map((log) => {
                  const Icon = getLogIcon(log)
                  const isOpen = expanded === log.id
                  return (
                    <article key={log.id} className="border-b border-border last:border-b-0">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : log.id)} className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25 md:grid-cols-[58px_34px_minmax(150px,0.7fr)_minmax(280px,2fr)_auto] md:items-center">
                        <div className="flex items-center gap-1.5"><span className="font-mono text-xs font-bold text-blue-400">#{log.entryNumber}</span></div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10"><Icon className="h-3.5 w-3.5 text-blue-400" /></div>
                        <div className="min-w-0"><CopyMenu name={log.userName || log.username || "Unknown User"} id={log.userId} avatar={log.avatar} /><div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground"><span>{log.rank || "Unknown rank"}</span>{log.callsign ? <><span>•</span><span>{log.callsign}</span></> : null}</div></div>
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-400">{log.module}</span>{log.division ? <span className="text-[10px] text-muted-foreground">{divisionLabel(log.division)}</span> : null}</div><p className="mt-1 truncate text-sm font-medium text-foreground">{log.summary}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{actionLabel(log.action)} · {relativeTime(log.createdAt)}</p></div>
                        <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground"><span className="hidden lg:inline">{formatDateTime(log.createdAt)}</span><span className="rounded border border-border bg-muted/30 px-1.5 py-0.5">{isOpen ? "Close" : "Details"}</span></div>
                      </button>
                      {isOpen ? <DetailPanel log={log} /> : null}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {pages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Page {page} of {pages}</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={75}>75 / page</option><option value={100}>100 / page</option></select></div>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-8 rounded-md border border-border px-3 text-xs disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="h-8 rounded-md border border-border px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
