import { useCallback, useEffect, useMemo, useState } from "react"
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
  table?: { rows?: GvizRow[] }
  status?: string
  errors?: Array<{ message?: string; detailed_message?: string }>
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

// Table order follows the Google Sheet: Officers on the left,
// then Supervisors, Low Command, Trial High Command, and High Command.
const DISPLAY_ORDER = [...RANK_COLUMNS]

// The rank filter intentionally lists the ranks in reverse order,
// putting Officers at the bottom of the filter menu.
const FILTER_ORDER = [...RANK_COLUMNS].reverse()

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
  if (start < 0 || end < start) {
    throw new Error("Google Sheets returned an invalid response.")
  }
  return JSON.parse(raw.slice(start, end + 1)) as GvizResponse
}

function getSheetId(): string {
  const match = SHEET_URL.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!match) throw new Error("The Authority Matrix Google Sheets URL is invalid.")
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
  ].includes(normalized)
}

function isExcludedRow(values: string[]): boolean {
  const text = key(values.join(" "))
  if (!text) return true

  return [
    "THIS DOCUMENT SUPERCEDES",
    "THIS DOCUMENT SUPERSEDES",
    "TAKES PRECEDENT",
    "RESTRICTIONS APPLY",
    "DETERMINED BY RANK IN FTD",
    "LAST UPDATED",
  ].some((phrase) => text.includes(phrase))
}

function parseMatrix(response: GvizResponse): MatrixData {
  const rows = response.table?.rows ?? []
  if (!rows.length) {
    throw new Error("The Authority Matrix sheet returned no data.")
  }

  const entries: MatrixEntry[] = []
  let currentSection: Section | null = null

  // The sheet layout is fixed: row 1 = group headings,
  // row 2 = rank headings, row 3 onward = matrix data.
  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
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
      normalizedName === "AUTHORITY"
    ) {
      continue
    }

    const permissions: Record<string, boolean> = {}
    for (const rank of RANK_COLUMNS) {
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
    throw new Error("The Authority Matrix loaded, but no matrix entries were found.")
  }

  return { ranks: RANK_COLUMNS, entries }
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

function compactRank(rank: string): string {
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

export default function AuthorityMatrix() {
  const [data, setData] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sectionFilter, setSectionFilter] = useState("ALL")
  const [rankFilter, setRankFilter] = useState("ALL")

  const loadMatrix = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const sheetId = getSheetId()
      const url =
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
        `?sheet=${encodeURIComponent(SHEET_NAME)}` +
        `&headers=0&tqx=out:json&cacheBust=${Date.now()}`

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
        throw new Error(`Google Sheets returned status "${responseData.status}".`)
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
    const ranks = rankFilter === "ALL"
      ? DISPLAY_ORDER
      : DISPLAY_ORDER.filter((rank) => rank.rank === rankFilter)
    return ranks
  }, [data, rankFilter])

  const filteredEntries = useMemo(() => {
    if (!data) return []
    const searchText = key(search)

    return data.entries.filter((entry) => {
      const matchesSearch =
        !searchText || key(entry.name).includes(searchText)
      const matchesSection =
        sectionFilter === "ALL" || entry.section === sectionFilter
      return matchesSearch && matchesSection
    })
  }, [data, search, sectionFilter])

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
    setSectionFilter("ALL")
    setRankFilter("ALL")
  }

  return (
    <div className="w-full min-w-0">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="border-b border-border/70 bg-card/95 px-4 py-4 sm:px-5">
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
                className={`h-4 w-4 text-blue-400 ${refreshing ? "animate-spin" : ""}`}
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

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-blue-400" />
                <select
                  value={sectionFilter}
                  onChange={(event) => setSectionFilter(event.target.value)}
                  className="h-9 w-full min-w-[190px] appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="ALL">All Sections</option>
                  <option value="PRIMARY RESPONSIBILITY">Primary Responsibility</option>
                  <option value="AUTHORITY">Authority</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              <div className="relative">
                <Shield className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-blue-400" />
                <select
                  value={rankFilter}
                  onChange={(event) => setRankFilter(event.target.value)}
                  className="h-9 w-full min-w-[180px] appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="ALL">All Ranks</option>
                  {FILTER_ORDER.map((rank) => (
                    <option key={rank.rank} value={rank.rank}>
                      {compactRank(rank.rank)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              {(search || sectionFilter !== "ALL" || rankFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5 text-blue-400" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
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
                    <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="max-h-[72vh] overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[34%]" />
                {visibleRanks.map((rank) => (
                  <col key={rank.rank} />
                ))}
              </colgroup>

              <thead className="sticky top-0 z-30">
                <tr className="border-b border-border/70 bg-card">
                  <th
                    rowSpan={2}
                    className="border-r border-border/70 bg-card px-3 py-2 text-left align-middle text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:px-4 sm:text-[10px]"
                  >
                    Responsibility / Authority
                  </th>
                  {groupedRanks.map(({ group, ranks }) => (
                    <th
                      key={group}
                      colSpan={ranks.length}
                      className={`border-r border-border/50 bg-card px-1 py-2 text-center text-[8px] font-bold uppercase tracking-[0.06em] last:border-r-0 sm:text-[9px] ${groupText(group)}`}
                    >
                      {group}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border/70 bg-card">
                  {visibleRanks.map((rank) => (
                    <th
                      key={rank.rank}
                      title={rank.rank}
                      className="border-r border-border/50 bg-card px-0.5 py-2 text-center text-[8px] font-semibold leading-tight text-muted-foreground last:border-r-0 sm:text-[9px]"
                    >
                      {compactRank(rank.rank)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {(["PRIMARY RESPONSIBILITY", "AUTHORITY"] as Section[]).flatMap(
                  (section) => {
                    const sectionEntries = filteredEntries.filter(
                      (entry) => entry.section === section,
                    )
                    if (!sectionEntries.length) return []

                    return [
                      <tr key={`section-${section}`}>
                        <td
                          colSpan={visibleRanks.length + 1}
                          className="border-b border-t border-blue-500/20 bg-muted/20 px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:px-4 sm:text-[10px]"
                        >
                          {section}
                        </td>
                      </tr>,
                      ...sectionEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border/50 hover:bg-muted/10"
                        >
                          <td className="border-r border-border/50 px-3 py-2 text-left text-[10px] font-medium leading-4 text-foreground sm:px-4 sm:text-[11px]">
                            {entry.name}
                          </td>
                          {visibleRanks.map((rank) => {
                            const allowed = entry.permissions[rank.rank]
                            return (
                              <td
                                key={`${entry.id}-${rank.rank}`}
                                className="border-r border-border/50 px-0.5 py-2 text-center last:border-r-0"
                              >
                                <span
                                  title={`${rank.rank}: ${allowed ? "Allowed" : "Not allowed"}`}
                                  className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] sm:h-5 sm:w-5 ${
                                    allowed
                                      ? "bg-blue-500/10 text-blue-400"
                                      : "bg-muted/40 text-muted-foreground/30"
                                  }`}
                                >
                                  {allowed ? (
                                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  ) : null}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )),
                    ]
                  },
                )}
              </tbody>
            </table>

            {!filteredEntries.length && (
              <div className="border-t border-border/70 px-4 py-10 text-center">
                <Search className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try changing your search or filters.
                </p>
              </div>
            )}

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
          </div>
        )}
      </div>
    </div>
  )
}
