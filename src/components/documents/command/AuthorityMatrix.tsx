import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
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

function normalizeSection(value: unknown): string {
  const text = cleanText(value)
  const upper = text.toUpperCase()

  if (upper.includes("PRIMARY RESPONSIBILITY")) {
    return "PRIMARY RESPONSIBILITY"
  }

  if (upper === "AUTHORITY") {
    return "AUTHORITY"
  }

  return text
}

function getGroupId(value: unknown): string | null {
  const text = cleanText(value).toUpperCase()

  if (!text) {
    return null
  }

  if (text.includes("TRIAL") && text.includes("HIGH COMMAND")) {
    return "TRIAL HIGH COMMAND"
  }

  if (text.includes("LOW COMMAND")) {
    return "LOW COMMAND"
  }

  if (text === "SUPERVISORS" || text.includes("SUPERVISOR")) {
    return "SUPERVISORS"
  }

  if (text === "OFFICERS" || text.includes("OFFICER")) {
    return "OFFICERS"
  }

  return null
}

function getGroupLabel(groupId: string): string {
  return groupId
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

function parseSheet(text: string): MatrixData {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Google Sheets returned an invalid response.")
  }

  const json = JSON.parse(
    text.slice(start, end + 1),
  ) as GvizResponse

  const rows = json.table?.rows ?? []

  if (!rows.length) {
    throw new Error(
      `No rows were found in the "${SHEET_NAME}" sheet.`,
    )
  }

  /*
   * Find the row containing the rank-group headers.
   * This allows the sheet layout to change without hardcoding
   * specific row numbers.
   */
  let groupHeaderIndex = -1
  let detectedGroups: Record<number, string> = {}

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const groupsForRow: Record<number, string> = {}

    for (let columnIndex = 0; columnIndex < (row.c?.length ?? 0); columnIndex += 1) {
      const groupId = getGroupId(getCellValue(row, columnIndex))

      if (groupId) {
        groupsForRow[columnIndex] = groupId
      }
    }

    if (Object.keys(groupsForRow).length >= 1) {
      groupHeaderIndex = rowIndex
      detectedGroups = groupsForRow
      break
    }
  }

  if (groupHeaderIndex === -1) {
    throw new Error(
      "Could not find the rank group headers in the Google Sheet.",
    )
  }

  /*
   * Google Sheets merged cells are returned with the value only
   * in the first cell. Carry the detected group across until the
   * next group appears.
   */
  const maxColumns = Math.max(
    ...rows.map((row) => row.c?.length ?? 0),
  )

  let currentGroup: string | null = null

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    if (detectedGroups[columnIndex]) {
      currentGroup = detectedGroups[columnIndex]
    } else if (currentGroup) {
      detectedGroups[columnIndex] = currentGroup
    }
  }

  /*
   * The rank names normally sit directly below the group row.
   */
  const rankHeaderIndex = groupHeaderIndex + 1
  const rankHeader = rows[rankHeaderIndex]

  if (!rankHeader) {
    throw new Error(
      "Could not find the rank header row in the Google Sheet.",
    )
  }

  const columns: RankColumn[] = []

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const groupId = detectedGroups[columnIndex]

    if (!groupId) {
      continue
    }

    const label = cleanText(
      getCellValue(rankHeader, columnIndex),
    )

    if (!label) {
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
      columns.some((column) => column.groupId === groupId),
    )
    .map((groupId) => ({
      id: groupId,
      label: getGroupLabel(groupId),
    }))

  /*
   * Support any additional command group that isn't in the normal
   * order above.
   */
  const additionalGroups = Array.from(
    new Set(columns.map((column) => column.groupId)),
  )
    .filter(
      (groupId) =>
        !GROUP_ORDER.includes(groupId),
    )
    .map((groupId) => ({
      id: groupId,
      label: groupId,
    }))

  const allGroups = [...groups, ...additionalGroups]

  const matrixRows: MatrixRow[] = []

  let currentSection = ""

  for (
    let rowIndex = rankHeaderIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    const columnA = normalizeSection(
      getCellValue(row, 0),
    )

    const name = cleanText(
      getCellValue(row, 1),
    )

    /*
     * Column A determines the section.
     * Blank cells inherit the previous section.
     */
    if (columnA === "PRIMARY RESPONSIBILITY") {
      currentSection = "PRIMARY RESPONSIBILITY"
    } else if (columnA === "AUTHORITY") {
      currentSection = "AUTHORITY"
    } else if (columnA) {
      /*
       * If Column A contains a different section heading, retain it
       * rather than silently changing the sheet data.
       */
      currentSection = columnA
    }

    if (!name) {
      continue
    }

    const permissions: Record<string, boolean> = {}

    for (const column of columns) {
      permissions[column.id] = isChecked(
        getCellValue(row, column.sourceIndex),
      )
    }

    matrixRows.push({
      id: `${rowIndex}-${name}`,
      section: currentSection,
      name,
      permissions,
    })
  }

  return {
    groups: allGroups,
    columns,
    rows: matrixRows,
  }
}

