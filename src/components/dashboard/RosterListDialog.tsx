import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Clipboard,
  ClipboardList,
  Copy,
  EyeOff,
  Filter,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { logAction } from "@/lib/actionLog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export type RosterListMember = {
  discordId: string
  name: string
  callsign: string
  badgeNumber: string
  rank: string
  strike?: number
}

type ListScope = "global" | "user"
type ListDivision = "department" | "swat" | "mtf7" | "mcd" | "tru" | "teu" | "sar"
type SelectionFilter = "all" | "selected" | "unselected"
type StrikeFilter = "all" | "1" | "2" | "3"

type SavedListMember = {
  userId: string
  name: string
  callsign: string
  badgeNumber: string
  rank: string
  strike?: number
}

type SavedList = {
  id: string
  week: string
  scope: ListScope
  ownerUserId: string
  selectedUserIds: string[]
  selectedUsers: SavedListMember[]
  createdByName: string
  createdAt: string
}

type PreviewItem = {
  userId: string
  strike: number
  label: string
}

type Props = {
  open: boolean
  onClose: () => void
  module: "activity" | "promotion"
  division: ListDivision
  members: RosterListMember[]
  initialSelectedIds: string[]
}

const clean = (value: unknown) => String(value ?? "").trim()

const DISCORD_HEADER = `**<:metropd:1396157575011237979> METRO POLICE DEPARTMENT <:metropd:1396157575011237979>**`
const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"

const ACTIVITY_TITLE = "**📋 WEEKLY ACTIVITY REMOVALS 📋**"
const ACTIVITY_INTRO =
  "The Metro Police Department recognizes the following officers for their participation and contributions to departmental activities throughout the week. The following members have been removed from the activity list based on their activity status and participation. Please review the members listed below and ensure all activity records are kept accurate and up to date."
const ACTIVITY_NOTES =
  "**🏆 ACTIVITY NOTES 🏆**\nActivity lists are made based off hours and if you feel like this was wrong feel free to make a ticket in <#1183194105455579207>."

const PROMOTION_TITLE = "**📋 WEEKLY PROMOTIONS 📋**"
const PROMOTION_INTRO =
  "The Metro Police Department proudly recognizes the following officers for their hard work, dedication, and consistent performance throughout the week. Promotions are awarded to those who continue to demonstrate professionalism, reliability, and a strong commitment to the department’s standards. Please join us in congratulating the following members on their advancement."
const PROMOTION_NOTES =
  "**🏆 PROMOTION NOTES 🏆**\nPromotions are based on activity, performance, professionalism, leadership, and compliance with Metro PD SOP/GSOP and Cali RP rules. If you believe a you was missed for a promotion feel free to make a ticket in <#1183194105455579207>."

const PROMOTION_RANK_ORDER = [
  "Officer",
  "Officer II",
  "Officer III",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Master Sergeant",
  "2nd Lieutenant",
  "1st Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Chief Of Staff",
  "Assistant Chief",
  "Deputy Chief",
  "Chief",
]

const normalizePromotionRank = (rank: string) =>
  clean(rank).replace(/\s+/g, " ").trim().toLowerCase()

const getNextPromotionRank = (rank: string) => {
  const index = PROMOTION_RANK_ORDER.findIndex(
    (item) => normalizePromotionRank(item) === normalizePromotionRank(rank),
  )
  return index >= 0 ? PROMOTION_RANK_ORDER[index + 1] ?? null : null
}

const strikeLabel = (strike: number) => {
  if (strike === 1) return "Activity Strike 1 (Warning):"
  if (strike === 2) return "Activity Strike 2 (1 Rank Demotion):"
  return "Activity Strike 3 (Termination):"
}

