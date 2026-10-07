import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  Check,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react"

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1WlES0v7NUSRccYvdd7EUHQgHvcdrBPJGUoKqNWbTDP8/edit?gid=0#gid=0"

type GvizCell = { v?: unknown; f?: unknown }
type GvizRow = { c?: Array<GvizCell | null> }
type GvizResponse = {
  table?: { cols?: Array<{ label?: string; id?: string }>; rows?: GvizRow[] }
  status?: string
  errors?: Array<{ message?: string; detailed_message?: string }>
}

type RankColumn = { column: number; rank: string }
type RowData = { id: string; values: string[]; rank: string | null }
type SheetData = { headers: string[]; rows: RowData[]; rankColumns: RankColumn[]; rankRows: string[] }

const RANK_ORDER = [
  "Chief Of Police",
  "Deputy Chief Of Police",
  "Assistant Chief Of Police",
  "Chief Of Staff",
  "Colonel",
  "Lieutenant Colonel",
  "MAJ",
  "CPT",
  "1LT",
  "2LT",
  "MSGT",
  "SSGT",
  "SGT",
  "CPL",
  "LCPL",
  "Officer 3",
  "Officer 2",
  "Officer",
]

const RANK_ALIASES: Record<string, string> = Object.fromEntries(
  [
    ["CHIEF OF POLICE", "Chief Of Police"],
    ["CHIEF", "Chief Of Police"],
    ["DEPUTY CHIEF OF POLICE", "Deputy Chief Of Police"],
    ["DEPUTY CHIEF", "Deputy Chief Of Police"],
    ["ASSISTANT CHIEF OF POLICE", "Assistant Chief Of Police"],
    ["ASSISTANT CHIEF", "Assistant Chief Of Police"],
    ["CHIEF OF STAFF", "Chief Of Staff"],
    ["LIEUTENANT COLONEL", "Lieutenant Colonel"],
    ["LT COL", "Lieutenant Colonel"],
    ["LTCOL", "Lieutenant Colonel"],
    ["COLONEL", "Colonel"],
    ["COL", "Colonel"],
    ["MAJOR", "MAJ"],
    ["MAJ", "MAJ"],
    ["CAPTAIN", "CPT"],
    ["CPT", "CPT"],
    ["1ST LIEUTENANT", "1LT"],
    ["1LT", "1LT"],
    ["2ND LIEUTENANT", "2LT"],
    ["2LT", "2LT"],
    ["MASTER SERGEANT", "MSGT"],
    ["MSGT", "MSGT"],
    ["STAFF SERGEANT", "SSGT"],
    ["SSGT", "SSGT"],
    ["SERGEANT", "SGT"],
    ["SGT", "SGT"],
    ["CORPORAL", "CPL"],
    ["CPL", "CPL"],
    ["LANCE CORPORAL", "LCPL"],
    ["LCPL", "LCPL"],
    ["OFFICER 3", "Officer 3"],
    ["OFFICER 2", "Officer 2"],
    ["OFFICER 1", "Officer"],
    ["OFFICER", "Officer"],
  ].map(([a, b]) => [a, b]),
)

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function key(value: unknown) {
  return clean(value).toUpperCase()
}

function rankOf(value: string) {
  return RANK_ALIASES[key(value)] ?? null
}

function rowValues(row: GvizRow | undefined) {
  return (row?.c ?? []).map((cell) => {
    if (!cell) return ""
    if (cell.f !== undefined && cell.f !== null) return clean(cell.f)
    if (cell.v !== undefined && cell.v !== null) return clean(cell.v)
    return ""
  })
}

function parseGviz(raw: string): GvizResponse {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Google Sheets returned an invalid response.")
  return JSON.parse(raw.slice(start, end + 1)) as GvizResponse
}

function getSheetId() {
  const match = SHEET_URL.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!match) throw new Error("The Punishment Guidelines Google Sheets URL is invalid.")
  return match[1]
}

