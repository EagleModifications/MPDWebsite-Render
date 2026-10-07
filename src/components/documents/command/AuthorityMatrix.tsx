import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react"

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18Io5OdkKsZ9aVDh8I5nsAPjBUISGGM77461K06ziALU/edit"

const SHEET_NAME = "Authority Matrix"


type Section = "PRIMARY RESPONSIBILITY" | "AUTHORITY"

type GroupName =
  | "OFFICERS"
  | "SUPERVISORS"
  | "LOW COMMAND"
  | "TRIAL HIGH COMMAND"
  | "HIGH COMMAND"

type RankColumn = {
  column: number
  rank: string
  group: GroupName
}

type MatrixEntry = {
  id: string
  section: Section
  name: string
  permissions: Record<string, boolean>
}

type MatrixData = {
  ranks: RankColumn[]
  entries: MatrixEntry[]
}

type GvizCell = {
  v?: unknown
  f?: unknown
}

type GvizRow = {
  c?: Array<GvizCell | null>
}

type GvizResponse = {
  table?: {
    rows?: GvizRow[]
  }
  status?: string
  errors?: Array<{
    message?: string
    detailed_message?: string
  }>
}

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function key(value: unknown): string {
  return clean(value).toUpperCase()
}

function cellValue(row: GvizRow | undefined, column: number): string {
  const cell = row?.c?.[column]

  if (!cell) return ""
  if (cell.f !== undefined && cell.f !== null) return clean(cell.f)
  if (cell.v !== undefined && cell.v !== null) return clean(cell.v)

  return ""
}

function rowValues(row: GvizRow | undefined): string[] {
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

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "Google Sheets did not return spreadsheet data. Make sure the sheet is publicly viewable."
    )
  }

  try {
    return JSON.parse(raw.slice(start, end + 1)) as GvizResponse
  } catch {
    throw new Error("Google Sheets returned an unreadable response.")
  }
}

function getSheetId(): string {
  const match = SHEET_URL.match(/\/spreadsheets\/d\/([^/]+)/)

  if (!match) {
    throw new Error("The Authority Matrix Google Sheets URL is invalid.")
  }

  return match[1]
}

function getSection(value: string): Section | null {
  const normalized = key(value)

  if (
    normalized === "PRIMARY RESPONSIBILITY" ||
    normalized === "PRIMARY RESPONSIBILITIES"
  ) {
    return "PRIMARY RESPONSIBILITY"
  }

  if (normalized === "AUTHORITY") return "AUTHORITY"

  return null
}

function isAllowed(value: string): boolean {
  const normalized = key(value)

  return ["TRUE", "YES", "Y", "1", "X", "CHECK", "CHECKED", "✓", "✔"].includes(
    normalized
  )
}

function isExcludedRow(values: string[]): boolean {
  const text = key(values.join(" "))

  if (!text) return true

  const excluded = [
    "THIS DOCUMENT SUPERCEDES",
    "THIS DOCUMENT SUPERSEDES",
    "TAKES PRECEDENT",
    "RESTRICTIONS APPLY",
    "DETERMINED BY RANK IN FTD",
    "LAST UPDATED",
  ]

  return excluded.some((phrase) => text.includes(phrase))
}

const RANK_COLUMNS: RankColumn[] = [
  { column: 2, rank: "Officer", group: "OFFICERS" },
  { column: 3, rank: "Officer 2", group: "OFFICERS" },
  { column: 4, rank: "Officer 3", group: "OFFICERS" },
  { column: 5, rank: "LCPL", group: "SUPERVISORS" },
  { column: 6, rank: "CPL", group: "SUPERVISORS" },
  { column: 7, rank: "SGT", group: "SUPERVISORS" },
  { column: 8, rank: "SSGT", group: "SUPERVISORS" },
  { column: 9, rank: "MSGT", group: "SUPERVISORS" },
  { column: 10, rank: "2LT", group: "LOW COMMAND" },
  { column: 11, rank: "1LT", group: "LOW COMMAND" },
  { column: 12, rank: "CPT", group: "LOW COMMAND" },
  { column: 13, rank: "MAJ", group: "LOW COMMAND" },
  { column: 14, rank: "Lieutenant Colonel", group: "TRIAL HIGH COMMAND" },
  { column: 15, rank: "Colonel", group: "HIGH COMMAND" },
  { column: 16, rank: "Chief Of Staff", group: "HIGH COMMAND" },
  { column: 17, rank: "Assistant Chief Of Police", group: "HIGH COMMAND" },
  { column: 18, rank: "Deputy Chief Of Police", group: "HIGH COMMAND" },
  { column: 19, rank: "Chief Of Police", group: "HIGH COMMAND" },
]

