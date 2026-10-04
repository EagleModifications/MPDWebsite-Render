import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react"

import {
    ChevronDown,
  ChevronUp,
  ArrowRight,
  ListChecks,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Copy,
  FileInput,
  History,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
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

type RosterMember = {
  discordId: string
  name: string
  rank?: string
  callsign?: string
  badgeNumber?: string
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

function tagClass(type: "module" | "division" | "category", value?: string | null) {
  const key = (value ?? "").toLowerCase()

  if (type === "module") {
    if (key === "promotion") {
      return "border-violet-500/30 bg-violet-500/10 text-violet-300"
    }

    if (key === "activity") {
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
    }

    return "border-slate-500/30 bg-slate-500/10 text-slate-300"
  }

  if (type === "division") {
    if (key === "department") {
      return "border-blue-500/30 bg-blue-500/10 text-blue-300"
    }

    if (key === "swat") {
      return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
    }

    if (key === "mtf7") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    }

    if (key === "mcd") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    }

    if (key === "tru") {
      return "border-rose-500/30 bg-rose-500/10 text-rose-300"
    }

    if (key === "teu") {
      return "border-orange-500/30 bg-orange-500/10 text-orange-300"
    }

    if (key === "sar") {
      return "border-sky-500/30 bg-sky-500/10 text-sky-300"
    }

    return "border-slate-500/30 bg-slate-500/10 text-slate-300"
  }

  if (key === "requirements") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300"
  }

  if (key === "import") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
  }

  if (key === "roster") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300"
  }

  if (key === "management") {
    return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
  }

  if (key === "navigation") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-300"
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-300"
}

function actionIcon(log: ActionLog) {
  const value = log.action.toLowerCase()
  const category = log.category.toLowerCase()

  if (value.includes("copy")) return Copy
  if (value.includes("select") || value.includes("deselect")) return CheckCircle2
  if (value.includes("import")) return FileInput
  if (value.includes("requirement")) return ClipboardCheck
  if (value.includes("delete") || value.includes("remove")) return Trash2
  if (value.includes("create") || value.includes("add")) return PlusCircle
  if (value.includes("update") || value.includes("edit") || value.includes("change")) return Pencil
  if (category === "management") return Settings2
  if (category === "navigation") return ArrowRight
  if (category === "roster") return ListChecks
  return History
}

function LogActionIcon({ log }: { log: ActionLog }) {
  const Icon = actionIcon(log)

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400"
      title={actionLabel(log.action)}
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

function statusLabel(log: ActionLog) {
  const value = log.action.toLowerCase()

  if (value.includes("copy")) return "Copied"
  if (value.includes("select")) return "Selected"
  if (value.includes("import")) return "Imported"
  if (value.includes("delete") || value.includes("remove")) return "Removed"
  if (value.includes("create") || value.includes("add")) return "Created"
  return "Updated"
}

function statusClass(log: ActionLog) {
  const value = statusLabel(log).toLowerCase()

  if (value === "created") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  }

  if (value === "removed" || value === "deleted") {
    return "border-red-500/30 bg-red-500/10 text-red-300"
  }

  if (value === "copied") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-300"
  }

  if (value === "selected") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
  }

  return "border-blue-500/30 bg-blue-500/10 text-blue-300"
}