function parseSheet(response: GvizResponse): SheetData {
  const rows = response.table?.rows ?? []
  if (!rows.length) throw new Error("The Punishment Guidelines sheet returned no data.")

  const width = Math.max(1, ...rows.map((row) => row.c?.length ?? 0))
  const headers = Array.from({ length: width }, (_, index) => {
    const label = response.table?.cols?.[index]?.label
    return clean(label) || `Column ${index + 1}`
  })

  const rankColumns = new Map<number, string>()
  const scanRows = rows.slice(0, Math.min(rows.length, 8))

  for (const row of scanRows) {
    rowValues(row).forEach((value, index) => {
      const rank = rankOf(value)
      if (rank) rankColumns.set(index, rank)
    })
  }

  const orderedRankColumns = [...rankColumns.entries()]
    .map(([column, rank]) => ({ column, rank }))
    .sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank))

  const rankRows = new Set<string>()
  const parsedRows: RowData[] = []

  rows.forEach((row, rowIndex) => {
    const values = rowValues(row)
    if (!values.some(Boolean)) return

    const rowRank = values.slice(0, 4).map(rankOf).find(Boolean) ?? null
    if (rowRank) rankRows.add(rowRank)

    const joined = key(values.join(" "))
    if (
      joined.includes("THIS DOCUMENT SUPERCEDES") ||
      joined.includes("THIS DOCUMENT SUPERSEDES") ||
      joined.includes("LAST UPDATED")
    ) return

    parsedRows.push({ id: `punishment-${rowIndex}`, values, rank: rowRank })
  })

  return {
    headers,
    rows: parsedRows,
    rankColumns: orderedRankColumns,
    rankRows: [...rankRows].sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b)),
  }
}

function displayRank(rank: string) {
  switch (rank) {
    case "Lieutenant Colonel": return "Lt. Colonel"
    case "Assistant Chief Of Police": return "Asst. Chief"
    case "Deputy Chief Of Police": return "Dep. Chief"
    case "Chief Of Police": return "Chief"
    default: return rank
  }
}

type FilterProps = {
  label: string
  icon: typeof Filter
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  open: boolean
  onToggle: () => void
  onClose: () => void
  itemIcon?: typeof Shield
}

function FilterDropdown({ label, icon: Icon, options, selected, onChange, open, onToggle, onClose, itemIcon: ItemIcon }: FilterProps) {
  const ref = useRef<HTMLDivElement>(null)
  const allSelected = selected.length === 0
  const count = allSelected ? options.length : selected.length

  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("mousedown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open, onClose])

  const toggle = (option: string) => {
    if (allSelected) {
      onChange(options.filter((item) => item !== option))
      return
    }
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]
    onChange(next.length === options.length ? [] : next)
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={onToggle} className={`flex h-9 w-full items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors ${open ? "border-blue-500/70 ring-2 ring-blue-500/10" : "border-border hover:border-blue-500/40"}`}>
        <Icon className="h-3.5 w-3.5 shrink-0 text-blue-400" />
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">{count}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[90] w-[285px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/50">
          <div className="max-h-[330px] overflow-y-auto p-1.5">
            <button type="button" onClick={() => onChange([])} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-muted/70">
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected ? "border-blue-500 bg-blue-500 text-white" : "border-border"}`}>{allSelected && <Check className="h-3 w-3 stroke-[3]" />}</span>
              <Icon className="h-4 w-4 text-blue-400" />
              <span>{label}</span>
            </button>
            <div className="my-1 border-t border-border/70" />
            {options.map((option) => {
              const checked = allSelected || selected.includes(option)
              return (
                <button key={option} type="button" onClick={() => toggle(option)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted/70">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-blue-500 bg-blue-500 text-white" : "border-border"}`}>{checked && <Check className="h-3 w-3 stroke-[3]" />}</span>
                  {ItemIcon && <ItemIcon className="h-4 w-4 shrink-0 text-blue-400" />}
                  <span className="truncate">{displayRank(option)}</span>
                </button>
              )
            })}
          </div>
          {!allSelected && <div className="border-t border-border/70 p-1.5"><button type="button" onClick={() => onChange([])} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"><X className="h-4 w-4" />Clear {label}</button></div>}
        </div>
      )}
    </div>
  )
}