function getGroupClasses(groupId: string) {
  switch (groupId) {
    case "OFFICERS":
      return {
        header: "bg-blue-500/15 text-blue-300",
        cell: "bg-blue-500/[0.035]",
      }

    case "SUPERVISORS":
      return {
        header: "bg-violet-500/15 text-violet-300",
        cell: "bg-violet-500/[0.035]",
      }

    case "LOW COMMAND":
      return {
        header: "bg-amber-500/15 text-amber-300",
        cell: "bg-amber-500/[0.035]",
      }

    case "TRIAL HIGH COMMAND":
      return {
        header: "bg-red-500/15 text-red-300",
        cell: "bg-red-500/[0.035]",
      }

    default:
      return {
        header: "bg-muted/50 text-foreground",
        cell: "bg-muted/10",
      }
  }
}

export default function AuthorityMatrix() {
  const [data, setData] = useState<MatrixData | null>(null)
  const [search, setSearch] = useState("")
  const [hiddenSections, setHiddenSections] = useState<string[]>([])
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadSheet = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true)
    }

    try {
      setError("")

      const match = GOOGLE_SHEET_URL.match(
        /\/spreadsheets\/d\/([^/]+)/,
      )

      if (!match?.[1]) {
        throw new Error("Invalid Google Sheet URL.")
      }

      const sheetId = match[1]

      /*
       * Uses the sheet URL and sheet name only.
       * No GID and no Google API key.
       */
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
          `Google Sheets returned ${response.status}.`,
        )
      }

      const text = await response.text()
      const parsed = parseSheet(text)

      setData(parsed)
      setLastUpdated(new Date())
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load the Google Sheet."

      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSheet()

    const interval = window.setInterval(() => {
      void loadSheet()
    }, REFRESH_INTERVAL)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadSheet])

  const sectionOptions = useMemo(() => {
    if (!data) {
      return []
    }

    return Array.from(
      new Set(
        data.rows
          .map((row) => row.section)
          .filter(Boolean),
      ),
    )
  }, [data])

  const visibleGroups = useMemo(() => {
    if (!data) {
      return []
    }

    return data.groups.filter(
      (group) => !hiddenGroups.includes(group.id),
    )
  }, [data, hiddenGroups])

  const visibleColumns = useMemo(() => {
    if (!data) {
      return []
    }

    return data.columns.filter(
      (column) =>
        !hiddenGroups.includes(column.groupId),
    )
  }, [data, hiddenGroups])

  const filteredRows = useMemo(() => {
    if (!data) {
      return []
    }

    const query = search.trim().toLowerCase()

    return data.rows.filter((row) => {
      if (hiddenSections.includes(row.section)) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        row.name.toLowerCase().includes(query) ||
        row.section.toLowerCase().includes(query)
      )
    })
  }, [data, hiddenSections, search])

  const rowsBySection = useMemo(() => {
    const sections = new Map<string, MatrixRow[]>()

    for (const row of filteredRows) {
      const existing = sections.get(row.section) ?? []
      existing.push(row)
      sections.set(row.section, existing)
    }

    return sections
  }, [filteredRows])

  const orderedSections = useMemo(() => {
    const preferred = [
      "PRIMARY RESPONSIBILITY",
      "AUTHORITY",
    ]

    const existing = Array.from(rowsBySection.keys())

    return [
      ...preferred.filter((section) =>
        existing.includes(section),
      ),
      ...existing.filter(
        (section) => !preferred.includes(section),
      ),
    ]
  }, [rowsBySection])

  const hasActiveFilters =
    search.trim().length > 0 ||
    hiddenSections.length > 0 ||
    hiddenGroups.length > 0

  const clearFilters = () => {
    setSearch("")
    setHiddenSections([])
    setHiddenGroups([])
  }

  const toggleSection = (section: string) => {
    setHiddenSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    )
  }

  const toggleGroup = (groupId: string) => {
    setHiddenGroups((current) =>
      current.includes(groupId)
        ? current.filter((item) => item !== groupId)
        : [...current, groupId],
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
        <div className="text-sm font-semibold text-red-300">
          Unable to load Authority Matrix
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {error ||
            `The "${SHEET_NAME}" sheet could not be loaded.`}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void loadSheet(true)}
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
      <div className="border-b border-border px-4 py-4">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              Authority Matrix
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Command authority and primary responsibilities.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-0 flex-1 sm:w-[260px] sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search..."
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Section Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
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
                className="w-[240px]"
              >
                <DropdownMenuLabel>
                  Sections
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {sectionOptions.map((section) => (
                  <DropdownMenuCheckboxItem
                    key={section}
                    checked={!hiddenSections.includes(section)}
                    onCheckedChange={() =>
                      toggleSection(section)
                    }
                  >
                    {section}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Rank Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
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

                {data.groups.map((group) => (
                  <DropdownMenuCheckboxItem
                    key={group.id}
                    checked={!hiddenGroups.includes(group.id)}
                    onCheckedChange={() =>
                      toggleGroup(group.id)
                    }
                  >
                    {group.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void loadSheet(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Active filters */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filters:
            </span>

            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Search: {search}
                <X className="h-3 w-3" />
              </button>
            )}

            {hiddenSections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => toggleSection(section)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Hidden: {section}
                <X className="h-3 w-3" />
              </button>
            ))}

            {hiddenGroups.map((groupId) => (
              <button
                key={groupId}
                type="button"
                onClick={() => toggleGroup(groupId)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Hidden: {groupId}
                <X className="h-3 w-3" />
              </button>
            ))}

            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-blue-400 transition hover:text-blue-300"
            >
              Clear filters
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            {error}
          </div>
        )}
      </div>

      {/* Matrix */}
      <div className="w-full min-w-0 overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[23%]" />

            {visibleColumns.map((column) => (
              <col
                key={column.id}
                style={{
                  width: `${77 / Math.max(visibleColumns.length, 1)}%`,
                }}
              />
            ))}
          </colgroup>

          <thead>
            <tr>
              {/* Responsibility heading */}
              <th
                rowSpan={2}
                className="border-b border-r border-border bg-background px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Responsibility / Authority
              </th>

              {visibleGroups.map((group) => {
                const groupColumns =
                  visibleColumns.filter(
                    (column) =>
                      column.groupId === group.id,
                  )

                if (!groupColumns.length) {
                  return null
                }

                const styles = getGroupClasses(
                  group.id,
                )

                return (
                  <th
                    key={group.id}
                    colSpan={groupColumns.length}
                    className={`border-b border-r border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider ${styles.header}`}
                  >
                    {group.label}
                  </th>
                )
              })}
            </tr>

            <tr>
              {visibleColumns.map((column) => {
                const styles = getGroupClasses(
                  column.groupId,
                )

                return (
                  <th
                    key={column.id}
                    className={`border-b border-r border-border px-1 py-2 text-center text-[10px] font-semibold leading-tight ${styles.header}`}
                    title={column.label}
                  >
                    <span className="block truncate">
                      {column.label}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {orderedSections.map((section) => {
              const sectionRows =
                rowsBySection.get(section) ?? []

              if (!sectionRows.length) {
                return null
              }

              return (
                <Fragment key={section}>
                  {/* Section separator */}
                  {section === "AUTHORITY" && (
                    <tr>
                      <td
                        colSpan={
                          1 + visibleColumns.length
                        }
                        className="border-y border-border bg-background px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-border" />

                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
                            AUTHORITY
                          </span>

                          <div className="h-px flex-1 bg-border" />
                        </div>
                      </td>
                    </tr>
                  )}

                  {sectionRows.map((row, rowIndex) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      {/* Section */}
                      {rowIndex === 0 && section !== "AUTHORITY" ? (
                        <td
                          rowSpan={sectionRows.length}
                          className="border-b border-r border-border bg-background px-3 py-3 align-middle"
                        >
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-400">
                            {section}
                          </div>
                        </td>
                      ) : section !== "AUTHORITY" ? null : null}

                      {/* Responsibility / authority name */}
                      <td
                        className={`border-b border-r border-border bg-background px-3 py-2.5 align-middle ${
                          section === "AUTHORITY"
                            ? "w-[23%]"
                            : ""
                        }`}
                      >
                        <span
                          className="block truncate text-xs font-medium text-foreground sm:text-sm"
                          title={row.name}
                        >
                          {row.name}
                        </span>
                      </td>

                      {/* Permission cells */}
                      {visibleColumns.map((column) => {
                        const styles =
                          getGroupClasses(
                            column.groupId,
                          )

                        const allowed =
                          row.permissions[
                            column.id
                          ]

                        return (
                          <td
                            key={column.id}
                            className={`border-b border-r border-border px-1 py-2 text-center ${styles.cell}`}
                          >
                            {allowed ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15">
                                <Check className="h-3.5 w-3.5 text-blue-400" />
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/30">
                                —
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="border-t border-border px-4 py-10 text-center">
            <p className="text-sm font-medium">
              No results found
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Try changing your search or filters.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {filteredRows.length}{" "}
            {filteredRows.length === 1
              ? "entry"
              : "entries"}
          </span>

          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Waiting for update"}
          </span>
        </div>
      </div>
    </div>
  )
}