function Tag({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${className}`}
    >
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
  callsign,
  badgeNumber,
  rank,
  avatar,
}: {
  name: string
  id?: string
  callsign?: string
  badgeNumber?: string
  rank?: string
  avatar?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const display = name?.trim() || "Unknown User"
  const safeId = id?.trim() || ""
  const safeCallsign = callsign?.trim() || ""
  const safeBadge = badgeNumber?.trim() || ""
  const safeRank = rank?.trim() || ""

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    const handleScroll = () => setOpen(false)

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("scroll", handleScroll, true)

    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("scroll", handleScroll, true)
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

  const openMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 264
    const menuHeight = 365
    const gap = 4

    let left = rect.left
    let top = rect.bottom + gap

    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8)
    }

    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap)
    }

    setPosition({ left, top })
    setOpen((current) => !current)
  }

  const openContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const menuWidth = 264
    const menuHeight = 365
    const gap = 4

    let left = event.clientX
    let top = event.clientY + gap

    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8)
    }

    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, event.clientY - menuHeight - gap)
    }

    setPosition({ left, top })
    setOpen(true)
  }

  const items = [
    {
      label: "Copy Discord ID",
      value: safeId,
      copyLabel: "Discord ID",
    },
    {
      label: "Copy Discord Mention",
      value: safeId ? `<@${safeId}>` : "",
      copyLabel: "Discord mention",
    },
    {
      label: "Copy Name",
      value: display,
      copyLabel: "Name",
    },
    {
      label: "Copy Callsign",
      value: safeCallsign,
      copyLabel: "Callsign",
    },
    {
      label: "Copy Badge Number",
      value: safeBadge,
      copyLabel: "Badge number",
    },
    {
      label: "Copy Rank",
      value: safeRank,
      copyLabel: "Rank",
    },
  ]

  const combined = [
    {
      label: "Name + Discord ID",
      value: safeId ? `${display} — ${safeId}` : "",
    },
    {
      label: "Callsign + Discord ID",
      value: safeCallsign && safeId ? `${safeCallsign} — ${safeId}` : "",
    },
    {
      label: "Callsign + Name",
      value: safeCallsign ? `${safeCallsign} — ${display}` : "",
    },
    {
      label: "Callsign + Badge Number",
      value: safeCallsign && safeBadge ? `${safeCallsign} — ${safeBadge}` : "",
    },
    {
      label: "Badge Number + Name",
      value: safeBadge ? `${safeBadge} — ${display}` : "",
    },
  ]

  return (
    <div
      ref={ref}
      className="relative inline-flex min-w-0"
      onContextMenu={openContextMenu}
    >
      <button
        type="button"
        onClick={openMenu}
        className="inline-flex max-w-full items-center gap-2 rounded-md py-0.5 text-left transition-colors hover:text-blue-400"
        title="Copy options"
      >
        <Avatar name={display} id={safeId} avatar={avatar} />
        <span className="truncate text-xs font-medium text-blue-400">
          {display}
        </span>
      </button>

      {open ? (
        <div
          className="fixed z-[200] w-[264px] overflow-hidden rounded-[4px] border border-[#252a31] bg-[#090a0c] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
          style={{ left: position.left, top: position.top }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="max-h-[365px] overflow-y-auto pr-0.5 [scrollbar-width:thin] [scrollbar-color:#30343b_transparent]">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={!item.value}
                onClick={() => void copy(item.value, item.copyLabel)}
                className="flex h-[29px] w-full items-center gap-2 rounded-[3px] px-2.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Clipboard className="h-[15px] w-[15px] shrink-0 text-blue-400" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            <div className="mx-1 my-1 border-t border-[#252a31]" />

            {combined.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={!item.value}
                onClick={() => void copy(item.value, item.label)}
                className="flex h-[29px] w-full items-center gap-2 rounded-[3px] px-2.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Clipboard className="h-[15px] w-[15px] shrink-0 text-blue-400" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
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
  className,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  icon?: typeof Users
  ariaLabel: string
  className?: string
}) {
  return (
    <div className={`relative min-w-0 ${className ?? ""}`}>
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-blue-400" />
      ) : null}

      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full appearance-none rounded-lg border border-[#303744] bg-[#0d1117] pr-9 text-xs outline-none transition-colors hover:border-blue-500/40 focus:border-blue-500/70 ${
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
                {String(change.field ?? change.label ?? change.key ?? (change.rank ? "Rank" : "Change"))}
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

function DetailPanel({ log, rosterProfiles }: { log: ActionLog; rosterProfiles: Record<string, RosterMember> }) {
  const details = log.details ?? {}

  const additionalDetails = Object.entries(details).filter(
    ([key]) =>
      key !== "changes" &&
      key !== "old" &&
      key !== "new",
  )

  return (
    <div className="border-t border-[#303744] bg-[#0e1219] px-4 py-4">
      <div className="grid gap-4">
        <ChangeList changes={details.changes} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Changed by
            </p>

            <div className="mt-1">
              <CopyMenu
                name={rosterProfiles[log.userId]?.name || log.userName || log.username || "Unknown user"}
                id={log.userId}
                callsign={rosterProfiles[log.userId]?.callsign || log.callsign}
                badgeNumber={rosterProfiles[log.userId]?.badgeNumber || log.badgeNumber}
                rank={rosterProfiles[log.userId]?.rank || log.rank}
                avatar={rosterProfiles[log.userId]?.avatar || log.avatar}
              />
            </div>
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

                  <div className="mt-1">
                    <CopyMenu
                      name={rosterProfiles[log.targetUserId || ""]?.name || log.targetName}
                      id={log.targetUserId}
                      callsign={rosterProfiles[log.targetUserId || ""]?.callsign || String(
                        details.targetCallsign ??
                          details.callsign ??
                          "",
                      )}
                      badgeNumber={rosterProfiles[log.targetUserId || ""]?.badgeNumber || String(
                        details.targetBadgeNumber ??
                          details.badgeNumber ??
                          "",
                      )}
                      rank={rosterProfiles[log.targetUserId || ""]?.rank || log.targetRank}
                      avatar={rosterProfiles[log.targetUserId || ""]?.avatar}
                    />
                  </div>
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
  const [action, setAction] = useState("")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [rosterProfiles, setRosterProfiles] = useState<Record<string, RosterMember>>({})
  const rosterLoadingRef = useRef<Set<string>>(new Set())

  const loadRosterProfiles = useCallback(async (items: ActionLog[]) => {
    const requests = new Map<string, { module: string; division: string }>()

    for (const log of items) {
      if (!log.division) continue
      const key = `${log.module}:${log.division}`
      if (!requests.has(key)) {
        requests.set(key, { module: log.module, division: log.division })
      }
    }

    const merged: Record<string, RosterMember> = {}

    await Promise.all(
      Array.from(requests.entries()).map(async ([key, request]) => {
        if (rosterLoadingRef.current.has(key)) return
        rosterLoadingRef.current.add(key)

        try {
          const endpoint = request.module === "activity"
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
              rank: String(member.rank ?? "").trim(),
              callsign: String(member.callsign ?? "").trim(),
              badgeNumber: String(member.badgeNumber ?? "").trim(),
              avatar: typeof member.avatar === "string" ? member.avatar : null,
            }
          }
        } catch {
          // Keep the stored audit identity as a fallback if roster lookup fails.
        } finally {
          rosterLoadingRef.current.delete(key)
        }
      }),
    )

    if (Object.keys(merged).length) {
      setRosterProfiles((current) => ({ ...current, ...merged }))
    }
  }, [])

  const getRosterMember = useCallback((discordId?: string | null) => {
    if (!discordId) return undefined
    return rosterProfiles[discordId]
  }, [rosterProfiles])

  const getDisplayName = useCallback((discordId: string | undefined, fallback: string) => {
    return getRosterMember(discordId)?.name || fallback || "Unknown User"
  }, [getRosterMember])

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
      if (action) params.set("action", action)
      if (search.trim()) params.set("search", search.trim())

      const response = await fetch(`/api/action-logs?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })

      const data = (await response.json()) as ApiResponse

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || `Failed to load action logs (${response.status}).`,
        )
      }

      const nextLogs = Array.isArray(data.logs) ? data.logs : []
      setLogs(nextLogs)
      void loadRosterProfiles(nextLogs)
      setTotal(data.pagination?.total ?? 0)
      setPages(Math.max(1, data.pagination?.pages ?? 1))

      if (data.pagination?.page && data.pagination.page !== page) {
        setPage(data.pagination.page)
      }
    } catch (err) {
      setLogs([])
      setTotal(0)
      setPages(1)
      setError(err instanceof Error ? err.message : "Failed to load action logs.")
    } finally {
      setLoading(false)
    }
  }, [action, category, division, loadRosterProfiles, module, page, pageSize, search, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadLogs, search])

  const userOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>()

    for (const log of logs) {
      if (!log.userId) continue
      map.set(log.userId, rosterProfiles[log.userId]?.name || log.userName || log.username || log.userId)
    }

    return [
      { value: "", label: "Anyone" },
      ...Array.from(map.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [logs, rosterProfiles])

  const actionOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>()

    for (const log of logs) {
      if (!log.action) continue
      map.set(log.action, actionLabel(log.action))
    }

    return [
      { value: "", label: "All actions" },
      ...Array.from(map.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
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
    setAction("")
    setSearch("")
    setPage(1)
    setExpanded(null)
  }

  const selectModule = (value: Module) => {
    setModule(value)
    setPage(1)
    setExpanded(null)
  }

  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = total ? Math.min(page * pageSize, total) : 0
  const hasFilters = Boolean(category || division || userId || action || search)
  const activeFilterCount = [category, division, userId, action, search].filter(Boolean).length

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
                <h1 className="text-xl font-semibold tracking-tight">Action Logs</h1>
                <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  Persistent
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                A permanent, numbered audit trail for roster, import, requirement, selection and management changes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadLogs()}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#303744] bg-[#0d1117] px-3 text-xs font-medium transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-blue-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        {/* Module tabs: intentionally flat, matching the reference layout. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {moduleOptions.map((option) => {
            const active = module === option.value
            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => selectModule(option.value as Module)}
                className={`h-8 rounded-lg border px-3 text-xs font-medium transition-all ${
                  active
                    ? "border-fuchsia-600/80 bg-fuchsia-600/10 text-fuchsia-400"
                    : "border-[#303744] bg-[#0d1117] text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {/* Reference-style filter row: no card/background around the controls. */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterSelect
            value={userId}
            options={userOptions}
            onChange={(value) => {
              setUserId(value)
              setPage(1)
              setExpanded(null)
            }}
            ariaLabel="User"
            className="w-[208px]"
          />

          <FilterSelect
            value={action}
            options={actionOptions}
            onChange={(value) => {
              setAction(value)
              setPage(1)
              setExpanded(null)
            }}
            ariaLabel="Action"
            className="w-[160px]"
          />

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${
              showFilters || activeFilterCount
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-[#303744] bg-[#0d1117] text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-foreground"
            }`}
          >
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-400">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setShowSearch((value) => !value)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${
              showSearch || search
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-[#303744] bg-[#0d1117] text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-foreground"
            }`}
          >
            Search
          </button>

          <span className="ml-auto text-xs text-muted-foreground">
            {total.toLocaleString()} {total === 1 ? "change" : "changes"}
          </span>
        </div>

        {showSearch ? (
          <div className="mb-4 relative max-w-[620px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search entries, people, ranks, IDs..."
              className="h-9 w-full rounded-lg border border-[#303744] bg-[#0d1117] pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-blue-500/60"
            />
          </div>
        ) : null}

        {showFilters ? (
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-4">
            <FilterSelect
              value={category}
              options={categoryOptions}
              onChange={(value) => {
                setCategory(value as Category)
                setPage(1)
                setExpanded(null)
              }}
              ariaLabel="Category"
              className="w-[170px]"
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
              className="w-[170px]"
            />
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#303744] px-3 text-xs text-muted-foreground transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <section>
          {loading && !logs.length ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading action logs...
            </div>
          ) : null}

          {!loading && !logs.length ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <History className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No action logs found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try clearing the filters or perform a dashboard action.
              </p>
            </div>
          ) : null}

          {grouped.map(([heading, group]) => (
            <div key={heading} className="mb-6">
              <div className="mb-2 px-0">
                <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                  {heading}
                </span>
              </div>

              <div className="space-y-1.5">
                {group.map((log) => {
                  const isOpen = expanded === log.id

                  return (
                    <article
                      key={log.id}
                      className="overflow-hidden rounded-xl border border-[#303744] bg-[#11151d] transition-colors hover:border-[#3d4758] hover:bg-[#131821]"
                    >
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] md:grid-cols-[44px_36px_minmax(165px,0.65fr)_minmax(280px,2fr)_auto] md:items-center"
                      >
                        <div className="flex items-center">
                          <span className="font-mono text-[10px] font-semibold text-blue-400">
                            #{log.entryNumber}
                          </span>
                        </div>

                        <div className="flex items-center justify-center">
                          <LogActionIcon log={log} />
                        </div>

                        <div className="min-w-0">
                          <CopyMenu
                            name={getDisplayName(log.userId, log.userName || log.username || "Unknown User")}
                            id={log.userId}
                            callsign={rosterProfiles[log.userId]?.callsign || log.callsign}
                            badgeNumber={rosterProfiles[log.userId]?.badgeNumber || log.badgeNumber}
                            rank={rosterProfiles[log.userId]?.rank || log.rank}
                            avatar={rosterProfiles[log.userId]?.avatar || log.avatar}
                          />
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{log.rank || "Unknown rank"}</span>
                            {log.callsign ? (
                              <>
                                <span>•</span>
                                <span>{log.callsign}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-5 text-foreground">
                            {log.summary}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="text-blue-300/80">{relativeTime(log.createdAt)}</span>

                            <span className="text-muted-foreground/60">•</span>

                            <Tag className={tagClass("module", log.module)}>
                              {moduleLabel(log.module)}
                            </Tag>

                            <Tag className={tagClass("division", log.division)}>
                              {divisionLabel(log.division)}
                            </Tag>

                            {log.category ? (
                              <Tag className={tagClass("category", log.category)}>
                                {actionLabel(log.category)}
                              </Tag>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <Tag className={statusClass(log)}>
                            {statusLabel(log)}
                          </Tag>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isOpen ? <DetailPanel log={log} rosterProfiles={rosterProfiles} /> : null}
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
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
                className="h-8 rounded-md border border-[#303744] bg-[#0d1117] px-2 text-xs outline-none focus:border-blue-500/60"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={75}>75 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <span>{start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
                className="h-8 rounded-md border border-[#303744] px-3 text-xs transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages || loading}
                onClick={() => setPage((value) => value + 1)}
                className="h-8 rounded-md border border-[#303744] px-3 text-xs transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40"
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
