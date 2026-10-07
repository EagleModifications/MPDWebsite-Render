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
    cols?: Array<{
      id?: string
      label?: string
    }>
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

const GROUPS = [
  "OFFICERS",
  "SUPERVISORS",
  "LOW COMMAND",
  "TRIAL HIGH COMMAND",
]

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function upper(value: unknown): string {
  return clean(value).toUpperCase()
}

function getCell(
  row: GvizRow | undefined,
  index: number,
): string {
  if (!row?.c?.[index]) {
    return ""
  }

  return clean(
    row.c[index]?.v ??
      row.c[index]?.f ??
      "",
  )
}

function getGroup(value: unknown): string | null {
  const valueUpper = upper(value)

  if (
    valueUpper === "OFFICERS" ||
    valueUpper === "OFFICER"
  ) {
    return "OFFICERS"
  }

  if (
    valueUpper === "SUPERVISORS" ||
    valueUpper === "SUPERVISOR"
  ) {
    return "SUPERVISORS"
  }

  if (valueUpper === "LOW COMMAND") {
    return "LOW COMMAND"
  }

  if (
    valueUpper === "TRIAL HIGH COMMAND" ||
    valueUpper === "TRIAL HIGH COMMANDS"
  ) {
    return "TRIAL HIGH COMMAND"
  }

  return null
}

function getSection(value: unknown): string {
  const valueUpper = upper(value)

  if (
    valueUpper === "PRIMARY RESPONSIBILITY"
  ) {
    return "PRIMARY RESPONSIBILITY"
  }

  if (valueUpper === "AUTHORITY") {
    return "AUTHORITY"
  }

  return clean(value)
}

