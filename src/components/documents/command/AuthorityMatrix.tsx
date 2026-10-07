import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
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
  if (cell.f !== undefined && cell.f !== null) return String(cell.f)
  if (cell.v !== undefined && cell.v !== null) return String(cell.v)

  return ""
}

function parseGviz(raw: string): GvizResponse {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")

  if (start === -1 || end === -1) {
    throw new Error("Google Sheets returned an invalid response.")
  }

  return JSON.parse(raw.slice(start, end + 1)) as GvizResponse
}

function getSheetId(): string {
  const match = SHEET_URL.match(/\/spreadsheets\/d\/([^/]+)/)

  if (!match) {
    throw new Error("The Authority Matrix Google Sheets URL is invalid.")
  }

  return match[1]
}

const RANK_ALIASES: Record<string, string> = {
  OFFICER: "Officer",
  "OFFICER 1": "Officer",
  "OFFICER 2": "Officer 2",
  "OFFICER 3": "Officer 3",
  LCPL: "LCPL",
  CPL: "CPL",
  SGT: "SGT",
  SSGT: "SSGT",
  MSGT: "MSGT",
  "2LT": "2LT",
  "1LT": "1LT",
  CPT: "CPT",
  MAJ: "MAJ",
  "LIEUTENANT COLONEL": "Lieutenant Colonel",
  LTCOL: "Lieutenant Colonel",
  "LT COL": "Lieutenant Colonel",
  COLONEL: "Colonel",
  COL: "Colonel",
  "CHIEF OF STAFF": "Chief Of Staff",
  "ASSISTANT CHIEF OF POLICE": "Assistant Chief Of Police",
  "ASSISTANT CHIEF": "Assistant Chief Of Police",
  "DEPUTY CHIEF OF POLICE": "Deputy Chief Of Police",
  "DEPUTY CHIEF": "Deputy Chief Of Police",
  "CHIEF OF POLICE": "Chief Of Police",
  CHIEF: "Chief Of Police",
}

function getRank(value: string): string | null {
  return RANK_ALIASES[key(value)] ?? null
}

function getGroup(rank: string): GroupName {
  switch (key(rank)) {
    case "OFFICER":
    case "OFFICER 2":
    case "OFFICER 3":
      return "OFFICERS"

    case "LCPL":
    case "CPL":
    case "SGT":
    case "SSGT":
    case "MSGT":
      return "SUPERVISORS"

    case "2LT":
    case "1LT":
    case "CPT":
    case "MAJ":
      return "LOW COMMAND"

    case "LIEUTENANT COLONEL":
      return "TRIAL HIGH COMMAND"

    default:
      return "HIGH COMMAND"
  }
}

function getSection(value: string): Section | null {
  const normalized = key(value)

  if (
    normalized === "PRIMARY RESPONSIBILITY" ||
    normalized === "PRIMARY RESPONSIBILITIES"
  ) {
    return "PRIMARY RESPONSIBILITY"
  }

  if (normalized === "AUTHORITY") {
    return "AUTHORITY"
  }

  return null
}

function isAllowed(value: string): boolean {
  return [
    "TRUE",
    "YES",
    "Y",
    "1",
    "X",
    "CHECK",
    "CHECKED",
    "✓",
    "✔",
  ].includes(key(value))
}

function isExcludedRow(values: string[]): boolean {
  const text = key(values.join(" "))

  if (!text) return true

  const excluded = [
    "THIS DOCUMENT SUPERCEDES",
    "TAKES PRECEDENT",
    "RESTRICTIONS APPLY",
    "DETERMINED BY RANK IN FTD",
    "LAST UPDATED",
  ]

  return excluded.some((phrase) => text.includes(phrase))
}

function findRankRow(rows: GvizRow[]): number {
  let bestRow = -1
  let bestCount = 0

  const scanLimit = Math.min(rows.length, 20)

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rows[rowIndex]
    let count = 0

    for (let column = 0; column < (row?.c?.length ?? 0); column += 1) {
      if (getRank(cellValue(row, column))) count += 1
    }

    if (count > bestCount) {
      bestCount = count
      bestRow = rowIndex
    }
  }

  return bestCount >= 3 ? bestRow : -1
}

