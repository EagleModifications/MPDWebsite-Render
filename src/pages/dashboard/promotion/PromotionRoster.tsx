import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Copy,
  Filter,
  Search,
  Shield,
  Users,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import GoogleRosterRefresh from "@/components/dashboard/GoogleRosterRefresh"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Division =
  | "department"
  | "swat"
  | "mtf7"
  | "mcd"
  | "tru"

type Status =
  | "compliant"
  | "non-compliant"

type PromotionRosterMember = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  discordId: string
  timeInDept: string
  timeInRank: string
  requiredHours: number
  promotionHours: number
  requiredTimeInRankDays: number
  requiredTrainingLogs: number
  requiredRecruitmentLogs: number
  requiredLogs: number
  status: Status
}

type DiscordProfile = {
  id: string
  username: string
  displayName: string
  avatar?: string | null
}

type DiscordContextMenu = {
  discordId: string
  name: string
  x: number
  y: number
} | null

type CopyType =
  | "discord"
  | "discord-mention"
  | "name"
  | "callsign"
  | "badge"
  | "rank"
  | "name-discord"
  | "callsign-discord"
  | "callsign-name"
  | "callsign-badge"
  | "badge-name"
  | "badge-discord"
  | "callsign-name-discord"
  | "callsign-badge-discord"
  | "name-badge-discord"
  | "full"

