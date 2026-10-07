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

type Section =
  | "PRIMARY RESPONSIBILITY"
  | "AUTHORITY"

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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

function cellValue(
  row: GvizRow | undefined,
  column: number,
): string {
  const cell = row?.c?.[column]

  if (!cell) {
    return ""
  }

  if (cell.f !== undefined && cell.f !== null) {
    return String(cell.f)
  }

  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v)
  }

  return ""
}

function parseGviz(raw: string): GvizResponse {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")

  if (start === -1 || end === -1) {
    throw new Error(
      "Google Sheets returned an invalid response.",
    )
  }

  return JSON.parse(
    raw.slice(start, end + 1),
  ) as GvizResponse
}

function getSheetId(): string {
  const match = SHEET_URL.match(
    /\/spreadsheets\/d\/([^/]+)/,
  )

  if (!match) {
    throw new Error(
      "The Authority Matrix Google Sheets URL is invalid.",
    )
  }

  return match[1]
}

/* -------------------------------------------------------------------------- */
/* Rank handling                                                              */
/* -------------------------------------------------------------------------- */

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

  "ASSISTANT CHIEF OF POLICE":
    "Assistant Chief Of Police",

  "ASSISTANT CHIEF": "Assistant Chief Of Police",

  "DEPUTY CHIEF OF POLICE":
    "Deputy Chief Of Police",

  "DEPUTY CHIEF": "Deputy Chief Of Police",

  "CHIEF OF POLICE": "Chief Of Police",

  CHIEF: "Chief Of Police",
}

