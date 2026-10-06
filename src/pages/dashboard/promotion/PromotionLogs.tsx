import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  FileInput,
  FileText,
  History,
  MousePointerClick,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Trash2,
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
  | "management"
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
  entryNumber?: number
  createdAt: string
  userId: string
  userName: string
  username: string
  rank: string
  callsign: string
  badgeNumber: string
  avatar?: string | null
  action: string
  module?: "promotion" | "activity" | string
  category: Exclude<Category, ""> | string
  division?: Exclude<Division, ""> | null
  targetUserId?: string | null
  targetName?: string | null
  targetRank?: string | null
  summary: string
  details?: Record<string, unknown> | null
  path?: string | null
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

const categoryOptions: Option[] = [
  { value: "", label: "All Categories" },
  { value: "roster", label: "Roster" },
  { value: "import", label: "Imports" },
  { value: "requirements", label: "Requirements" },
  { value: "navigation", label: "Navigation" },
  { value: "management", label: "Management" },
]

const divisionOptions: Option[] = [
  { value: "", label: "All Divisions" },
  { value: "department", label: "Department" },
  { value: "swat", label: "SWAT" },
  { value: "mtf7", label: "MTF-7" },
  { value: "mcd", label: "MCD" },
  { value: "tru", label: "TRU" },
  { value: "teu", label: "TEU" },
  { value: "sar", label: "SAR" },
]

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
  "copy-selected",
  "copy-discord-id",
  "copy-name",
  "copy-callsign",
  "copy-badge-number",
  "refresh-roster",
  "import-promotion",
  "save-requirements",
  "reset-requirements",
  "create-promotion-list",
  "submit-promotion-list",
  "delete-promotion-list",
  "edit-promotion",
  "promote-member",
  "demote-member",
]

const actionLabel = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const categoryLabel = (value: string) =>
  categoryOptions.find((item) => item.value === value)?.label ??
  actionLabel(value)

const divisionLabel = (value?: string | null) =>
  divisionOptions.find((item) => item.value === value)?.label ??
  (value ? actionLabel(value) : "—")

const formatDateTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const formatTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

const formatDateHeading = (value: string) => {
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

const formatDetailValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "—"
  }

  if (typeof value === "string") {
    return value
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
    const index = Number(BigInt(discordId) % 6n)
    return `https://cdn.discordapp.com/embed/avatars/${index}.png?size=128`
  } catch {
    return undefined
  }
}

const getAvatarUrl = (
  discordId: string,
  avatar?: string | null,
) => {
  if (!avatar) {
    return getDefaultAvatar(discordId)
  }

  if (
    avatar.startsWith("http://") ||
    avatar.startsWith("https://")
  ) {
    return avatar
  }

  if (avatar.startsWith("a_")) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.gif?size=128`
  }

  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`
}

const getActionIcon = (log: ActionLog) => {
  const value = `${log.action} ${log.category}`.toLowerCase()

  if (value.includes("copy") || value.includes("clipboard")) {
    return Clipboard
  }

  if (value.includes("select") || value.includes("selected")) {
    return MousePointerClick
  }

  if (value.includes("import")) {
    return FileInput
  }

  if (
    value.includes("delete") ||
    value.includes("remove") ||
    value.includes("reset")
  ) {
    return Trash2
  }

  if (
    value.includes("create") ||
    value.includes("add") ||
    value.includes("submit")
  ) {
    return PlusCircle
  }

  if (
    value.includes("edit") ||
    value.includes("change") ||
    value.includes("update") ||
    value.includes("promote") ||
    value.includes("demote")
  ) {
    return Pencil
  }

  if (value.includes("requirement")) {
    return ClipboardCheck
  }

  if (value.includes("management")) {
    return Settings2
  }

  if (value.includes("navigation") || value.includes("page")) {
    return History
  }

  return Activity
}

