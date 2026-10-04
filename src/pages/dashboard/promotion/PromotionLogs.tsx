import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  Copy,
  FileInput,
  FileText,
  Filter,
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
  categoryOptions.find((item) => item.value === value)?.label ?? actionLabel(value)

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

  if (
    value.includes("copy") ||
    value.includes("clipboard")
  ) {
    return Copy
  }

  if (
    value.includes("select") ||
    value.includes("selected")
  ) {
    return MousePointerClick
  }

  if (
    value.includes("import")
  ) {
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

  if (
    value.includes("requirement")
  ) {
    return ClipboardCheck
  }

  if (
    value.includes("management")
  ) {
    return Settings2
  }

  if (
    value.includes("navigation") ||
    value.includes("page")
  ) {
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
    return "border-red-500/20 bg-red-500/10 text-red-400"
  }

  if (
    value.includes("create") ||
    value.includes("add") ||
    value.includes("submit") ||
    value.includes("promote")
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
  }

  if (
    value.includes("copy")
  ) {
    return "border-violet-500/20 bg-violet-500/10 text-violet-400"
  }

  if (
    value.includes("import")
  ) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-400"
  }

  return "border-blue-500/20 bg-blue-500/10 text-blue-400"
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

  const copy = async (
    value: string,
    label: string,
  ) => {
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
        className={`flex min-w-0 items-center gap-2 rounded-md text-left transition-colors hover:bg-muted/50 ${
          compact ? "px-1 py-0.5" : "px-1.5 py-1"
        }`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <div
          className={`shrink-0 overflow-hidden rounded-full border bg-muted ${
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
          <div className="truncate text-sm font-medium text-blue-400">
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
          className="absolute left-0 top-full z-[70] mt-1 w-60 rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b px-3 py-2">
            <p className="truncate text-sm font-semibold">
              {name || "Unknown User"}
            </p>

            {username ? (
              <p className="truncate text-xs text-muted-foreground">
                @{username}
              </p>
            ) : null}
          </div>

          <div className="grid gap-0.5 p-1">
            {userId ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() => void copy(userId, "Discord ID")}
              >
                <Clipboard className="h-3.5 w-3.5 text-blue-400" />
                Copy Discord ID
              </button>
            ) : null}

            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
              onClick={() => void copy(name, "Name")}
            >
              <UserRound className="h-3.5 w-3.5 text-blue-400" />
              Copy Name
            </button>

            {callsign ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() => void copy(callsign, "Callsign")}
              >
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                Copy Callsign
              </button>
            ) : null}

            {badgeNumber ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() => void copy(badgeNumber, "Badge number")}
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-blue-400" />
                Copy Badge Number
              </button>
            ) : null}

            {rank ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() => void copy(rank, "Rank")}
              >
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                Copy Rank
              </button>
            ) : null}

            {name && userId ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() =>
                  void copy(
                    `${name} (${userId})`,
                    "Name + Discord ID",
                  )
                }
              >
                <Copy className="h-3.5 w-3.5 text-blue-400" />
                Name + Discord ID
              </button>
            ) : null}

            {callsign && name ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() =>
                  void copy(
                    `${callsign} | ${name}`,
                    "Callsign + Name",
                  )
                }
              >
                <Copy className="h-3.5 w-3.5 text-blue-400" />
                Callsign + Name
              </button>
            ) : null}

            {badgeNumber && name ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                onClick={() =>
                  void copy(
                    `${badgeNumber} | ${name}`,
                    "Badge number + Name",
                  )
                }
              >
                <Copy className="h-3.5 w-3.5 text-blue-400" />
                Badge Number + Name
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TargetIdentity({
  log,
}: {
  log: ActionLog
}) {
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

function ActionIcon({
  log,
}: {
  log: ActionLog
}) {
  const Icon = getActionIcon(log)

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${getActionIconStyle(
        log,
      )}`}
      title={actionLabel(log.action)}
    >
      <Icon className="h-4 w-4" />
    </div>
  )
}

