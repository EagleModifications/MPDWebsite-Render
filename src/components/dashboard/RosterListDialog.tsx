import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, Check, ClipboardList, Loader2, Users, X } from "lucide-react"
import { toast } from "sonner"
import { logAction } from "@/lib/actionLog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

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
  const [week, setWeek] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const title = module === "activity" ? "Activity List" : "Promotion List"
  const strikeMode = module === "activity"

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.discordId, member])),
    [members],
  )

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/roster-lists/${module}/${division}`, {
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
      setPreview(Array.isArray(data.preview) ? data.preview : [])

      const own = (Array.isArray(data.current) ? data.current : []).find(
        (item: SavedList) => item.scope === scope,
      )
      if (own?.selectedUserIds?.length) {
        setSelected(own.selectedUserIds)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load list.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setSelected(initialSelectedIds)
      void load()
    }
    // initialSelectedIds is intentionally only applied when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module, division])

  useEffect(() => {
    if (!open) return
    const own = current.find((item) => item.scope === scope)
    setSelected(own?.selectedUserIds?.length ? own.selectedUserIds : initialSelectedIds)
  }, [scope, open, current, initialSelectedIds])

  const toggle = (id: string) => {
    setSelected((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((value) => value !== id)
        : [...currentIds, id],
    )
  }

  const selectAll = () => setSelected(members.map((member) => member.discordId).filter(Boolean))
  const clearAll = () => setSelected([])

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
      const response = await fetch(`/api/roster-lists/${module}/${division}`, {
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

  const scopeList = current.find((item) => item.scope === scope)
  const savedStrikeMap = new Map((scopeList?.selectedUsers ?? []).map((item) => [item.userId, item.strike]))
  const previewMap = new Map(preview.map((item) => [item.userId, item.strike]))
  const previousWeek = history.find((item) => item.week !== week)

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
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">List scope</p>
                    <p className="text-xs text-muted-foreground">
                      Global creates one shared list. User creates one list for your account.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border bg-muted/20 p-1">
                    <button
                      type="button"
                      onClick={() => setScope("global")}
                      className={`rounded-md px-3 py-2 text-xs font-medium ${scope === "global" ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Global
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("user")}
                      className={`rounded-md px-3 py-2 text-xs font-medium ${scope === "user" ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      User
                    </button>
                  </div>
                </div>
                {scopeList && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-500">
                    <Check className="h-3.5 w-3.5" />
                    {scope === "global" ? "A global list already exists this week and can be updated." : "Your user list already exists this week and can be updated."}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Select members</p>
                    <p className="text-xs text-muted-foreground">{selected.length} selected</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearAll}>Clear</Button>
                  </div>
                </div>

                <div className="divide-y">
                  {members.map((member) => {
                    const checked = selected.includes(member.discordId)
                    const strike = previewMap.get(member.discordId)
                    return (
                      <label
                        key={member.discordId}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${checked ? "bg-blue-500/5" : ""}`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggle(member.discordId)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{member.name || "Unknown"}</span>
                            {strikeMode && (savedStrikeMap.get(member.discordId) || strike) && (
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                                {savedStrikeMap.get(member.discordId)
                                  ? `Strike ${savedStrikeMap.get(member.discordId)}`
                                  : `Preview: Strike ${strike}`}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.callsign || "—"} · {member.badgeNumber || "—"} · {member.rank || "—"}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                  {!members.length && (
                    <div className="p-8 text-center text-sm text-muted-foreground">No roster members are available.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {strikeMode && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold">Strike preview</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Members selected in the previous week preview as Activity Strike 2 this week. Future weekly lists continue the progression to Strike 3.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-semibold">This week</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scopeList ? `${scopeList.selectedUserIds.length} members are currently saved.` : "No list has been submitted for this scope yet."}
                </p>
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
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{item.week}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{item.scope}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.selectedUserIds.length} selected · {item.createdByName || "Unknown"}
                      </p>
                    </div>
                  ))}
                  {!history.length && !previousWeek && (
                    <p className="text-xs text-muted-foreground">No previous lists yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