function parseMatrix(response: GvizResponse): MatrixData {
  const rows = response.table?.rows ?? []

  if (!rows.length) {
    throw new Error(`The "${SHEET_NAME}" tab returned no data.`)
  }

  const ranks = [...RANK_COLUMNS].reverse()
  const entries: MatrixEntry[] = []
  let currentSection: Section | null = null

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const values = rowValues(row)

    if (isExcludedRow(values)) continue

    const detectedSection = getSection(cellValue(row, 0))
    if (detectedSection) {
      currentSection = detectedSection
      continue
    }

    if (!currentSection) continue

    const name = clean(cellValue(row, 1))
    if (!name) continue

    const normalizedName = key(name)

    if (
      normalizedName === "PRIMARY RESPONSIBILITY" ||
      normalizedName === "AUTHORITY"
    ) {
      continue
    }

    const permissions: Record<string, boolean> = {}

    for (const rank of ranks) {
      permissions[rank.rank] = isAllowed(cellValue(row, rank.column))
    }

    entries.push({
      id: `${currentSection}-${rowIndex}-${name}`,
      section: currentSection,
      name,
      permissions,
    })
  }

  if (!entries.length) {
    throw new Error(
      `The "${SHEET_NAME}" tab was reached, but no matrix rows were found. Check that columns A:T still contain the Authority Matrix.`,
    )
  }

  return { ranks, entries }
}

function displayRank(rank: string): string {
  switch (rank) {
    case "Lieutenant Colonel":
      return "Lt. Colonel"
    case "Assistant Chief Of Police":
      return "Asst. Chief"
    case "Deputy Chief Of Police":
      return "Dep. Chief"
    case "Chief Of Police":
      return "Chief"
    default:
      return rank
  }
}

function groupText(group: GroupName): string {
  switch (group) {
    case "OFFICERS":
      return "text-sky-400"
    case "SUPERVISORS":
      return "text-orange-400"
    case "LOW COMMAND":
      return "text-green-400"
    case "TRIAL HIGH COMMAND":
      return "text-cyan-400"
    case "HIGH COMMAND":
      return "text-cyan-400"
  }
}

type FilterDropdownProps = {
  label: string
  icon: typeof Filter
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  open: boolean
  onToggle: () => void
  onClose: () => void
  displayOption?: (value: string) => string
  itemIcon?: typeof Shield
}

