import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Check,
  ChevronDown,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18Io5OdkKsZ9aVDh8I5nsAPjBUISGGM77461K06ziALU/edit"

const SHEET_NAME = "Authority Matrix"

const REFRESH_INTERVAL = 60_000

type SheetCell = {
  v?: unknown
  f?: string
}

type GvizRow = {
  c?: Array<SheetCell | null>
}

type GvizResponse = {
  table?: {
    rows?: GvizRow[]
  }
}

type RankGroup = {
  id: string
  label: string
}

type RankColumn = {
  id: string
  label: string
  groupId: string
  sourceIndex: number
}

type MatrixRow = {
  id: string
  section: string
  name: string
  permissions: Record<string, boolean>
}

type MatrixData = {
  groups: RankGroup[]
  columns: RankColumn[]
  rows: MatrixRow[]
}

const GROUP_ORDER = [
  "OFFICERS",
  "SUPERVISORS",
  "LOW COMMAND",
  "TRIAL HIGH COMMAND",
]

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * IMPORTANT:
 * Only recognise actual group-header text.
 *
 * Do NOT use includes("OFFICER") here because rows such as:
 * "Send Officer Off Duty"
 * would incorrectly become an OFFICERS header.
 */
function getExactGroupId(value: unknown): string | null {
  const text = cleanText(value).toUpperCase()

  if (!text) {
    return null
  }

  if (
    text === "TRIAL HIGH COMMAND" ||
    text === "TRIAL HIGH COMMANDS"
  ) {
    return "TRIAL HIGH COMMAND"
  }

  if (text === "LOW COMMAND") {
    return "LOW COMMAND"
  }

  if (text === "SUPERVISORS" || text === "SUPERVISOR") {
    return "SUPERVISORS"
  }

  if (text === "OFFICERS" || text === "OFFICER") {
    return "OFFICERS"
  }

  return null
}

function normalizeSection(value: unknown): string {
  const text = cleanText(value)
  const upper = text.toUpperCase()

  if (upper === "PRIMARY RESPONSIBILITY") {
    return "PRIMARY RESPONSIBILITY"
  }

  if (upper === "AUTHORITY") {
    return "AUTHORITY"
  }

  return text
}

function isChecked(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value
  }

  const text = cleanText(value).toLowerCase()

  return [
    "true",
    "yes",
    "y",
    "1",
    "x",
    "✓",
    "✔",
    "check",
    "checked",
  ].includes(text)
}

function getCellValue(
  row: GvizRow | undefined,
  index: number,
): unknown {
  return row?.c?.[index]?.v ?? row?.c?.[index]?.f ?? ""
}

/*
 * These are document notes, not authority-matrix entries.
 */
function isExcludedDocumentText(value: string): boolean {
  const text = cleanText(value).toLowerCase()

  if (!text) {
    return false
  }

  return (
    text.includes(
      "this document supersedes and takes precedent",
    ) ||
    text.includes(
      "this document supersedes and takes precedence",
    ) ||
    text.includes("restrictions apply based on the rank") ||
    text.includes("determined by rank in ftd") ||
    text.includes("last updated") ||
    /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}/.test(
      text,
    )
  )
}

function getGroupStyles(groupId: string) {
  switch (groupId) {
    case "OFFICERS":
      return {
        header:
          "bg-blue-500/[0.10] text-blue-300",
        cell:
          "bg-blue-500/[0.025]",
      }

    case "SUPERVISORS":
      return {
        header:
          "bg-violet-500/[0.10] text-violet-300",
        cell:
          "bg-violet-500/[0.025]",
      }

    case "LOW COMMAND":
      return {
        header:
          "bg-amber-500/[0.10] text-amber-300",
        cell:
          "bg-amber-500/[0.025]",
      }

    case "TRIAL HIGH COMMAND":
      return {
        header:
          "bg-red-500/[0.10] text-red-300",
        cell:
          "bg-red-500/[0.025]",
      }

    default:
      return {
        header:
          "bg-muted/30 text-muted-foreground",
        cell:
          "bg-muted/[0.02]",
      }
  }
}

