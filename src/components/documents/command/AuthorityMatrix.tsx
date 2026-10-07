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

/*
 * IMPORTANT:
 * This must be the exact name of the bottom tab in Google Sheets.
 */
const SHEET_NAME = "Authority Matrix"

type GroupName =
  | "OFFICERS"
  | "SUPERVISORS"
  | "LOW COMMAND"
  | "TRIAL HIGH COMMAND"
  | "HIGH COMMAND"
  | "OTHER"

type RankColumn = {
  column: number
  rank: string
  group: GroupName
}

type MatrixEntry = {
  id: string
  section: "PRIMARY RESPONSIBILITY" | "AUTHORITY"
  name: string
  permissions: Record<string, boolean>
}

type ParsedMatrix = {
  ranks: RankColumn[]
  entries: MatrixEntry[]
}

const GROUP_ORDER: GroupName[] = [
  "OFFICERS",
  "SUPERVISORS",
  "LOW COMMAND",
  "TRIAL HIGH COMMAND",
  "HIGH COMMAND",
  "OTHER",
]

const RANK_GROUPS: Record<string, GroupName> = {
  OFFICER: "OFFICERS",
  "OFFICER 1": "OFFICERS",
  "OFFICER 2": "OFFICERS",
  "OFFICER 3": "OFFICERS",

  LCPL: "SUPERVISORS",
  CPL: "SUPERVISORS",
  SGT: "SUPERVISORS",
  SSGT: "SUPERVISORS",
  MSGT: "SUPERVISORS",

  "2LT": "LOW COMMAND",
  "1LT": "LOW COMMAND",
  CPT: "LOW COMMAND",
  MAJ: "LOW COMMAND",

  LTCOL: "TRIAL HIGH COMMAND",
  "LT COL": "TRIAL HIGH COMMAND",
  "LIEUTENANT COLONEL": "TRIAL HIGH COMMAND",

  COL: "HIGH COMMAND",
  "CHIEF OF STAFF": "HIGH COMMAND",
  "ASSISTANT CHIEF": "HIGH COMMAND",
  "DEPUTY CHIEF": "HIGH COMMAND",
  CHIEF: "HIGH COMMAND",
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

  LTCOL: "LTCOL",
  "LT COL": "LTCOL",
  "LIEUTENANT COLONEL": "LTCOL",

  COL: "COL",
  "CHIEF OF STAFF": "Chief Of Staff",
  "ASSISTANT CHIEF": "Assistant Chief",
  "DEPUTY CHIEF": "Deputy Chief",
  CHIEF: "Chief",
}

const GROUP_ALIASES: Record<string, GroupName> = {
  OFFICERS: "OFFICERS",
  OFFICER: "OFFICERS",

  SUPERVISORS: "SUPERVISORS",
  SUPERVISOR: "SUPERVISORS",

  "LOW COMMAND": "LOW COMMAND",
  "LOWER COMMAND": "LOW COMMAND",

  "TRIAL HIGH COMMAND": "TRIAL HIGH COMMAND",

  "HIGH COMMAND": "HIGH COMMAND",
}

function normalise(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function cleanLabel(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getCellValue(
  row: GvizRow,
  column: number,
): string {
  const cell = row.c?.[column]

  if (!cell) {
    return ""
  }

  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v)
  }

  if (cell.f !== undefined && cell.f !== null) {
    return String(cell.f)
  }

  return ""
}

function getRankGroup(rank: string): GroupName {
  return (
    RANK_GROUPS[normalise(rank)] ??
    "OTHER"
  )
}

function getCanonicalRank(rank: string): string {
  const key = normalise(rank)

  return (
    RANK_ALIASES[key] ??
    cleanLabel(rank)
  )
}

function isRankLabel(value: string): boolean {
  const key = normalise(value)

  return Boolean(
    RANK_ALIASES[key] ||
      RANK_GROUPS[key],
  )
}

function isGroupLabel(value: string): boolean {
  return Boolean(
    GROUP_ALIASES[normalise(value)],
  )
}