export default function PunishmentGuidelines() {
  const [data, setData] = useState<SheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [rankFilter, setRankFilter] = useState<string[]>([])
  const [openFilter, setOpenFilter] = useState(false)

  const load = useCallback(async (manual = false) => {
    try {
      manual ? setRefreshing(true) : setLoading(true)
      setError(null)
      const url = `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq?headers=0&tqx=out:json&cacheBust=${Date.now()}`
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}.`)
      const raw = await response.text()
      if (/<!doctype html|<html/i.test(raw)) throw new Error("Google Sheets returned a webpage instead of sheet data. Make sure the spreadsheet is publicly viewable.")
      const parsed = parseGviz(raw)
      if (parsed.errors?.length) throw new Error(parsed.errors[0]?.detailed_message ?? parsed.errors[0]?.message ?? "Google Sheets returned an error.")
      setData(parseSheet(parsed))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Punishment Guidelines.")
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rankOptions = useMemo(() => data?.rankColumns.length ? data.rankColumns.map((item) => item.rank) : data?.rankRows ?? [], [data])
  const filteredRows = useMemo(() => {
    if (!data) return []
    const query = key(search)
    return data.rows.filter((row) => {
      const matchesSearch = !query || key(row.values.join(" ")).includes(query)
      const matchesRowRank = rankFilter.length === 0 || (row.rank ? rankFilter.includes(row.rank) : true)
      return matchesSearch && matchesRowRank
    })
  }, [data, search, rankFilter])

  const visibleRankColumns = useMemo(() => {
    if (!data) return []
    if (!data.rankColumns.length || rankFilter.length === 0) return data.rankColumns
    return data.rankColumns.filter((item) => rankFilter.includes(item.rank))
  }, [data, rankFilter])

  const clear = () => { setSearch(""); setRankFilter([]); setOpenFilter(false) }

  return (
    <div className="w-full min-w-0">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500"><FileSpreadsheet className="h-5 w-5" /></div>
              <div><h2 className="text-base font-semibold">Punishment Guidelines</h2><p className="text-xs text-muted-foreground">Command punishment guidelines by rank.</p></div>
            </div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"><RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</button>
          </div>
          {!loading && !error && data && (
            <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_190px_auto]">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search punishment guidelines..." className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10" /></div>
              {rankOptions.length > 0 && <FilterDropdown label="All Ranks" icon={Shield} options={rankOptions} selected={rankFilter} onChange={setRankFilter} open={openFilter} onToggle={() => setOpenFilter((value) => !value)} onClose={() => setOpenFilter(false)} itemIcon={Shield} />}
              {(search || rankFilter.length > 0) && <button type="button" onClick={clear} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><X className="h-3.5 w-3.5" />Clear</button>}
            </div>
          )}
        </div>

        {loading && <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading Punishment Guidelines...</div>}
        {!loading && error && <div className="p-5"><div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5"><h3 className="text-sm font-semibold text-red-400">Unable to load Punishment Guidelines</h3><p className="mt-1 text-sm text-muted-foreground">{error}</p><button type="button" onClick={() => void load(true)} className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" />Try Again</button></div></div>}

        {!loading && !error && data && (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {data.rankColumns.length ? <col className="w-[28%]" /> : data.headers.map((header) => <col key={header} />)}
                {visibleRankColumns.map((rank) => <col key={rank.rank} />)}
              </colgroup>
              <thead>
                <tr className="border-b border-border/70 bg-muted/20">
                  {data.rankColumns.length ? <th className="border-r border-border/70 px-3 py-3 text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Punishment / Guideline</th> : data.headers.map((header) => <th key={header} className="border-r border-border/60 px-3 py-3 text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{header}</th>)}
                  {data.rankColumns.length && visibleRankColumns.map((rank) => <th key={rank.rank} title={rank.rank} className="border-r border-border/50 px-1 py-2 text-center text-[7px] font-semibold text-muted-foreground whitespace-nowrap">{displayRank(rank.rank)}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const displayValues = data.rankColumns.length ? data.headers.map((_, index) => row.values[index] ?? "").filter((_, index) => !data.rankColumns.some((rank) => rank.column === index)) : row.values
                  return (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-blue-500/[0.025]">
                      {data.rankColumns.length ? <td className="border-r border-border/50 px-3 py-2.5 text-[10px] font-medium whitespace-nowrap">{displayValues.filter(Boolean).join(" • ") || "—"}</td> : row.values.map((value, index) => <td key={index} className="border-r border-border/50 px-3 py-2.5 text-[10px] align-top">{value || "—"}</td>)}
                      {data.rankColumns.length && visibleRankColumns.map((rank) => {
                        const value = row.values[rank.column] ?? ""
                        const allowed = /^(true|yes|y|1|x|✓|✔|allowed|check|checked)$/i.test(value.trim())
                        return <td key={rank.rank} className="border-r border-border/40 px-0.5 py-2.5 text-center"><span className={`mx-auto inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${allowed ? "border-blue-500/40 bg-blue-500/15 text-blue-400" : "border-border/80 bg-muted/20 text-transparent"}`}><Check className="h-3 w-3 stroke-[3]" /></span></td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredRows.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">No results found.</div>}
          </div>
        )}
      </section>
    </div>
  )
}