function getRank(value: string): string | null {
  return (
    RANK_ALIASES[key(value)] ?? null
  )
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

function isRank(value: string): boolean {
  return getRank(value) !== null
}

/* -------------------------------------------------------------------------- */
/* Section handling                                                           */
/* -------------------------------------------------------------------------- */

function getSection(
  value: string,
): Section | null {
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

/* -------------------------------------------------------------------------- */
/* Permission handling                                                        */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Footer / note filtering                                                    */
/* -------------------------------------------------------------------------- */

function isExcludedRow(
  values: string[],
): boolean {
  const text = key(values.join(" "))

  if (!text) {
    return true
  }

  const excluded = [
    "THIS DOCUMENT SUPERCEDES",
    "TAKES PRECEDENT",
    "RESTRICTIONS APPLY",
    "DETERMINED BY RANK IN FTD",
    "LAST UPDATED",
  ]

  return excluded.some((phrase) =>
    text.includes(phrase),
  )
}

/* -------------------------------------------------------------------------- */
/* Find the actual rank row                                                   */
/* -------------------------------------------------------------------------- */

function findRankRow(
  rows: GvizRow[],
): number {
  let bestRow = -1
  let bestCount = 0

  /*
   * The real sheet has:
   *
   * Row 1 = groups
   * Row 2 = ranks
   *
   * However, we don't hard-code row numbers because
   * someone may add rows above the matrix later.
   */

  const scanLimit = Math.min(
    rows.length,
    20,
  )

  for (
    let rowIndex = 0;
    rowIndex < scanLimit;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    let count = 0

    for (
      let column = 0;
      column < (row?.c?.length ?? 0);
      column += 1
    ) {
      const value = cellValue(
        row,
        column,
      )

      if (isRank(value)) {
        count += 1
      }
    }

    if (count > bestCount) {
      bestCount = count
      bestRow = rowIndex
    }
  }

  if (bestCount < 3) {
    return -1
  }

  return bestRow
}

/* -------------------------------------------------------------------------- */
/* Parse the matrix                                                           */
/* -------------------------------------------------------------------------- */

function parseMatrix(
  response: GvizResponse,
): MatrixData {
  const rows = response.table?.rows ?? []

  if (rows.length === 0) {
    throw new Error(
      "The Authority Matrix sheet returned no data.",
    )
  }

  const rankRowIndex = findRankRow(rows)

  if (rankRowIndex === -1) {
    throw new Error(
      "Could not find the rank columns in the Authority Matrix sheet.",
    )
  }

  const rankRow = rows[rankRowIndex]

  const ranks: RankColumn[] = []

  /*
   * Read the rank names directly from the rank row.
   *
   * This means the site isn't dependent on the
   * number of ranks or their exact column positions.
   */
  for (
    let column = 0;
    column < (rankRow?.c?.length ?? 0);
    column += 1
  ) {
    const rawRank = cellValue(
      rankRow,
      column,
    )

    const rank = getRank(rawRank)

    if (!rank) {
      continue
    }

    ranks.push({
      column,
      rank,
      group: getGroup(rank),
    })
  }

  if (ranks.length === 0) {
    throw new Error(
      "No rank columns could be read from the Authority Matrix.",
    )
  }

  /*
   * Data starts immediately after the rank row.
   *
   * Column A = section
   * Column B = responsibility
   * C+     = permissions
   */
  const entries: MatrixEntry[] = []

  let currentSection: Section | null =
    null

  for (
    let rowIndex = rankRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    if (!row) {
      continue
    }

    const values = (
      row.c ?? []
    ).map((cell) =>
      clean(
        cell?.f ??
          cell?.v ??
          "",
      ),
    )

    if (isExcludedRow(values)) {
      continue
    }

    /*
     * Column A contains the merged section label.
     *
     * Because Google Sheets only exposes the value on
     * the first row of a merged area, keep the current
     * section until another one is encountered.
     */
    const section =
      getSection(
        cellValue(row, 0),
      )

    if (section) {
      currentSection = section
    }

    if (!currentSection) {
      continue
    }

    /*
     * Column B contains the actual description/name.
     */
    const name = clean(
      cellValue(row, 1),
    )

    if (!name) {
      continue
    }

    const normalizedName = key(name)

    /*
     * Don't accidentally render headers as entries.
     */
    if (
      normalizedName ===
        "PRIMARY RESPONSIBILITY" ||
      normalizedName === "AUTHORITY"
    ) {
      continue
    }

    /*
     * Ignore explanatory/footer content.
     */
    if (
      normalizedName.includes(
        "THIS DOCUMENT",
      ) ||
      normalizedName.includes(
        "RESTRICTIONS APPLY",
      ) ||
      normalizedName.includes(
        "LAST UPDATED",
      ) ||
      normalizedName.includes(
        "DETERMINED BY RANK",
      )
    ) {
      continue
    }

    const permissions: Record<
      string,
      boolean
    > = {}

    for (const rank of ranks) {
      permissions[rank.rank] =
        isAllowed(
          cellValue(
            row,
            rank.column,
          ),
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
      "The Authority Matrix loaded, but no matrix entries were found.",
    )
  }

  return {
    ranks,
    entries,
  }
}

/* -------------------------------------------------------------------------- */
/* Styling                                                                    */
/* -------------------------------------------------------------------------- */

function groupText(
  group: GroupName,
): string {
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

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AuthorityMatrix() {
  const [data, setData] =
    useState<MatrixData | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState("")

  const [sectionFilter, setSectionFilter] =
    useState("ALL")

  const [rankFilter, setRankFilter] =
    useState("ALL")

  const loadMatrix = useCallback(
    async (
      manualRefresh = false,
    ) => {
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

        const response =
          await fetch(url, {
            method: "GET",
            cache: "no-store",
          })

        if (!response.ok) {
          throw new Error(
            `Google Sheets returned HTTP ${response.status}.`,
          )
        }

        const raw =
          await response.text()

        /*
         * If Google redirects the request to a
         * login/HTML page, this gives a much more
         * useful error.
         */
        if (
          raw.includes("<html") ||
          raw.includes("<!DOCTYPE")
        ) {
          throw new Error(
            "Google Sheets did not return spreadsheet data. The sheet must be publicly viewable.",
          )
        }

        const responseData =
          parseGviz(raw)

        if (
          responseData.errors &&
          responseData.errors.length > 0
        ) {
          throw new Error(
            responseData.errors[0]
              ?.detailed_message ??
              responseData.errors[0]
                ?.message ??
              "Google Sheets returned an error.",
          )
        }

        if (
          responseData.status &&
          responseData.status !== "ok"
        ) {
          throw new Error(
            `Google Sheets returned status "${responseData.status}".`,
          )
        }

        const parsed =
          parseMatrix(
            responseData,
          )

        setData(parsed)
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
    },
    [],
  )

  useEffect(() => {
    void loadMatrix()

    /*
     * Automatically check the Google Sheet every minute.
     */
    const interval =
      window.setInterval(
        () => {
          void loadMatrix()
        },
        60_000,
      )

    return () => {
      window.clearInterval(
        interval,
      )
    }
  }, [loadMatrix])

  /* ------------------------------------------------------------------------ */
  /* Filtering                                                                */
  /* ------------------------------------------------------------------------ */

  const visibleRanks = useMemo(() => {
    if (!data) {
      return []
    }

    if (rankFilter === "ALL") {
      return data.ranks
    }

    return data.ranks.filter(
      (rank) =>
        rank.rank === rankFilter,
    )
  }, [data, rankFilter])

  const filteredEntries =
    useMemo(() => {
      if (!data) {
        return []
      }

      const searchText =
        key(search)

      return data.entries.filter(
        (entry) => {
          const matchesSearch =
            !searchText ||
            key(
              entry.name,
            ).includes(searchText)

          const matchesSection =
            sectionFilter === "ALL" ||
            entry.section ===
              sectionFilter

          const matchesRank =
            rankFilter === "ALL" ||
            entry.permissions[
              rankFilter
            ] !== undefined

          return (
            matchesSearch &&
            matchesSection &&
            matchesRank
          )
        },
      )
    }, [
      data,
      search,
      sectionFilter,
      rankFilter,
    ])

  const groupedRanks =
    useMemo(() => {
      const groups: Array<{
        group: GroupName
        ranks: RankColumn[]
      }> = []

      for (const rank of visibleRanks) {
        const existing =
          groups.find(
            (item) =>
              item.group ===
              rank.group,
          )

        if (existing) {
          existing.ranks.push(
            rank,
          )
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

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="w-full min-w-0">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        {/* Header */}
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
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
                void loadMatrix(
                  true,
                )
              }
              disabled={refreshing}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={
                  refreshing
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />

              Refresh
            </button>
          </div>

          {/* Filters */}
          {!loading &&
            !error &&
            data && (
              <div className="mt-4 flex flex-col gap-2.5 lg:flex-row">
                {/* Search */}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
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

                {/* Section filter */}
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                  <select
                    value={
                      sectionFilter
                    }
                    onChange={(
                      event,
                    ) =>
                      setSectionFilter(
                        event.target
                          .value,
                      )
                    }
                    className="h-9 w-full min-w-[190px] appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
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

                {/* Rank filter */}
                <div className="relative">
                  <Shield className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                  <select
                    value={
                      rankFilter
                    }
                    onChange={(
                      event,
                    ) =>
                      setRankFilter(
                        event.target
                          .value,
                      )
                    }
                    className="h-9 w-full min-w-[180px] appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="ALL">
                      All Ranks
                    </option>

                    {data.ranks.map(
                      (rank) => (
                        <option
                          key={
                            rank.rank
                          }
                          value={
                            rank.rank
                          }
                        >
                          {
                            rank.rank
                          }
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
                    onClick={
                      clearFilters
                    }
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
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading Authority Matrix...
            </div>
          </div>
        )}

        {/* Error */}
        {!loading &&
          error && (
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

                    <p className="mt-1 text-sm text-muted-foreground">
                      {error}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        void loadMatrix(
                          true,
                        )
                      }
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

        {/* Matrix */}
        {!loading &&
          !error &&
          data && (
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[34%]" />

                  {visibleRanks.map(
                    (rank) => (
                      <col
                        key={
                          rank.rank
                        }
                      />
                    ),
                  )}
                </colgroup>

                <thead>
                  {/* Group headings */}
                  <tr className="border-b border-border/70 bg-muted/20">
                    <th
                      rowSpan={2}
                      className="border-r border-border/70 px-3 py-3 text-left align-middle text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:px-4 sm:text-[10px]"
                    >
                      Responsibility / Authority
                    </th>

                    {groupedRanks.map(
                      ({
                        group,
                        ranks,
                      }) => (
                        <th
                          key={
                            group
                          }
                          colSpan={
                            ranks.length
                          }
                          className={`border-r border-border/50 px-1 py-2 text-center text-[8px] font-bold uppercase tracking-[0.06em] last:border-r-0 sm:text-[9px] ${groupText(
                            group,
                          )}`}
                        >
                          {group}
                        </th>
                      ),
                    )}
                  </tr>

                  {/* Rank headings */}
                  <tr className="border-b border-border/70 bg-muted/10">
                    {visibleRanks.map(
                      (rank) => (
                        <th
                          key={
                            rank.rank
                          }
                          title={
                            rank.rank
                          }
                          className="border-r border-border/50 px-0.5 py-2 text-center text-[8px] font-semibold leading-tight text-muted-foreground last:border-r-0 sm:text-[9px]"
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
                    ] as Section[]
                  ).map(
                    (section) => {
                      const sectionEntries =
                        filteredEntries.filter(
                          (
                            entry,
                          ) =>
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
                        <tr
                          key={`section-${section}`}
                          className={
                            section ===
                            "AUTHORITY"
                              ? "border-t-2 border-blue-500/20"
                              : ""
                          }
                        >
                          <td
                            colSpan={
                              visibleRanks.length +
                              1
                            }
                            className="border-b border-border/70 bg-muted/20 px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:px-4 sm:text-[10px]"
                          >
                            {section}
                          </td>
                        </tr>
                      )
                    },
                  )}

                  {filteredEntries.map(
                    (entry) => (
                      <tr
                        key={
                          entry.id
                        }
                        className={`border-b border-border/50 hover:bg-muted/10 ${
                          entry.section ===
                          "AUTHORITY"
                            ? "bg-background"
                            : ""
                        }`}
                      >
                        <td className="border-r border-border/50 px-3 py-2 text-left text-[10px] font-medium leading-4 text-foreground sm:px-4 sm:text-[11px]">
                          {
                            entry.name
                          }
                        </td>

                        {visibleRanks.map(
                          (rank) => {
                            const allowed =
                              Boolean(
                                entry
                                  .permissions[
                                  rank
                                    .rank
                                ],
                              )

                            return (
                              <td
                                key={`${entry.id}-${rank.rank}`}
                                className="border-r border-border/50 px-0.5 py-2 text-center last:border-r-0"
                              >
                                {allowed ? (
                                  <span
                                    title={`${rank.rank}: Allowed`}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-emerald-500/10 text-emerald-400 sm:h-5 sm:w-5"
                                  >
                                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  </span>
                                ) : (
                                  <span
                                    title={`${rank.rank}: Not allowed`}
                                    className="text-[10px] text-muted-foreground/25"
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

        {/* Count */}
        {!loading &&
          !error &&
          data && (
            <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {
                  filteredEntries.length
                }
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
