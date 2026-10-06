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
  Clock3,
  Copy,
  Filter,
  ListPlus,
  Search,
  Shield,
  Users,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import RosterListDialog from "@/components/dashboard/RosterListDialog"
import GoogleRosterRefresh from "@/components/dashboard/GoogleRosterRefresh"
import { logAction } from "@/lib/actionLog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  | "callsign-badge-name"
  | "callsign-badge-name-discord"
  | "name-rank-discord"
  | "full"

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

export default function PromotionRoster() {
  const [division, setDivision] =
    useState<Division>("department")

  const displayDivision =
    divisions.find((entry) => entry.id === division)?.label ?? division

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

  const [rosterListOpen, setRosterListOpen] =
    useState(false)

  const shiftSelectingRef =
    useRef(false)

  /* ─────────────────────────────────────────────
     Whether this division uses recruitment logs
  ───────────────────────────────────────────── */

  const showRecruitmentLogs =
    division === "department"

  /* ─────────────────────────────────────────────
     Load Roster
  ───────────────────────────────────────────── */

  const loadRoster = useCallback(
    async (showLoadingState = false) => {
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

  /* ─────────────────────────────────────────────
     Sorted Members
  ───────────────────────────────────────────── */

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        compareCallsigns,
      ),
    [members],
  )

  /* ─────────────────────────────────────────────
     Rank Options
  ───────────────────────────────────────────── */

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

  /* ─────────────────────────────────────────────
     Filtered Members
  ───────────────────────────────────────────── */

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
              normalizeRank(member.rank),
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

  /* ─────────────────────────────────────────────
     Statistics
  ───────────────────────────────────────────── */

  const stats = useMemo(() => {
    const compliant = members.filter(
      (member) =>
        member.status === "compliant",
    ).length

    const nonCompliant = members.filter(
      (member) =>
        member.status === "non-compliant",
    ).length

    const totalHours = members.reduce(
      (total, member) =>
        total + member.promotionHours,
      0,
    )

    return {
      total: members.length,
      compliant,
      nonCompliant,
      totalHours,
    }
  }, [members])

  /* ─────────────────────────────────────────────
     Selection
  ───────────────────────────────────────────── */

  const toggleMember = (
    discordId: string,
  ) => {
    if (!discordId) {
      return
    }

    const member = members.find(
      (item) => item.discordId === discordId,
    )
    const wasSelected = selectedIds.includes(discordId)

    setSelectedIds((current) =>
      current.includes(discordId)
        ? current.filter(
            (id) => id !== discordId,
          )
        : [...current, discordId],
    )

    if (member) {
      logAction({
        module: "promotion",
        action: wasSelected ? "deselect-member" : "select-member",
        category: "roster",
        division,
        targetUserId: member.discordId,
        targetName: member.name,
        targetRank: member.rank,
        summary: `${wasSelected ? "Deselected" : "Selected"} ${member.name} in the ${displayDivision} promotion roster.`,
      })
    }

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
          normalizeRank(item.rank) ===
            memberRank &&
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

    logAction({
        module: "promotion",
      action: "select-rank",
      category: "roster",
      division,
      targetRank: member.rank,
      summary: `Selected ${rankIds.length} ${member.rank} members in the ${displayDivision} promotion roster.`,
      details: { count: rankIds.length },
    })

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
          (member) => member.discordId,
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

    logAction({
        module: "promotion",
      action: allSelected ? "deselect-all-visible" : "select-all-visible",
      category: "roster",
      division,
      summary: `${allSelected ? "Deselected" : "Selected"} all ${visibleIds.length} visible members in the ${displayDivision} promotion roster.`,
      details: { count: visibleIds.length },
    })

    setSelectedCopied(false)
  }

  /* ─────────────────────────────────────────────
     Copy
  ───────────────────────────────────────────── */

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
          (member) => member.discordId,
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
          (member) => member.callsign,
        )
        break

      case "badge":
        values = selectedMembers.map(
          (member) => member.badgeNumber,
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

      case "callsign-badge-name":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.badgeNumber} — ${member.name}`,
        )
        break

      case "callsign-badge-name-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.callsign} — ${member.badgeNumber} — ${member.name} — ${member.discordId}`,
        )
        break

      case "name-rank-discord":
        values = selectedMembers.map(
          (member) =>
            `${member.name} — ${member.rank} — ${member.discordId}`,
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

            if (showRecruitmentLogs) {
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

      const copyLabels: Record<CopyType, string> = {
        discord: "Discord ID",
        "discord-mention": "Discord Mention",
        name: "Name",
        callsign: "Callsign",
        badge: "Badge Number",
        rank: "Rank",
        "name-discord": "Name + Discord ID",
        "callsign-discord": "Callsign + Discord ID",
        "callsign-name": "Callsign + Name",
        "callsign-badge": "Callsign + Badge Number",
        "badge-name": "Badge Number + Name",
        "badge-discord": "Badge Number + Discord ID",
        "callsign-name-discord": "Callsign + Name + Discord ID",
        "callsign-badge-discord": "Callsign + Badge Number + Discord ID",
        "name-badge-discord": "Name + Badge Number + Discord ID",
        "callsign-badge-name": "Callsign + Badge Number + Name",
        "callsign-badge-name-discord":
          "Callsign + Badge Number + Name + Discord ID",
        "name-rank-discord": "Name + Rank + Discord ID",
        full: "Full Roster",
      }

      toast.success(`${copyLabels[type]} copied to clipboard`)

      logAction({
        module: "promotion",
        action: "copy-roster",
        category: "roster",
        division,
        summary: `Copied ${selectedMembers.length} selected members from the ${displayDivision} promotion roster.`,
        details: {
          copyType: type,
          count: selectedMembers.length,
          memberIds: selectedMembers.map((member) => member.discordId),
        },
      })

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

  /* ─────────────────────────────────────────────
     Status Filters
  ───────────────────────────────────────────── */

  const toggleStatusFilter = (
    status: Status,
  ) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter(
            (item) => item !== status,
          )
        : [...current, status],
    )

    setSelectedCopied(false)

    logAction({
        module: "promotion",
      action: "filter-status",
      category: "roster",
      division,
      summary: `Toggled ${getStatusLabel(status)} status filter on the ${displayDivision} promotion roster.`,
      details: { status },
    })
  }

  const selectAllStatuses = () => {
    setStatusFilters(
      statusOptions.map(
        (status) => status.id,
      ),
    )

    logAction({
        module: "promotion",
      action: "filter-status",
      category: "roster",
      division,
      summary: `Selected all status filters on the ${displayDivision} promotion roster.`,
    })

    setSelectedCopied(false)
  }

  const clearStatuses = () => {
    setStatusFilters([])
    logAction({
        module: "promotion",
      action: "clear-status-filters",
      category: "roster",
      division,
      summary: `Cleared status filters on the ${displayDivision} promotion roster.`,
    })
    setSelectedCopied(false)
  }

  /* ─────────────────────────────────────────────
     Rank Filters
  ───────────────────────────────────────────── */

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

    logAction({
        module: "promotion",
      action: "filter-rank",
      category: "roster",
      division,
      targetRank: rank,
      summary: `Toggled ${rank} rank filter on the ${displayDivision} promotion roster.`,
      details: { rank },
    })

    setSelectedCopied(false)
  }

  const selectAllRanks = () => {
    setRankFilters([...rankOptions])
    logAction({
        module: "promotion",
      action: "filter-rank",
      category: "roster",
      division,
      summary: `Selected all rank filters on the ${displayDivision} promotion roster.`,
      details: { ranks: rankOptions },
    })
    setSelectedCopied(false)
  }

  const clearRanks = () => {
    setRankFilters([])
    logAction({
        module: "promotion",
      action: "clear-rank-filters",
      category: "roster",
      division,
      summary: `Cleared rank filters on the ${displayDivision} promotion roster.`,
    })
    setSelectedCopied(false)
  }

  const clearSearch = () => {
    setSearch("")
    setSelectedCopied(false)
  }

  /* ─────────────────────────────────────────────
     Clear Filters
  ───────────────────────────────────────────── */

  const clearFilters = () => {
    setSearch("")
    setStatusFilters([])
    setRankFilters([])
    setSelectedCopied(false)

    logAction({
        module: "promotion",
      action: "clear-filters",
      category: "roster",
      division,
      summary: `Cleared all filters on the ${displayDivision} promotion roster.`,
    })
  }

  const allVisibleSelected =
    filteredMembers.length > 0 &&
    filteredMembers
      .filter(
        (member) => member.discordId,
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

  const copyMember = async (
    type: CopyType,
    member: PromotionRosterMember,
  ) => {
    let value = ""
    let label = ""

    switch (type) {
      case "discord":
        value = member.discordId
        label = "Discord ID"
        break
      case "discord-mention":
        value = `<@${member.discordId}>`
        label = "Discord Mention"
        break
      case "name":
        value = member.name
        label = "Name"
        break
      case "callsign":
        value = member.callsign
        label = "Callsign"
        break
      case "badge":
        value = member.badgeNumber
        label = "Badge Number"
        break
      case "rank":
        value = member.rank
        label = "Rank"
        break
      case "name-discord":
        value = `${member.name} — ${member.discordId}`
        label = "Name + Discord ID"
        break
      case "callsign-discord":
        value = `${member.callsign} — ${member.discordId}`
        label = "Callsign + Discord ID"
        break
      case "callsign-name":
        value = `${member.callsign} — ${member.name}`
        label = "Callsign + Name"
        break
      case "callsign-badge":
        value = `${member.callsign} — ${member.badgeNumber}`
        label = "Callsign + Badge Number"
        break
      case "badge-name":
        value = `${member.badgeNumber} — ${member.name}`
        label = "Badge Number + Name"
        break
      case "badge-discord":
        value = `${member.badgeNumber} — ${member.discordId}`
        label = "Badge Number + Discord ID"
        break
      case "callsign-name-discord":
        value = `${member.callsign} — ${member.name} — ${member.discordId}`
        label = "Callsign + Name + Discord"
        break
      case "callsign-badge-discord":
        value = `${member.callsign} — ${member.badgeNumber} — ${member.discordId}`
        label = "Callsign + Badge + Discord"
        break
      case "name-badge-discord":
        value = `${member.name} — ${member.badgeNumber} — ${member.discordId}`
        label = "Name + Badge + Discord"
        break
      case "callsign-badge-name":
        value = `${member.callsign} — ${member.badgeNumber} — ${member.name}`
        label = "Callsign + Badge + Name"
        break
      case "callsign-badge-name-discord":
        value = `${member.callsign} — ${member.badgeNumber} — ${member.name} — ${member.discordId}`
        label = "Callsign + Badge + Name + Discord"
        break
      case "name-rank-discord":
        value = `${member.name} — ${member.rank} — ${member.discordId}`
        label = "Name + Rank + Discord"
        break
      case "full": {
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

        if (showRecruitmentLogs) {
          details.push(
            `Recruitments/Ridealongs: ${member.requiredRecruitmentLogs}`,
          )
        }

        details.push(
          `${member.requiredHours.toFixed(1)}h`,
          `${member.promotionHours.toFixed(1)}h`,
          getStatusLabel(member.status),
        )

        value = details.join(" — ")
        label = "Full Details"
        break
      }
    }

    try {
      await navigator.clipboard.writeText(value)

      logAction({
        module: "promotion",
        action: "copy-member",
        category: "roster",
        division,
        targetUserId: member.discordId,
        targetName: member.name,
        targetRank: member.rank,
        summary: `Copied ${label} for ${member.name} from the ${displayDivision} promotion roster.`,
        details: { copyType: type },
      })

      toast.success(`${label} copied to clipboard`)
    } catch {
      toast.error("Copy failed", {
        description: "Your browser could not access the clipboard.",
      })
    }
  }

  const copyDiscordId = async (
    member: PromotionRosterMember,
  ) => {
    await copyMember("discord", member)
  }

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

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

                      logAction({
        module: "promotion",
                        action: "change-division",
                        category: "navigation",
                        division: item.id,
                        summary: `Switched Promotion Roster from ${divisions.find((entry) => entry.id === division)?.label ?? division} to ${item.label}.`,
                        details: {
                          fromDivision: division,
                          toDivision: item.id,
                        },
                      })

                      setDivision(item.id)
                      setSearch("")
                      setStatusFilters([])
                      setRankFilters([])
                      setSelectedIds([])
                      setSelectedCopied(false)
                      setError(null)
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

        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search */}

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSelectedCopied(false)
                }}
                placeholder="Search name, callsign, badge, rank or Discord ID..."
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Clear Search */}

            {search.trim() && (
              <Button
                type="button"
                onClick={clearSearch}
                className="shrink-0 inline-flex h-9 items-center justify-center gap-2 rounded-md border-0 bg-transparent px-3 text-sm font-medium text-foreground shadow-none outline-none transition-colors hover:bg-transparent hover:text-blue-400 focus:bg-transparent focus:text-blue-400 focus:outline-none focus:ring-0 active:bg-transparent"
              >
                <X className="h-4 w-4" />
                Clear Search
              </Button>
            )}

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

                  {selectedStatusCount > 0 && (
                    <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                      {selectedStatusCount}
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
                  onSelect={(event) => event.preventDefault()}
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

                {statusOptions.map((status) => {
                  const Icon = status.icon
                  const checked =
                    statusFilters.includes(status.id)

                  return (
                    <DropdownMenuItem
                      key={status.id}
                      onSelect={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        toggleStatusFilter(status.id)
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
                          status.id === "compliant"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      />

                      <span>{status.label}</span>
                    </DropdownMenuItem>
                  )
                })}

                {statusFilters.length > 0 && (
                  <>
                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={clearStatuses}
                      className="gap-2 bg-transparent text-muted-foreground hover:bg-transparent focus:bg-transparent data-[highlighted]:bg-transparent"
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

                  {selectedRankCount > 0 && (
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
                  onSelect={(event) => event.preventDefault()}
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

                {rankOptions.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No ranks available
                  </DropdownMenuItem>
                ) : (
                  rankOptions.map((rank) => {
                    const checked =
                      rankFilters.some(
                        (item) =>
                          normalizeRank(item) ===
                          normalizeRank(rank),
                      )

                    return (
                      <DropdownMenuItem
                        key={rank}
                        onSelect={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          toggleRankFilter(rank)
                        }
                        className="gap-2"
                      >
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />

                        <Shield className="h-4 w-4 text-blue-400" />

                        <span className="truncate">
                          {rank}
                        </span>
                      </DropdownMenuItem>
                    )
                  })
                )}

                {rankFilters.length > 0 && (
                  <>
                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={clearRanks}
                      className="gap-2 bg-transparent text-muted-foreground hover:bg-transparent focus:bg-transparent data-[highlighted]:bg-transparent"
                    >
                      <X className="h-4 w-4" />
                      Clear Ranks
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Promotion List */}

            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setRosterListOpen(true)}
              >
                <ListPlus className="h-4 w-4 text-blue-500" />
                Promotion List
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
                      onClick={() => void copySelected("discord")}
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Discord IDs
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("discord-mention")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Discord Mentions
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => void copySelected("name")}
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Names
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => void copySelected("callsign")}
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Callsigns
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => void copySelected("badge")}
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Badge Numbers
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => void copySelected("rank")}
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Ranks
                    </DropdownMenuItem>

                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("name-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Name + Discord ID
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Discord ID
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-name")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Name
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-badge")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Badge
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("badge-name")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Badge + Name
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("badge-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Badge + Discord ID
                    </DropdownMenuItem>

                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-name-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Name + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-badge-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Badge + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("name-badge-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Name + Badge + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-badge-name")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Badge + Name
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("callsign-badge-name-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Callsign + Badge + Name + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() =>
                        void copySelected("name-rank-discord")
                      }
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Name + Rank + Discord
                    </DropdownMenuItem>

                    <div className="my-1 h-px bg-border" />

                    <DropdownMenuItem
                      onClick={() => void copySelected("full")}
                      className="gap-2 text-sm"
                    >
                      <Copy className="h-4 w-4 text-blue-400" />
                      Copy Full Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            )}

            {/* Google Sheets Refresh */}

            <GoogleRosterRefresh
              onRefreshed={() => loadRoster(false)}
            />
          </div>

          {/* Active Filters */}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Active filters:
            </div>

            {statusFilters.length === 0 &&
            rankFilters.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                None
              </span>
            ) : (
              <>
                {statusFilters.map((status) => {
                  const Icon = getStatusIcon(status)

                  return (
                    <button
                      key={`status-${status}`}
                      type="button"
                      onClick={() =>
                        toggleStatusFilter(status)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${getStatusClasses(
                        status,
                      )}`}
                    >
                      <Icon className="h-3 w-3" />
                      {getStatusLabel(status)}
                      <X className="h-3 w-3" />
                    </button>
                  )
                })}

                {rankFilters.map((rank) => (
                  <button
                    key={`rank-${rank}`}
                    type="button"
                    onClick={() =>
                      toggleRankFilter(rank)
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                  >
                    <Shield className="h-3 w-3" />
                    {rank}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </>
            )}

            {hasFilters && (
              <Button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-sm font-medium text-foreground shadow-none outline-none transition-colors hover:bg-transparent hover:text-blue-400 focus:bg-transparent focus:text-blue-400 focus:outline-none focus:ring-0 active:bg-transparent"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Error */}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Roster */}

        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
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
                  onClick={clearFilters}
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

                  <thead className="sticky top-0 z-40 bg-card">
                    <tr className="border-b bg-card text-center">
                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center shadow-[0_1px_0_hsl(var(--border))]">
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

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Callsign
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Badge
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Name
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Rank
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Discord ID
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        <span className="block truncate">
                          Time in Dept
                        </span>
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        <span className="block truncate">
                          Time in Rank
                        </span>
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        <span className="block truncate">
                          Required Time in Rank
                        </span>
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Required Logs
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Required Hours
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        Hours
                      </th>

                      <th className="sticky top-0 z-40 overflow-hidden border-b bg-card px-2 py-3 text-center font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
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

                            <td className="overflow-hidden px-2 py-3 text-center align-middle">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                >
                                  <button
                                    type="button"
                                    title={
                                      member.discordId
                                    }
                                    className="mx-auto block max-w-full truncate bg-transparent px-1.5 py-1 font-mono text-[10px] text-blue-400 outline-none transition-colors hover:bg-transparent hover:text-blue-300 hover:underline hover:decoration-blue-400/60 hover:underline-offset-2 focus:bg-transparent focus:outline-none data-[state=open]:bg-transparent"
                                  >
                                    {
                                      member.discordId
                                    }
                                  </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  side="bottom"
                                  align="start"
                                  sideOffset={4}
                                  avoidCollisions={false}
                                  className="w-[285px] max-h-80 overflow-y-auto p-1"
                                >
                                  {([
                                    ["discord", "Copy Discord ID"],
                                    ["discord-mention", "Copy Discord Mention"],
                                    ["name", "Copy Name"],
                                    ["callsign", "Copy Callsign"],
                                    ["badge", "Copy Badge Number"],
                                    ["rank", "Copy Rank"],
                                  ] as [CopyType, string][]).map(([type, label]) => (
                                    <DropdownMenuItem
                                      key={type}
                                      onClick={() => void copyMember(type, member)}
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
                                  ] as [CopyType, string][]).map(([type, label]) => (
                                    <DropdownMenuItem
                                      key={type}
                                      onClick={() => void copyMember(type, member)}
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
                                  ] as [CopyType, string][]).map(([type, label]) => (
                                    <DropdownMenuItem
                                      key={type}
                                      onClick={() => void copyMember(type, member)}
                                      className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"
                                    >
                                      <Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                                      <span>{label}</span>
                                    </DropdownMenuItem>
                                  ))}

                                  <div className="my-0.5 h-px bg-border" />

                                  <DropdownMenuItem
                                    onClick={() => void copyMember("full", member)}
                                    className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"
                                  >
                                    <Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                                    <span>Copy Full Details</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                              checked={selected}
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

                              {/* Fixed label */}

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

                              {/* Required time */}

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

                              {/* Required logs */}

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

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="min-w-0 max-w-[calc(100%-60px)] truncate bg-transparent px-2 py-1 font-mono text-[11px] text-blue-400 outline-none transition-colors hover:bg-transparent hover:text-blue-300 hover:underline hover:decoration-blue-400/60 hover:underline-offset-2 focus:bg-transparent focus:outline-none data-[state=open]:bg-transparent"
                                  >
                                    {
                                      member.discordId
                                    }
                                  </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={() => void copyDiscordId(member)}
                                    className="gap-2"
                                  >
                                    <Copy className="h-4 w-4 text-blue-400" />

                                    Copy Discord ID
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
      </div>

      <RosterListDialog
        open={rosterListOpen}
        onClose={() => setRosterListOpen(false)}
        module="promotion"
        division={division}
        members={members}
        initialSelectedIds={selectedIds}
      />
    </DashboardLayout>
  )
}
