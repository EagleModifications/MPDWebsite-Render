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
  ListPlus,
  Search,
  RotateCcw,
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

type ActivityRosterMember = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  discordId: string
  timeInDept: string
  timeInRank: string
  requiredHours: number
  activityHours: number
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
  a: ActivityRosterMember,
  b: ActivityRosterMember,
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

export default function ActivityRoster() {
  const [division, setDivision] =
    useState<Division>("department")

  const [members, setMembers] =
    useState<ActivityRosterMember[]>([])

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

  /*
   * Ref is used instead of state so Shift is
   * captured synchronously before Radix fires
   * onCheckedChange.
   */
  const shiftSelectingRef =
    useRef(false)

  /* ─────────────────────────────────────────────
     Load Roster
  ───────────────────────────────────────────── */

  const loadRoster = useCallback(
    async (
      showLoadingState = false,
      resetFilters = false,
    ) => {
      try {
        if (showLoadingState) {
          setLoading(true)
        }

        setError(null)

        const response = await fetch(
          `/api/activity/roster/${division}`,
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

        const roster: ActivityRosterMember[] =
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
                    activityHours:
                      Number(
                        member.activityHours,
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

        if (resetFilters) {
          const defaultRanks = Array.from(
            new Map(
              roster.map((member) => [
                normalizeRank(member.rank),
                cleanValue(member.rank),
              ] as const),
            ).values(),
          ).filter(Boolean)

          setStatusFilters(
            statusOptions.map(
              (status) => status.id,
            ),
          )
          setRankFilters(defaultRanks)
          setSearch("")
        }

        setSelectedIds([])
        setSelectedCopied(false)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load activity roster."

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
    void loadRoster(false, true)
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
        total + member.activityHours,
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

    setSelectedIds((current) =>
      current.includes(discordId)
        ? current.filter(
            (id) => id !== discordId,
          )
        : [...current, discordId],
    )

    setSelectedCopied(false)
    void logAction({ module: "activity", action: selectedIds.includes(discordId) ? "deselect-member" : "select-member", category: "roster", division, targetUserId: discordId, summary: `${selectedIds.includes(discordId) ? "Deselected" : "Selected"} a member on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
  }

  const selectRankMembers = (
    member: ActivityRosterMember,
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

    setSelectedCopied(false)
    void logAction({ module: "activity", action: "select-rank", category: "roster", division, targetRank: member.rank, summary: `Selected all visible ${member.rank} members on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`, details: { count: rankIds.length } })
  }

  const handleMemberSelection = (
    member: ActivityRosterMember,
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

    setSelectedCopied(false)
    void logAction({ module: "activity", action: allSelected ? "deselect-all-visible" : "select-all-visible", category: "roster", division, summary: `${allSelected ? "Deselected" : "Selected"} all visible members on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`, details: { count: visibleIds.length } })
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
          (member) =>
            [
              member.callsign,
              member.badgeNumber,
              member.name,
              member.rank,
              member.discordId,
              member.timeInDept,
              member.timeInRank,
              `${member.requiredHours.toFixed(1)}h`,
              `${member.activityHours.toFixed(1)}h`,
              getStatusLabel(
                member.status,
              ),
            ].join(" — "),
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
            selectedMembers.length === 1
              ? "member"
              : "members"
          } copied to your clipboard.`,
        },
      )

      void logAction({
        module: "activity",
        action: "copy-roster",
        category: "roster",
        division,
        summary: `Copied ${selectedMembers.length} selected members from the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`,
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

  const copyMember = async (type: CopyType, member: ActivityRosterMember) => {
    let value = ""
    let label = ""

    switch (type) {
      case "discord": value = member.discordId; label = "Discord ID"; break
      case "discord-mention": value = `<@${member.discordId}>`; label = "Discord Mention"; break
      case "name": value = member.name; label = "Name"; break
      case "callsign": value = member.callsign; label = "Callsign"; break
      case "badge": value = member.badgeNumber; label = "Badge Number"; break
      case "rank": value = member.rank; label = "Rank"; break
      case "name-discord": value = `${member.name} — ${member.discordId}`; label = "Name + Discord ID"; break
      case "callsign-discord": value = `${member.callsign} — ${member.discordId}`; label = "Callsign + Discord ID"; break
      case "callsign-name": value = `${member.callsign} — ${member.name}`; label = "Callsign + Name"; break
      case "callsign-badge": value = `${member.callsign} — ${member.badgeNumber}`; label = "Callsign + Badge Number"; break
      case "badge-name": value = `${member.badgeNumber} — ${member.name}`; label = "Badge Number + Name"; break
      case "badge-discord": value = `${member.badgeNumber} — ${member.discordId}`; label = "Badge Number + Discord ID"; break
      case "callsign-name-discord": value = `${member.callsign} — ${member.name} — ${member.discordId}`; label = "Callsign + Name + Discord"; break
      case "callsign-badge-discord": value = `${member.callsign} — ${member.badgeNumber} — ${member.discordId}`; label = "Callsign + Badge + Discord"; break
      case "name-badge-discord": value = `${member.name} — ${member.badgeNumber} — ${member.discordId}`; label = "Name + Badge + Discord"; break
      case "callsign-badge-name": value = `${member.callsign} — ${member.badgeNumber} — ${member.name}`; label = "Callsign + Badge + Name"; break
      case "callsign-badge-name-discord": value = `${member.callsign} — ${member.badgeNumber} — ${member.name} — ${member.discordId}`; label = "Callsign + Badge + Name + Discord"; break
      case "name-rank-discord": value = `${member.name} — ${member.rank} — ${member.discordId}`; label = "Name + Rank + Discord"; break
      case "full":
        value = [member.callsign, member.badgeNumber, member.name, member.rank, member.discordId, member.timeInDept, member.timeInRank, `${member.requiredHours.toFixed(1)}h`, `${member.activityHours.toFixed(1)}h`, getStatusLabel(member.status)].join(" — ")
        label = "Full Details"
        break
    }

    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, { description: `${member.name}'s ${label.toLowerCase()} has been copied to your clipboard.` })
      void logAction({
        module: "activity",
        action: "copy-member",
        category: "roster",
        division,
        targetUserId: member.discordId,
        targetName: member.name,
        targetRank: member.rank,
        summary: `Copied ${label} for ${member.name} from the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`,
        details: { copyType: type },
      })
    } catch {
      toast.error("Copy failed", { description: "Your browser could not access the clipboard." })
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
    void logAction({ module: "activity", action: "filter-status", category: "roster", division, summary: `Toggled ${getStatusLabel(status)} status filter on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`, details: { status } })
  }

  const selectAllStatuses = () => {
    setStatusFilters(
      statusOptions.map(
        (status) => status.id,
      ),
    )

    setSelectedCopied(false)
    void logAction({ module: "activity", action: "filter-status", category: "roster", division, summary: `Selected all status filters on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
  }

  const clearStatuses = () => {
    setStatusFilters([])
    setSelectedCopied(false)
    void logAction({ module: "activity", action: "clear-status-filters", category: "roster", division, summary: `Cleared status filters on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
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

    setSelectedCopied(false)
    void logAction({ module: "activity", action: "filter-rank", category: "roster", division, targetRank: rank, summary: `Toggled ${rank} rank filter on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
  }

  const selectAllRanks = () => {
    setRankFilters([...rankOptions])
    setSelectedCopied(false)
    void logAction({ module: "activity", action: "filter-rank", category: "roster", division, summary: `Selected all rank filters on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`, details: { ranks: rankOptions } })
  }

  const clearRanks = () => {
    setRankFilters([])
    setSelectedCopied(false)
    void logAction({ module: "activity", action: "clear-rank-filters", category: "roster", division, summary: `Cleared rank filters on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
  }

  /* ─────────────────────────────────────────────
     Clear Filters
  ───────────────────────────────────────────── */

  const clearFilters = () => {
    setStatusFilters([])
    setRankFilters([])
    setSelectedCopied(false)
    void logAction({ module: "activity", action: "clear-filters", category: "roster", division, summary: `Cleared all status and rank filters on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
  }

  const resetFilters = () => {
    setStatusFilters(
      statusOptions.map((status) => status.id),
    )
    setRankFilters([...rankOptions])
    setSelectedCopied(false)
    void logAction({
      module: "activity",
      action: "reset-filters",
      category: "roster",
      division,
      summary: `Reset all filters on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.`,
      details: {
        statuses: statusOptions.map(
          (status) => status.id,
        ),
        ranks: rankOptions,
      },
    })
  }

  const clearSearch = () => {
    setSearch("")
    setSelectedCopied(false)
    void logAction({ module: "activity", action: "clear-search", category: "roster", division, summary: `Cleared the search on the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
  }

  const filtersAreDefault =
    statusFilters.length === statusOptions.length &&
    statusOptions.every((status) =>
      statusFilters.includes(status.id),
    ) &&
    rankFilters.length === rankOptions.length &&
    rankOptions.every((rank) =>
      rankFilters.some(
        (selectedRank) =>
          normalizeRank(selectedRank) ===
          normalizeRank(rank),
      ),
    )

  const hasFilterSelection =
    statusFilters.length > 0 ||
    rankFilters.length > 0

  const hasFilterChanges =
    !filtersAreDefault

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
    (statusFilters.length > 0 &&
      statusFilters.length < statusOptions.length) ||
    (rankOptions.length > 0 &&
      rankFilters.length > 0 &&
      rankFilters.length < rankOptions.length)

  const selectedStatusCount =
    statusFilters.length

  const selectedRankCount =
    rankFilters.length

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col gap-4 p-3 sm:gap-6 sm:p-6">
        {/* HEADER */}

        <div className="flex shrink-0 flex-col gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Activity Roster
                </h1>

                <p className="text-sm text-muted-foreground">
                  View activity compliance and
                  roster information for each
                  division.
                </p>
              </div>
            </div>
          </div>

          {/* Division Tabs */}

          <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-fit">
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
                    void logAction({ module: "activity", action: "change-division", category: "navigation", division: item.id, summary: `Switched Activity Roster to ${item.label}.` })
                    setSearch("")
                    setSelectedIds([])
                    setSelectedCopied(false)
                    setError(null)
                  }}
                  className={
                    active
                      ? "rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 shadow-sm transition-colors sm:px-4 sm:text-sm shrink-0"
                      : "rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-4 sm:text-sm shrink-0"
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
                Activity Hours
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
                  setSearch(
                    event.target.value,
                  )
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
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="shrink-0 gap-2 bg-transparent text-blue-400 shadow-none transition-colors hover:text-blue-300 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
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
                      className="gap-2 bg-transparent text-blue-400 shadow-none transition-colors hover:text-blue-300 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
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
                      className="gap-2 bg-transparent text-blue-400 shadow-none transition-colors hover:text-blue-300 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <X className="h-4 w-4" />

                      Clear Ranks
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Activity List */}

            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setRosterListOpen(true)}
              >
                <ListPlus className="h-4 w-4 text-blue-500" />
                Activity List
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

                    <DropdownMenuItem
                      onClick={() => void copySelected("callsign-badge-name")}
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Badge + Name
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => void copySelected("callsign-badge-name-discord")}
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Callsign + Badge + Name + Discord
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => void copySelected("name-rank-discord")}
                      className="gap-2 text-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-400" />
                      Name + Rank + Discord
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
              onRefreshed={() => {
                void logAction({ module: "activity", action: "refresh-roster", category: "roster", division, summary: `Refreshed the ${division === "department" ? "Department" : division.toUpperCase()} activity roster.` })
                void loadRoster(false)
              }}
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
              </>
            )}

            {(hasFilterSelection || hasFilterChanges) && (
              <div className="flex items-center gap-2">
                {hasFilterSelection && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-7 gap-1.5 bg-transparent px-2 text-foreground shadow-none transition-colors hover:bg-transparent hover:text-blue-400 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear Filters
                  </Button>
                )}

                {hasFilterChanges && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-7 gap-1.5 bg-transparent px-2 text-foreground shadow-none transition-colors hover:bg-transparent hover:text-blue-400 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Filters
                  </Button>
                )}
              </div>
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

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
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
              <div className="text-xs text-muted-foreground">
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
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="w-12 px-4 py-3">
                      <Checkbox
                        checked={
                          allVisibleSelected
                        }
                        onCheckedChange={
                          toggleAllVisible
                        }
                        aria-label="Select all visible members"
                      />
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Callsign
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Badge
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Name
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Rank
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Discord ID
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Time in Dept
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Time in Rank
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Required
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Activity
                    </th>

                    <th className="px-4 py-3 font-medium text-muted-foreground">
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
                          <td className="px-4 py-3">
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
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {member.callsign}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {member.badgeNumber}
                          </td>

                          <td className="px-4 py-3">
                            {member.name}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {member.rank}
                          </td>

                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" title={member.discordId} className="mx-auto block max-w-full truncate bg-transparent px-1.5 py-1 font-mono text-[10px] text-blue-400 outline-none transition-colors hover:text-blue-300 hover:underline">
                                  {member.discordId}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="bottom" align="start" sideOffset={4} avoidCollisions={false} className="max-h-80 w-[285px] overflow-y-auto p-1">
                                {([
                                  ["discord", "Copy Discord ID"], ["discord-mention", "Copy Discord Mention"], ["name", "Copy Name"], ["callsign", "Copy Callsign"], ["badge", "Copy Badge Number"], ["rank", "Copy Rank"],
                                ] as [CopyType, string][]).map(([type, label]) => (
                                  <DropdownMenuItem key={type} onClick={() => void copyMember(type, member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>{label}</span></DropdownMenuItem>
                                ))}
                                <div className="my-0.5 h-px bg-border" />
                                {([
                                  ["name-discord", "Name + Discord ID"], ["callsign-discord", "Callsign + Discord ID"], ["callsign-name", "Callsign + Name"], ["callsign-badge", "Callsign + Badge Number"], ["badge-name", "Badge Number + Name"], ["badge-discord", "Badge Number + Discord ID"],
                                ] as [CopyType, string][]).map(([type, label]) => (
                                  <DropdownMenuItem key={type} onClick={() => void copyMember(type, member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>{label}</span></DropdownMenuItem>
                                ))}
                                <div className="my-0.5 h-px bg-border" />
                                {([
                                  ["callsign-name-discord", "Callsign + Name + Discord"], ["callsign-badge-discord", "Callsign + Badge + Discord"], ["name-badge-discord", "Name + Badge + Discord"], ["callsign-badge-name", "Callsign + Badge + Name"], ["callsign-badge-name-discord", "Callsign + Badge + Name + Discord"], ["name-rank-discord", "Name + Rank + Discord"],
                                ] as [CopyType, string][]).map(([type, label]) => (
                                  <DropdownMenuItem key={type} onClick={() => void copyMember(type, member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>{label}</span></DropdownMenuItem>
                                ))}
                                <div className="my-0.5 h-px bg-border" />
                                <DropdownMenuItem onClick={() => void copyMember("full", member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>Copy Full Details</span></DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {member.timeInDept}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {member.timeInRank}
                          </td>

                          <td className="px-4 py-3">
                            {member.requiredHours.toFixed(
                              1,
                            )}
                            h
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {member.activityHours.toFixed(
                              1,
                            )}
                            h
                          </td>

                          <td className="px-4 py-3">
                            <div
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                member.status,
                              )}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />

                              {getStatusLabel(
                                member.status,
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    },
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y md:hidden">
              {filteredMembers.map((member) => {
                const selected = selectedIds.includes(member.discordId)
                const StatusIcon = getStatusIcon(member.status)

                return (
                  <div
                    key={member.discordId || `${member.badgeNumber}-${member.callsign}-${member.name}`}
                    className={`p-4 transition-colors ${selected ? "bg-blue-500/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={selected}
                          disabled={!member.discordId}
                          aria-label={`Select ${member.name}`}
                          onPointerDown={(event) => {
                            shiftSelectingRef.current = event.shiftKey
                          }}
                          onCheckedChange={() => {
                            const shiftKey = shiftSelectingRef.current
                            shiftSelectingRef.current = false
                            handleMemberSelection(member, shiftKey)
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{member.callsign}</p>
                            <p className="truncate text-sm text-muted-foreground">{member.name}</p>
                          </div>

                          <div className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(member.status)}`}>
                            <StatusIcon className="h-3 w-3" />
                            {getStatusLabel(member.status)}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Badge</p>
                            <p className="mt-0.5 truncate font-medium">{member.badgeNumber}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rank</p>
                            <p className="mt-0.5 truncate font-medium">{member.rank}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Activity</p>
                            <p className="mt-0.5 font-medium">{member.activityHours.toFixed(1)}h</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Required</p>
                            <p className="mt-0.5 font-medium">{member.requiredHours.toFixed(1)}h</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Time in Dept</p>
                            <p className="mt-0.5 truncate font-medium">{member.timeInDept || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Time in Rank</p>
                            <p className="mt-0.5 truncate font-medium">{member.timeInRank || "—"}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-xs text-muted-foreground">Discord</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="min-w-0 max-w-full truncate rounded-md px-2 py-1 font-mono text-[11px] text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300">
                                {member.discordId}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-80 w-[285px] overflow-y-auto p-1">
                              {([
                                ["discord", "Copy Discord ID"], ["discord-mention", "Copy Discord Mention"], ["name", "Copy Name"], ["callsign", "Copy Callsign"], ["badge", "Copy Badge Number"], ["rank", "Copy Rank"],
                              ] as [CopyType, string][]).map(([type, label]) => (
                                <DropdownMenuItem key={type} onClick={() => void copyMember(type, member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>{label}</span></DropdownMenuItem>
                              ))}
                              <div className="my-0.5 h-px bg-border" />
                              {([
                                ["name-discord", "Name + Discord ID"], ["callsign-discord", "Callsign + Discord ID"], ["callsign-name", "Callsign + Name"], ["callsign-badge", "Callsign + Badge Number"], ["badge-name", "Badge Number + Name"], ["badge-discord", "Badge Number + Discord ID"],
                              ] as [CopyType, string][]).map(([type, label]) => (
                                <DropdownMenuItem key={type} onClick={() => void copyMember(type, member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>{label}</span></DropdownMenuItem>
                              ))}
                              <div className="my-0.5 h-px bg-border" />
                              {([
                                ["callsign-name-discord", "Callsign + Name + Discord"], ["callsign-badge-discord", "Callsign + Badge + Discord"], ["name-badge-discord", "Name + Badge + Discord"], ["callsign-badge-name", "Callsign + Badge + Name"], ["callsign-badge-name-discord", "Callsign + Badge + Name + Discord"], ["name-rank-discord", "Name + Rank + Discord"],
                              ] as [CopyType, string][]).map(([type, label]) => (
                                <DropdownMenuItem key={type} onClick={() => void copyMember(type, member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>{label}</span></DropdownMenuItem>
                              ))}
                              <div className="my-0.5 h-px bg-border" />
                              <DropdownMenuItem onClick={() => void copyMember("full", member)} className="h-7 gap-2 whitespace-nowrap px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5 shrink-0 text-blue-400" /><span>Copy Full Details</span></DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            </>
          )}
        </div>
      </div>
      <RosterListDialog
        open={rosterListOpen}
        onClose={() => setRosterListOpen(false)}
        module="activity"
        division={division}
        members={members}
        initialSelectedIds={selectedIds}
      />

    </DashboardLayout>
  )
}