export default function RosterListDialog({
  open,
  onClose,
  module,
  division,
  members,
  initialSelectedIds,
}: Props) {
  const [scope, setScope] = useState<ListScope>("global")
  const [selected, setSelected] = useState<string[]>(initialSelectedIds)
  const [current, setCurrent] = useState<SavedList[]>([])
  const [history, setHistory] = useState<SavedList[]>([])
  const [preview, setPreview] = useState<PreviewItem[]>([])
  const [effectiveCurrent, setEffectiveCurrent] = useState<SavedList | null>(null)
  const [effectivePrevious, setEffectivePrevious] = useState<SavedList | null>(null)
  const [previewScope, setPreviewScope] = useState<ListScope>("global")
  const [week, setWeek] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>("all")
  const [strikeFilter, setStrikeFilter] = useState<StrikeFilter>("all")
  const [hideSection, setHideSection] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const title = module === "activity" ? "Activity List" : "Promotion List"
  const strikeMode = module === "activity"

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.discordId, member])),
    [members],
  )

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/roster-lists/${module}/${division}?scope=${scope}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load list.")
      }

      setWeek(clean(data.week))
      setCurrent(Array.isArray(data.current) ? data.current : [])
      setHistory(Array.isArray(data.history) ? data.history : [])
      setPreview(module === "activity" && Array.isArray(data.preview) ? data.preview : [])
      setEffectiveCurrent(data.effectiveCurrent ?? null)
      setEffectivePrevious(module === "activity" ? data.effectivePrevious ?? null : null)
      setPreviewScope(module === "activity" && data.previewScope === "user" ? "user" : "global")

      if (module === "activity") {
        const own = (Array.isArray(data.current) ? data.current : []).find(
          (item: SavedList) => item.scope === scope,
        )
        if (own?.selectedUserIds?.length) {
          setSelected(own.selectedUserIds)
        }
      } else {
        // Promotion lists are independent each week and must never inherit
        // selections from a previous week's activity/promotion list.
        setSelected(initialSelectedIds)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load list.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setSelected(initialSelectedIds)
      setSearch("")
      setSelectionFilter("all")
      setStrikeFilter("all")
      setHideSection(false)
      void load()
    }
    // initialSelectedIds is intentionally only applied when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module, division])

  useEffect(() => {
    if (!open) return
    void load()
    // scope changes must load the matching global/user settings from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  useEffect(() => {
    if (!open) return

    if (module === "promotion") {
      setSelected(initialSelectedIds)
      return
    }

    const own = current.find((item) => item.scope === scope)
    const fallback = scope === "user" ? current.find((item) => item.scope === "global") : null
    setSelected(
      own?.selectedUserIds?.length
        ? own.selectedUserIds
        : fallback?.selectedUserIds?.length
          ? fallback.selectedUserIds
          : initialSelectedIds,
    )
  }, [scope, open, current, initialSelectedIds, module])

  const savedStrikeMap = useMemo(
    () => new Map((effectiveCurrent?.selectedUsers ?? []).map((item) => [item.userId, item.strike])),
    [effectiveCurrent],
  )

  const previewMap = useMemo(
    () => new Map(preview.map((item) => [item.userId, item.strike])),
    [preview],
  )

  const getStrike = (member: RosterListMember) => {
    if (!strikeMode) return undefined
    return savedStrikeMap.get(member.discordId) ?? previewMap.get(member.discordId) ?? member.strike ?? 1
  }

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return members.filter((member) => {
      const checked = selected.includes(member.discordId)
      const strike = getStrike(member)

      if (selectionFilter === "selected" && !checked) return false
      if (selectionFilter === "unselected" && checked) return false
      if (strikeMode && strikeFilter !== "all" && String(strike) !== strikeFilter) return false

      if (query) {
        const haystack = [
          member.name,
          member.callsign,
          member.badgeNumber,
          member.rank,
          member.discordId,
        ].join(" ").toLowerCase()
        if (!haystack.includes(query)) return false
      }

      return true
    })
  }, [members, selected, selectionFilter, strikeFilter, search, strikeMode, savedStrikeMap, previewMap])

  const selectedMembers = useMemo(
    () => selected.map((id) => memberMap.get(id)).filter(Boolean) as RosterListMember[],
    [selected, memberMap],
  )

  const previewMembers = useMemo(
    () => selectedMembers
      .map((member) => ({ member, strike: getStrike(member) ?? 1 }))
      .sort((a, b) => a.strike - b.strike || a.member.name.localeCompare(b.member.name)),
    [selectedMembers, savedStrikeMap, previewMap, strikeMode],
  )

  const copyText = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)

    if (!strikeMode) {
      const grouped = new Map<string, RosterListMember[]>()

      for (const member of selectedMembers) {
        const nextRank = getNextPromotionRank(member.rank)
        if (!nextRank) continue

        const key = `${member.rank}|||${nextRank}`
        const group = grouped.get(key) ?? []
        group.push(member)
        grouped.set(key, group)
      }

      const promotionSections: string[] = []
      let promotionGroupIndex = 0
      for (const [key, group] of grouped) {
        const [fromRank, toRank] = key.split("|||")

        if (promotionGroupIndex > 0) {
          promotionSections.push(DIVIDER)
        }

        promotionSections.push(`**${fromRank.toUpperCase()} → ${toRank.toUpperCase()}**`)
        promotionSections.push("**Personnel:**")
        promotionSections.push(
          group.map((member) => `• <@${member.discordId}>`).join("\n"),
        )
        promotionSections.push("")
        promotionGroupIndex += 1
      }

      if (promotionSections.length) {
        promotionSections.push(DIVIDER)
      }

      return [
        DISCORD_HEADER,
        PROMOTION_TITLE,
        PROMOTION_INTRO,
        DIVIDER,
        ...(promotionSections.length
          ? promotionSections
          : ["**Personnel:**", "• N/A", "", DIVIDER]),
        PROMOTION_NOTES,
        `**Promotion Date:** <t:${now}:F>`,
      ].join("\n")
    }

    const sections: string[] = [
      DISCORD_HEADER,
      ACTIVITY_TITLE,
      ACTIVITY_INTRO,
      DIVIDER,
    ]

    for (const strike of [1, 2, 3]) {
      const strikeMembers = previewMembers.filter((item) => item.strike === strike)
      if (!strikeMembers.length) continue

      sections.push(`**${strikeLabel(strike)}**`)
      sections.push(strikeMembers.map(({ member }) => `• <@${member.discordId}>`).join("\n"))
      sections.push("")
      sections.push(DIVIDER)
    }

    sections.push(ACTIVITY_NOTES)
    sections.push(`**Activity Date:** <t:${now}:F>`)
    return sections.join("\n")
  }, [strikeMode, selectedMembers, previewMembers])

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      toast.success(`${title} message copied to clipboard.`)
    } catch {
      toast.error("Unable to copy the preview message.")
    }
  }

  const toggle = (id: string) => {
    setSelected((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((value) => value !== id)
        : [...currentIds, id],
    )
  }

  const selectAll = () => {
    setSelected((currentIds) => {
      const ids = new Set(currentIds)
      filteredMembers.forEach((member) => {
        if (member.discordId) ids.add(member.discordId)
      })
      return Array.from(ids)
    })
  }

  const clearAll = () => {
    setSelected((currentIds) =>
      currentIds.filter((id) => !filteredMembers.some((member) => member.discordId === id)),
    )
  }

  const save = async () => {
    const selectedUsers = selected
      .map((id) => memberMap.get(id))
      .filter(Boolean) as RosterListMember[]

    if (!selectedUsers.length) {
      toast.error(`Select at least one member for this ${title.toLowerCase()}.`)
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/roster-lists/${module}/${division}?scope=${scope}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ scope, selectedUsers }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to save ${title.toLowerCase()}.`)
      }

      logAction({
        module,
        action: scope === "global" ? "submit-global-list" : "submit-user-list",
        category: "roster",
        division,
        summary: `Saved a ${title.toLowerCase()} for ${scope === "global" ? "the global roster" : "the user roster"} with ${selectedUsers.length} selected member${selectedUsers.length === 1 ? "" : "s"}.`,
        details: {
          week: data.list?.week,
          scope,
          selectedUserIds: selectedUsers.map((item) => item.discordId),
        },
      })
      toast.success(`${title} saved for this week.`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save list.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const scopeList = effectiveCurrent
  const ownScopeList = current.find((item) => item.scope === scope)
  const usingGlobalFallback = scope === "user" && !ownScopeList && Boolean(effectiveCurrent?.scope === "global")
  const previousWeeks = history.filter((item) => item.week < week)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">
                Week of {week || "current week"} · {division === "department" ? "Department" : division.toUpperCase()}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">List scope</p>
                      <p className="text-xs text-muted-foreground">Global creates one shared list. User creates one list for your account.</p>
                    </div>
                    <div className="inline-flex rounded-lg border bg-muted/20 p-1">
                      <button type="button" onClick={() => setScope("global")} className={`rounded-md px-3 py-2 text-xs font-medium ${scope === "global" ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"}`}>Global</button>
                      <button type="button" onClick={() => setScope("user")} className={`rounded-md px-3 py-2 text-xs font-medium ${scope === "user" ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"}`}>User</button>
                    </div>
                  </div>
                  {scopeList && (
                    <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${usingGlobalFallback ? "border-amber-500/20 bg-amber-500/5 text-amber-500" : "border-blue-500/20 bg-blue-500/5 text-blue-500"}`}>
                      <Check className="h-3.5 w-3.5" />
                      {usingGlobalFallback ? "Your user list is missing this week, so the global settings are being used." : scope === "global" ? "Global settings are active for this week." : "Your user settings are active for this week."}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card">
                  <div className="border-b px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Select members</p>
                        <p className="text-xs text-muted-foreground">{selected.length} selected · showing {filteredMembers.length} of {members.length}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button type="button" variant="outline" size="sm" onClick={selectAll}>Select Visible</Button>
                        <Button type="button" variant="outline" size="sm" onClick={clearAll}>Clear Visible</Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, callsign, badge or rank..." className="pl-9" />
                      </div>
                      <Button type="button" variant="outline" onClick={() => setFiltersOpen((value) => !value)}>
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                        <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                      </Button>
                      <Button type="button" variant={hideSection ? "default" : "outline"} onClick={() => setHideSection((value) => !value)}>
                        <EyeOff className="mr-2 h-4 w-4" />
                        {hideSection ? "Show Section" : "Hide Section"}
                      </Button>
                    </div>

                    {filtersOpen && (
                      <div className="mt-3 rounded-lg border bg-muted/10 p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Selection</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(["all", "selected", "unselected"] as SelectionFilter[]).map((value) => (
                                <button key={value} type="button" onClick={() => setSelectionFilter(value)} className={`rounded-md border px-2.5 py-1.5 text-xs ${selectionFilter === value ? "border-blue-500/30 bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"}`}>
                                  {value === "all" ? "All" : value === "selected" ? "Selected" : "Unselected"}
                                </button>
                              ))}
                            </div>
                          </div>
                          {strikeMode && (
                            <div>
                              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Activity Strike</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(["all", "1", "2", "3"] as StrikeFilter[]).map((value) => (
                                  <button key={value} type="button" onClick={() => setStrikeFilter(value)} className={`rounded-md border px-2.5 py-1.5 text-xs ${strikeFilter === value ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:text-foreground"}`}>
                                    {value === "all" ? "All" : `Strike ${value}`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!hideSection && (
                    <div className="divide-y">
                      {filteredMembers.map((member) => {
                      const checked = selected.includes(member.discordId)
                      const strike = getStrike(member)
                      return (
                        <label key={member.discordId} className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${checked ? "bg-blue-500/5" : ""}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggle(member.discordId)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{member.name || "Unknown"}</span>
                              {strikeMode && strike && (
                                <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">Strike {strike}</span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{member.callsign || "—"} · {member.badgeNumber || "—"} · {member.rank || "—"}</p>
                          </div>
                        </label>
                      )
                      })}
                      {!filteredMembers.length && <div className="p-8 text-center text-sm text-muted-foreground">No members match the current search and filters.</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {strikeMode && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-sm font-semibold">Strike preview</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{scope === "user" && previewScope === "user" ? "Your user list is used when one exists. If you missed a week, the global list is used automatically. " : "The global list is used for this view. "}Members selected in the previous effective week preview as the next activity strike. Future weekly lists continue the progression to Strike 3.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-semibold">This week</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{scopeList ? `${scopeList.selectedUserIds.length} members are currently saved.` : "No list has been submitted for this scope yet."}
                  {usingGlobalFallback && <span className="mt-1 block text-amber-500">No user list was submitted this week — using the global list.</span>}</p>
                  <Button className="mt-4 w-full" onClick={() => void save()} disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    {scopeList ? `Update ${title}` : `Submit ${title}`}
                  </Button>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-semibold">Previous weeks</p>
                  </div>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {previousWeeks.map((item) => {
                      const isGlobal = item.scope === "global"
                      const isEffective = scope === "global" ? isGlobal : item.id === effectivePrevious?.id
                      return (
                        <div key={item.id} className={`rounded-xl border p-3 transition-colors ${isEffective ? "border-blue-500/30 bg-blue-500/5" : "bg-muted/5"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{item.week}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${isGlobal ? "border-blue-500/20 bg-blue-500/10 text-blue-500" : "border-purple-500/20 bg-purple-500/10 text-purple-400"}`}>{isGlobal ? "Global" : "User"}</span>
                              {isEffective && <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-500">Used</span>}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.selectedUserIds.length} selected · {item.createdByName || "Unknown"}</p>
                        </div>
                      )
                    })}
                    {!previousWeeks.length && <p className="text-xs text-muted-foreground">No previous lists yet.</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clipboard className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-semibold">Message Preview</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">The preview shows roster names. Copy uses real Discord mentions.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void copyPreview()} disabled={!selectedMembers.length}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Message
                </Button>
              </div>

              <div className="p-4">
                {strikeMode ? (
                  <div className="rounded-lg border bg-muted/10 p-4 text-sm leading-6">
                    <p className="font-semibold">&lt;:metropd:1396157575011237979&gt; METRO POLICE DEPARTMENT &lt;:metropd:1396157575011237979&gt;</p>
                    <p className="font-semibold">📋 WEEKLY ACTIVITY REMOVALS 📋</p>
                    <p className="mt-3">{ACTIVITY_INTRO}</p>
                    <p>{DIVIDER}</p>
                    {[1, 2, 3].map((strike) => {
                      const group = previewMembers.filter((item) => item.strike === strike)
                      if (!group.length) return null
                      return (
                        <div key={strike} className="mt-2">
                          <p className="font-semibold">{strikeLabel(strike)}</p>
                          {group.map(({ member }) => <p key={member.discordId}>• {member.name || "Unknown"}</p>)}
                          <p className="h-5" aria-hidden="true" />
                          <p>{DIVIDER}</p>
                        </div>
                      )
                    })}
                    <p className="font-semibold">🏆 ACTIVITY NOTES 🏆</p>
                    <p>Activity lists are made based off hours and if you feel like this was wrong feel free to make a ticket in &lt;#1183194105455579207&gt;.</p>
                    <p className="mt-2"><strong>Activity Date:</strong> {new Date().toLocaleString()}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/10 p-4 text-sm leading-6">
                    <p className="font-semibold">&lt;:metropd:1396157575011237979&gt; METRO POLICE DEPARTMENT &lt;:metropd:1396157575011237979&gt;</p>
                    <p className="font-semibold">📋 WEEKLY PROMOTIONS 📋</p>
                    <p className="mt-3">{PROMOTION_INTRO}</p>
                    <p>{DIVIDER}</p>
                    {selectedMembers.length ? (
                      (() => {
                        const groups = new Map<string, RosterListMember[]>()
                        selectedMembers.forEach((member) => {
                          const nextRank = getNextPromotionRank(member.rank)
                          if (!nextRank) return
                          const key = `${member.rank}|||${nextRank}`
                          groups.set(key, [...(groups.get(key) ?? []), member])
                        })

                        return groups.size ? (
                          Array.from(groups.entries()).map(([key, group], index) => {
                            const [fromRank, toRank] = key.split("|||")
                            return (
                              <div key={key} className="mt-3">
                                {index > 0 && <p className="my-3">{DIVIDER}</p>}
                                <p className="font-semibold">{fromRank.toUpperCase()} → {toRank.toUpperCase()}</p>
                                <p className="font-semibold">Personnel:</p>
                                {group.map((member) => (
                                  <p key={member.discordId}>• {member.name || "Unknown"}</p>
                                ))}
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-muted-foreground">Selected members have no defined next promotion rank.</p>
                        )
                      })()
                    ) : (
                      <p className="text-muted-foreground">Select members to preview the message.</p>
                    )}
                    <p className="h-5" aria-hidden="true" />
                    <p>{DIVIDER}</p>
                    <p className="font-semibold">🏆 PROMOTION NOTES 🏆</p>
                    <p>Promotions are based on departmental requirements, performance, and overall conduct. If you believe a promotion has been missed or incorrectly processed, please open a ticket in &lt;#1183194105455579207&gt;.</p>
                    <p className="mt-2"><strong>Promotion Date:</strong> {new Date().toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