function parseMatrix(response: GvizResponse): MatrixData {
  const rows = response.table?.rows ?? []

  if (rows.length === 0) {
    throw new Error("The Authority Matrix sheet returned no data.")
  }

  const rankRowIndex = findRankRow(rows)

  if (rankRowIndex === -1) {
    throw new Error(
      "Could not find the rank columns in the Authority Matrix sheet.",
    )
  }

  const rankRow = rows[rankRowIndex]
  const ranks: RankColumn[] = []

  for (let column = 0; column < (rankRow?.c?.length ?? 0); column += 1) {
    const rank = getRank(cellValue(rankRow, column))

    if (!rank) continue

    ranks.push({
      column,
      rank,
      group: getGroup(rank),
    })
  }

  if (ranks.length === 0) {
    throw new Error("No rank columns could be read from the Authority Matrix.")
  }

  const entries: MatrixEntry[] = []
  let currentSection: Section | null = null

  for (
    let rowIndex = rankRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]
    if (!row) continue

    const values = (row.c ?? []).map((cell) =>
      clean(cell?.f ?? cell?.v ?? ""),
    )

    if (isExcludedRow(values)) continue

    const section = getSection(cellValue(row, 0))
    if (section) currentSection = section
    if (!currentSection) continue

    const name = clean(cellValue(row, 1))
    if (!name) continue

    const normalizedName = key(name)

    if (
      normalizedName === "PRIMARY RESPONSIBILITY" ||
      normalizedName === "AUTHORITY" ||
      normalizedName.includes("THIS DOCUMENT") ||
      normalizedName.includes("RESTRICTIONS APPLY") ||
      normalizedName.includes("LAST UPDATED") ||
      normalizedName.includes("DETERMINED BY RANK")
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

  if (entries.length === 0) {
    throw new Error(
      "The Authority Matrix loaded, but no matrix entries were found.",
    )
  }

  /*
   * The sheet is read in its natural left-to-right order, but the UI
   * intentionally displays the command structure from Chief down to Officer.
   */
  const orderedRanks = [...ranks].sort((a, b) => b.column - a.column)

  return {
    ranks: orderedRanks,
    entries,
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
    case "HIGH COMMAND":
      return "text-cyan-400"
  }
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

function FilterDropdown({
  label,
  count,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string
  count: number
  icon: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex h-9 min-w-[190px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
      >
        <span className="text-blue-400">{icon}</span>
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
          {count}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-blue-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[260px] rounded-xl border border-border bg-background p-2 shadow-2xl shadow-black/40">
          {children}
        </div>
      )}
    </div>
  )
}

function FilterOption({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
          checked
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-border bg-background"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

export default function AuthorityMatrix() {
  const [data, setData] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sectionFilter, setSectionFilter] = useState<Section | "ALL">("ALL")
  const [rankFilter, setRankFilter] = useState<string>("ALL")
  const [openFilter, setOpenFilter] = useState<"section" | "rank" | null>(null)

  const loadMatrix = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const sheetId = getSheetId()
      const url =
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
        `?sheet=${encodeURIComponent(SHEET_NAME)}` +
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

      if (raw.includes("<html") || raw.includes("<!DOCTYPE")) {
        throw new Error(
          "Google Sheets did not return spreadsheet data. The sheet must be publicly viewable.",
        )
      }

      const responseData = parseGviz(raw)

      if (responseData.errors?.length) {
        throw new Error(
          responseData.errors[0]?.detailed_message ??
            responseData.errors[0]?.message ??
            "Google Sheets returned an error.",
        )
      }

      if (responseData.status && responseData.status !== "ok") {
        throw new Error(
          `Google Sheets returned status "${responseData.status}".`,
        )
      }

      setData(parseMatrix(responseData))
    } catch (caught) {
      setData(null)
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Authority Matrix.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  const visibleRanks = useMemo(() => {
    if (!data) return []

    if (rankFilter === "ALL") return data.ranks

    return data.ranks.filter((rank) => rank.rank === rankFilter)
  }, [data, rankFilter])

  const filteredEntries = useMemo(() => {
    if (!data) return []

    const searchText = key(search)

    return data.entries.filter((entry) => {
      const matchesSearch =
        !searchText || key(entry.name).includes(searchText)

      const matchesSection =
        sectionFilter === "ALL" || entry.section === sectionFilter

      const matchesRank =
        rankFilter === "ALL" ||
        entry.permissions[rankFilter] !== undefined

      return matchesSearch && matchesSection && matchesRank
    })
  }, [data, search, sectionFilter, rankFilter])

  const groupedRanks = useMemo(() => {
    const groups: Array<{ group: GroupName; ranks: RankColumn[] }> = []

    for (const rank of visibleRanks) {
      const existing = groups.find((item) => item.group === rank.group)

      if (existing) {
        existing.ranks.push(rank)
      } else {
        groups.push({
          group: rank.group,
          ranks: [rank],
        })
      }
    }

    return groups
  }, [visibleRanks])

  const clearFilters = () => {
    setSearch("")
    setSectionFilter("ALL")
    setRankFilter("ALL")
  }

  const sectionCount = sectionFilter === "ALL" ? 2 : 1
  const rankCount = rankFilter === "ALL" ? 18 : 1

  return (
    <div className="w-full min-w-0">
      <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        {/* Sticky controls. It stays visible while the matrix is scrolled. */}
        <div className="sticky top-0 z-[70] border-b border-border/70 bg-card/95 px-4 py-4 shadow-sm backdrop-blur-md sm:px-5">
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
            <div className="mt-4 flex flex-col gap-2.5 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search responsibilities..."
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              <FilterDropdown
                label={
                  sectionFilter === "ALL"
                    ? "All Sections"
                    : sectionFilter === "PRIMARY RESPONSIBILITY"
                      ? "Primary Responsibility"
                      : "Authority"
                }
                count={sectionCount}
                icon={<Filter className="h-3.5 w-3.5" />}
                open={openFilter === "section"}
                onToggle={() =>
                  setOpenFilter((current) =>
                    current === "section" ? null : "section",
                  )
                }
              >
                <div className="border-b border-border/70 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-blue-400" />
                    Sections
                  </span>
                </div>

                <div className="mt-1">
                  <FilterOption
                    checked={sectionFilter === "ALL"}
                    label="All Sections"
                    onClick={() => setSectionFilter("ALL")}
                  />
                  <FilterOption
                    checked={sectionFilter === "PRIMARY RESPONSIBILITY"}
                    label="Primary Responsibility"
                    onClick={() =>
                      setSectionFilter("PRIMARY RESPONSIBILITY")
                    }
                  />
                  <FilterOption
                    checked={sectionFilter === "AUTHORITY"}
                    label="Authority"
                    onClick={() => setSectionFilter("AUTHORITY")}
                  />
                </div>
              </FilterDropdown>

              <FilterDropdown
                label={
                  rankFilter === "ALL" ? "All Ranks" : displayRank(rankFilter)
                }
                count={rankCount}
                icon={<Shield className="h-3.5 w-3.5" />}
                open={openFilter === "rank"}
                onToggle={() =>
                  setOpenFilter((current) =>
                    current === "rank" ? null : "rank",
                  )
                }
              >
                <div className="border-b border-border/70 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                    Ranks
                  </span>
                </div>

                <div className="mt-1 max-h-[300px] overflow-y-auto pr-1">
                  <FilterOption
                    checked={rankFilter === "ALL"}
                    label="All Ranks"
                    onClick={() => setRankFilter("ALL")}
                  />

                  {data.ranks.map((rank) => (
                    <FilterOption
                      key={rank.rank}
                      checked={rankFilter === rank.rank}
                      label={displayRank(rank.rank)}
                      onClick={() => setRankFilter(rank.rank)}
                    />
                  ))}
                </div>
              </FilterDropdown>

              {(search ||
                sectionFilter !== "ALL" ||
                rankFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
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

                <div>
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
          <div className="w-full">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[28%]" />
                {visibleRanks.map((rank) => (
                  <col key={rank.rank} />
                ))}
              </colgroup>

              <thead className="sticky top-[108px] z-[60]">
                <tr className="border-b border-border/70 bg-background">
                  <th
                    rowSpan={2}
                    className="border-r border-border/70 bg-background px-3 py-2 text-left align-middle text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:px-4 sm:text-[10px]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Filter className="h-3 w-3 text-blue-400" />
                      Responsibility / Authority
                    </span>
                  </th>

                  {groupedRanks.map(({ group, ranks }) => (
                    <th
                      key={group}
                      colSpan={ranks.length}
                      className={`border-r border-border/50 bg-background px-1 py-2 text-center text-[8px] font-bold uppercase tracking-[0.06em] last:border-r-0 sm:text-[9px] ${groupText(
                        group,
                      )}`}
                    >
                      {group}
                    </th>
                  ))}
                </tr>

                <tr className="border-b border-border/70 bg-background">
                  {visibleRanks.map((rank) => (
                    <th
                      key={rank.rank}
                      title={rank.rank}
                      className="border-r border-border/50 bg-background px-0.5 py-2 text-center text-[8px] font-semibold leading-tight text-muted-foreground last:border-r-0 sm:text-[9px]"
                    >
                      {displayRank(rank.rank)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {(["PRIMARY RESPONSIBILITY", "AUTHORITY"] as Section[]).map(
                  (section) => {
                    const sectionEntries = filteredEntries.filter(
                      (entry) => entry.section === section,
                    )

                    if (sectionEntries.length === 0) return null

                    return (
                      <tr
                        key={`section-${section}`}
                        className={
                          section === "AUTHORITY"
                            ? "border-t-2 border-blue-500/20"
                            : ""
                        }
                      >
                        <td
                          colSpan={visibleRanks.length + 1}
                          className="border-b border-border/70 bg-muted/20 px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:px-4 sm:text-[10px]"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Filter className="h-3 w-3 text-blue-400" />
                            {section}
                          </span>
                        </td>
                      </tr>
                    )
                  },
                )}

                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 hover:bg-muted/10"
                  >
                    <td className="border-r border-border/50 px-3 py-2 text-left text-[10px] font-medium leading-4 text-foreground sm:px-4 sm:text-[11px]">
                      {entry.name}
                    </td>

                    {visibleRanks.map((rank) => {
                      const allowed = Boolean(entry.permissions[rank.rank])

                      return (
                        <td
                          key={`${entry.id}-${rank.rank}`}
                          className="border-r border-border/50 px-0.5 py-2 text-center last:border-r-0"
                        >
                          {allowed ? (
                            <span
                              title={`${rank.rank}: Allowed`}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-blue-500/50 bg-blue-500/10 text-blue-400 sm:h-5 sm:w-5"
                            >
                              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            </span>
                          ) : (
                            <span
                              title={`${rank.rank}: Not allowed`}
                              className="inline-flex h-4 w-4 rounded-[3px] border border-border bg-background sm:h-5 sm:w-5"
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
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