function parseSheet(text: string): MatrixData {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start === -1 || end === -1) {
    throw new Error(
      "Google Sheets returned an invalid response.",
    )
  }

  const json = JSON.parse(
    text.slice(start, end + 1),
  ) as GvizResponse

  const rows = json.table?.rows ?? []

  if (!rows.length) {
    throw new Error(
      `No rows were found in "${SHEET_NAME}".`,
    )
  }

  const maxColumns = Math.max(
    ...rows.map(
      (row) => row.c?.length ?? 0,
    ),
  )

  /*
   * Find the REAL group-header row.
   *
   * The previous version used partial matching and therefore
   * accidentally detected "Send Officer Off Duty" as OFFICERS.
   *
   * This version requires the cell itself to equal the group name.
   */
  let groupHeaderIndex = -1

  for (
    let rowIndex = 0;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    let groupCount = 0

    for (
      let columnIndex = 0;
      columnIndex < maxColumns;
      columnIndex += 1
    ) {
      if (
        getExactGroupId(
          getCellValue(
            rows[rowIndex],
            columnIndex,
          ),
        )
      ) {
        groupCount += 1
      }
    }

    if (groupCount > 0) {
      groupHeaderIndex = rowIndex
      break
    }
  }

  if (groupHeaderIndex === -1) {
    throw new Error(
      "Could not find the rank group headers.",
    )
  }

  /*
   * Google Sheets merged cells normally only return the value
   * in the first cell. Carry the group across blank cells.
   */
  const groupAtColumn: Record<
    number,
    string
  > = {}

  let currentGroup: string | null = null

  for (
    let columnIndex = 0;
    columnIndex < maxColumns;
    columnIndex += 1
  ) {
    const exactGroup = getExactGroupId(
      getCellValue(
        rows[groupHeaderIndex],
        columnIndex,
      ),
    )

    if (exactGroup) {
      currentGroup = exactGroup
    }

    if (currentGroup) {
      groupAtColumn[columnIndex] =
        currentGroup
    }
  }

  /*
   * The row immediately underneath the group row contains
   * the actual rank names.
   */
  const rankHeaderIndex =
    groupHeaderIndex + 1

  const rankHeader =
    rows[rankHeaderIndex]

  if (!rankHeader) {
    throw new Error(
      "Could not find the rank names.",
    )
  }

  const columns: RankColumn[] = []

  for (
    let columnIndex = 0;
    columnIndex < maxColumns;
    columnIndex += 1
  ) {
    const groupId =
      groupAtColumn[columnIndex]

    if (!groupId) {
      continue
    }

    const label = cleanText(
      getCellValue(
        rankHeader,
        columnIndex,
      ),
    )

    /*
     * A rank header must actually look like a rank.
     * Prevent data such as TRUE/FALSE from becoming a rank.
     */
    const lowerLabel = label.toLowerCase()

    if (
      !label ||
      lowerLabel === "true" ||
      lowerLabel === "false" ||
      lowerLabel === "yes" ||
      lowerLabel === "no" ||
      isExcludedDocumentText(label)
    ) {
      continue
    }

    columns.push({
      id: `${groupId}-${columnIndex}`,
      label,
      groupId,
      sourceIndex: columnIndex,
    })
  }

  if (!columns.length) {
    throw new Error(
      "No rank columns were found in the Google Sheet.",
    )
  }

  const groups = GROUP_ORDER
    .filter((groupId) =>
      columns.some(
        (column) =>
          column.groupId === groupId,
      ),
    )
    .map((groupId) => ({
      id: groupId,
      label: groupId,
    }))

  const additionalGroups = Array.from(
    new Set(
      columns.map(
        (column) => column.groupId,
      ),
    ),
  )
    .filter(
      (groupId) =>
        !GROUP_ORDER.includes(groupId),
    )
    .map((groupId) => ({
      id: groupId,
      label: groupId,
    }))

  const allGroups = [
    ...groups,
    ...additionalGroups,
  ]

  const matrixRows: MatrixRow[] = []

  let currentSection = ""

  for (
    let rowIndex =
      rankHeaderIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    const columnA = normalizeSection(
      getCellValue(row, 0),
    )

    const columnB = cleanText(
      getCellValue(row, 1),
    )

    /*
     * Remove document notes and timestamp rows
     * before they ever reach the table.
     */
    if (
      isExcludedDocumentText(
        columnA,
      ) ||
      isExcludedDocumentText(
        columnB,
      )
    ) {
      continue
    }

    if (
      columnA ===
      "PRIMARY RESPONSIBILITY"
    ) {
      currentSection =
        "PRIMARY RESPONSIBILITY"
    } else if (
      columnA === "AUTHORITY"
    ) {
      currentSection = "AUTHORITY"
    } else if (columnA) {
      /*
       * Only treat Column A as a new section if
       * it is not a normal data row.
       */
      if (
        columnA !==
          "PRIMARY RESPONSIBILITY" &&
        columnA !== "AUTHORITY"
      ) {
        /*
         * Most rows use Column A as the section and
         * Column B as the responsibility.
         *
         * If Column A contains an ordinary row value,
         * retain the previous section.
         */
        if (
          !columnB &&
          (
            columnA
              .toUpperCase()
              .includes("RESPONSIBILITY") ||
            columnA
              .toUpperCase()
              .includes("AUTHORITY")
          )
        ) {
          currentSection =
            columnA
        }
      }
    }

    /*
     * Column B is the actual responsibility/authority name.
     */
    if (!columnB) {
      continue
    }

    if (!currentSection) {
      continue
    }

    const permissions: Record<
      string,
      boolean
    > = {}

    for (const column of columns) {
      permissions[column.id] =
        isChecked(
          getCellValue(
            row,
            column.sourceIndex,
          ),
        )
    }

    matrixRows.push({
      id: `${rowIndex}-${columnB}`,
      section: currentSection,
      name: columnB,
      permissions,
    })
  }

  return {
    groups: allGroups,
    columns,
    rows: matrixRows,
  }
}