const getActionIconStyle = (log: ActionLog) => {
  const value = `${log.action} ${log.category}`.toLowerCase()

  if (
    value.includes("delete") ||
    value.includes("remove") ||
    value.includes("reset")
  ) {
    return "border-red-500/25 bg-red-500/10 text-red-400"
  }

  if (
    value.includes("create") ||
    value.includes("add") ||
    value.includes("submit") ||
    value.includes("promote")
  ) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
  }

  if (value.includes("copy")) {
    return "border-violet-500/25 bg-violet-500/10 text-violet-400"
  }

  if (value.includes("import")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-400"
  }

  return "border-blue-500/25 bg-blue-500/10 text-blue-400"
}

const getActionBadgeStyle = (log: ActionLog) => {
  const value = `${log.action} ${log.category}`.toLowerCase()

  if (
    value.includes("delete") ||
    value.includes("remove") ||
    value.includes("reset")
  ) {
    return "border-red-500/25 bg-red-500/10 text-red-400"
  }

  if (
    value.includes("create") ||
    value.includes("add") ||
    value.includes("submit") ||
    value.includes("promote")
  ) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
  }

  if (value.includes("copy")) {
    return "border-violet-500/25 bg-violet-500/10 text-violet-400"
  }

  if (value.includes("import")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-400"
  }

  return "border-blue-500/25 bg-blue-500/10 text-blue-400"
}

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  const text = await response.text()

  if (!text.trim()) {
    throw new Error(
      `Action logs API returned an empty response (${response.status}).`,
    )
  }

  try {
    return JSON.parse(text) as ApiResponse
  } catch {
    if (response.status === 404) {
      throw new Error(
        "The promotion action logs endpoint returned 404. The dashboard is now using /api/action-logs?module=promotion.",
      )
    }

    throw new Error(
      `Action logs API returned an invalid response (${response.status}).`,
    )
  }
}

function IdentityCard({
  name,
  username,
  userId,
  rank,
  callsign,
  badgeNumber,
  avatar,
  compact = false,
}: {
  name: string
  username?: string
  userId?: string
  rank?: string
  callsign?: string
  badgeNumber?: string
  avatar?: string | null
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, {
        description: value,
      })
    } catch {
      toast.error("Copy failed")
    }
  }

  const avatarUrl = userId
    ? getAvatarUrl(userId, avatar)
    : undefined

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        className={`group flex min-w-0 items-center gap-2 rounded-lg text-left transition-colors hover:bg-blue-500/5 ${
          compact ? "px-1.5 py-1" : "px-2 py-1.5"
        }`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <div
          className={`shrink-0 overflow-hidden rounded-full border border-border bg-muted ${
            compact ? "h-7 w-7" : "h-8 w-8"
          }`}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold">
              {getInitials(name)}
            </div>
          )}
        </div>

        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-blue-400">
            {name || "Unknown User"}
          </div>

          {username ? (
            <div className="truncate text-[10px] text-muted-foreground">
              @{username}
            </div>
          ) : null}
        </div>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[80] mt-1 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold">
              {name || "Unknown User"}
            </p>

            {username ? (
              <p className="truncate text-xs text-muted-foreground">
                @{username}
              </p>
            ) : null}

            {rank ? (
              <p className="mt-1 text-[10px] text-blue-400">
                {rank}
              </p>
            ) : null}
          </div>

          <div className="grid gap-0.5 p-1">
            {userId ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => void copy(userId, "Discord ID")}
              >
                <Clipboard className="h-3.5 w-3.5 text-blue-400" />
                Copy Discord ID
              </button>
            ) : null}

            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
              onClick={() => void copy(name, "Name")}
            >
              <UserRound className="h-3.5 w-3.5 text-blue-400" />
              Copy Name
            </button>

            {callsign ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => void copy(callsign, "Callsign")}
              >
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                Copy Callsign
              </button>
            ) : null}

            {badgeNumber ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => void copy(badgeNumber, "Badge number")}
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-blue-400" />
                Copy Badge Number
              </button>
            ) : null}

            {rank ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => void copy(rank, "Rank")}
              >
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                Copy Rank
              </button>
            ) : null}

            {name && userId ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() =>
                  void copy(
                    `${name} (${userId})`,
                    "Name + Discord ID",
                  )
                }
              >
                <Clipboard className="h-3.5 w-3.5 text-blue-400" />
                Name + Discord ID
              </button>
            ) : null}

            {callsign && name ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() =>
                  void copy(
                    `${callsign} | ${name}`,
                    "Callsign + Name",
                  )
                }
              >
                <Clipboard className="h-3.5 w-3.5 text-blue-400" />
                Callsign + Name
              </button>
            ) : null}

            {badgeNumber && name ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() =>
                  void copy(
                    `${badgeNumber} | ${name}`,
                    "Badge number + Name",
                  )
                }
              >
                <Clipboard className="h-3.5 w-3.5 text-blue-400" />
                Badge Number + Name
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TargetIdentity({ log }: { log: ActionLog }) {
  const details = log.details ?? {}

  const targetName =
    log.targetName ||
    String(
      details.targetDisplayName ??
        details.targetName ??
        details.name ??
        "",
    ).trim()

  const targetUserId =
    log.targetUserId ||
    String(
      details.targetDiscordId ??
        details.targetUserId ??
        details.discordId ??
        "",
    ).trim()

  const targetRank =
    log.targetRank ||
    String(details.targetRank ?? "").trim()

  const targetCallsign = String(
    details.targetCallsign ??
      details.callsign ??
      "",
  ).trim()

  const targetBadge = String(
    details.targetBadgeNumber ??
      details.badgeNumber ??
      "",
  ).trim()

  const targetAvatar = String(
    details.targetAvatar ?? "",
  ).trim()

  if (!targetName && !targetUserId) {
    return (
      <span className="text-xs text-muted-foreground">
        —
      </span>
    )
  }

  return (
    <IdentityCard
      name={targetName || targetUserId}
      userId={targetUserId || undefined}
      rank={targetRank || undefined}
      callsign={targetCallsign || undefined}
      badgeNumber={targetBadge || undefined}
      avatar={targetAvatar || undefined}
      compact
    />
  )
}

function DetailItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/60 px-3 py-2.5">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0 text-xs">{children}</div>
    </div>
  )
}


function FilterDropdown({
  value,
  placeholder,
  options,
  onChange,
  width = "w-[180px]",
}: {
  value: string
  placeholder: string
  options: Option[]
  onChange: (value: string) => void
  width?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const close = () => setOpen(false)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [open])

  const selected = options.find((option) => option.value === value)

  return (
    <div className={`relative ${width}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-left text-[12px] text-foreground outline-none transition-colors hover:border-blue-500/40 focus:border-blue-500/60"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-[100] max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${active ? "bg-blue-500/10 text-blue-400" : "text-foreground hover:bg-accent"}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="truncate">{option.label}</span>
                {active ? <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function PromotionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<Category>("")
  const [division, setDivision] = useState<Division>("")
  const [userId, setUserId] = useState("")
  const [action, setAction] = useState("")
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  })

  const [availableActions, setAvailableActions] =
    useState<string[]>(fallbackActions)

  const hasFilters = Boolean(
    search.trim() ||
      category ||
      division ||
      userId ||
      action ||
      from ||
      to,
  )

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        module: "promotion",
      })

      if (search.trim()) {
        params.set("search", search.trim())
      }

      if (category) {
        params.set("category", category)
      }

      if (division) {
        params.set("division", division)
      }

      if (userId) {
        params.set("userId", userId)
      }

      if (action) {
        params.set("action", action)
      }

      if (from) {
        params.set("from", `${from}T00:00:00.000Z`)
      }

      if (to) {
        params.set("to", `${to}T23:59:59.999Z`)
      }

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

      const data = await readApiResponse(response)

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error ||
            `Failed to load promotion action logs (${response.status}).`,
        )
      }

      const incoming = Array.isArray(data.logs)
        ? data.logs
        : []

      const nextLogs: ActionLog[] = []

      for (const log of incoming) {
        const previous =
          nextLogs[nextLogs.length - 1]

        const sameEvent =
          previous &&
          previous.userId === log.userId &&
          previous.action === log.action &&
          previous.category === log.category &&
          previous.division === log.division &&
          previous.targetUserId ===
            log.targetUserId &&
          previous.targetName === log.targetName &&
          previous.summary === log.summary &&
          Math.abs(
            new Date(previous.createdAt).getTime() -
              new Date(log.createdAt).getTime(),
          ) <= 3000

        if (!sameEvent) {
          nextLogs.push(log)
        }
      }

      setLogs(nextLogs)

      setPagination(
        data.pagination ?? {
          page,
          limit: 50,
          total: nextLogs.length,
          pages: 1,
        },
      )

      setAvailableActions((current) =>
        Array.from(
          new Set([
            ...fallbackActions,
            ...current,
            ...nextLogs.map((log) => log.action),
          ]),
        ).sort(),
      )
    } catch (err) {
      setLogs([])
      setPagination({
        page: 1,
        limit: 50,
        total: 0,
        pages: 1,
      })

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load promotion action logs.",
      )
    } finally {
      setLoading(false)
    }
  }, [
    page,
    search,
    category,
    division,
    userId,
    action,
    from,
    to,
  ])

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadLogs()
      },
      search ? 250 : 0,
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadLogs, search])

  useEffect(() => {
    const closeMenus = () => {
      // Identity menus are self-contained.
    }

    window.addEventListener("scroll", closeMenus, true)

    return () => {
      window.removeEventListener(
        "scroll",
        closeMenus,
        true,
      )
    }
  }, [])

  const actionOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...fallbackActions,
          ...availableActions,
        ]),
      ).sort(),
    [availableActions],
  )

  const clearFilters = () => {
    setSearch("")
    setCategory("")
    setDivision("")
    setUserId("")
    setAction("")
    setFrom("")
    setTo("")
    setPage(1)
    setExpanded(null)
    setAdvancedFiltersOpen(false)
  }

  const changeFilter = <T,>(
    setter: (value: T) => void,
    value: T,
  ) => {
    setter(value)
    setPage(1)
    setExpanded(null)
  }

  const groupedLogs = useMemo(() => {
    const groups: Array<{
      key: string
      label: string
      logs: ActionLog[]
    }> = []

    for (const log of logs) {
      const date = new Date(log.createdAt)
      const key = Number.isNaN(date.getTime())
        ? "unknown"
        : date.toISOString().slice(0, 10)

      const existing = groups.find(
        (group) => group.key === key,
      )

      if (existing) {
        existing.logs.push(log)
      } else {
        groups.push({
          key,
          label: formatDateHeading(log.createdAt),
          logs: [log],
        })
      }
    }

    return groups
  }, [logs])

  return (
    <DashboardLayout>
      <div className="flex min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-5">
        {/* Compact reference-style controls */}
        <div className="mx-auto w-full max-w-[760px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="rounded-lg border border-blue-500/60 bg-blue-500/10 px-3 py-1.5 text-[12px] font-medium text-blue-400 shadow-sm">
              Promotion Logs
            </button>
            <button
              type="button"
              aria-expanded={advancedFiltersOpen}
              onClick={() => setAdvancedFiltersOpen((current) => !current)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                advancedFiltersOpen
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                More filters
                <ChevronDown className={`h-3 w-3 transition-transform ${advancedFiltersOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            <button type="button" className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground" onClick={() => void loadLogs()} disabled={loading}>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </span>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={userId}
              placeholder="Anyone"
              options={[
                { value: "", label: "Anyone" },
                ...Array.from(
                  new Map(
                    logs
                      .filter((log) => log.userId)
                      .map((log) => [
                        log.userId,
                        {
                          value: log.userId,
                          label: log.userName || log.username || log.userId,
                        },
                      ]),
                  ).values(),
                ),
              ]}
              onChange={(value) => changeFilter(setUserId, value)}
            />

            <FilterDropdown
              value={action}
              placeholder="All actions"
              options={[
                { value: "", label: "All actions" },
                ...actionOptions.map((item) => ({
                  value: item,
                  label: actionLabel(item),
                })),
              ]}
              onChange={(value) => changeFilter(setAction, value)}
            />

            <span className="ml-auto text-[11px] text-muted-foreground">
              {pagination.total.toLocaleString()} changes
            </span>
          </div>

          {(advancedFiltersOpen || hasFilters) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} placeholder="Search..." className="h-8 w-[220px] border-border bg-card pl-8 text-[11px]" />
              </div>
              <FilterDropdown
                value={category}
                placeholder="All Categories"
                options={categoryOptions}
                onChange={(value) => changeFilter(setCategory, value as Category)}
                width="w-[150px]"
              />
              <FilterDropdown
                value={division}
                placeholder="All Divisions"
                options={divisionOptions}
                onChange={(value) => changeFilter(setDivision, value as Division)}
                width="w-[150px]"
              />
              <Input type="date" value={from} onChange={(event) => changeFilter(setFrom, event.target.value)} className="h-8 w-[130px] text-[11px]" />
              <Input type="date" value={to} onChange={(event) => changeFilter(setTo, event.target.value)} className="h-8 w-[130px] text-[11px]" />
              <button type="button" onClick={clearFilters} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[11px] text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {/* Log timeline */}
        <div className="mx-auto w-full max-w-[760px] min-w-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[76px] animate-pulse rounded-xl border border-border bg-card/70"
                />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-border bg-card px-4 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>

              <p className="text-sm font-medium">
                No promotion action logs found
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedLogs.map((group) => (
                <section key={group.key}>
                  <div className="mb-2 flex items-center gap-2 px-0">
                    <span className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
                      {group.label}
                    </span>

                    <div className="h-px flex-1 bg-border" />

                    <span className="text-[10px] text-muted-foreground">
                      {group.logs.length}{" "}
                      {group.logs.length === 1
                        ? "change"
                        : "changes"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.logs.map((log, index) => {
                      const isExpanded =
                        expanded === log.id

                      const actorName =
                        log.userName ||
                        log.username ||
                        log.userId ||
                        "Unknown User"

                      const Action = getActionIcon(log)

                      const entryNumber =
                        log.entryNumber ??
                        (pagination.page - 1) *
                          pagination.limit +
                          index +
                          1

                      return (
                        <div
                          key={
                            log.id ||
                            `${log.createdAt}-${log.userId}-${index}`
                          }
                          className={`overflow-visible rounded-lg border bg-card/70 transition-all ${
                            isExpanded
                              ? "border-blue-500/30 shadow-sm shadow-blue-950/20"
                              : "border-border hover:border-blue-500/20"
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() =>
                              setExpanded(
                                isExpanded
                                  ? null
                                  : log.id,
                              )
                            }
                          >
                            <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
                              {/* Entry */}
                              <div className="hidden w-8 shrink-0 items-center gap-1 sm:flex">
                                <span className="font-mono text-[10px] font-medium text-muted-foreground">
                                  #{entryNumber}
                                </span>
                              </div>

                              {/* Action icon */}
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${getActionIconStyle(
                                  log,
                                )}`}
                              >
                                <Action className="h-4 w-4" />
                              </div>

                              {/* Main event */}
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="truncate text-xs font-semibold sm:text-sm">
                                    {actionLabel(
                                      log.action,
                                    )}
                                  </span>

                                  {log.targetName ||
                                  log.targetUserId ? (
                                    <>
                                      <span className="text-muted-foreground">
                                        ·
                                      </span>
                                      <span className="truncate text-xs text-foreground/80 sm:text-sm">
                                        {log.targetName ||
                                          log.targetUserId}
                                      </span>
                                    </>
                                  ) : null}
                                </div>

                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground sm:text-[11px]">
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    <UserRound className="h-3 w-3 shrink-0" />
                                    <span className="truncate">
                                      {actorName}
                                    </span>
                                  </span>

                                  <span>·</span>

                                  <span>
                                    {formatTime(
                                      log.createdAt,
                                    )}
                                  </span>

                                  <span>·</span>

                                  <span className="truncate">
                                    {categoryLabel(
                                      log.category,
                                    )}
                                  </span>

                                  {log.division ? (
                                    <>
                                      <span>·</span>
                                      <span className="text-blue-400">
                                        {divisionLabel(
                                          log.division,
                                        )}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              {/* Status/action badge */}
                              <span
                                className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${getActionBadgeStyle(
                                  log,
                                )}`}
                              >
                                {actionLabel(log.action)}
                              </span>

                              <div className="flex shrink-0 items-center gap-2">
                                <span className="hidden text-[10px] text-muted-foreground md:block">
                                  {formatDateTime(
                                    log.createdAt,
                                  )}
                                </span>

                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            {/* Summary */}
                            {log.summary ? (
                              <div className="border-t border-border/60 px-3 pb-3 pt-2 sm:px-[68px]">
                                <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                                  {log.summary}
                                </p>
                              </div>
                            ) : null}
                          </button>

                          {/* Expanded details */}
                          {isExpanded ? (
                            <div className="border-t border-border bg-muted/[0.035] px-3 py-3">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold">
                                    Change details
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    Full audit information for this entry.
                                  </p>
                                </div>

                                <span className="font-mono text-[10px] text-muted-foreground">
                                  Entry #{entryNumber}
                                </span>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailItem label="Changed By">
                                  <IdentityCard
                                    name={actorName}
                                    username={log.username}
                                    userId={log.userId}
                                    rank={log.rank}
                                    callsign={
                                      log.callsign
                                    }
                                    badgeNumber={
                                      log.badgeNumber
                                    }
                                    avatar={log.avatar}
                                  />
                                </DetailItem>

                                <DetailItem label="Action">
                                  <div className="grid gap-1 text-xs">
                                    <span>
                                      <b>Action:</b>{" "}
                                      {actionLabel(
                                        log.action,
                                      )}
                                    </span>
                                    <span>
                                      <b>Category:</b>{" "}
                                      {categoryLabel(
                                        log.category,
                                      )}
                                    </span>
                                    <span>
                                      <b>Division:</b>{" "}
                                      {divisionLabel(
                                        log.division,
                                      )}
                                    </span>
                                    <span className="truncate">
                                      <b>Page:</b>{" "}
                                      {log.path || "—"}
                                    </span>
                                  </div>
                                </DetailItem>

                                <DetailItem label="Changed">
                                  <TargetIdentity log={log} />

                                  {log.targetRank ? (
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                      Rank:{" "}
                                      <span className="text-foreground">
                                        {log.targetRank}
                                      </span>
                                    </p>
                                  ) : null}

                                  {log.targetUserId ? (
                                    <p className="mt-1 truncate font-mono text-[9px] text-blue-400/70">
                                      {log.targetUserId}
                                    </p>
                                  ) : null}
                                </DetailItem>

                                <DetailItem label="Recorded">
                                  <p className="font-medium">
                                    {formatDateTime(
                                      log.createdAt,
                                    )}
                                  </p>

                                  {log.entryNumber ? (
                                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                      Entry #{log.entryNumber}
                                    </p>
                                  ) : null}
                                </DetailItem>
                              </div>

                              <div className="mt-2 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Summary
                                </p>

                                <p className="text-xs leading-5">
                                  {log.summary ||
                                    "No summary available."}
                                </p>
                              </div>

                              {log.details &&
                              Object.keys(log.details)
                                .length > 0 ? (
                                <div className="mt-2 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Additional Details
                                  </p>

                                  <div className="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                                    {Object.entries(
                                      log.details,
                                    ).map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className="min-w-0 rounded-md border border-border bg-muted/10 px-2.5 py-2"
                                        >
                                          <p className="truncate text-[10px] font-medium text-muted-foreground">
                                            {actionLabel(
                                              key,
                                            )}
                                          </p>

                                          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4">
                                            {formatDetailValue(
                                              value,
                                            )}
                                          </pre>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {log.path ? (
                                <p className="mt-2 break-all border-t border-border pt-2 text-[10px] text-muted-foreground">
                                  {log.path}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 ? (
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              Page {pagination.page} of{" "}
              {pagination.pages} ·{" "}
              {pagination.total.toLocaleString()} logs
            </span>

            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={page <= 1 || loading}
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
                className="h-8 px-3 text-xs"
                disabled={
                  page >= pagination.pages || loading
                }
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
        ) : null}
      </div>
    </DashboardLayout>
  )
}