export default function ActionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<Category>("")
  const [division, setDivision] = useState<Division>("")
  const [action, setAction] = useState("")
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

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

        // IMPORTANT:
        // The working endpoint is /api/action-logs.
        // Promotion logs are selected through the module query.
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

      if (action) {
        params.set("action", action)
      }

      if (from) {
        params.set(
          "from",
          `${from}T00:00:00.000Z`,
        )
      }

      if (to) {
        params.set(
          "to",
          `${to}T23:59:59.999Z`,
        )
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
            new Date(
              previous.createdAt,
            ).getTime() -
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
            ...nextLogs.map(
              (log) => log.action,
            ),
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
      // Identity menus are self-contained and close when
      // their parent is clicked again.
    }

    window.addEventListener(
      "scroll",
      closeMenus,
      true,
    )

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
    setAction("")
    setFrom("")
    setTo("")
    setPage(1)
    setExpanded(null)
  }

  const changeFilter = <T,>(
    setter: (value: T) => void,
    value: T,
  ) => {
    setter(value)
    setPage(1)
    setExpanded(null)
  }

  return (
    <DashboardLayout>
      <div className="flex min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-5">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Promotion Action Logs
              </h1>

              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Promotion Management audit history.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 self-start"
            onClick={() => void loadLogs()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-blue-500" />
              Filters
            </div>

            <span className="text-[11px] text-muted-foreground">
              {hasFilters
                ? `${[
                    search.trim(),
                    category,
                    division,
                    action,
                    from,
                    to,
                  ].filter(Boolean).length} active`
                : "None"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 md:min-w-[280px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) =>
                  changeFilter(
                    setSearch,
                    event.target.value,
                  )
                }
                placeholder="Search users, actions, IDs, targets..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Category */}
            <select
              value={category}
              onChange={(event) =>
                changeFilter(
                  setCategory,
                  event.target.value as Category,
                )
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {categoryOptions.map((item) => (
                <option
                  key={item.value || "all"}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            {/* Division */}
            <select
              value={division}
              onChange={(event) =>
                changeFilter(
                  setDivision,
                  event.target.value as Division,
                )
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {divisionOptions.map((item) => (
                <option
                  key={item.value || "all"}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            {/* Action */}
            <select
              value={action}
              onChange={(event) =>
                changeFilter(
                  setAction,
                  event.target.value,
                )
              }
              className="h-8 max-w-[190px] rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">
                All Actions
              </option>

              {actionOptions.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {actionLabel(item)}
                </option>
              ))}
            </select>

            {/* From */}
            <Input
              type="date"
              value={from}
              onChange={(event) =>
                changeFilter(
                  setFrom,
                  event.target.value,
                )
              }
              className="h-8 w-[130px] text-xs"
            />

            {/* To */}
            <Input
              type="date"
              value={to}
              onChange={(event) =>
                changeFilter(
                  setTo,
                  event.target.value,
                )
              }
              className="h-8 w-[130px] text-xs"
            />

            {/* Clear is on the right of all filters */}
            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          <div className="mt-2 text-[11px] text-muted-foreground">
            {pagination.total.toLocaleString()} total
            logs
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {/* Logs */}
        <div className="overflow-visible rounded-lg border bg-card">
          {/* Desktop headings */}
          <div className="hidden border-b bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[55px_1.45fr_50px_1fr_.75fr_.75fr_1.5fr_125px] lg:items-center lg:gap-3">
            <span>Entry</span>
            <span />
            <span>Icon</span>
            <span>Changed By</span>
            <span>Action</span>
            <span>Division</span>
            <span>Target</span>
            <span>Time</span>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 7 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse bg-muted/10"
                  />
                ),
              )}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-1 px-4 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />

              <p className="text-sm font-medium">
                No promotion action logs found
              </p>

              <p className="text-xs text-muted-foreground">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log, index) => {
                const isExpanded =
                  expanded === log.id

                const actorName =
                  log.userName ||
                  log.username ||
                  log.userId ||
                  "Unknown User"

                return (
                  <div
                    key={
                      log.id ||
                      `${log.createdAt}-${log.userId}-${index}`
                    }
                    className="relative"
                  >
                    <button
                      type="button"
                      className="w-full text-left transition-colors hover:bg-muted/20"
                      onClick={() =>
                        setExpanded(
                          isExpanded
                            ? null
                            : log.id,
                        )
                      }
                    >
                      <div className="grid gap-2 px-3 py-2.5 lg:grid-cols-[55px_1.45fr_50px_1fr_.75fr_.75fr_1.5fr_125px] lg:items-center lg:gap-3">
                        {/* Entry */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {log.entryNumber ??
                              (pagination.page -
                                1) *
                                pagination.limit +
                                index +
                                1}
                          </span>

                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Mobile / desktop actor */}
                        <div
                          className="min-w-0"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <IdentityCard
                            name={actorName}
                            username={
                              log.username
                            }
                            userId={log.userId}
                            rank={log.rank}
                            callsign={
                              log.callsign
                            }
                            badgeNumber={
                              log.badgeNumber
                            }
                            avatar={log.avatar}
                            compact
                          />
                        </div>

                        {/* Action icon */}
                        <div className="flex">
                          <ActionIcon log={log} />
                        </div>

                        {/* Changed by */}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium sm:text-sm">
                            {actorName}
                          </p>

                          <p className="truncate text-[10px] text-muted-foreground">
                            {log.rank ||
                              "Rank unavailable"}
                          </p>
                        </div>

                        {/* Action */}
                        <div className="min-w-0">
                          <span className="truncate text-xs font-semibold sm:text-sm">
                            {actionLabel(
                              log.action,
                            )}
                          </span>
                        </div>

                        {/* Division */}
                        <span className="w-fit truncate rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                          {divisionLabel(
                            log.division,
                          )}
                        </span>

                        {/* Target */}
                        <div
                          className="min-w-0"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Changed
                          </div>

                          <TargetIdentity
                            log={log}
                          />
                        </div>

                        {/* Time */}
                        <span className="text-[10px] text-muted-foreground lg:text-right">
                          {formatDateTime(
                            log.createdAt,
                          )}
                        </span>
                      </div>

                      {/* Summary row */}
                      <div className="px-3 pb-2 lg:pl-[108px] lg:pr-4">
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {log.summary}
                        </p>
                      </div>
                    </button>

                    {/* Expanded */}
                    {isExpanded ? (
                      <div className="border-t bg-muted/5 px-3 py-3">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {/* Actor */}
                          <div className="rounded-md border bg-background/70 px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <UserRound className="h-3 w-3" />
                              Changed By
                            </div>

                            <IdentityCard
                              name={actorName}
                              username={
                                log.username
                              }
                              userId={
                                log.userId
                              }
                              rank={
                                log.rank
                              }
                              callsign={
                                log.callsign
                              }
                              badgeNumber={
                                log.badgeNumber
                              }
                              avatar={
                                log.avatar
                              }
                            />
                          </div>

                          {/* Action */}
                          <div className="rounded-md border bg-background/70 px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <Activity className="h-3 w-3" />
                              Action
                            </div>

                            <div className="grid gap-1 text-xs">
                              <span>
                                <b>
                                  Action:
                                </b>{" "}
                                {actionLabel(
                                  log.action,
                                )}
                              </span>

                              <span>
                                <b>
                                  Category:
                                </b>{" "}
                                {categoryLabel(
                                  log.category,
                                )}
                              </span>

                              <span>
                                <b>
                                  Division:
                                </b>{" "}
                                {divisionLabel(
                                  log.division,
                                )}
                              </span>

                              <span className="truncate">
                                <b>
                                  Page:
                                </b>{" "}
                                {log.path ||
                                  "—"}
                              </span>
                            </div>
                          </div>

                          {/* Target */}
                          <div className="rounded-md border bg-background/70 px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <Shield className="h-3 w-3" />
                              Changed
                            </div>

                            <TargetIdentity
                              log={log}
                            />

                            {log.targetRank ? (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                Rank:{" "}
                                <span className="text-foreground">
                                  {
                                    log.targetRank
                                  }
                                </span>
                              </p>
                            ) : null}

                            {log.targetUserId ? (
                              <p className="mt-1 truncate font-mono text-[9px] text-blue-400/70">
                                {
                                  log.targetUserId
                                }
                              </p>
                            ) : null}
                          </div>

                          {/* Recorded */}
                          <div className="rounded-md border bg-background/70 px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <History className="h-3 w-3" />
                              Recorded
                            </div>

                            <p className="text-xs font-medium">
                              {formatDateTime(
                                log.createdAt,
                              )}
                            </p>

                            {log.entryNumber ? (
                              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                Entry #
                                {
                                  log.entryNumber
                                }
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="mt-2 rounded-md border bg-background/70 px-3 py-2.5">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Summary
                          </p>

                          <p className="text-xs leading-5">
                            {log.summary ||
                              "No summary available."}
                          </p>
                        </div>

                        {/* Details */}
                        {log.details &&
                        Object.keys(
                          log.details,
                        ).length > 0 ? (
                          <div className="mt-2 rounded-md border bg-background/70 px-3 py-2.5">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Additional Details
                            </p>

                            <div className="grid max-h-56 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                              {Object.entries(
                                log.details,
                              ).map(
                                ([
                                  key,
                                  value,
                                ]) => (
                                  <div
                                    key={key}
                                    className="min-w-0 rounded border bg-muted/10 px-2 py-1.5"
                                  >
                                    <p className="truncate text-[10px] font-medium text-muted-foreground">
                                      {actionLabel(
                                        key,
                                      )}
                                    </p>

                                    <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4">
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
          )}

          {/* Pagination */}
          {!loading &&
          logs.length > 0 ? (
            <div className="flex flex-col gap-2 border-t bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] text-muted-foreground">
                Page{" "}
                {pagination.page} of{" "}
                {pagination.pages} ·{" "}
                {pagination.total.toLocaleString()}{" "}
                logs
              </span>

              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={
                    page <= 1 || loading
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.max(
                        1,
                        current - 1,
                      ),
                    )
                  }
                >
                  Previous
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={
                    page >=
                      pagination.pages ||
                    loading
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
      </div>
    </DashboardLayout>
  )
}