function isSection(value: string):
  | "PRIMARY RESPONSIBILITY"
  | "AUTHORITY"
  | null {
  const key = normalise(value)

  if (
    key === "PRIMARY RESPONSIBILITY" ||
    key === "PRIMARY RESPONSIBILITIES"
  ) {
    return "PRIMARY RESPONSIBILITY"
  }

  if (key === "AUTHORITY") {
    return "AUTHORITY"
  }

  return null
}

function isIgnoredRow(values: string[]): boolean {
  const combined = normalise(values.join(" "))

  if (!combined) {
    return true
  }

  const ignoredPhrases = [
    "THIS DOCUMENT SUPERCEDES",
    "TAKES PRECEDENT",
    "RESTRICTIONS APPLY",
    "DETERMINED BY RANK IN FTD",
    "LAST UPDATED",
  ]

  return ignoredPhrases.some((phrase) =>
    combined.includes(phrase),
  )
}

function parsePermission(value: string): boolean {
  const key = normalise(value)

  if (
    key === "TRUE" ||
    key === "YES" ||
    key === "Y" ||
    key === "1" ||
    key === "X" ||
    key === "✓" ||
    key === "✔" ||
    key === "CHECK" ||
    key === "CHECKED"
  ) {
    return true
  }

  return false
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
    cols?: Array<{
      id?: string
      label?: string
      type?: string
    }>
    rows?: GvizRow[]
  }
  status?: string
  errors?: Array<{
    message?: string
    detailed_message?: string
  }>
}

function parseGvizResponse(raw: string): GvizResponse {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "Google Sheets returned an invalid response.",
    )
  }

  return JSON.parse(
    raw.slice(start, end + 1),
  ) as GvizResponse
}

function findRankHeaderRow(
  rows: GvizRow[],
): number {
  let bestRow = -1
  let bestMatches = 0

  const limit = Math.min(rows.length, 15)

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const row = rows[rowIndex]
    const values = row.c ?? []

    let matches = 0

    for (const cell of values) {
      const value = String(
        cell?.v ?? cell?.f ?? "",
      ).trim()

      if (isRankLabel(value)) {
        matches += 1
      }
    }

    if (matches > bestMatches) {
      bestMatches = matches
      bestRow = rowIndex
    }
  }

  return bestMatches >= 2 ? bestRow : -1
}

function findGroupHeaderRow(
  rows: GvizRow[],
  rankHeaderRow: number,
): number {
  let bestRow = -1
  let bestMatches = 0

  const limit = Math.min(
    rankHeaderRow === -1
      ? rows.length
      : rankHeaderRow,
    15,
  )

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const values = rows[rowIndex]?.c ?? []

    let matches = 0

    for (const cell of values) {
      const value = String(
        cell?.v ?? cell?.f ?? "",
      ).trim()

      if (isGroupLabel(value)) {
        matches += 1
      }
    }

    if (matches > bestMatches) {
      bestMatches = matches
      bestRow = rowIndex
    }
  }

  return bestMatches > 0 ? bestRow : -1
}

