import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  Copy,
  Check,
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
  module?: "all" | "promotion" | "activity" | string
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
  if (!avatar) return getDefaultAvatar(discordId)

  const value = String(avatar).trim()
  if (!value) return getDefaultAvatar(discordId)

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  // Discord avatar hashes may arrive with a file extension already attached.
  const hash = value.replace(/\.(gif|png|webp)$/i, "")
  const extension = hash.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.${extension}?size=128`
}

const getLogAvatar = (log: ActionLog) => {
  const details = log.details ?? {}
  const candidate =
    log.avatar ??
    details.avatar ??
    details.avatarUrl ??
    details.avatarURL ??
    details.avatarHash ??
    details.userAvatar ??
    details.userAvatarUrl ??
    details.authorAvatar ??
    details.authorAvatarUrl

  return candidate == null ? null : String(candidate)
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
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${name || "Discord user"} profile picture`}
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  const image = event.currentTarget
                  const fallback = userId ? getDefaultAvatar(userId) : undefined
                  if (fallback && image.src !== fallback) {
                    image.src = fallback
                    return
                  }
                  image.style.display = "none"
                }}
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
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={false}
        className="z-[300] w-[285px] max-h-80 overflow-y-auto p-1"
        onClick={(event) => event.stopPropagation()}
      >
        {([
          ["discord", "Copy Discord ID"],
          ["discord-mention", "Copy Discord Mention"],
          ["name", "Copy Name"],
          ["callsign", "Copy Callsign"],
          ["badge", "Copy Badge Number"],
          ["rank", "Copy Rank"],
        ] as [string, string][]).map(([type, label]) => (
          <DropdownMenuItem
            key={type}
            disabled={
              (type === "discord" || type === "discord-mention") && !userId
                ? true
                : type === "callsign" && !callsign
                  ? true
                  : type === "badge" && !badgeNumber
                    ? true
                    : type === "rank" && !rank
                      ? true
                      : false
            }
            onSelect={(event) => {
              event.preventDefault()
              copy(type)
            }}
            className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"
          >
            <Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}

        <div className="my-0.5 h-px bg-border" />

        {([
          ["name-discord", "Name + Discord ID"],
          ["callsign-discord", "Callsign + Discord ID"],
          ["callsign-name", "Callsign + Name"],
          ["callsign-badge", "Callsign + Badge Number"],
          ["badge-name", "Badge Number + Name"],
          ["badge-discord", "Badge Number + Discord ID"],
        ] as [string, string][]).map(([type, label]) => (
          <DropdownMenuItem
            key={type}
            disabled={
              type === "name-discord"
                ? !userId
                : type === "callsign-discord"
                  ? !callsign || !userId
                  : type === "callsign-name"
                    ? !callsign
                    : type === "callsign-badge"
                      ? !callsign || !badgeNumber
                      : type === "badge-name"
                        ? !badgeNumber
                        : !badgeNumber || !userId
            }
            onSelect={(event) => {
              event.preventDefault()
              copy(type)
            }}
            className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"
          >
            <Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}

        <div className="my-0.5 h-px bg-border" />

        {([
          ["callsign-name-discord", "Callsign + Name + Discord"],
          ["callsign-badge-discord", "Callsign + Badge + Discord"],
          ["name-badge-discord", "Name + Badge + Discord"],
          ["callsign-badge-name", "Callsign + Badge + Name"],
          ["callsign-badge-name-discord", "Callsign + Badge + Name + Discord"],
          ["name-rank-discord", "Name + Rank + Discord"],
        ] as [string, string][]).map(([type, label]) => (
          <DropdownMenuItem
            key={type}
            disabled={
              type === "callsign-name-discord"
                ? !callsign || !userId
                : type === "callsign-badge-discord"
                  ? !callsign || !badgeNumber || !userId
                  : type === "name-badge-discord"
                    ? !badgeNumber || !userId
                    : type === "callsign-badge-name"
                      ? !callsign || !badgeNumber
                      : type === "callsign-badge-name-discord"
                        ? !callsign || !badgeNumber || !userId
                        : !rank || !userId
            }
            onSelect={(event) => {
              event.preventDefault()
              copy(type)
            }}
            className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"
          >
            <Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}

        <div className="my-0.5 h-px bg-border" />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            copy("full")
          }}
          className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"
        >
          <Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span>Copy Full Details</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const selected = options.find((option) => option.value === value)

  return (
    <div ref={dropdownRef} className={`relative ${width}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
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
                {active ? <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-blue-400" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function PromotionLogs() {
  const [module, setModule] = useState<LogModule>("promotion")

  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<Category>("")
  const [division, setDivision] = useState<Division>("")
  const [userId, setUserId] = useState("")
  const [action, setAction] = useState("")
  const [search, setSearch] = useState("")

  const [expanded, setExpanded] = useState<string | null>(null)
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

  const hasFilters = Boolean(
    search.trim() ||
      category ||
      division ||
      userId ||
      action,
  )

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        module,
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
    search,
    category,
    division,
    userId,
    action,
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
        setExpanded(null)
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
    setSearch("")
    setCategory("")
    setDivision("")
    setUserId("")
    setAction("")
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

  const changePageSize = (value: number) => {
    setPageSize(value)
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
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                {module === "promotion" ? (
                  <Shield className="h-5 w-5 text-blue-500" />
                ) : (
                  <Activity className="h-5 w-5 text-blue-500" />
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {module === "all" ? "All Logs" : module === "promotion" ? "Promotion Logs" : "Activity Logs"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {module === "all"
                    ? "View promotion and activity management audit history and changes."
                    : module === "promotion"
                      ? "View promotion management audit history and changes."
                      : "View activity management audit history and changes."}
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
              Refresh
            </Button>
          </div>

          {/* Log module tabs */}
          <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-2">
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
                    setExpanded(null)
                    setSearch("")
                    setCategory("")
                    setDivision("")
                    setUserId("")
                    setAction("")
                  }}
                  className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors ${
                    active
                      ? "border-blue-500/60 bg-blue-500/10 text-blue-400"
                      : "border-border bg-card text-muted-foreground hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Filters */}
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_190px_190px_190px]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => changeFilter(setSearch, event.target.value)}
                  placeholder="Search users, actions, IDs, targets..."
                  className="h-10 w-full border-border bg-card pl-9 text-[12px]"
                />
              </div>

              <FilterDropdown
                value={category}
                placeholder="All Categories"
                options={categoryOptions}
                onChange={(value) => changeFilter(setCategory, value as Category)}
                width="w-full"
              />

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
                width="w-full"
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
                width="w-full"
              />

            </div>

            <div className="mt-2 flex min-h-5 items-center justify-end gap-2">
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {pagination.total.toLocaleString()} changes
              </span>
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
                No {module === "all" ? "" : module === "promotion" ? "promotion" : "activity"} action logs found
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

                  <div className="space-y-1">
                    {group.logs.map((log, index) => {
                      const isExpanded =
                        expanded === log.id

                      const actorName =
                        log.userName ||
                        log.username ||
                        log.userId ||
                        "Unknown User"

                      const Action = getActionIcon(log)

                      const globalLogIndex = logs.findIndex(
                        (item) => item.id === log.id,
                      )

                      const entryNumber =
                        log.entryNumber ??
                        (pagination.page - 1) *
                          pagination.limit +
                        Math.max(globalLogIndex, 0) +
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
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full cursor-pointer text-left outline-none"
                            onClick={() =>
                              setExpanded(
                                isExpanded
                                  ? null
                                  : log.id,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setExpanded(
                                  isExpanded
                                    ? null
                                    : log.id,
                                )
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
                              {/* Entry + action icon */}
                              <div className="flex w-8 shrink-0 items-center justify-center">
                                <span className="font-mono text-[9px] text-muted-foreground/70">
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
                                  <IdentityCard
                                    name={actorName}
                                    username={log.username}
                                    userId={log.userId}
                                    rank={log.rank}
                                    callsign={log.callsign}
                                    badgeNumber={log.badgeNumber}
                                    avatar={getLogAvatar(log)}
                                    compact
                                  />

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

                          </div>

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

                              <div className="divide-y divide-border border-y border-border">
                                <div className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Summary
                                  </span>
                                  <p className="text-xs leading-5">
                                    {log.summary || "No summary available."}
                                  </p>
                                </div>

                                <div className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Action
                                  </span>
                                  <div className="grid gap-1 text-xs">
                                    <span>
                                      <b>Action:</b>{" "}
                                      {actionLabel(log.action)}
                                    </span>
                                    <span>
                                      <b>Category:</b>{" "}
                                      {categoryLabel(log.category)}
                                    </span>
                                    <span>
                                      <b>Division:</b>{" "}
                                      {divisionLabel(log.division)}
                                    </span>
                                    <span className="truncate">
                                      <b>Page:</b>{" "}
                                      {log.path || "—"}
                                    </span>
                                  </div>
                                </div>

                                {log.targetName || log.targetUserId ? (
                                  <div className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                      Changed
                                    </span>
                                    <div className="min-w-0">
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
                                    </div>
                                  </div>
                                ) : null}

                                {log.details &&
                                Object.keys(log.details).length > 0 ? (
                                  <>
                                    {Object.entries(log.details).map(
                                      ([key, value]) => {
                                        const normalized = key
                                          .toLowerCase()
                                          .replace(/[^a-z0-9]/g, "")

                                        const isCode =
                                          normalized === "code" ||
                                          normalized === "oldcode" ||
                                          normalized === "newcode"

                                        if (
                                          normalized === "oldcode" ||
                                          normalized === "newcode"
                                        ) {
                                          return null
                                        }

                                        const oldCode = Object.entries(
                                          log.details ?? {},
                                        ).find(
                                          ([detailKey]) =>
                                            detailKey
                                              .toLowerCase()
                                              .replace(/[^a-z0-9]/g, "") ===
                                            "oldcode",
                                        )?.[1]

                                        const newCode = Object.entries(
                                          log.details ?? {},
                                        ).find(
                                          ([detailKey]) =>
                                            detailKey
                                              .toLowerCase()
                                              .replace(/[^a-z0-9]/g, "") ===
                                            "newcode",
                                        )?.[1]

                                        return (
                                          <div
                                            key={key}
                                            className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]"
                                          >
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                              {actionLabel(key)}
                                            </span>
                                            <div className="min-w-0 text-xs">
                                              {isCode &&
                                              (oldCode !== undefined ||
                                                newCode !== undefined) ? (
                                                <div className="flex flex-wrap items-center gap-2 font-mono">
                                                  <span className="text-red-400 line-through">
                                                    {formatDetailValue(oldCode)}
                                                  </span>
                                                  <span className="text-muted-foreground">
                                                    →
                                                  </span>
                                                  <span className="text-emerald-400">
                                                    {formatDetailValue(newCode)}
                                                  </span>
                                                </div>
                                              ) : (
                                                <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-4">
                                                  {formatDetailValue(value)}
                                                </pre>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      },
                                    )}

                                    {(Object.keys(log.details).some(
                                      (key) =>
                                        key
                                          .toLowerCase()
                                          .replace(/[^a-z0-9]/g, "") ===
                                        "oldcode",
                                    ) ||
                                      Object.keys(log.details).some(
                                        (key) =>
                                          key
                                            .toLowerCase()
                                            .replace(/[^a-z0-9]/g, "") ===
                                          "newcode",
                                      )) ? (
                                      <div className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                          Code
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                                          <span className="text-red-400 line-through">
                                            {formatDetailValue(
                                              Object.entries(log.details).find(
                                                ([key]) =>
                                                  key
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9]/g, "") ===
                                                  "oldcode",
                                              )?.[1],
                                            )}
                                          </span>
                                          <span className="text-muted-foreground">
                                            →
                                          </span>
                                          <span className="text-emerald-400">
                                            {formatDetailValue(
                                              Object.entries(log.details).find(
                                                ([key]) =>
                                                  key
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9]/g, "") ===
                                                  "newcode",
                                              )?.[1],
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}

                                <div className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Changed By
                                  </span>
                                  <IdentityCard
                                    name={actorName}
                                    username={log.username}
                                    userId={log.userId}
                                    rank={log.rank}
                                    callsign={log.callsign}
                                    badgeNumber={log.badgeNumber}
                                    avatar={getLogAvatar(log)}
                                    compact
                                  />
                                </div>

                                <div className="grid gap-1 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Recorded
                                  </span>
                                  <div>
                                    <p className="text-xs font-medium">
                                      {formatDateTime(log.createdAt)}
                                    </p>
                                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                      Entry #{entryNumber}
                                    </p>
                                  </div>
                                </div>
                              </div>

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