function isPermission(value: unknown): boolean {
  const text = clean(value).toLowerCase()

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

function isDocumentNote(
  value: string,
): boolean {
  const text = value.toLowerCase()

  if (!text) {
    return false
  }

  return (
    text.includes(
      "this document supersedes",
    ) ||
    text.includes(
      "takes precedent over any other document",
    ) ||
    text.includes(
      "takes precedence over any other document",
    ) ||
    text.includes(
      "restrictions apply based on the rank",
    ) ||
    text.includes(
      "determined by rank in ftd",
    ) ||
    text.includes("last updated") ||
    /^\d{1,2}\/\d{1,2}\/\d{4}/.test(
      text,
    )
  )
}

/*
 * Google Sheets can return the merged group heading in
 * different rows depending on how the sheet was created.
 *
 * This function searches the first several rows and finds
 * the row with the greatest number of recognisable group
 * headings.
 */
function findGroupRow(
  rows: GvizRow[],
  maxColumns: number,
): number {
  let bestRow = -1
  let bestCount = 0

  const rowsToCheck = Math.min(
    rows.length,
    15,
  )

  for (
    let rowIndex = 0;
    rowIndex < rowsToCheck;
    rowIndex += 1
  ) {
    let count = 0

    for (
      let columnIndex = 0;
      columnIndex < maxColumns;
      columnIndex += 1
    ) {
      if (
        getGroup(
          getCell(
            rows[rowIndex],
            columnIndex,
          ),
        )
      ) {
        count += 1
      }
    }

    if (count > bestCount) {
      bestCount = count
      bestRow = rowIndex
    }
  }

  return bestRow
}

function parseSheet(
  responseText: string,
): MatrixData {
  const jsonStart =
    responseText.indexOf("{")

  const jsonEnd =
    responseText.lastIndexOf("}")

  if (
    jsonStart === -1 ||
    jsonEnd === -1
  ) {
    throw new Error(
      "Google Sheets returned an invalid response.",
    )
  }

  const response =
    JSON.parse(
      responseText.slice(
        jsonStart,
        jsonEnd + 1,
      ),
    ) as GvizResponse

  const rows =
    response.table?.rows ?? []

  if (!rows.length) {
    throw new Error(
      `No data was found in "${SHEET_NAME}".`,
    )
  }

  const maxColumns = Math.max(
    ...rows.map(
      (row) =>
        row.c?.length ?? 0,
    ),
  )

  /*
   * Find the row containing the command groups.
   */
  const groupRowIndex =
    findGroupRow(
      rows,
      maxColumns,
    )

  if (groupRowIndex === -1) {
    /*
     * Do not fail immediately.
     *
     * Some versions of GViz return the first row as
     * column metadata instead of a normal row. We therefore
     * try to infer the groups from the first rows.
     */
    const possibleRows =
      rows.slice(0, 10)

    let found = false

    for (const row of possibleRows) {
      for (
        let i = 0;
        i < maxColumns;
        i += 1
      ) {
        if (
          getGroup(
            getCell(row, i),
          )
        ) {
          found = true
          break
        }
      }

      if (found) {
        break
      }
    }

    if (!found) {
      throw new Error(
        `Could not find the "${SHEET_NAME}" table structure.`,
      )
    }
  }

  const actualGroupRow =
    groupRowIndex === -1
      ? 0
      : groupRowIndex

  /*
   * Carry merged group headings across columns.
   */
  const groupsAtColumn: Record<
    number,
    string
  > = {}

  let currentGroup: string | null =
    null

  for (
    let columnIndex = 0;
    columnIndex < maxColumns;
    columnIndex += 1
  ) {
    const detected =
      getGroup(
        getCell(
          rows[actualGroupRow],
          columnIndex,
        ),
      )

    if (detected) {
      currentGroup = detected
    }

    if (currentGroup) {
      groupsAtColumn[
        columnIndex
      ] = currentGroup
    }
  }

  /*
   * The next row is normally the actual rank row.
   *
   * If the next row contains TRUE/FALSE instead,
   * search the following few rows for the real rank row.
   */
  let rankRowIndex =
    actualGroupRow + 1

  for (
    let attempt = 0;
    attempt < 4 &&
    rankRowIndex < rows.length;
    attempt += 1
  ) {
    let usefulLabels = 0

    for (
      let columnIndex = 0;
      columnIndex < maxColumns;
      columnIndex += 1
    ) {
      if (
        !groupsAtColumn[
          columnIndex
        ]
      ) {
        continue
      }

      const label =
        getCell(
          rows[rankRowIndex],
          columnIndex,
        )

      const lower =
        label.toLowerCase()

      if (
        label &&
        lower !== "true" &&
        lower !== "false"
      ) {
        usefulLabels += 1
      }
    }

    if (usefulLabels >= 2) {
      break
    }

    rankRowIndex += 1
  }

  const columns: RankColumn[] = []

  for (
    let columnIndex = 0;
    columnIndex < maxColumns;
    columnIndex += 1
  ) {
    const groupId =
      groupsAtColumn[
        columnIndex
      ]

    if (!groupId) {
      continue
    }

    const label =
      getCell(
        rows[rankRowIndex],
        columnIndex,
      )

    if (!label) {
      continue
    }

    const lower =
      label.toLowerCase()

    if (
      lower === "true" ||
      lower === "false" ||
      lower === "yes" ||
      lower === "no"
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
      "No rank columns could be read from the sheet.",
    )
  }

  const groups: RankGroup[] =
    GROUPS
      .filter(
        (group) =>
          columns.some(
            (column) =>
              column.groupId ===
              group,
          ),
      )
      .map((group) => ({
        id: group,
        label: group,
      }))

  const matrixRows: MatrixRow[] =
    []

  let currentSection = ""

  /*
   * Everything after the rank header is table data.
   */
  for (
    let rowIndex =
      rankRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex]

    const columnA =
      getSection(
        getCell(row, 0),
      )

    const name =
      getCell(row, 1)

    /*
     * Ignore the document notes and timestamp rows.
     */
    if (
      isDocumentNote(
        columnA,
      ) ||
      isDocumentNote(name)
    ) {
      continue
    }

    /*
     * Column A controls the section.
     */
    if (
      columnA ===
      "PRIMARY RESPONSIBILITY"
    ) {
      currentSection =
        "PRIMARY RESPONSIBILITY"
    } else if (
      columnA === "AUTHORITY"
    ) {
      currentSection =
        "AUTHORITY"
    }

    /*
     * Empty Column B rows are section/header rows,
     * not actual entries.
     */
    if (!name) {
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
      permissions[
        column.id
      ] = isPermission(
        getCell(
          row,
          column.sourceIndex,
        ),
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
    groups,
    columns,
    rows: matrixRows,
  }
}

function groupClasses(
  groupId: string,
) {
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

  const loadSheet =
    useCallback(
      async (
        manual = false,
      ) => {
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

          const sheetId =
            match[1]

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
          data.rows.map(
            (row) =>
              row.section,
          ),
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
        search
          .trim()
          .toLowerCase()

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
      const result =
        new Map<
          string,
          MatrixRow[]
        >()

      for (const row of filteredRows) {
        const rows =
          result.get(
            row.section,
          ) ?? []

        rows.push(row)

        result.set(
          row.section,
          rows,
        )
      }

      return result
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
    search.trim() !== "" ||
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
      <div className="flex min-h-[380px] items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading Authority Matrix...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.03] p-6">
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
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              Authority Matrix
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Command authority and primary responsibilities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* SECTION FILTER */}
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

            {/* RANK FILTER */}
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

        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
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
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/[0.03] px-3 py-2 text-xs text-amber-300">
            Latest Google Sheet refresh failed. Showing the
            last successfully loaded data.
          </div>
        )}
      </div>

      {/* MATRIX */}
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
            {/* GROUPS */}
            <tr>
              <th
                rowSpan={2}
                className="border-b border-r border-border bg-background px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                Responsibility / Authority
              </th>

              {visibleGroups.map(
                (group) => {
                  const columns =
                    visibleColumns.filter(
                      (column) =>
                        column.groupId ===
                        group.id,
                    )

                  if (!columns.length) {
                    return null
                  }

                  const styles =
                    groupClasses(
                      group.id,
                    )

                  return (
                    <th
                      key={group.id}
                      colSpan={
                        columns.length
                      }
                      className={`border-b border-r border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider ${styles.header}`}
                    >
                      {group.label}
                    </th>
                  )
                },
              )}
            </tr>

            {/* RANKS */}
            <tr>
              {visibleColumns.map(
                (column) => {
                  const styles =
                    groupClasses(
                      column.groupId,
                    )

                  return (
                    <th
                      key={column.id}
                      title={column.label}
                      className={`border-b border-r border-border px-1 py-2 text-center text-[10px] font-semibold ${styles.header}`}
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
                const rows =
                  rowsBySection.get(
                    section,
                  ) ?? []

                if (!rows.length) {
                  return null
                }

                return (
                  <Fragment
                    key={section}
                  >
                    {/* PRIMARY RESPONSIBILITY */}
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

                    {/* AUTHORITY */}
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

                    {rows.map(
                      (row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-white/[0.02]"
                        >
                          <td className="border-b border-r border-border bg-background px-4 py-2.5">
                            <span
                              className="block truncate text-[13px] font-medium text-foreground"
                              title={row.name}
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
                                groupClasses(
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

        {!filteredRows.length && (
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