function parseGviz(
  response: GvizResponse,
): ParsedMatrix {
  const rows = response.table?.rows ?? []

  if (rows.length === 0) {
    throw new Error(
      "The Google Sheet did not return any rows.",
    )
  }

  const rankHeaderRow = findRankHeaderRow(rows)
  const groupHeaderRow = findGroupHeaderRow(
    rows,
    rankHeaderRow,
  )

  if (rankHeaderRow === -1) {
    throw new Error(
      `Could not find the rank columns in the "${SHEET_NAME}" tab.`,
    )
  }

  const rankRow = rows[rankHeaderRow]?.c ?? []
  const groupRow =
    groupHeaderRow >= 0
      ? rows[groupHeaderRow]?.c ?? []
      : []

  const ranks: RankColumn[] = []

  for (
    let column = 0;
    column < rankRow.length;
    column += 1
  ) {
    const rawRank = getCellValue(
      rows[rankHeaderRow],
      column,
    )

    if (!isRankLabel(rawRank)) {
      continue
    }

    const rank = getCanonicalRank(rawRank)

    let group: GroupName | undefined

    /*
     * First try the group header directly above the
     * rank column.
     */
    for (
      let groupColumn = column;
      groupColumn >= 0;
      groupColumn -= 1
    ) {
      const groupValue = getCellValue(
        {
          c: groupRow,
        },
        groupColumn,
      )

      if (isGroupLabel(groupValue)) {
        group = GROUP_ALIASES[
          normalise(groupValue)
        ]
        break
      }
    }

    /*
     * If the sheet uses merged cells and GViz does not
     * expose the merged value beside the rank, fall back
     * to the known rank grouping.
     */
    if (!group) {
      group = getRankGroup(rank)
    }

    ranks.push({
      column,
      rank,
      group,
    })
  }

  if (ranks.length === 0) {
    throw new Error(
      `Could not find any rank columns in the "${SHEET_NAME}" tab.`,
    )
  }

  /*
   * Column A = section
   * Column B = responsibility / authority name
   * Remaining columns = rank permissions
   */
  const entries: MatrixEntry[] = []

  let currentSection:
    | "PRIMARY RESPONSIBILITY"
    | "AUTHORITY"
    | null = null

  for (
    let rowIndex = rankHeaderRow + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    if (!row) {
      continue
    }

    const allValues = (row.c ?? []).map(
      (cell) =>
        String(
          cell?.v ?? cell?.f ?? "",
        ).trim(),
    )

    if (isIgnoredRow(allValues)) {
      continue
    }

    const sectionCell = getCellValue(row, 0)
    const detectedSection =
      isSection(sectionCell)

    if (detectedSection) {
      currentSection = detectedSection
      continue
    }

    /*
     * Some Google Sheets layouts may put the section
     * label in another visible cell. Check the first
     * few cells as a fallback.
     */
    if (!currentSection) {
      for (
        let column = 0;
        column < Math.min(allValues.length, 3);
        column += 1
      ) {
        const possibleSection = isSection(
          allValues[column],
        )

        if (possibleSection) {
          currentSection = possibleSection
          break
        }
      }
    }

    if (!currentSection) {
      continue
    }

    const name = cleanLabel(
      getCellValue(row, 1),
    )

    if (!name) {
      continue
    }

    const upperName = normalise(name)

    if (
      upperName === "PRIMARY RESPONSIBILITY" ||
      upperName === "AUTHORITY"
    ) {
      continue
    }

    if (
      upperName.includes("THIS DOCUMENT") ||
      upperName.includes("LAST UPDATED") ||
      upperName.includes("RESTRICTIONS APPLY")
    ) {
      continue
    }

    const permissions: Record<string, boolean> = {}

    for (const rank of ranks) {
      permissions[rank.rank] = parsePermission(
        getCellValue(row, rank.column),
      )
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
      `The "${SHEET_NAME}" tab was found, but no Authority Matrix entries could be read.`,
    )
  }

  return {
    ranks,
    entries,
  }
}

function getSheetId(): string {
  const match = SHEET_URL.match(
    /\/spreadsheets\/d\/([^/]+)/,
  )

  if (!match) {
    throw new Error(
      "Invalid Google Sheets URL.",
    )
  }

  return match[1]
}

function getGroupClasses(
  group: GroupName,
): string {
  switch (group) {
    case "OFFICERS":
      return "text-sky-400"

    case "SUPERVISORS":
      return "text-emerald-400"

    case "LOW COMMAND":
      return "text-amber-400"

    case "TRIAL HIGH COMMAND":
      return "text-orange-400"

    case "HIGH COMMAND":
      return "text-red-400"

    default:
      return "text-muted-foreground"
  }
}

