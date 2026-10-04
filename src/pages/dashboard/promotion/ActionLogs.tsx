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
  Copy,
  ClipboardList,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type MouseEvent,
} from "react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Category = "roster" | "import" | "requirements" | "navigation" | ""
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
  discordDisplayName?: string
  discordUsername?: string
  avatar?: string | null
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

type DiscordProfile = {
  id: string
  username: string
  displayName: string
  avatar?: string | null
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

const categoryOptions = [
  { value: "", label: "All Categories" },
  { value: "roster", label: "Roster" },
  { value: "import", label: "Imports" },
  { value: "requirements", label: "Requirements" },
  { value: "navigation", label: "Navigation" },
] as const

const divisionOptions = [
  { value: "", label: "All Divisions" },
  { value: "department", label: "Department" },
  { value: "swat", label: "SWAT" },
  { value: "mtf7", label: "MTF-7" },
  { value: "mcd", label: "MCD" },
  { value: "tru", label: "TRU" },
  { value: "teu", label: "TEU" },
  { value: "sar", label: "SAR" },
] as const

const fallbackActions = [
  "view-roster",
  "change-division",
  "search-roster",
  "filter-status",
  "filter-rank",
  "clear-filters",
  "select-member",
  "select-rank",
  "select-all-visible",
  "copy-roster",
  "copy-discord-id",
  "refresh-roster",
  "import-promotion",
  "save-requirements",
  "reset-requirements",
]

const divisionLabel = (value: string | null) =>
  divisionOptions.find((item) => item.value === value)?.label ?? value ?? "—"

const categoryLabel = (value: string) =>
  categoryOptions.find((item) => item.value === value)?.label ?? value

const actionLabel = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const formatDetailValue = (value: unknown) => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const getDefaultAvatar = (discordId: string) => {
  try {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordId) % 6n)}.png?size=128`
  } catch {
    return undefined
  }
}

const getAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!avatar) return getDefaultAvatar(discordId)
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar
  if (avatar.startsWith("a_")) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.gif?size=128`
  }
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`
}

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"

function UserIdentity({
  log,
  profile,
  open,
  onOpen,
  onContextMenu,
}: {
  log: ActionLog
  profile?: DiscordProfile
  open: boolean
  onOpen: () => void
  onContextMenu: (event: MouseEvent) => void
}) {
  const displayName = profile?.displayName || log.discordDisplayName || log.userName || log.username || "Unknown User"
  const username = profile?.username || log.discordUsername || log.username
  const avatar = getAvatarUrl(log.userId, profile?.avatar || log.avatar)

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, { description: value })
    } catch {
      toast.error("Copy failed", { description: "Your browser could not access the clipboard." })
    }
    onOpen()
  }

  const values: Record<string, string> = {
    discord: log.userId,
    "discord-mention": `<@${log.userId}>`,
    name: displayName,
    callsign: log.callsign || "",
    badge: log.badgeNumber || "",
    rank: log.rank || "",
  }

  const copyCombined = async (type: string, label: string) => {
    const parts = {
      "name-discord": `${displayName} | ${log.userId}`,
      "callsign-discord": `${log.callsign} | ${log.userId}`,
      "callsign-name": `${log.callsign} | ${displayName}`,
      "callsign-badge-name": `${log.callsign} | ${log.badgeNumber} | ${displayName}`,
      "callsign-badge-name-discord": `${log.callsign} | ${log.badgeNumber} | ${displayName} | ${log.userId}`,
      "name-rank-discord": `${displayName} | ${log.rank} | ${log.userId}`,
      full: `Callsign: ${log.callsign}\nBadge: ${log.badgeNumber}\nName: ${displayName}\nRank: ${log.rank}\nDiscord: ${log.userId}`,
    } as Record<string, string>
    await copy(parts[type] || "", label)
  }

  return (
    <div className="relative min-w-0">
      <DropdownMenu open={open} onOpenChange={(value) => { if (value !== open) onOpen() }}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`${displayName}${username ? ` (@${username})` : ""}`}
            className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={onContextMenu}
          >
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-muted">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-semibold">{getInitials(displayName)}</div>}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium text-blue-400" title={displayName}>{displayName}</div>
              <div className="truncate text-[11px] text-muted-foreground" title={username ? `@${username}` : "Username unavailable"}>{username ? `@${username}` : "Username unavailable"}</div>
              <div className="truncate font-mono text-[10px] text-blue-400/70" title={log.userId}>{log.userId}</div>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions={false}
          className="max-h-72 w-64 overflow-y-auto"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="border-b px-3 py-2">
            <p className="truncate text-sm font-semibold" title={displayName}>{displayName}</p>
            <p className="truncate text-xs text-muted-foreground" title={username ? `@${username}` : "Username unavailable"}>{username ? `@${username}` : "Username unavailable"}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-blue-400" title={log.userId}>{log.userId}</p>
          </div>

          <DropdownMenuItem onClick={() => void copy(values.discord, "Discord ID")} className="gap-2 text-sm">
            <Copy className="h-4 w-4 text-blue-400" /> Copy Discord IDs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copy(values["discord-mention"], "Discord Mention")} className="gap-2 text-sm">
            <Copy className="h-4 w-4 text-blue-400" /> Copy Discord Mentions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copy(values.name, "Name")} className="gap-2 text-sm">
            <Copy className="h-4 w-4 text-blue-400" /> Copy Names
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copy(values.callsign, "Callsign")} className="gap-2 text-sm">
            <Copy className="h-4 w-4 text-blue-400" /> Copy Callsigns
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copy(values.badge, "Badge Number")} className="gap-2 text-sm">
            <Copy className="h-4 w-4 text-blue-400" /> Copy Badge Numbers
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copy(values.rank, "Rank")} className="gap-2 text-sm">
            <Copy className="h-4 w-4 text-blue-400" /> Copy Ranks
          </DropdownMenuItem>

          <div className="my-1 h-px bg-border" />
          {[
            ["name-discord", "Name + Discord ID"],
            ["callsign-discord", "Callsign + Discord ID"],
            ["callsign-name", "Callsign + Name"],
            ["callsign-badge-name", "Callsign + Badge + Name"],
            ["callsign-badge-name-discord", "Callsign + Badge + Name + Discord"],
            ["name-rank-discord", "Name + Rank + Discord"],
            ["full", "Copy Full Details"],
          ].map(([type, label]) => (
            <DropdownMenuItem key={type} onClick={() => void copyCombined(type, label)} className="gap-2 text-sm">
              <ClipboardList className="h-4 w-4 text-blue-400" /> {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
  const [openUserMenu, setOpenUserMenu] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null)
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 })
  const [profiles, setProfiles] = useState<Record<string, DiscordProfile>>({})
  const profilesRef = useRef<Record<string, DiscordProfile>>({})
  const profileLoadingRef = useRef<Set<string>>(new Set())

  const hasFilters = Boolean(search.trim() || category || division || action || from || to)

  const loadProfile = useCallback(async (discordId: string) => {
    if (!discordId || profilesRef.current[discordId] || profileLoadingRef.current.has(discordId)) return

    profileLoadingRef.current.add(discordId)
    try {
      const response = await fetch(
        `/api/promotion/discord-profile/${encodeURIComponent(discordId)}`,
        { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } },
      )
      const data = (await response.json()) as { success?: boolean; profile?: DiscordProfile }

      if (response.ok && data.success && data.profile) {
        profilesRef.current[discordId] = data.profile
        setProfiles((current) => ({ ...current, [discordId]: data.profile! }))
      }
    } catch {
      // The stored audit identity remains visible if Discord lookup fails.
    } finally {
      profileLoadingRef.current.delete(discordId)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (search.trim()) params.set("search", search.trim())
      if (category) params.set("category", category)
      if (division) params.set("division", division)
      if (action) params.set("action", action)
      if (from) params.set("from", `${from}T00:00:00.000Z`)
      if (to) params.set("to", `${to}T23:59:59.999Z`)

      const response = await fetch(`/api/promotion/action-logs?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })

      const text = await response.text()
      let data: ApiResponse = {}
      try {
        data = text ? (JSON.parse(text) as ApiResponse) : {}
      } catch {
        throw new Error("The action logs API returned an invalid response.")
      }

      if (!response.ok || data.success !== true) {
        throw new Error(data.error || `Failed to load action logs (${response.status}).`)
      }

      const incoming = Array.isArray(data.logs) ? data.logs : []
      const nextLogs: ActionLog[] = []

      for (const log of incoming) {
        const previous = nextLogs[nextLogs.length - 1]
        const sameEvent = previous &&
          previous.userId === log.userId &&
          previous.action === log.action &&
          previous.category === log.category &&
          previous.division === log.division &&
          previous.targetUserId === log.targetUserId &&
          previous.targetName === log.targetName &&
          previous.summary === log.summary &&
          Math.abs(new Date(previous.createdAt).getTime() - new Date(log.createdAt).getTime()) <= 3000

        if (!sameEvent) nextLogs.push(log)
      }

      setLogs(nextLogs)
      setPagination(data.pagination ?? { page, limit: 50, total: nextLogs.length, pages: 1 })
      setAvailableActions((current) =>
        Array.from(new Set([...fallbackActions, ...current, ...nextLogs.map((log) => log.action)])).sort(),
      )
    } catch (err) {
      setLogs([])
      setError(err instanceof Error ? err.message : "Failed to load promotion action logs.")
    } finally {
      setLoading(false)
    }
  }, [page, search, category, division, action, from, to])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    for (const discordId of Array.from(new Set(logs.map((log) => log.userId).filter(Boolean)))) {
      void loadProfile(discordId)
    }
  }, [logs, loadProfile])

  useEffect(() => {
    const close = () => {
      setContextMenu(null)
      setOpenUserMenu(null)
    }
    window.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [])

  const actionOptions = useMemo(
    () => Array.from(new Set([...fallbackActions, ...availableActions])).sort(),
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
    setExpanded(null)
  }

  const openContextMenu = (event: MouseEvent, log: ActionLog) => {
    event.preventDefault()
    event.stopPropagation()
    if (!log.userId) return

    const width = 170
    const height = 46
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
      discordId: log.userId,
      label: log.discordDisplayName || log.userName || log.username || log.userId,
    })
  }

  const copyContextId = async () => {
    if (!contextMenu) return
    try {
      await navigator.clipboard.writeText(contextMenu.discordId)
      toast.success("Discord ID copied", { description: contextMenu.discordId })
    } catch {
      toast.error("Copy failed")
    } finally {
      setContextMenu(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Promotion Action Logs</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">Promotion Management audit history.</p>
            </div>
          </div>
          <Button type="button" variant={loading ? "default" : "outline"} size="sm" className="gap-2 self-start" onClick={() => void loadLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 text-white ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        </div>

        <div className="sticky top-2 z-40 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-blue-500" />
              Filters
            </div>
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,2fr)_repeat(3,minmax(140px,1fr))_130px_130px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search users, actions, IDs, targets..." className="h-8 pl-8 pr-16 text-xs" />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setPage(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground" title="Clear search">
                  <span className="inline-flex items-center gap-1"><X className="h-3 w-3" /> Clear</span>
                </button>
              )}
            </div>
            <select value={category} onChange={(e) => { setCategory(e.target.value as Category); setPage(1) }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              {categoryOptions.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
            <select value={division} onChange={(e) => { setDivision(e.target.value as Division); setPage(1) }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              {divisionOptions.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">All Actions</option>
              {actionOptions.map((item) => <option key={item} value={item}>{actionLabel(item)}</option>)}
            </select>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="h-8 text-xs" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="h-8 text-xs" />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">{pagination.total.toLocaleString()} total logs</div>
        </div>

        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}

        <div className="overflow-visible rounded-lg border bg-card">
          <div className="hidden border-b bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[1.55fr_1fr_.8fr_.8fr_1.8fr_125px] lg:gap-3">
            <span>User</span><span>Action</span><span>Category</span><span>Division</span><span>Details</span><span>Time</span>
          </div>

          {loading ? (
            <div className="divide-y">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-14 animate-pulse bg-muted/10" />)}</div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-1 px-4 text-center">
              <FileText className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium">No action logs found</p>
              <p className="text-xs text-muted-foreground">Try changing your search or filters.</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const isExpanded = expanded === log.id
                const userMenuOpen = openUserMenu === log.id

                return (
                  <div key={log.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full text-left transition-colors hover:bg-muted/20"
                      onClick={() => { setExpanded((current) => current === log.id ? null : log.id); setOpenUserMenu(null) }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setExpanded((current) => current === log.id ? null : log.id)
                          setOpenUserMenu(null)
                        }
                      }}
                    >
                      <div className="grid gap-2 px-3 py-2.5 lg:grid-cols-[1.55fr_1fr_.8fr_.8fr_1.8fr_125px] lg:items-center lg:gap-3">
                        <div onClick={(event) => event.stopPropagation()}>
                          <UserIdentity
                            log={log}
                            profile={profiles[log.userId]}
                            open={userMenuOpen}
                            onOpen={() => setOpenUserMenu((current) => current === log.id ? null : log.id)}
                            onContextMenu={(event) => openContextMenu(event, log)}
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          <span className="truncate text-xs font-semibold sm:text-sm" title={actionLabel(log.action)}>{actionLabel(log.action)}</span>
                        </div>

                        <span className="w-fit rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{categoryLabel(log.category)}</span>
                        <span className="truncate text-xs text-muted-foreground">{divisionLabel(log.division)}</span>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-xs sm:text-sm" title={log.summary}>{log.summary}</p>
                          {log.targetName && <p className="mt-0.5 truncate text-[10px] text-blue-400">Target: {log.targetName}{log.targetRank ? ` · ${log.targetRank}` : ""}</p>}
                        </div>
                        <span className="text-[10px] text-muted-foreground lg:text-right">{formatDateTime(log.createdAt)}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/5 px-3 py-3">
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="rounded-md border bg-background/70 px-3 py-2">
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><UserRound className="h-3 w-3" /> Actor</div>
                            <div className="grid gap-0.5 text-xs">
                              <span><b>Display:</b> {profiles[log.userId]?.displayName || log.discordDisplayName || log.userName || "—"}</span>
                              <span><b>Username:</b> {(profiles[log.userId]?.username || log.discordUsername || log.username) ? `@${profiles[log.userId]?.username || log.discordUsername || log.username}` : "—"}</span>
                              <button type="button" className="w-fit font-mono text-[10px] text-blue-400 hover:text-blue-300" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(log.userId).then(() => toast.success("Discord ID copied")) }}>{log.userId}</button>
                            </div>
                          </div>

                          <div className="rounded-md border bg-background/70 px-3 py-2">
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Shield className="h-3 w-3" /> Action</div>
                            <div className="grid gap-0.5 text-xs">
                              <span><b>Action:</b> {actionLabel(log.action)}</span>
                              <span><b>Category:</b> {categoryLabel(log.category)} · <b>Division:</b> {divisionLabel(log.division)}</span>
                              <span className="truncate" title={log.path || ""}><b>Page:</b> {log.path || "—"}</span>
                            </div>
                          </div>

                          <div className="rounded-md border bg-background/70 px-3 py-2">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target</div>
                            <div className="grid gap-0.5 text-xs">
                              <span><b>Name:</b> {log.targetName || "—"}</span>
                              <span className="font-mono text-[10px] text-blue-400">{log.targetUserId || "—"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 rounded-md border bg-background/70 px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                          <p className="text-xs leading-5">{log.summary}</p>
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2 rounded-md border bg-background/70 px-3 py-2">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Additional Details</p>
                            <div className="grid max-h-44 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                              {Object.entries(log.details).map(([key, value]) => (
                                <div key={key} className="min-w-0 rounded border bg-muted/10 px-2 py-1.5">
                                  <p className="truncate text-[10px] font-medium text-muted-foreground">{actionLabel(key)}</p>
                                  <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4">{formatDetailValue(value)}</pre>
                                </div>
                              ))}
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
            <div className="flex items-center justify-between gap-3 border-t bg-muted/10 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} logs</span>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= pagination.pages} onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div className="fixed z-[100] min-w-[170px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => void copyContextId()}>
            <Clipboard className="h-4 w-4" />
            Copy User ID
          </button>
        </div>
      )}
    </DashboardLayout>
  )
}
