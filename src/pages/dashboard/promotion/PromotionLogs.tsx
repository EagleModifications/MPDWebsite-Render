import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  Check,
  FileInput,
  FileText,
  Filter,
  History,
  MousePointerClick,
  Pencil,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { getSession } from "@/lib/auth"
import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

type LogModule = "all" | "promotion" | "activity"

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

type RosterMember = {
  discordId: string
  name: string
  rank?: string
  callsign?: string
  badgeNumber?: string
  avatar?: string | null
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

const detailLabel = (key: string) => {
  const labels: Record<string, string> = {
    count: "Count",
    hours: "Hours",
    requiredHours: "Required Hours",
    promotionHours: "Promotion Hours",
    timeInRankDays: "Time In Rank",
    requiredTimeInRankDays: "Required Time In Rank",
    trainingLogs: "Training Logs",
    requiredTrainingLogs: "Required Training Logs",
    recruitmentLogs: "Recruitment Logs",
    requiredRecruitmentLogs: "Required Recruitment Logs",
    requiredLogs: "Required Logs",
    status: "Status",
    rank: "Rank",
    targetRank: "Target Rank",
    division: "Division",
    category: "Category",
    action: "Action",
    page: "Page",
    reason: "Reason",
    note: "Note",
    notes: "Notes",
  }

  return labels[key] ?? actionLabel(key)
}

const formatDetailValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map((item) => formatDetailValue(item)).join(", ")
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${detailLabel(key)}: ${formatDetailValue(item)}`)
      .join(" · ")
  }
  return String(value)
}

const getDetailEntries = (log: ActionLog) => {
  const details = log.details ?? {}
  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null)

  // Keep requirement changes easy to scan: show the important requirement
  // values in a predictable order rather than dumping the raw JSON object.
  const requirementOrder = [
    "requiredHours",
    "promotionHours",
    "requiredTimeInRankDays",
    "timeInRankDays",
    "requiredTrainingLogs",
    "trainingLogs",
    "requiredRecruitmentLogs",
    "recruitmentLogs",
    "requiredLogs",
    "hours",
    "count",
  ]

  if (log.category === "requirements" || log.action.toLowerCase().includes("requirement")) {
    return entries.sort(([a], [b]) => {
      const ai = requirementOrder.indexOf(a)
      const bi = requirementOrder.indexOf(b)
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    })
  }

  return entries
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
  const cleanAvatar = avatar?.trim()

  if (!cleanAvatar || !discordId) {
    return getDefaultAvatar(discordId)
  }

  if (cleanAvatar.startsWith("http://") || cleanAvatar.startsWith("https://")) {
    const match = cleanAvatar.match(/\/avatars\/(\d+)\/([^/?#]+)/i)

    if (match) {
      const [, id, hashWithExtension] = match
      const hash = hashWithExtension.replace(/\.(gif|webp|png|jpg|jpeg)$/i, "")

      if (hash.startsWith("a_")) {
        return `https://cdn.discordapp.com/avatars/${id}/${hash}.gif?size=256`
      }

      return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=256`
    }

    return cleanAvatar
  }

  const hash = cleanAvatar.replace(/\.(gif|webp|png|jpg|jpeg)$/i, "")

  if (hash.startsWith("a_")) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.gif?size=256`
  }

  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=256`
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
  const [avatarFailed, setAvatarFailed] = useState(false)

  const avatarUrl = userId
    ? getAvatarUrl(userId, avatar)
    : undefined

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, { description: value })
    } catch {
      toast.error("Copy failed")
    }
  }

  const copy = (type: string) => {
    const safeName = name || "Unknown User"
    const values: Record<string, string> = {
      discord: userId || "",
      "discord-mention": userId ? `<@${userId}>` : "",
      name: safeName,
      callsign: callsign || "",
      badge: badgeNumber || "",
      rank: rank || "",
      "name-discord": userId ? `${safeName} (${userId})` : safeName,
      "callsign-discord": callsign && userId ? `${callsign} | ${userId}` : "",
      "callsign-name": callsign && safeName ? `${callsign} | ${safeName}` : "",
      "callsign-badge": callsign && badgeNumber ? `${callsign} | ${badgeNumber}` : "",
      "badge-name": badgeNumber && safeName ? `${badgeNumber} | ${safeName}` : "",
      "badge-discord": badgeNumber && userId ? `${badgeNumber} | ${userId}` : "",
      "callsign-name-discord": callsign && safeName && userId ? `${callsign} | ${safeName} | ${userId}` : "",
      "callsign-badge-discord": callsign && badgeNumber && userId ? `${callsign} | ${badgeNumber} | ${userId}` : "",
      "name-badge-discord": safeName && badgeNumber && userId ? `${safeName} | ${badgeNumber} | ${userId}` : "",
      "callsign-badge-name": callsign && badgeNumber && safeName ? `${callsign} | ${badgeNumber} | ${safeName}` : "",
      "callsign-badge-name-discord": callsign && badgeNumber && safeName && userId ? `${callsign} | ${badgeNumber} | ${safeName} | ${userId}` : "",
      "name-rank-discord": safeName && rank && userId ? `${safeName} | ${rank} | ${userId}` : "",
      full: [
        callsign && `Callsign: ${callsign}`,
        badgeNumber && `Badge: ${badgeNumber}`,
        safeName && `Name: ${safeName}`,
        rank && `Rank: ${rank}`,
        userId && `Discord: ${userId}`,
      ].filter(Boolean).join(" | "),
    }

    const labels: Record<string, string> = {
      discord: "Discord ID",
      "discord-mention": "Discord Mention",
      name: "Name",
      callsign: "Callsign",
      badge: "Badge Number",
      rank: "Rank",
      "name-discord": "Name + Discord",
      "callsign-discord": "Callsign + Discord",
      "callsign-name": "Callsign + Name",
      "callsign-badge": "Callsign + Badge",
      "badge-name": "Badge + Name",
      "badge-discord": "Badge + Discord",
      "callsign-name-discord": "Callsign + Name + Discord",
      "callsign-badge-discord": "Callsign + Badge + Discord",
      "name-badge-discord": "Name + Badge + Discord",
      "callsign-badge-name": "Callsign + Badge + Name",
      "callsign-badge-name-discord": "Callsign + Badge + Name + Discord",
      "name-rank-discord": "Name + Rank + Discord",
      full: "Full Details",
    }

    const value = values[type]
    if (!value) return
    void copyValue(value, labels[type] || "Details")
  }

  const item = (type: string, label: string, disabled = false) => (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault()
        copy(type)
      }}
      className="gap-2 text-sm"
    >
      <Clipboard className="h-4 w-4 text-blue-400" />
      {label}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`group flex min-w-0 items-center gap-2 rounded-md text-left transition-colors ${
            compact ? "px-1 py-0.5" : "px-1.5 py-1"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`shrink-0 overflow-hidden rounded-full border border-border bg-muted ${
              compact ? "h-7 w-7" : "h-8 w-8"
            }`}
          >
            {avatarUrl && !avatarFailed ? (
              <img
                src={avatarUrl}
                alt={`${name || "Discord user"} profile picture`}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold">
                {getInitials(name)}
              </div>
            )}
          </div>

          <div className="min-w-0 leading-tight">
            <div className="truncate text-[11px] font-medium text-foreground transition-colors group-hover:text-blue-400">
              {name || "Unknown User"}
            </div>
            {username ? (
              <div className="truncate text-[9px] text-muted-foreground">
                @{username}
              </div>
            ) : null}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="z-[300] w-64"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold">{name || "Unknown User"}</p>
          {username ? <p className="truncate text-xs text-muted-foreground">@{username}</p> : null}
          {rank ? <p className="mt-0.5 text-[10px] text-blue-400">{rank}</p> : null}
        </div>

        <DropdownMenuSeparator />
        {item("discord", "Discord ID", !userId)}
        {item("discord-mention", "Discord Mention", !userId)}
        {item("name", "Name")}
        {item("callsign", "Callsign", !callsign)}
        {item("badge", "Badge Number", !badgeNumber)}
        {item("rank", "Rank", !rank)}
        <DropdownMenuSeparator />
        {item("name-discord", "Name + Discord", !userId)}
        {item("callsign-discord", "Callsign + Discord", !callsign || !userId)}
        {item("callsign-name", "Callsign + Name", !callsign)}
        {item("callsign-badge", "Callsign + Badge", !callsign || !badgeNumber)}
        {item("badge-name", "Badge + Name", !badgeNumber)}
        {item("badge-discord", "Badge + Discord", !badgeNumber || !userId)}
        {item("callsign-name-discord", "Callsign + Name + Discord", !callsign || !userId)}
        {item("callsign-badge-discord", "Callsign + Badge + Discord", !callsign || !badgeNumber || !userId)}
        {item("name-badge-discord", "Name + Badge + Discord", !badgeNumber || !userId)}
        {item("callsign-badge-name", "Callsign + Badge + Name", !callsign || !badgeNumber)}
        {item("callsign-badge-name-discord", "Callsign + Badge + Name + Discord", !callsign || !badgeNumber || !userId)}
        {item("name-rank-discord", "Name + Rank + Discord", !rank || !userId)}
        <DropdownMenuSeparator />
        {item("full", "Copy Full Details")}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TargetIdentity({
  log,
  rosterProfiles,
}: {
  log: ActionLog
  rosterProfiles: Record<string, RosterMember>
}) {
  const details = log.details ?? {}

  const rosterProfile =
    log.targetUserId
      ? rosterProfiles[log.targetUserId]
      : undefined

  const targetName =
    rosterProfile?.name ||
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
    rosterProfile?.rank ||
    log.targetRank ||
    String(details.targetRank ?? "").trim()

  const targetCallsign =
    rosterProfile?.callsign ||
    String(
      details.targetCallsign ??
        details.callsign ??
        "",
    ).trim()

  const targetBadge =
    rosterProfile?.badgeNumber ||
    String(
      details.targetBadgeNumber ??
        details.badgeNumber ??
        "",
    ).trim()

  const targetAvatar =
    rosterProfile?.avatar ||
    String(
      details.targetAvatar ??
        details.targetAvatarUrl ??
        details.avatar ??
        "",
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

function FilterDropdown({
  values,
  placeholder,
  options,
  onChange,
  width = "w-[180px]",
}: {
  values: string[]
  placeholder: string
  options: Option[]
  onChange: (values: string[]) => void
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectable = options.filter((option) => option.value !== "")
  const selected = values.filter((value) =>
    selectable.some((option) => option.value === value),
  )

  useEffect(() => {
    if (!open) return

    const close = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]
    onChange(next)
  }

  const buttonLabel =
    selected.length === 0
      ? placeholder
      : selected.length === selectable.length
        ? `All ${placeholder.replace(/^All /i, "")}`
        : `${selected.length} selected`

  return (
    <div ref={dropdownRef} className={`relative ${width}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-left text-[12px] text-foreground outline-none transition-colors hover:border-blue-500/40 focus:border-blue-500/60"
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown
          className={`ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[100] max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-2xl">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-accent"
            onClick={() => onChange([])}
          >
            <span>All</span>
            {selected.length === 0 ? <Check className="h-3.5 w-3.5 text-blue-400" /> : null}
          </button>

          <div className="my-1 border-t border-border" />

          {selectable.map((option) => {
            const active = selected.includes(option.value)
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${active ? "bg-blue-500/10 text-blue-400" : "text-foreground hover:bg-accent"}`}
                onClick={() => toggle(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {active ? <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-blue-400" /> : null}
              </button>
            )
          })}

          {selected.length > 0 ? (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-md px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-transparent hover:text-blue-400"
                onClick={() => onChange([])}
              >
                Clear selection
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function PromotionLogs() {
  const [module, setModule] = useState<LogModule>("promotion")
  const [sessionUserId, setSessionUserId] = useState("")
  const [sessionAvatar, setSessionAvatar] = useState<string | null>(null)

  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<string[]>([])
  const [divisions, setDivisions] = useState<string[]>([])
  const [userIds, setUserIds] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [search, setSearch] = useState("")

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  })

  const [availableActions, setAvailableActions] =
    useState<string[]>(fallbackActions)

  const [rosterProfiles, setRosterProfiles] =
    useState<Record<string, RosterMember>>({})

  const rosterLoadingRef = useRef<Set<string>>(new Set())

  const hasFilters = Boolean(
    categories.length ||
      divisions.length ||
      userIds.length ||
      actions.length,
  )

  useEffect(() => {
    let mounted = true

    getSession()
      .then((session) => {
        if (!mounted || !session) return
        setSessionUserId(String(session.discordId ?? ""))
        setSessionAvatar(session.avatar ?? null)
      })
      .catch(() => {
        if (!mounted) return
        setSessionUserId("")
        setSessionAvatar(null)
      })

    return () => {
      mounted = false
    }
  }, [])

  const loadRosterProfiles = useCallback(async (items: ActionLog[]) => {
    const requests = new Map<string, { module: string; division: string }>()

    for (const log of items) {
      if (!log.division || !log.userId && !log.targetUserId) continue

      const key = `${log.module ?? module}:${log.division}`
      if (!requests.has(key)) {
        requests.set(key, {
          module: log.module === "activity" ? "activity" : "promotion",
          division: log.division,
        })
      }
    }

    const merged: Record<string, RosterMember> = {}

    await Promise.all(
      Array.from(requests.entries()).map(async ([key, request]) => {
        if (rosterLoadingRef.current.has(key)) return
        rosterLoadingRef.current.add(key)

        try {
          const endpoint =
            request.module === "activity"
              ? `/api/activity/roster/${encodeURIComponent(request.division)}`
              : `/api/promotion/roster/${encodeURIComponent(request.division)}`

          const response = await fetch(endpoint, {
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          })

          if (!response.ok) return

          const data = (await response.json()) as {
            success?: boolean
            members?: Array<Record<string, unknown>>
          }

          if (!data.success || !Array.isArray(data.members)) return

          for (const member of data.members) {
            const discordId = String(member.discordId ?? "").trim()
            const name = String(member.name ?? "").trim()
            if (!discordId || !name) continue

            merged[discordId] = {
              discordId,
              name,
              rank: String(member.rank ?? "").trim() || undefined,
              callsign: String(member.callsign ?? "").trim() || undefined,
              badgeNumber: String(member.badgeNumber ?? "").trim() || undefined,
              avatar: typeof member.avatar === "string" ? member.avatar : null,
            }
          }
        } catch {
          // Stored audit identity remains the fallback if roster lookup fails.
        } finally {
          rosterLoadingRef.current.delete(key)
        }
      }),
    )

    if (Object.keys(merged).length) {
      setRosterProfiles((current) => ({ ...current, ...merged }))
    }
  }, [module])

  const toggleExpanded = useCallback((id: string) => {
    if (!id) return

    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      })

      if (module !== "all") {
        params.set("module", module)
      }

      if (search.trim()) {
        params.set("search", search.trim())
      }

      categories.forEach((value) => params.append("category", value))
      divisions.forEach((value) => params.append("division", value))
      userIds.forEach((value) => params.append("userId", value))
      actions.forEach((value) => params.append("action", value))

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
            `Failed to load ${module} action logs (${response.status}).`,
        )
      }

      const nextLogs = Array.isArray(data.logs)
        ? data.logs
        : []

      // Do not deduplicate adjacent entries. Every audit entry returned by
      // the API must remain visible, even when several actions happened
      // within the same few seconds.
      setLogs(nextLogs)
      void loadRosterProfiles(nextLogs)

      setPagination(
        data.pagination ?? {
          page,
          limit: pageSize,
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
        limit: pageSize,
        total: 0,
        pages: 1,
      })

      setError(
        err instanceof Error
          ? err.message
          : `Failed to load ${module} action logs.`,
      )
    } finally {
      setLoading(false)
    }
  }, [
    page,
    pageSize,
    module,
    loadRosterProfiles,
    search,
    categories,
    divisions,
    userIds,
    actions,
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(new Set())
      }
    }

    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
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
    setCategories([])
    setDivisions([])
    setUserIds([])
    setActions([])
    setPage(1)
    setExpanded(new Set())
  }

  const clearSearch = () => {
    setSearch("")
    setPage(1)
    setExpanded(new Set())
  }

  const resetFilters = () => {
    clearFilters()
  }

  const changeFilter = <T,>(
    setter: (value: T) => void,
    value: T,
  ) => {
    setter(value)
    setPage(1)
    setExpanded(new Set())
  }

  const changePageSize = (value: number) => {
    setPageSize(value)
    setPage(1)
    setExpanded(new Set())
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
      <div className="mx-auto flex w-full max-w-[1100px] min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-5">
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  All Logs
                </h1>
                <p className="text-sm text-muted-foreground">
                  View promotion and activity management audit history and changes.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-2 self-start lg:self-center"
              onClick={() => void loadLogs()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing" : "Refresh"}
            </Button>
          </div>

          {/* Log module tabs */}
          <div className="flex w-fit items-center gap-2">
            {([
              ["all", "All"],
              ["promotion", "Promotion Logs"],
              ["activity", "Activity Logs"],
            ] as const).map(([value, label]) => {
              const active = module === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (module === value) return
                    setModule(value)
                    setPage(1)
                    setExpanded(new Set())
                    setSearch("")
                    setCategories([])
                    setDivisions([])
                    setUserIds([])
                    setActions([])
                  }}
                  className={`h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors ${
                    active
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                      : "border-border bg-transparent text-muted-foreground hover:border-blue-500/40 hover:bg-transparent hover:text-blue-400"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Search + filters — all controls live inside the Filters box. */}
          <div className="w-full">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {pagination.total.toLocaleString()} changes
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,1fr)_170px_170px_170px_180px]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => changeFilter(setSearch, event.target.value)}
                    placeholder="Search users, actions, IDs, targets..."
                    className="h-9 w-full border-border bg-background pl-9 text-[12px]"
                  />
                </div>

                <FilterDropdown
                  values={categories}
                  placeholder="All Categories"
                  options={categoryOptions}
                  onChange={(values) => changeFilter(setCategories, values)}
                  width="w-full"
                />

                <FilterDropdown
                  values={divisions}
                  placeholder="All Divisions"
                  options={divisionOptions}
                  onChange={(values) => changeFilter(setDivisions, values)}
                  width="w-full"
                />

                <FilterDropdown
                  values={userIds}
                  placeholder="Anyone"
                  options={[
                    { value: "", label: "Anyone" },
                    ...Array.from(
                      new Map<string, Option>(
                        logs
                          .filter((log) => log.userId)
                          .map((log) => [
                            log.userId,
                            {
                              value: log.userId,
                              label: log.userName || log.username || log.userId,
                            },
                          ] as const),
                      ).values(),
                    ),
                  ]}
                  onChange={(values) => changeFilter(setUserIds, values)}
                  width="w-full"
                />

                <FilterDropdown
                  values={actions}
                  placeholder="All actions"
                  options={[
                    { value: "", label: "All actions" },
                    ...actionOptions.map((item) => ({
                      value: item,
                      label: actionLabel(item),
                    })),
                  ]}
                  onChange={(values) => changeFilter(setActions, values)}
                  width="w-full"
                />
              </div>

              <div className="mt-2 flex min-h-8 flex-wrap items-center gap-2 border-t border-border pt-2">
                <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Filter className="h-3.5 w-3.5 text-blue-400" />
                  Filters:
                </div>

                {!hasFilters && !search.trim() ? (
                  <span className="text-xs text-muted-foreground">None</span>
                ) : (
                  <>
                    {search.trim() ? (
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        Search: {search.trim()}
                      </span>
                    ) : null}
                    {categories.map((value) => (
                      <span key={`category-${value}`} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        Category: {categoryLabel(value)}
                      </span>
                    ))}
                    {divisions.map((value) => (
                      <span key={`division-${value}`} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        Division: {divisionLabel(value)}
                      </span>
                    ))}
                    {userIds.map((value) => (
                      <span key={`user-${value}`} className="max-w-48 truncate rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        User: {logs.find((log) => log.userId === value)?.userName || logs.find((log) => log.userId === value)?.username || value}
                      </span>
                    ))}
                    {actions.map((value) => (
                      <span key={`action-${value}`} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        Action: {actionLabel(value)}
                      </span>
                    ))}
                  </>
                )}

                {(search.trim() || hasFilters) ? (
                  <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                    {search.trim() ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="inline-flex h-6 items-center gap-1 border-0 bg-transparent px-0 text-[10px] font-medium text-muted-foreground shadow-none outline-none transition-colors hover:bg-transparent hover:text-blue-400 focus:bg-transparent focus:text-blue-400 focus:outline-none focus:ring-0"
                      >
                        <X className="h-3 w-3" />
                        Clear Search
                      </button>
                    ) : null}

                    {hasFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex h-6 items-center gap-1 border-0 bg-transparent px-0 text-[10px] font-medium text-muted-foreground shadow-none outline-none transition-colors hover:bg-transparent hover:text-blue-400 focus:bg-transparent focus:text-blue-400 focus:outline-none focus:ring-0"
                      >
                        <X className="h-3 w-3" />
                        Clear Filters
                      </button>
                    ) : null}

                    {hasFilters ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex h-6 items-center gap-1 border-0 bg-transparent px-0 text-[10px] font-medium text-muted-foreground shadow-none outline-none transition-colors hover:bg-transparent hover:text-blue-400 focus:bg-transparent focus:text-blue-400 focus:outline-none focus:ring-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset Filters
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {/* Log timeline */}
        <div className="mx-auto w-full max-w-[1100px] min-w-0">
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
                No {module === "all" ? "action" : module === "promotion" ? "promotion" : "activity"} logs found
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

                  <div className="space-y-2">
                    {group.logs.map((log, index) => {
                      const isExpanded = expanded.has(log.id)

                      const actorProfile = log.userId
                        ? rosterProfiles[log.userId]
                        : undefined

                      const actorName =
                        actorProfile?.name ||
                        log.userName ||
                        log.username ||
                        log.userId ||
                        "Unknown User"

                      const actorAvatar =
                        actorProfile?.avatar ||
                        log.avatar ||
                        (log.userId && log.userId === sessionUserId
                          ? sessionAvatar
                          : null)

                      const Action = getActionIcon(log)

                      const globalLogIndex = logs.findIndex(
                        (item) => item.id === log.id,
                      )

                      const entryNumber =
                        log.entryNumber ??
                        (pagination.page - 1) * pagination.limit +
                        Math.max(globalLogIndex, 0) +
                        1

                      const detailEntries = getDetailEntries(log)

                      return (
                        <div
                          key={
                            log.id ||
                            `${log.createdAt}-${log.userId}-${index}`
                          }
                          className={`overflow-hidden rounded-xl border bg-card transition-colors ${
                            isExpanded
                              ? "border-blue-500/40"
                              : "border-border hover:border-blue-500/25"
                          }`}
                        >
                          {/* Compact log entry — intentionally matches the reference entry layout. */}
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full cursor-pointer text-left outline-none"
                            onClick={() => toggleExpanded(log.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                toggleExpanded(log.id)
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${getActionIconStyle(
                                  log,
                                )}`}
                              >
                                <Action className="h-4 w-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="truncate text-[13px] font-semibold text-foreground sm:text-sm">
                                    {actionLabel(log.action)}
                                  </span>

                                  {log.targetName || log.targetUserId ? (
                                    <>
                                      <span className="shrink-0 text-muted-foreground">
                                        →
                                      </span>
                                      <div
                                        className="min-w-0"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        <TargetIdentity
                                          log={log}
                                          rosterProfiles={rosterProfiles}
                                        />
                                      </div>
                                    </>
                                  ) : null}
                                </div>

                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                                  <IdentityCard
                                    name={actorName}
                                    username={log.username}
                                    userId={log.userId}
                                    rank={actorProfile?.rank || log.rank}
                                    callsign={
                                      actorProfile?.callsign || log.callsign
                                    }
                                    badgeNumber={
                                      actorProfile?.badgeNumber ||
                                      log.badgeNumber
                                    }
                                    avatar={actorAvatar}
                                    compact
                                  />

                                  <span>·</span>
                                  <span>{formatDateTime(log.createdAt).split(",")[0]}</span>

                                  <span>·</span>
                                  <span>{categoryLabel(log.category)}</span>

                                  {log.division ? (
                                    <>
                                      <span>·</span>
                                      <span className="text-blue-400">
                                        {divisionLabel(log.division)}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              <span
                                className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${getActionBadgeStyle(
                                  log,
                                )}`}
                              >
                                {actionLabel(log.action)}
                              </span>

                              <div className="flex shrink-0 items-center">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded entry — readable rows for every log type. */}
                          {isExpanded ? (
                            <div className="border-t border-border px-4 py-3 sm:px-7 sm:py-4">
                              {detailEntries.length > 0 ? (
                                <div className="divide-y divide-border">
                                  {detailEntries.map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="grid grid-cols-[minmax(110px,180px)_1fr] items-start gap-5 py-3 first:pt-0 last:pb-1"
                                    >
                                      <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                                        {detailLabel(key)}
                                      </span>
                                      <span className="min-w-0 whitespace-pre-wrap break-words text-[11px] leading-5 text-foreground sm:text-xs">
                                        {formatDetailValue(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {log.summary ? (
                                <div className={`${detailEntries.length > 0 ? "mt-3 border-t border-border pt-3" : ""}`}>
                                  <p className="text-[11px] leading-5 text-muted-foreground sm:text-xs">
                                    {log.summary}
                                  </p>
                                </div>
                              ) : null}

                              <div className="mt-3 grid gap-4 border-t border-border pt-3 sm:grid-cols-[1fr_auto]">
                                <div className="min-w-0">
                                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Changed By
                                  </p>
                                  <IdentityCard
                                    name={actorName}
                                    username={log.username}
                                    userId={log.userId}
                                    rank={log.rank}
                                    callsign={log.callsign}
                                    badgeNumber={log.badgeNumber}
                                    avatar={actorAvatar}
                                  />
                                  {log.userId ? (
                                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                                      {log.userId}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="min-w-0 sm:text-right">
                                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Entry
                                  </p>
                                  <p className="font-mono text-sm font-medium text-foreground">
                                    #{entryNumber}
                                  </p>
                                </div>
                              </div>
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
          <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Entries per page</span>
              <FilterDropdown
                value={String(pageSize)}
                placeholder="50"
                options={[
                  { value: "10", label: "10" },
                  { value: "25", label: "25" },
                  { value: "50", label: "50" },
                  { value: "100", label: "100" },
                ]}
                onChange={(value) => changePageSize(Number(value))}
                width="w-[92px]"
              />
            </div>

            <div className="text-[11px] text-muted-foreground">
              Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} logs
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={page >= pagination.pages || loading}
                onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
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