function getDiscordAvatarUrl(
  discordId?: string,
  avatar?: string | null,
): string | undefined {
  const cleanAvatar = avatar?.trim()

  if (!cleanAvatar) {
    return undefined
  }

  if (
    cleanAvatar.startsWith("http://") ||
    cleanAvatar.startsWith("https://")
  ) {
    const match = cleanAvatar.match(
      /\/avatars\/(\d+)\/([^/?#]+)/i,
    )

    if (match) {
      const [, id, hashWithExtension] = match
      const hash = hashWithExtension.replace(
        /\.(gif|webp|png|jpg|jpeg)$/i,
        "",
      )

      if (hash.startsWith("a_")) {
        return `https://cdn.discordapp.com/avatars/${id}/${hash}.gif?size=256`
      }
    }

    return cleanAvatar
  }

  if (discordId && cleanAvatar.startsWith("a_")) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${cleanAvatar}.gif?size=256`
  }

  if (discordId) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${cleanAvatar}.png?size=256`
  }

  return undefined
}

function getDiscordDefaultAvatarUrl(
  discordId?: string,
): string | undefined {
  if (!discordId) {
    return undefined
  }

  try {
    const avatarIndex = Number(BigInt(discordId) % 6n)

    return `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png?size=256`
  } catch {
    return undefined
  }
}

function getDiscordInitials(
  displayName: string,
  username: string,
): string {
  const value =
    displayName.trim() ||
    username.trim() ||
    "User"

  return (
    value
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  )
}

const divisions: {
  id: Division
  label: string
}[] = [
  {
    id: "department",
    label: "Department",
  },
  {
    id: "swat",
    label: "SWAT",
  },
  {
    id: "mtf7",
    label: "MTF-7",
  },
  {
    id: "mcd",
    label: "MCD",
  },
  {
    id: "tru",
    label: "TRU",
  },
]

const statusOptions: {
  id: Status
  label: string
  icon: typeof CheckCircle2
}[] = [
  {
    id: "compliant",
    label: "Compliant",
    icon: CheckCircle2,
  },
  {
    id: "non-compliant",
    label: "Non-Compliant",
    icon: XCircle,
  },
]

const cleanValue = (
  value: unknown,
): string => {
  if (
    value === null ||
    value === undefined
  ) {
    return ""
  }

  const cleaned = String(value).trim()

  if (
    !cleaned ||
    cleaned === "-" ||
    cleaned === "—" ||
    cleaned === "#N/A" ||
    cleaned.toLowerCase() === "n/a" ||
    cleaned.toLowerCase() === "null" ||
    cleaned.toLowerCase() === "undefined"
  ) {
    return ""
  }

  return cleaned
}

const normalizeStatus = (
  value: unknown,
): Status => {
  const status =
    cleanValue(value).toLowerCase()

  if (status === "compliant") {
    return "compliant"
  }

  return "non-compliant"
}

const normalizeRank = (
  value: unknown,
): string =>
  cleanValue(value)
    .replace(/\s+/g, " ")
    .toLowerCase()

const getStatusLabel = (
  status: Status,
) => {
  switch (status) {
    case "compliant":
      return "Compliant"

    case "non-compliant":
      return "Non-Compliant"
  }
}

const getStatusClasses = (
  status: Status,
) => {
  switch (status) {
    case "compliant":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"

    case "non-compliant":
      return "border-red-500/20 bg-red-500/10 text-red-400"
  }
}

const getStatusIcon = (
  status: Status,
) => {
  switch (status) {
    case "compliant":
      return CheckCircle2

    case "non-compliant":
      return XCircle
  }
}

/* ─────────────────────────────────────────────
   Callsign Sorting
───────────────────────────────────────────── */

const compareCallsigns = (
  a: PromotionRosterMember,
  b: PromotionRosterMember,
) =>
  cleanValue(
    a.callsign,
  ).localeCompare(
    cleanValue(
      b.callsign,
    ),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  )

/* ─────────────────────────────────────────────
   Discord Profile Dropdown
───────────────────────────────────────────── */

type DiscordProfileDropdownProps = {
  member: PromotionRosterMember
  profile?: DiscordProfile
  profileLoading?: boolean
  onOpenChange: (open: boolean) => void
  onCopyId: (
    member: PromotionRosterMember,
  ) => void
  mobile?: boolean
}

function DiscordProfileDropdown({
  member,
  profile,
  profileLoading = false,
  onOpenChange,
  onCopyId,
  mobile = false,
}: DiscordProfileDropdownProps) {
  const displayName =
    profile?.displayName ||
    member.name ||
    "Discord User"

  const username =
    profile?.username ||
    ""

  const avatar =
    getDiscordAvatarUrl(
      member.discordId,
      profile?.avatar,
    ) ||
    getDiscordDefaultAvatarUrl(
      member.discordId,
    )

  const initials =
    getDiscordInitials(
      displayName,
      username,
    )

  return (
    <DropdownMenu
      onOpenChange={onOpenChange}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`${member.name} (${member.discordId})`}
          className={
            mobile
              ? "min-w-0 max-w-full truncate rounded-md px-2 py-1 text-left text-[11px] text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              : "mx-auto block max-w-full truncate rounded-md px-1.5 py-1 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
          }
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <span className="font-medium">
            {member.name}
          </span>{" "}
          <span>
            ({member.discordId})
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={mobile ? "start" : "end"}
        sideOffset={5}
        className="w-72"
      >
        <DropdownMenuLabel className="p-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0 rounded-lg">
              <AvatarImage
                src={avatar}
                alt={displayName}
              />

              <AvatarFallback className="rounded-lg">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {profileLoading
                  ? "Loading profile..."
                  : displayName}
              </p>

              <p className="truncate text-xs font-normal text-muted-foreground">
                {profileLoading
                  ? "Fetching Discord information"
                  : username
                    ? `@${username}`
                    : "Username unavailable"}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            onCopyId(member)
          }}
          className="gap-2"
        >
          <Copy className="h-4 w-4 text-blue-400" />

          <span>Copy ID</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function PromotionRoster() {
  const [division, setDivision] =
    useState<Division>("department")

  const [members, setMembers] =
    useState<PromotionRosterMember[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState("")

  const [statusFilters, setStatusFilters] =
    useState<Status[]>([])

  const [rankFilters, setRankFilters] =
    useState<string[]>([])

  const [selectedIds, setSelectedIds] =
    useState<string[]>([])

  const [selectedCopied, setSelectedCopied] =
    useState(false)

  const [openDiscordMenu, setOpenDiscordMenu] =
    useState<string | null>(null)

  const [discordContextMenu, setDiscordContextMenu] =
    useState<DiscordContextMenu>(null)

  const [discordProfiles, setDiscordProfiles] =
    useState<Record<string, DiscordProfile>>({})

  const [discordProfileLoading, setDiscordProfileLoading] =
    useState<Record<string, boolean>>({})

  const shiftSelectingRef =
    useRef(false)

  const loadDiscordProfile = useCallback(
    async (discordId: string) => {
      if (!discordId) {
        return
      }

      if (discordProfiles[discordId]) {
        return
      }

      if (discordProfileLoading[discordId]) {
        return
      }

      setDiscordProfileLoading(
        (current) => ({
          ...current,
          [discordId]: true,
        }),
      )

      try {
        const response = await fetch(
          `/api/promotion/discord-profile/${encodeURIComponent(
            discordId,
          )}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        )

        const data =
          (await response.json()) as {
            success?: boolean
            profile?: DiscordProfile
            error?: string
          }

        if (
          !response.ok ||
          !data.success ||
          !data.profile
        ) {
          throw new Error(
            data.error ||
              `Failed to load Discord profile (${response.status}).`,
          )
        }

        setDiscordProfiles(
          (current) => ({
            ...current,
            [discordId]:
              data.profile!,
          }),
        )
      } catch (profileError) {
        console.error(
          "[promotion-roster] Failed to load Discord profile:",
          profileError,
        )

        setDiscordProfiles(
          (current) => ({
            ...current,
            [discordId]: {
              id: discordId,
              username: "",
              displayName: "",
            },
          }),
        )
      } finally {
        setDiscordProfileLoading(
          (current) => ({
            ...current,
            [discordId]: false,
          }),
        )
      }
    },
    [
      discordProfileLoading,
      discordProfiles,
    ],
  )

  const showRecruitmentLogs =
    division === "department"

  const loadRoster = useCallback(
    async (
      showLoadingState = false,
    ) => {
      try {
        if (showLoadingState) {
          setLoading(true)
        }

        setError(null)

        const response = await fetch(
          `/api/promotion/roster/${division}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Failed to load roster (${response.status})`,
          )
        }

        const data =
          await response.json()

        if (!data?.success) {
          throw new Error(
            data?.error ||
              "Failed to load roster.",
          )
        }

        const roster: PromotionRosterMember[] =
          Array.isArray(data.members)
            ? data.members
                .map(
                  (
                    member: Record<
                      string,
                      unknown
                    >,
                  ) => ({
                    callsign: cleanValue(
                      member.callsign,
                    ),
                    badgeNumber: cleanValue(
                      member.badgeNumber,
                    ),
                    name: cleanValue(
                      member.name,
                    ),
                    rank: cleanValue(
                      member.rank,
                    ),
                    discordId: cleanValue(
                      member.discordId,
                    ),
                    timeInDept: cleanValue(
                      member.timeInDept,
                    ),
                    timeInRank: cleanValue(
                      member.timeInRank,
                    ),
                    requiredHours:
                      Number(
                        member.requiredHours,
                      ) || 0,
                    promotionHours:
                      Number(
                        member.promotionHours,
                      ) || 0,
                    requiredTimeInRankDays:
                      Number(
                        member.requiredTimeInRankDays,
                      ) || 0,
                    requiredTrainingLogs:
                      Number(
                        member.requiredTrainingLogs,
                      ) || 0,
                    requiredRecruitmentLogs:
                      Number(
                        member.requiredRecruitmentLogs,
                      ) || 0,
                    requiredLogs:
                      Number(
                        member.requiredLogs,
                      ) || 0,
                    status:
                      normalizeStatus(
                        member.status,
                      ),
                  }),
                )
                .filter(
                  (member) =>
                    member.name &&
                    member.callsign &&
                    member.badgeNumber &&
                    member.rank &&
                    member.discordId,
                )
            : []

        setMembers(roster)
        setSelectedIds([])
        setSelectedCopied(false)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load promotion roster."

        setMembers([])
        setError(message)

        toast.error(
          "Failed to load roster",
          {
            description: message,
          },
        )
      } finally {
        setLoading(false)
      }
    },
    [division],
  )

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  /*
   * The Discord profile dropdown is a Radix dropdown,
   * so it handles outside-click behavior itself.
   *
   * The custom right-click context menu is still closed
   * when clicking or scrolling elsewhere.
   */
  useEffect(() => {
    const closeContextMenu = () => {
      setDiscordContextMenu(null)
    }

    const closeOnScroll = () => {
      setDiscordContextMenu(null)
    }

    document.addEventListener(
      "click",
      closeContextMenu,
    )

    document.addEventListener(
      "scroll",
      closeOnScroll,
      true,
    )

    return () => {
      document.removeEventListener(
        "click",
        closeContextMenu,
      )

      document.removeEventListener(
        "scroll",
        closeOnScroll,
        true,
      )
    }
  }, [])

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        compareCallsigns,
      ),
    [members],
  )

  const rankOptions = useMemo(() => {
    const seen = new Set<string>()
    const ranks: string[] = []

    for (const member of sortedMembers) {
      const rank = cleanValue(
        member.rank,
      )

      const rankKey =
        normalizeRank(rank)

      if (!rank || !rankKey) {
        continue
      }

      if (seen.has(rankKey)) {
        continue
      }

      seen.add(rankKey)
      ranks.push(rank)
    }

    return ranks
  }, [sortedMembers])

  const filteredMembers = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    return sortedMembers.filter(
      (member) => {
        const matchesSearch =
          !query ||
          [
            member.callsign,
            member.badgeNumber,
            member.name,
            member.rank,
            member.discordId,
          ].some((value) =>
            cleanValue(value)
              .toLowerCase()
              .includes(query),
          )

        const matchesStatus =
          statusFilters.length === 0 ||
          statusFilters.includes(
            member.status,
          )

        const matchesRank =
          rankFilters.length === 0 ||
          rankFilters.some(
            (rank) =>
              normalizeRank(rank) ===
              normalizeRank(
                member.rank,
              ),
          )

        return (
          matchesSearch &&
          matchesStatus &&
          matchesRank
        )
      },
    )
  }, [
    sortedMembers,
    search,
    statusFilters,
    rankFilters,
  ])

  const stats = useMemo(() => {
    const compliant =
      members.filter(
        (member) =>
          member.status ===
          "compliant",
      ).length

    const nonCompliant =
      members.filter(
        (member) =>
          member.status ===
          "non-compliant",
      ).length

    const totalHours =
      members.reduce(
        (total, member) =>
          total +
          member.promotionHours,
        0,
      )

    return {
      total: members.length,
      compliant,
      nonCompliant,
      totalHours,
    }
  }, [members])

  const toggleMember = (
    discordId: string,
  ) => {
    if (!discordId) {
      return
    }

    setSelectedIds((current) =>
      current.includes(discordId)
        ? current.filter(
            (id) => id !== discordId,
          )
        : [...current, discordId],
    )

    setSelectedCopied(false)
  }

  const selectRankMembers = (
    member: PromotionRosterMember,
  ) => {
    const memberRank =
      normalizeRank(member.rank)

    if (
      !memberRank ||
      !member.discordId
    ) {
      return
    }

    const rankIds = filteredMembers
      .filter(
        (item) =>
          normalizeRank(
            item.rank,
          ) === memberRank &&
          item.discordId,
      )
      .map(
        (item) => item.discordId,
      )

    if (!rankIds.length) {
      return
    }

    setSelectedIds((current) =>
      Array.from(
        new Set([
          ...current,
          ...rankIds,
        ]),
      ),
    )

    setSelectedCopied(false)
  }

  const handleMemberSelection = (
    member: PromotionRosterMember,
    shiftKey: boolean,
  ) => {
    if (!member.discordId) {
      return
    }

    if (shiftKey) {
      selectRankMembers(member)
      return
    }

    toggleMember(member.discordId)
  }

  const toggleAllVisible = () => {
    const visibleIds =
      filteredMembers
        .map(
          (member) =>
            member.discordId,
        )
        .filter(Boolean)

    if (!visibleIds.length) {
      return
    }

    const allSelected =
      visibleIds.every((id) =>
        selectedIds.includes(id),
      )

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !visibleIds.includes(id),
        ),
      )
    } else {
      setSelectedIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...visibleIds,
          ]),
        ),
      )
    }

    setSelectedCopied(false)
  }

  const copySelected = async (
    type: CopyType,
  ) => {
    if (!selectedIds.length) {
      return
    }

    const selectedMembers =
      sortedMembers.filter((member) =>
        selectedIds.includes(
          member.discordId,
        ),
      )

    let values: string[] = []

    switch (type) {
      case "discord":
        values = selectedMembers.map(
          (member) =>
            member.discordId,
        )
        break

      case "discord-mention":
        values = selectedMembers.map(
          (member) =>
            `<@${member.discordId}>`,
        )
        break

      case "name":
        values = selectedMembers.map(
          (member) => member.name,
        )
        break

      case "callsign":
        values = selectedMembers.map(
          (member) =>
            member.callsign,
        )
        break

      case "badge":
        values = selectedMembers.map(
          (member) =>
            member.badgeNumber,
        )
        break

      case "rank":
        values = selectedMembers.map(
          (member) => member.rank,
        )
        break

      case "name-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.name} — ${member.discordId}`,
        )
        break

      case "callsign-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.discordId}`,
        )
        break

      case "callsign-name":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.name}`,
        )
        break

      case "callsign-badge":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.badgeNumber}`,
        )
        break

      case "badge-name":
        values = selectedMembers.map(
          (member) =>
            `${member.badgeNumber} — ${member.name}`,
        )
        break

      case "badge-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.badgeNumber} — ${member.discordId}`,
        )
        break

      case "callsign-name-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.name} — ${member.discordId}`,
        )
        break

      case "callsign-badge-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.badgeNumber} — ${member.discordId}`,
        )
        break

      case "name-badge-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.name} — ${member.badgeNumber} — ${member.discordId}`,
        )
        break

      case "full":
        values = selectedMembers.map(
          (member) => {
            const details = [
              member.callsign,
              member.badgeNumber,
              member.name,
              member.rank,
              member.discordId,
              member.timeInDept,
              member.timeInRank,
              `${member.requiredTimeInRankDays} DAYS`,
              `Trainings: ${member.requiredTrainingLogs}`,
            ]

            if (
              showRecruitmentLogs
            ) {
              details.push(
                `Recruitments/Ridealongs: ${member.requiredRecruitmentLogs}`,
              )
            }

            details.push(
              `${member.requiredHours.toFixed(1)}h`,
              `${member.promotionHours.toFixed(1)}h`,
              getStatusLabel(
                member.status,
              ),
            )

            return details.join(
              " — ",
            )
          },
        )
        break
    }

    if (!values.length) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        values.join("\n"),
      )

      setSelectedCopied(true)

      toast.success(
        "Copied successfully",
        {
          description: `${selectedMembers.length} ${
            selectedMembers.length ===
            1
              ? "member"
              : "members"
          } copied to your clipboard.`,
        },
      )

      window.setTimeout(() => {
        setSelectedCopied(false)
      }, 1800)
    } catch {
      setSelectedCopied(false)

      toast.error(
        "Copy failed",
        {
          description:
            "Your browser could not access the clipboard.",
        },
      )
    }
  }

  const toggleStatusFilter = (
    status: Status,
  ) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter(
            (item) =>
              item !== status,
          )
        : [...current, status],
    )

    setSelectedCopied(false)
  }

  const selectAllStatuses = () => {
    setStatusFilters(
      statusOptions.map(
        (status) => status.id,
      ),
    )

    setSelectedCopied(false)
  }

  const clearStatuses = () => {
    setStatusFilters([])
    setSelectedCopied(false)
  }

  const toggleRankFilter = (
    rank: string,
  ) => {
    setRankFilters((current) => {
      const exists = current.some(
        (item) =>
          normalizeRank(item) ===
          normalizeRank(rank),
      )

      if (exists) {
        return current.filter(
          (item) =>
            normalizeRank(item) !==
            normalizeRank(rank),
        )
      }

      return [...current, rank]
    })

    setSelectedCopied(false)
  }

  const selectAllRanks = () => {
    setRankFilters([
      ...rankOptions,
    ])
    setSelectedCopied(false)
  }

  const clearRanks = () => {
    setRankFilters([])
    setSelectedCopied(false)
  }

  const clearFilters = () => {
    setSearch("")
    setStatusFilters([])
    setRankFilters([])
    setSelectedCopied(false)
  }

  const allVisibleSelected =
    filteredMembers.length > 0 &&
    filteredMembers
      .filter(
        (member) =>
          member.discordId,
      )
      .every((member) =>
        selectedIds.includes(
          member.discordId,
        ),
      )

  const hasFilters =
    Boolean(search.trim()) ||
    statusFilters.length > 0 ||
    rankFilters.length > 0

  const selectedStatusCount =
    statusFilters.length

  const selectedRankCount =
    rankFilters.length

  const copyDiscordId = async (
    member: PromotionRosterMember,
  ) => {
    try {
      await navigator.clipboard.writeText(
        member.discordId,
      )

      toast.success(
        "Discord ID copied",
        {
          description: `${member.name}'s Discord ID has been copied to your clipboard.`,
        },
      )
    } catch {
      toast.error(
        "Copy failed",
        {
          description:
            "Your browser could not access the clipboard.",
        },
      )
    } finally {
      setOpenDiscordMenu(null)
      setDiscordContextMenu(null)
    }
  }

  const handleDiscordDropdownOpen = (
    member: PromotionRosterMember,
    open: boolean,
  ) => {
    if (open) {
      setDiscordContextMenu(null)
      setOpenDiscordMenu(
        member.discordId,
      )

      void loadDiscordProfile(
        member.discordId,
      )

      return
    }

    setOpenDiscordMenu(null)
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-full min-w-0 flex-col gap-4 overflow-x-hidden p-3 sm:gap-6 sm:p-6">
        {/* HEADER */}

        <div className="flex shrink-0 flex-col gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Promotion Roster
                </h1>

                <p className="text-sm text-muted-foreground">
                  View promotion compliance and
                  roster information for each
                  division.
                </p>
              </div>
            </div>
          </div>

          {/* Division Tabs */}

          <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-full items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 sm:min-w-0">
              {divisions.map((item) => {
                const active =
                  division === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (
                        division === item.id
                      ) {
                        return
                      }

                      setDivision(item.id)
                      setSearch("")
                      setStatusFilters([])
                      setRankFilters([])
                      setSelectedIds([])
                      setSelectedCopied(false)
                      setError(null)
                      setOpenDiscordMenu(null)
                      setDiscordContextMenu(null)
                    }}
                    className={
                      active
                        ? "shrink-0 rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 shadow-sm transition-colors sm:px-4 sm:text-sm"
                        : "shrink-0 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-4 sm:text-sm"
                    }
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Stats */}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total
              </p>

              <Users className="h-4 w-4 text-blue-500" />
            </div>

            <p className="mt-2 text-2xl font-semibold">
              {stats.total}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/10 bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Compliant
              </p>

              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>

            <p className="mt-2 text-2xl font-semibold text-emerald-500">
              {stats.compliant}
            </p>
          </div>

          <div className="rounded-xl border border-red-500/10 bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Non-Compliant
              </p>

              <XCircle className="h-4 w-4 text-red-500" />
            </div>

            <p className="mt-2 text-2xl font-semibold text-red-500">
              {stats.nonCompliant}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Promotion Hours
              </p>

              <Clock3 className="h-4 w-4 text-blue-500" />
            </div>

            <p className="mt-2 text-2xl font-semibold">
              {stats.totalHours.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Filters */}

        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search */}

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value,
                  )
                  setSelectedCopied(false)
                }}
                placeholder="Search name, callsign, badge, rank or Discord ID..."
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 xl:min-w-[170px]"
                >
                  <Filter className="h-4 w-4 text-blue-400" />

                  <span>Status</span>

                  {selectedStatusCount >
                    0 && (
                    <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                      {
                        selectedStatusCount
                      }
                    </span>
                  )}

                  <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56"
              >
                <DropdownMenuItem
                  onSelect={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => {
                    if (
                      statusFilters.length ===
                      statusOptions.length
                    ) {
                      clearStatuses()
                    } else {
                      selectAllStatuses()
                    }
                  }}
                  className="gap-2"
                >
                  <Checkbox
                    checked={
                      statusFilters.length ===
                      statusOptions.length
                    }
                    tabIndex={-1}
                    className="pointer-events-none"
                  />

                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-blue-400" />

                    <span className="font-medium">
                      All Statuses
                    </span>
                  </div>
                </DropdownMenuItem>

                <div className="my-1 h-px bg-border" />

                {statusOptions.map(
                  (status) => {
                    const Icon =
                      status.icon

                    const checked =
                      statusFilters.includes(
                        status.id,
                      )

                    return (
                      <DropdownMenuItem
                        key={status.id}
                        onSelect={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          toggleStatusFilter(
                            status.id,
                          )
                        }
                        className="gap-2"
                      >
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />

                        <Icon
                          className={`h-4 w-4 ${
                            status.id ===
                            "compliant"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        />

                        <span>
                          {status.label}
                        </span>
                      </DropdownMenuItem>
                    )
                  },
                )}

                {statusFilters.length >
                  0 && (
                  <>
                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={
                        clearStatuses
                      }
                      className="gap-2 text-muted-foreground"
                    >
                      <X className="h-4 w-4" />

                      Clear Statuses
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Rank Filter */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 xl:min-w-[170px]"
                >
                  <Shield className="h-4 w-4 text-blue-400" />

                  <span>Rank</span>

                  {selectedRankCount >
                    0 && (
                    <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                      {selectedRankCount}
                    </span>
                  )}

                  <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="max-h-80 w-64 overflow-y-auto"
              >
                <DropdownMenuItem
                  onSelect={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => {
                    if (
                      rankOptions.length > 0 &&
                      rankFilters.length ===
                        rankOptions.length
                    ) {
                      clearRanks()
                    } else {
                      selectAllRanks()
                    }
                  }}
                  className="gap-2"
                >
                  <Checkbox
                    checked={
                      rankOptions.length > 0 &&
                      rankFilters.length ===
                        rankOptions.length
                    }
                    tabIndex={-1}
                    className="pointer-events-none"
                  />

                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-blue-400" />

                    <span className="font-medium">
                      All Ranks
                    </span>
                  </div>
                </DropdownMenuItem>

                <div className="my-1 h-px bg-border" />

                {rankOptions.length ===
                0 ? (
                  <DropdownMenuItem
                    disabled
                  >
                    No ranks available
                  </DropdownMenuItem>
                ) : (
                  rankOptions.map(
                    (rank) => {
                      const checked =
                        rankFilters.some(
                          (item) =>
                            normalizeRank(
                              item,
                            ) ===
                            normalizeRank(
                              rank,
                            ),
                        )

                      return (
                        <DropdownMenuItem
                          key={rank}
                          onSelect={(event) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            toggleRankFilter(
                              rank,
                            )
                          }
                          className="gap-2"
                        >
                          <Checkbox
                            checked={
                              checked
                            }
                            tabIndex={-1}
                            className="pointer-events-none"
                          />

                          <Shield className="h-4 w-4 text-blue-400" />

                          <span className="truncate">
                            {rank}
                          </span>
                        </DropdownMenuItem>
                      )
                    },
                  )
                )}

                {rankFilters.length >
                  0 && (
                  <>
                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={
                        clearRanks
                      }
                      className="gap-2 text-muted-foreground"
                    >
                      <X className="h-4 w-4" />

                      Clear Ranks
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}

            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />

                Clear
              </Button>
            )}

            {/* Selected Copy Actions */}

            {selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant={
                      selectedCopied
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="gap-2"
                  >
                    {selectedCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}

                    {selectedCopied
                      ? "Copied"
                      : `Copy Selected (${selectedIds.length})`}

                    {!selectedCopied && (
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    )}
                  </Button>
                </DropdownMenuTrigger>

                {!selectedCopied && (
                  <DropdownMenuContent
                    align="end"
                    className="max-h-72 w-64 overflow-y-auto"
                  >
                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Discord IDs
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "discord-mention",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Discord Mentions
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "name",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Names
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "callsign",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Callsigns
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "badge",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Badge Numbers
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "rank",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Ranks
                    </DropdownMenuItem>

                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "name-discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Name + Discord ID
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "callsign-discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Discord ID
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "callsign-name",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Name
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "callsign-badge",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Badge
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "badge-name",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Badge + Name
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "badge-discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Badge + Discord ID
                    </DropdownMenuItem>

                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "callsign-name-discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Name + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "callsign-badge-discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Badge + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "name-badge-discord",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Name + Badge + Discord
                    </DropdownMenuItem>

                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected(
                          "full",
                        )
                      }
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Copy Full Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            )}

            {/* Google Sheets Refresh */}

            <GoogleRosterRefresh
              onRefreshed={() =>
                loadRoster(false)
              }
            />
          </div>

          {/* Active Filters */}

          {(statusFilters.length > 0 ||
            rankFilters.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />

                Active filters:
              </div>

              {statusFilters.map(
                (status) => {
                  const Icon =
                    getStatusIcon(status)

                  return (
                    <button
                      key={`status-${status}`}
                      type="button"
                      onClick={() =>
                        toggleStatusFilter(
                          status,
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${getStatusClasses(
                        status,
                      )}`}
                    >
                      <Icon className="h-3 w-3" />

                      {getStatusLabel(
                        status,
                      )}

                      <X className="h-3 w-3" />
                    </button>
                  )
                },
              )}

              {rankFilters.map(
                (rank) => (
                  <button
                    key={`rank-${rank}`}
                    type="button"
                    onClick={() =>
                      toggleRankFilter(
                        rank,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                  >
                    <Shield className="h-3 w-3" />

                    {rank}

                    <X className="h-3 w-3" />
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* Error */}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Roster */}

        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="min-w-0">
              <h2 className="font-medium">
                {divisions.find(
                  (item) =>
                    item.id === division,
                )?.label ??
                  "Department"}{" "}
                Roster
              </h2>

              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {filteredMembers.length} of{" "}
                {members.length} members
              </p>
            </div>

            {selectedIds.length > 0 && (
              <div className="shrink-0 text-xs text-muted-foreground">
                {selectedIds.length} selected
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />

                Loading roster...
              </div>
            </div>
          ) : filteredMembers.length ===
            0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 px-6 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />

              <p className="font-medium">
                No members found
              </p>

              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "Try changing or clearing your filters."
                  : "There are no valid roster members available."}
              </p>

              {hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={
                    clearFilters
                  }
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop roster */}

              <div className="hidden w-full min-w-0 overflow-hidden md:block">
                <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-[3%]" />
                    <col className="w-[6%]" />
                    <col className="w-[5%]" />
                    <col className="w-[9%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[9%]" />
                    <col className="w-[14%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[7%]" />
                  </colgroup>

                  <thead>
                    <tr className="border-b bg-muted/30 text-center">
                      <th className="overflow-hidden px-2 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={
                              allVisibleSelected
                            }
                            onCheckedChange={
                              toggleAllVisible
                            }
                            aria-label="Select all visible members"
                          />
                        </div>
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Callsign
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Badge
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Name
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Rank
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Discord ID
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        <span className="block truncate">
                          Time in Dept
                        </span>
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        <span className="block truncate">
                          Time in Rank
                        </span>
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        <span className="block truncate">
                          Required Time in Rank
                        </span>
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Required Logs
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Required Hours
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Activity
                      </th>

                      <th className="overflow-hidden px-2 py-3 text-center font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMembers.map(
                      (member) => {
                        const selected =
                          selectedIds.includes(
                            member.discordId,
                          )

                        const StatusIcon =
                          getStatusIcon(
                            member.status,
                          )

                        return (
                          <tr
                            key={
                              member.discordId ||
                              `${member.badgeNumber}-${member.callsign}-${member.name}`
                            }
                            className={`border-b last:border-0 transition-colors hover:bg-muted/20 ${
                              selected
                                ? "bg-blue-500/5"
                                : ""
                            }`}
                          >
                            {/* Select */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={
                                    selected
                                  }
                                  disabled={
                                    !member.discordId
                                  }
                                  aria-label={`Select ${member.name}`}
                                  onPointerDown={(
                                    event,
                                  ) => {
                                    shiftSelectingRef.current =
                                      event.shiftKey
                                  }}
                                  onCheckedChange={() => {
                                    const shiftKey =
                                      shiftSelectingRef.current

                                    shiftSelectingRef.current =
                                      false

                                    handleMemberSelection(
                                      member,
                                      shiftKey,
                                    )
                                  }}
                                />
                              </div>
                            </td>

                            {/* Callsign */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle font-medium">
                              <span className="block truncate">
                                {member.callsign}
                              </span>
                            </td>

                            {/* Badge */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle text-muted-foreground">
                              <span className="block truncate">
                                {member.badgeNumber}
                              </span>
                            </td>

                            {/* Name */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle">
                              <span className="block truncate">
                                {member.name}
                              </span>
                            </td>

                            {/* Rank */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle text-muted-foreground">
                              <span
                                className="block truncate"
                                title={
                                  member.rank
                                }
                              >
                                {member.rank}
                              </span>
                            </td>

                            {/* Discord */}

                            <td className="relative overflow-visible px-2 py-3 text-center align-middle">
                              <DiscordProfileDropdown
                                member={
                                  member
                                }
                                profile={
                                  discordProfiles[
                                    member.discordId
                                  ]
                                }
                                profileLoading={
                                  discordProfileLoading[
                                    member.discordId
                                  ]
                                }
                                onOpenChange={(
                                  open,
                                ) =>
                                  handleDiscordDropdownOpen(
                                    member,
                                    open,
                                  )
                                }
                                onCopyId={
                                  copyDiscordId
                                }
                              />
                            </td>

                            {/* Time in Department */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle text-muted-foreground">
                              <span className="block truncate">
                                {member.timeInDept ||
                                  "—"}
                              </span>
                            </td>

                            {/* Time in Rank */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle text-muted-foreground">
                              <span className="block truncate">
                                {member.timeInRank ||
                                  "—"}
                              </span>
                            </td>

                            {/* Required Time in Rank */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle font-medium">
                              <span className="block truncate">
                                {
                                  member.requiredTimeInRankDays
                                }{" "}
                                DAYS
                              </span>
                            </td>

                            {/* Required Logs */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle">
                              <div className="space-y-0.5 text-[11px] leading-4">
                                <div className="whitespace-nowrap">
                                  Trainings:{" "}
                                  {
                                    member.requiredTrainingLogs
                                  }
                                </div>

                                {showRecruitmentLogs && (
                                  <div className="whitespace-nowrap">
                                    Recruitments/Ridealongs:{" "}
                                    {
                                      member.requiredRecruitmentLogs
                                    }
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Required Hours */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle font-medium">
                              <span className="block truncate">
                                {member.requiredHours.toFixed(
                                  1,
                                )}
                                h
                              </span>
                            </td>

                            {/* Activity */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle font-medium">
                              <span className="block truncate">
                                {member.promotionHours.toFixed(
                                  1,
                                )}
                                h
                              </span>
                            </td>

                            {/* Status */}

                            <td className="overflow-hidden px-2 py-3 text-center align-middle">
                              <div
                                className={`mx-auto inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                                  member.status,
                                )}`}
                              >
                                <StatusIcon className="h-3 w-3 shrink-0" />

                                <span className="truncate">
                                  {getStatusLabel(
                                    member.status,
                                  )}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile roster cards */}

              <div className="divide-y md:hidden">
                {filteredMembers.map(
                  (member) => {
                    const selected =
                      selectedIds.includes(
                        member.discordId,
                      )

                    const StatusIcon =
                      getStatusIcon(
                        member.status,
                      )

                    return (
                      <div
                        key={
                          member.discordId ||
                          `${member.badgeNumber}-${member.callsign}-${member.name}`
                        }
                        className={`p-4 transition-colors ${
                          selected
                            ? "bg-blue-500/5"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={
                                selected
                              }
                              disabled={
                                !member.discordId
                              }
                              aria-label={`Select ${member.name}`}
                              onPointerDown={(
                                event,
                              ) => {
                                shiftSelectingRef.current =
                                  event.shiftKey
                              }}
                              onCheckedChange={() => {
                                const shiftKey =
                                  shiftSelectingRef.current

                                shiftSelectingRef.current =
                                  false

                                handleMemberSelection(
                                  member,
                                  shiftKey,
                                )
                              }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {
                                    member.callsign
                                  }
                                </p>

                                <p className="truncate text-sm text-muted-foreground">
                                  {
                                    member.name
                                  }
                                </p>
                              </div>

                              <div
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                                  member.status,
                                )}`}
                              >
                                <StatusIcon className="h-3 w-3" />

                                {getStatusLabel(
                                  member.status,
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Badge
                                </p>

                                <p className="mt-0.5 truncate font-medium">
                                  {
                                    member.badgeNumber
                                  }
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Rank
                                </p>

                                <p className="mt-0.5 truncate font-medium">
                                  {
                                    member.rank
                                  }
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Promotion
                                </p>

                                <p className="mt-0.5 font-medium">
                                  {member.promotionHours.toFixed(
                                    1,
                                  )}
                                  h
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Required Hours
                                </p>

                                <p className="mt-0.5 font-medium">
                                  {member.requiredHours.toFixed(
                                    1,
                                  )}
                                  h
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Time in Dept
                                </p>

                                <p className="mt-0.5 truncate font-medium">
                                  {
                                    member.timeInDept ||
                                    "—"
                                  }
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Time in Rank
                                </p>

                                <p className="mt-0.5 truncate font-medium">
                                  {
                                    member.timeInRank ||
                                    "—"
                                  }
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Req Time in Rank
                                </p>

                                <p className="mt-0.5 font-medium">
                                  {
                                    member.requiredTimeInRankDays
                                  }{" "}
                                  DAYS
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-muted-foreground">
                                  Req Logs
                                </p>

                                <div className="mt-0.5 space-y-0.5 font-medium leading-4">
                                  <p>
                                    Trainings:{" "}
                                    {
                                      member.requiredTrainingLogs
                                    }
                                  </p>

                                  {showRecruitmentLogs && (
                                    <p>
                                      Recruitments/Ridealongs:{" "}
                                      {
                                        member.requiredRecruitmentLogs
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex min-w-0 items-center gap-2">
                              <span className="shrink-0 text-xs text-muted-foreground">
                                Discord
                              </span>

                              <div className="relative min-w-0">
                                <DiscordProfileDropdown
                                  member={
                                    member
                                  }
                                  profile={
                                    discordProfiles[
                                      member.discordId
                                    ]
                                  }
                                  profileLoading={
                                    discordProfileLoading[
                                      member.discordId
                                    ]
                                  }
                                  mobile
                                  onOpenChange={(
                                    open,
                                  ) =>
                                    handleDiscordDropdownOpen(
                                      member,
                                      open,
                                    )
                                  }
                                  onCopyId={
                                    copyDiscordId
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </>
          )}
        </div>

        {/* Right-click Discord context menu */}

        {discordContextMenu && (
          <div
            className="fixed z-[100] w-52 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl"
            style={{
              left: discordContextMenu.x,
              top: discordContextMenu.y,
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
            onContextMenu={(event) =>
              event.preventDefault()
            }
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => {
                const member =
                  members.find(
                    (item) =>
                      item.discordId ===
                      discordContextMenu.discordId,
                  )

                if (member) {
                  void copyDiscordId(
                    member,
                  )
                }
              }}
            >
              <Copy className="h-4 w-4 text-blue-400" />

              Copy ID
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