export default function AuthorityMatrix() {
  const [data, setData] =
    useState<MatrixData | null>(null)

  const [search, setSearch] =
    useState("")

  const [hiddenSections, setHiddenSections] =
    useState<string[]>([])

  const [hiddenGroups, setHiddenGroups] =
    useState<string[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState("")

  const loadSheet = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true)
      }

      try {
        setError("")

        const match =
          GOOGLE_SHEET_URL.match(
            /\/spreadsheets\/d\/([^/]+)/,
          )

        if (!match?.[1]) {
          throw new Error(
            "Invalid Google Sheet URL.",
          )
        }

        const sheetId = match[1]

        const url =
          `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
          `?sheet=${encodeURIComponent(
            SHEET_NAME,
          )}` +
          `&headers=0` +
          `&tqx=out:json` +
          `&cacheBust=${Date.now()}`

        const response =
          await fetch(url, {
            cache: "no-store",
          })

        if (!response.ok) {
          throw new Error(
            `Google Sheets returned ${response.status}.`,
          )
        }

        const text =
          await response.text()

        const parsed =
          parseSheet(text)

        setData(parsed)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the Google Sheet.",
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadSheet()

    const interval =
      window.setInterval(
        () => {
          void loadSheet()
        },
        REFRESH_INTERVAL,
      )

    return () =>
      window.clearInterval(
        interval,
      )
  }, [loadSheet])

  const sectionOptions =
    useMemo(() => {
      if (!data) {
        return []
      }

      return Array.from(
        new Set(
          data.rows
            .map(
              (row) =>
                row.section,
            )
            .filter(Boolean),
        ),
      )
    }, [data])

  const visibleGroups =
    useMemo(() => {
      if (!data) {
        return []
      }

      return data.groups.filter(
        (group) =>
          !hiddenGroups.includes(
            group.id,
          ),
      )
    }, [data, hiddenGroups])

  const visibleColumns =
    useMemo(() => {
      if (!data) {
        return []
      }

      return data.columns.filter(
        (column) =>
          !hiddenGroups.includes(
            column.groupId,
          ),
      )
    }, [data, hiddenGroups])

  const filteredRows =
    useMemo(() => {
      if (!data) {
        return []
      }

      const query =
        search.trim().toLowerCase()

      return data.rows.filter(
        (row) => {
          if (
            hiddenSections.includes(
              row.section,
            )
          ) {
            return false
          }

          if (!query) {
            return true
          }

          return (
            row.name
              .toLowerCase()
              .includes(query) ||
            row.section
              .toLowerCase()
              .includes(query)
          )
        },
      )
    }, [
      data,
      hiddenSections,
      search,
    ])

  const rowsBySection =
    useMemo(() => {
      const sections =
        new Map<
          string,
          MatrixRow[]
        >()

      for (const row of filteredRows) {
        const current =
          sections.get(
            row.section,
          ) ?? []

        current.push(row)

        sections.set(
          row.section,
          current,
        )
      }

      return sections
    }, [filteredRows])

  const orderedSections =
    useMemo(() => {
      const preferred = [
        "PRIMARY RESPONSIBILITY",
        "AUTHORITY",
      ]

      const existing =
        Array.from(
          rowsBySection.keys(),
        )

      return [
        ...preferred.filter(
          (section) =>
            existing.includes(
              section,
            ),
        ),
        ...existing.filter(
          (section) =>
            !preferred.includes(
              section,
            ),
        ),
      ]
    }, [rowsBySection])

  const hasFilters =
    search.trim().length > 0 ||
    hiddenSections.length > 0 ||
    hiddenGroups.length > 0

  const clearFilters = () => {
    setSearch("")
    setHiddenSections([])
    setHiddenGroups([])
  }

  const toggleSection = (
    section: string,
  ) => {
    setHiddenSections(
      (current) =>
        current.includes(section)
          ? current.filter(
              (item) =>
                item !== section,
            )
          : [
              ...current,
              section,
            ],
    )
  }

  const toggleGroup = (
    group: string,
  ) => {
    setHiddenGroups(
      (current) =>
        current.includes(group)
          ? current.filter(
              (item) =>
                item !== group,
            )
          : [
              ...current,
              group,
            ],
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading Authority Matrix...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <h3 className="text-sm font-semibold text-red-300">
          Unable to load Authority Matrix
        </h3>

        <p className="mt-2 text-sm text-muted-foreground">
          {error}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() =>
            void loadSheet(true)
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Authority Matrix
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Command authority and primary responsibilities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search..."
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Section */}
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Section
                  <ChevronDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-[245px]"
              >
                <DropdownMenuLabel>
                  Sections
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {sectionOptions.map(
                  (section) => (
                    <DropdownMenuCheckboxItem
                      key={section}
                      checked={
                        !hiddenSections.includes(
                          section,
                        )
                      }
                      onCheckedChange={() =>
                        toggleSection(
                          section,
                        )
                      }
                    >
                      {section}
                    </DropdownMenuCheckboxItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Rank */}
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Rank
                  <ChevronDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-[220px]"
              >
                <DropdownMenuLabel>
                  Rank Groups
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {data.groups.map(
                  (group) => (
                    <DropdownMenuCheckboxItem
                      key={group.id}
                      checked={
                        !hiddenGroups.includes(
                          group.id,
                        )
                      }
                      onCheckedChange={() =>
                        toggleGroup(
                          group.id,
                        )
                      }
                    >
                      {group.label}
                    </DropdownMenuCheckboxItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={refreshing}
              onClick={() =>
                void loadSheet(true)
              }
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Active filters */}
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filters:
            </span>

            {search.trim() && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Search: {search}
                <X className="h-3 w-3" />
              </button>
            )}

            {hiddenSections.map(
              (section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() =>
                    toggleSection(
                      section,
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Hidden: {section}
                  <X className="h-3 w-3" />
                </button>
              ),
            )}

            {hiddenGroups.map(
              (group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() =>
                    toggleGroup(group)
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Hidden: {group}
                  <X className="h-3 w-3" />
                </button>
              ),
            )}

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Clear filters
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            The latest sheet refresh failed. Showing the
            previous data.
          </div>
        )}
      </div>

      {/* Table */}
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[28%]" />

            {visibleColumns.map(
              (column) => (
                <col
                  key={column.id}
                  style={{
                    width: `${
                      72 /
                      Math.max(
                        visibleColumns.length,
                        1,
                      )
                    }%`,
                  }}
                />
              ),
            )}
          </colgroup>

          <thead>
            {/* Group header */}
            <tr>
              <th
                rowSpan={2}
                className="border-b border-r border-border bg-background px-4 py-3 text-left align-middle text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                Responsibility / Authority
              </th>

              {visibleGroups.map(
                (group) => {
                  const groupColumns =
                    visibleColumns.filter(
                      (column) =>
                        column.groupId ===
                        group.id,
                    )

                  if (
                    !groupColumns.length
                  ) {
                    return null
                  }

                  const styles =
                    getGroupStyles(
                      group.id,
                    )

                  return (
                    <th
                      key={group.id}
                      colSpan={
                        groupColumns.length
                      }
                      className={`border-b border-r border-border px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider ${styles.header}`}
                    >
                      {group.label}
                    </th>
                  )
                },
              )}
            </tr>

            {/* Rank names */}
            <tr>
              {visibleColumns.map(
                (column) => {
                  const styles =
                    getGroupStyles(
                      column.groupId,
                    )

                  return (
                    <th
                      key={column.id}
                      className={`border-b border-r border-border px-1 py-2 text-center text-[10px] font-semibold ${styles.header}`}
                      title={column.label}
                    >
                      <span className="block truncate">
                        {column.label}
                      </span>
                    </th>
                  )
                },
              )}
            </tr>
          </thead>

          <tbody>
            {orderedSections.map(
              (section) => {
                const sectionRows =
                  rowsBySection.get(
                    section,
                  ) ?? []

                if (
                  !sectionRows.length
                ) {
                  return null
                }

                return (
                  <Fragment
                    key={section}
                  >
                    {/* Primary Responsibility label */}
                    {section ===
                      "PRIMARY RESPONSIBILITY" && (
                      <tr>
                        <td
                          colSpan={
                            1 +
                            visibleColumns.length
                          }
                          className="border-b border-border bg-muted/[0.025] px-4 py-2"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
                            Primary Responsibility
                          </span>
                        </td>
                      </tr>
                    )}

                    {/* Authority separator */}
                    {section ===
                      "AUTHORITY" && (
                      <tr>
                        <td
                          colSpan={
                            1 +
                            visibleColumns.length
                          }
                          className="border-y border-border bg-background px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />

                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                              Authority
                            </span>

                            <div className="h-px flex-1 bg-border" />
                          </div>
                        </td>
                      </tr>
                    )}

                    {sectionRows.map(
                      (row) => (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-white/[0.02]"
                        >
                          <td className="border-b border-r border-border bg-background px-4 py-2.5 align-middle">
                            <span
                              className="block truncate text-xs font-medium text-foreground sm:text-[13px]"
                              title={
                                row.name
                              }
                            >
                              {
                                row.name
                              }
                            </span>
                          </td>

                          {visibleColumns.map(
                            (
                              column,
                            ) => {
                              const styles =
                                getGroupStyles(
                                  column.groupId,
                                )

                              const allowed =
                                row
                                  .permissions[
                                  column.id
                                ]

                              return (
                                <td
                                  key={
                                    column.id
                                  }
                                  className={`border-b border-r border-border px-1 py-2 text-center ${styles.cell}`}
                                >
                                  {allowed ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15">
                                      <Check className="h-3.5 w-3.5 text-blue-400" />
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/25">
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
                  </Fragment>
                )
              },
            )}
          </tbody>
        </table>

        {filteredRows.length ===
          0 && (
          <div className="border-t border-border px-4 py-10 text-center">
            <p className="text-sm font-medium">
              No results found
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Try changing your search or
              filters.
            </p>
          </div>
        )}
      </div>

      {/* Simple footer */}
      <div className="border-t border-border px-4 py-2.5">
        <span className="text-[11px] text-muted-foreground">
          {filteredRows.length}{" "}
          {filteredRows.length ===
          1
            ? "entry"
            : "entries"}
        </span>
      </div>
    </div>
  )
}