export default function AuthorityMatrix() {
  const [matrix, setMatrix] =
    useState<ParsedMatrix | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState("")

  const [sectionFilter, setSectionFilter] =
    useState("ALL")

  const [rankFilter, setRankFilter] =
    useState("ALL")

  const [refreshing, setRefreshing] =
    useState(false)

  const loadMatrix = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
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
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(
            `Google Sheets returned HTTP ${response.status}.`,
          )
        }

        const raw = await response.text()

        if (
          raw.includes("<html") ||
          raw.includes("<!DOCTYPE")
        ) {
          throw new Error(
            "Google Sheets did not return spreadsheet data. Make sure the sheet is publicly viewable.",
          )
        }

        const parsed =
          parseGvizResponse(raw)

        if (
          parsed.errors &&
          parsed.errors.length > 0
        ) {
          const message =
            parsed.errors[0]?.detailed_message ??
            parsed.errors[0]?.message ??
            "Google Sheets returned an error."

          throw new Error(message)
        }

        if (
          parsed.status &&
          parsed.status !== "ok"
        ) {
          throw new Error(
            `Google Sheets returned status "${parsed.status}".`,
          )
        }

        setMatrix(
          parseGviz(parsed),
        )
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load Authority Matrix."

        setError(message)
        setMatrix(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadMatrix()

    const interval = window.setInterval(() => {
      void loadMatrix()
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadMatrix])

  const filteredEntries =
    useMemo(() => {
      if (!matrix) {
        return []
      }

      const searchValue =
        normalise(search)

      return matrix.entries.filter(
        (entry) => {
          const matchesSearch =
            !searchValue ||
            normalise(
              entry.name,
            ).includes(searchValue)

          const matchesSection =
            sectionFilter === "ALL" ||
            entry.section === sectionFilter

          const matchesRank =
            rankFilter === "ALL" ||
            entry.permissions[rankFilter] !==
              undefined

          return (
            matchesSearch &&
            matchesSection &&
            matchesRank
          )
        },
      )
    }, [
      matrix,
      search,
      sectionFilter,
      rankFilter,
    ])

  const visibleRanks =
    useMemo(() => {
      if (!matrix) {
        return []
      }

      if (rankFilter === "ALL") {
        return matrix.ranks
      }

      return matrix.ranks.filter(
        (rank) =>
          rank.rank === rankFilter,
      )
    }, [matrix, rankFilter])

  const groupedRanks =
    useMemo(() => {
      const groups = new Map<
        GroupName,
        RankColumn[]
      >()

      for (const rank of visibleRanks) {
        const existing =
          groups.get(rank.group) ?? []

        existing.push(rank)
        groups.set(rank.group, existing)
      }

      return GROUP_ORDER
        .filter((group) =>
          groups.has(group),
        )
        .map((group) => ({
          group,
          ranks:
            groups.get(group) ?? [],
        }))
    }, [visibleRanks])

  const clearFilters = () => {
    setSearch("")
    setSectionFilter("ALL")
    setRankFilter("ALL")
  }

  return (
    <div className="w-full min-w-0">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        {/* Header */}
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                <FileSpreadsheet className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-semibold">
                  Authority Matrix
                </h2>

                <p className="text-xs text-muted-foreground">
                  Command authority and responsibilities by rank.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadMatrix(true)
              }
              disabled={refreshing}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </button>
          </div>

          {/* Filters */}
          {!loading && !error && matrix && (
            <div className="mt-4 flex flex-col gap-2.5 lg:flex-row">
              {/* Search */}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search responsibilities..."
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              {/* Section */}
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                <select
                  value={sectionFilter}
                  onChange={(event) =>
                    setSectionFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 w-full min-w-[190px] appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="ALL">
                    All Sections
                  </option>
                  <option value="PRIMARY RESPONSIBILITY">
                    Primary Responsibility
                  </option>
                  <option value="AUTHORITY">
                    Authority
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              {/* Rank */}
              <div className="relative">
                <Shield className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                <select
                  value={rankFilter}
                  onChange={(event) =>
                    setRankFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 w-full min-w-[160px] appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="ALL">
                    All Ranks
                  </option>

                  {matrix.ranks.map(
                    (rank) => (
                      <option
                        key={rank.rank}
                        value={rank.rank}
                      >
                        {rank.rank}
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              {(search ||
                sectionFilter !==
                  "ALL" ||
                rankFilter !==
                  "ALL") && (
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

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading Authority Matrix...
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="p-5">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-red-400">
                    Unable to load Authority Matrix
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      void loadMatrix(true)
                    }
                    className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Matrix */}
        {!loading &&
          !error &&
          matrix && (
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[34%]" />

                  {visibleRanks.map(
                    (rank) => (
                      <col
                        key={rank.rank}
                      />
                    ),
                  )}
                </colgroup>

                <thead>
                  {/* Group row */}
                  <tr className="border-b border-border/70 bg-muted/20">
                    <th
                      rowSpan={2}
                      className="border-r border-border/70 px-3 py-3 text-left align-middle text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:px-4"
                    >
                      Responsibility / Authority
                    </th>

                    {groupedRanks.map(
                      ({
                        group,
                        ranks,
                      }) => (
                        <th
                          key={group}
                          colSpan={
                            ranks.length
                          }
                          className={`border-r border-border/50 px-1 py-2 text-center text-[9px] font-bold uppercase tracking-[0.08em] last:border-r-0 ${getGroupClasses(
                            group,
                          )}`}
                        >
                          {group}
                        </th>
                      ),
                    )}
                  </tr>

                  {/* Rank row */}
                  <tr className="border-b border-border/70 bg-muted/10">
                    {visibleRanks.map(
                      (rank) => (
                        <th
                          key={rank.rank}
                          title={rank.rank}
                          className="border-r border-border/50 px-0.5 py-2 text-center text-[9px] font-semibold text-muted-foreground last:border-r-0 sm:text-[10px]"
                        >
                          {rank.rank}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {(
                    [
                      "PRIMARY RESPONSIBILITY",
                      "AUTHORITY",
                    ] as const
                  ).map((section) => {
                    const sectionEntries =
                      filteredEntries.filter(
                        (entry) =>
                          entry.section ===
                          section,
                      )

                    if (
                      sectionEntries.length ===
                      0
                    ) {
                      return null
                    }

                    return (
                      <tbody
                        key={section}
                      >
                        <tr>
                          <td
                            colSpan={
                              visibleRanks.length +
                              1
                            }
                            className={`border-b border-border/70 bg-muted/20 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:px-4 ${
                              section ===
                              "AUTHORITY"
                                ? "border-t-2 border-t-blue-500/20"
                                : ""
                            }`}
                          >
                            {section}
                          </td>
                        </tr>

                        {sectionEntries.map(
                          (entry) => (
                            <tr
                              key={entry.id}
                              className="border-b border-border/50 last:border-b-0 hover:bg-muted/10"
                            >
                              <td className="border-r border-border/50 px-3 py-2.5 text-left text-[11px] font-medium leading-4 text-foreground sm:px-4 sm:text-xs">
                                {entry.name}
                              </td>

                              {visibleRanks.map(
                                (rank) => {
                                  const allowed =
                                    Boolean(
                                      entry
                                        .permissions[
                                        rank.rank
                                      ],
                                    )

                                  return (
                                    <td
                                      key={`${entry.id}-${rank.rank}`}
                                      className="border-r border-border/50 px-0.5 py-2.5 text-center last:border-r-0"
                                    >
                                      {allowed ? (
                                        <span
                                          title={`${rank.rank}: Allowed`}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"
                                        >
                                          <Check className="h-3 w-3" />
                                        </span>
                                      ) : (
                                        <span
                                          title={`${rank.rank}: Not allowed`}
                                          className="text-[11px] text-muted-foreground/30"
                                        >
                                          —
                                        </span>
                                      )}
                                    </td>
                                  )
                                },
                              )}
                            </tr>
                          ),
                        )}
                      </tbody>
                    )
                  })}
                </tbody>
              </table>

              {filteredEntries.length ===
                0 && (
                <div className="border-t border-border/70 px-4 py-10 text-center">
                  <Search className="mx-auto h-5 w-5 text-muted-foreground/50" />

                  <p className="mt-2 text-sm font-medium">
                    No results found
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Try changing your search or filters.
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Result count */}
        {!loading &&
          !error &&
          matrix && (
            <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {filteredEntries.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {matrix.entries.length}
              </span>{" "}
              entries
            </div>
          )}
      </div>
    </div>
  )
}