function FilterDropdown({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
  open,
  onToggle,
  onClose,
  displayOption = (value) => value,
  itemIcon: ItemIcon,
}: FilterDropdownProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const allSelected = selected.length === 0
  const selectedCount = allSelected ? options.length : selected.length

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, onClose])

  const toggleOption = (option: string) => {
    if (allSelected) {
      onChange(options.filter((value) => value !== option))
      return
    }

    const next = selected.includes(option)
      ? selected.filter((value) => value !== option)
      : [...selected, option]

    onChange(next.length === options.length ? [] : next)
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex h-9 w-full items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition-colors ${
          open
            ? "border-blue-500/70 ring-2 ring-blue-500/10"
            : "border-border hover:border-blue-500/40"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{label}</span>
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-blue-400">
          {selectedCount}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[260px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/40">
          <div className="max-h-[330px] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/70"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  allSelected
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-border bg-background"
                }`}
              >
                {allSelected && <Check className="h-3 w-3 stroke-[3]" />}
              </span>
              <Icon className="h-4 w-4 shrink-0 text-blue-400" />
              <span className="truncate">{label}</span>
            </button>

            <div className="my-1 border-t border-border/70" />

            {options.map((option) => {
              const checked = allSelected || selected.includes(option)
              const OptionIcon = ItemIcon

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/70"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-border bg-background"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3 stroke-[3]" />}
                  </span>
                  {OptionIcon ? (
                    <OptionIcon className="h-4 w-4 shrink-0 text-blue-400" />
                  ) : null}
                  <span className="min-w-0 truncate">{displayOption(option)}</span>
                </button>
              )
            })}
          </div>

          {!allSelected && (
            <div className="border-t border-border/70 p-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Clear {label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AuthorityMatrix() {
  const [data, setData] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sectionFilter, setSectionFilter] = useState<string[]>([])
  const [rankFilter, setRankFilter] = useState<string[]>([])
  const [openFilter, setOpenFilter] = useState<"section" | "rank" | null>(null)

  const loadMatrix = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const sheetId = getSheetId()
      const url =
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
        `?sheet=${encodeURIComponent(SHEET_NAME)}` +
        `&tq=${encodeURIComponent("select *")}` +
        `&headers=0` +
        `&tqx=out:json` +
        `&cacheBust=${Date.now()}`

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Google Sheets returned HTTP ${response.status}.`)
      }

      const raw = await response.text()

      if (/<!doctype html|<html/i.test(raw)) {
        throw new Error(
          "Google Sheets returned a webpage instead of sheet data. Make sure the spreadsheet is publicly viewable."
        )
      }

      const responseData = parseGviz(raw)

      if (responseData.errors?.length) {
        throw new Error(
          responseData.errors[0]?.detailed_message ??
            responseData.errors[0]?.message ??
            "Google Sheets returned an error."
        )
      }

      if (responseData.status && responseData.status !== "ok") {
        throw new Error(`Google Sheets returned status \"${responseData.status}\".`)
      }

      setData(parseMatrix(responseData))
    } catch (caught) {
      setData(null)
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Authority Matrix."
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  const sectionOptions: Section[] = ["PRIMARY RESPONSIBILITY", "AUTHORITY"]

  const visibleRanks = useMemo(() => {
    if (!data) return []
    if (rankFilter.length === 0) return data.ranks
    return data.ranks.filter((rank) => rankFilter.includes(rank.rank))
  }, [data, rankFilter])

  const filteredEntries = useMemo(() => {
    if (!data) return []

    const searchText = key(search)

    return data.entries.filter((entry) => {
      const matchesSearch = !searchText || key(entry.name).includes(searchText)
      const matchesSection =
        sectionFilter.length === 0 || sectionFilter.includes(entry.section)
      const selectedRanks =
        rankFilter.length === 0 ? data.ranks : data.ranks.filter((rank) => rankFilter.includes(rank.rank))
      const matchesRank =
        selectedRanks.length === 0 || selectedRanks.some((rank) => entry.permissions[rank.rank] === true)

      return matchesSearch && matchesSection && matchesRank
    })
  }, [data, search, sectionFilter, rankFilter])

  const groupedRanks = useMemo(() => {
    const groups: Array<{ group: GroupName; ranks: RankColumn[] }> = []

    for (const rank of visibleRanks) {
      const existing = groups.find((item) => item.group === rank.group)

      if (existing) existing.ranks.push(rank)
      else groups.push({ group: rank.group, ranks: [rank] })
    }

    return groups
  }, [visibleRanks])

  const clearFilters = () => {
    setSearch("")
    setSectionFilter([])
    setRankFilter([])
    setOpenFilter(null)
  }

  const renderEntries = () => {
    let lastSection: Section | null = null

    return filteredEntries.map((entry) => {
      const showSection = entry.section !== lastSection
      lastSection = entry.section

      return (
        <tbody key={entry.id}>
          {showSection && (
            <tr
              className={
                entry.section === "AUTHORITY"
                  ? "border-t-2 border-blue-500/30"
                  : ""
              }
            >
              <td
                colSpan={visibleRanks.length + 1}
                className="border-b border-blue-500/15 bg-blue-500/[0.035] px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-blue-400 sm:px-3 sm:text-[10px]"
              >
                {entry.section}
              </td>
            </tr>
          )}

          <tr className="border-b border-border/50 transition-colors hover:bg-blue-500/[0.025]">
            <td className="border-r border-border/50 px-3 py-2.5 text-left text-[10px] font-medium leading-4 text-foreground whitespace-nowrap sm:px-3 sm:text-[11px]">
              {entry.name}
            </td>

            {visibleRanks.map((rank) => {
              const allowed = entry.permissions[rank.rank] === true

              return (
                <td
                  key={`${entry.id}-${rank.rank}`}
                  className="border-r border-border/40 px-0.5 py-2.5 text-center last:border-r-0"
                >
                  <span
                    title={`${rank.rank}: ${allowed ? "Allowed" : "Not allowed"}`}
                    aria-label={`${rank.rank}: ${allowed ? "Allowed" : "Not allowed"}`}
                    className={
                      allowed
                        ? "mx-auto inline-flex h-4 w-4 items-center justify-center rounded-[4px] border border-blue-500/40 bg-blue-500/15 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.08)] sm:h-[18px] sm:w-[18px]"
                        : "mx-auto inline-flex h-4 w-4 items-center justify-center rounded-[4px] border border-border/80 bg-muted/20 text-transparent sm:h-[18px] sm:w-[18px]"
                    }
                  >
                    <Check
                      className={
                        allowed
                          ? "h-2.5 w-2.5 stroke-[3] sm:h-3 sm:w-3"
                          : "h-2.5 w-2.5 sm:h-3 sm:w-3"
                      }
                    />
                  </span>
                </td>
              )
            })}
          </tr>
        </tbody>
      )
    })
  }

  return (
    <div className="w-full min-w-0">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Authority Matrix</h2>
                <p className="text-xs text-muted-foreground">
                  Command authority and responsibilities by rank.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadMatrix(true)}
              disabled={refreshing}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh
            </button>
          </div>

          {!loading && !error && data && (
            <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search responsibilities..."
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              <FilterDropdown
                label="All Sections"
                icon={Filter}
                options={sectionOptions}
                selected={sectionFilter}
                onChange={setSectionFilter}
                open={openFilter === "section"}
                onToggle={() =>
                  setOpenFilter((current) =>
                    current === "section" ? null : "section",
                  )
                }
                onClose={() => setOpenFilter(null)}
                displayOption={(value) =>
                  value === "PRIMARY RESPONSIBILITY"
                    ? "Primary Responsibility"
                    : "Authority"
                }
              />

              <FilterDropdown
                label="All Ranks"
                icon={Shield}
                options={data.ranks.map((rank) => rank.rank)}
                selected={rankFilter}
                onChange={setRankFilter}
                open={openFilter === "rank"}
                onToggle={() =>
                  setOpenFilter((current) =>
                    current === "rank" ? null : "rank",
                  )
                }
                onClose={() => setOpenFilter(null)}
                displayOption={displayRank}
                itemIcon={Shield}
              />

              {(search || sectionFilter.length > 0 || rankFilter.length > 0) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading Authority Matrix...
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 sm:p-5">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-red-400">
                    Unable to load Authority Matrix
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadMatrix(true)}
                    className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse">

              <colgroup>
                <col className="w-[25%]" />
                {visibleRanks.map((rank) => (
                  <col key={rank.rank} />
                ))}
              </colgroup>

              <thead>
                <tr className="border-b border-border/70 bg-muted/20">
                  <th
                    rowSpan={2}
                    className="border-r border-border/70 bg-background/30 px-3 py-3 text-left align-middle text-[8px] font-bold uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap"
                  >
                    Responsibility / Authority
                  </th>
                  {groupedRanks.map(({ group, ranks }) => (
                    <th
                      key={group}
                      colSpan={ranks.length}
                      className={`border-r border-border/50 bg-background/40 px-0.5 py-2 text-center text-[7px] font-bold uppercase tracking-[0.015em] whitespace-nowrap last:border-r-0 sm:text-[8px] ${groupText(group)}`}
                    >
                      {group}
                    </th>
                  ))}
                </tr>

                <tr className="border-b border-border/70 bg-muted/10">
                  {visibleRanks.map((rank) => (
                    <th
                      key={rank.rank}
                      title={rank.rank}
                      className="h-[38px] overflow-hidden border-r border-border/50 bg-background/20 px-0.5 py-1 text-center text-[6.5px] font-semibold leading-none text-muted-foreground whitespace-nowrap last:border-r-0 sm:text-[7px]"
                    >
                      <span
                        className="block truncate whitespace-nowrap"
                        title={rank.rank}
                      >
                        {displayRank(rank.rank)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              {renderEntries()}
            </table>

            {filteredEntries.length === 0 && (
              <div className="border-t border-border/70 px-4 py-10 text-center">
                <Search className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try changing your search or filters.
                </p>
              </div>
            )}
          </div>
        )}

        {!loading && !error && data && (
          <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {filteredEntries.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {data.entries.length}
            </span>{" "}
            entries
          </div>
        )}
      </div>
    </div>
  )
}
