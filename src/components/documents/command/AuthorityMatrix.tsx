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

/*
 * IMPORTANT:
 * This must be the NAME OF THE TAB at the bottom of Google Sheets,
 * not necessarily the name of the spreadsheet.
 */
const SHEET_NAME = "Authority Matrix"

const AUTO_REFRESH_MS = 60_000

type GvizCell = {
  v?: unknown
  f?: string
}

type GvizRow = {
  c?: Array<GvizCell | null>
}

type GvizResponse = {
  table?: {
    rows?: GvizRow[]
  }
}

type Group = {
  id: string
  label: string
}

type Rank = {
  id: string
  label: string
  groupId: string
  sourceColumn: number
}

type MatrixEntry = {
  id: string
  section: string
  name: string
  permissions: Record<string, boolean>
}

type MatrixData = {
  groups: Group[]
  ranks: Rank[]
  entries: MatrixEntry[]
}

const KNOWN_GROUPS = [
  "OFFICERS",
  "SUPERVISORS",
  "LOW COMMAND",
  "TRIAL HIGH COMMAND",
]

function text(value: unknown): string {
  return String(value ?? "")
    .replace(/\*+/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function upper(value: unknown): string {
  return text(value).toUpperCase()
}

function cell(
  row: GvizRow | undefined,
  index: number,
): string {
  if (!row?.c?.[index]) {
    return ""
  }

  const item = row.c[index]

  return text(
    item?.v ??
      item?.f ??
      "",
  )
}

function detectGroup(
  value: string,
): string | null {
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

function permission(value: string): boolean {
  const normalised =
    text(value).toLowerCase()

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
  ].includes(normalised)
}

function ignoredDocumentText(
  value: string,
): boolean {
  const lower =
    value.toLowerCase()

  return (
    lower.includes(
      "this document supersedes",
    ) ||
    lower.includes(
      "takes precedent over any other document",
    ) ||
    lower.includes(
      "takes precedence over any other document",
    ) ||
    lower.includes(
      "restrictions apply based on the rank",
    ) ||
    lower.includes(
      "determined by rank in ftd",
    ) ||
    lower.includes(
      "last updated",
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}/.test(
      lower,
    )
  )
}

/*
 * Find the row containing the rank groups.
 *
 * Google Sheets often returns merged cells with the value
 * only in the first cell of the merged area, so we only
 * need to find one or more recognised groups.
 */
function findGroupRow(
  rows: GvizRow[],
): number {
  let bestIndex = -1
  let bestScore = 0

  const limit = Math.min(
    rows.length,
    20,
  )

  for (
    let rowIndex = 0;
    rowIndex < limit;
    rowIndex++
  ) {
    let score = 0

    for (
      let columnIndex = 0;
      columnIndex < 40;
      columnIndex++
    ) {
      const value =
        cell(
          rows[rowIndex],
          columnIndex,
        )

      if (detectGroup(value)) {
        score++
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIndex = rowIndex
    }
  }

  return bestIndex
}

/*
 * If Google has stripped the merged group cells completely,
 * infer the groups from the rank labels.
 *
 * This is only a fallback. Normally the group headings from
 * the sheet are used.
 */
function inferGroupFromRank(
  value: string,
): string | null {
  const rank = upper(value)

  if (
    rank === "OFFICER" ||
    /^OFFICER\s*[123]$/.test(rank)
  ) {
    return "OFFICERS"
  }

  if (
    [
      "LCPL",
      "CPL",
      "SGT",
      "SSGT",
      "MSGT",
    ].includes(rank)
  ) {
    return "SUPERVISORS"
  }

  if (
    [
      "2LT",
      "1LT",
      "CPT",
      "MAJ",
    ].includes(rank)
  ) {
    return "LOW COMMAND"
  }

  if (
    rank.includes("LTCOL") ||
    rank.includes("LIEUTENANT COLONEL")
  ) {
    return "TRIAL HIGH COMMAND"
  }

  return null
}

function parseGviz(
  raw: string,
): MatrixData {
  const start =
    raw.indexOf("{")

  const end =
    raw.lastIndexOf("}")

  if (
    start === -1 ||
    end === -1
  ) {
    throw new Error(
      "Google Sheets did not return readable sheet data.",
    )
  }

  const json =
    JSON.parse(
      raw.slice(
        start,
        end + 1,
      ),
    ) as GvizResponse

  const rows =
    json.table?.rows ?? []

  if (!rows.length) {
    throw new Error(
      `The "${SHEET_NAME}" tab returned no rows.`,
    )
  }

  /*
   * Work out the widest row.
   */
  const width =
    Math.max(
      ...rows.map(
        (row) =>
          row.c?.length ?? 0,
      ),
    )

  const groupRow =
    findGroupRow(rows)

  /*
   * Build group information.
   */
  const groupsByColumn =
    new Map<
      number,
      string
    >()

  if (groupRow >= 0) {
    let currentGroup:
      | string
      | null = null

    for (
      let column = 0;
      column < width;
      column++
    ) {
      const value =
        cell(
          rows[groupRow],
          column,
        )

      const detected =
        detectGroup(value)

      if (detected) {
        currentGroup = detected
      }

      if (currentGroup) {
        groupsByColumn.set(
          column,
          currentGroup,
        )
      }
    }
  }

  /*
   * Find the rank/header row.
   *
   * Normally this is immediately beneath the group row.
   * We inspect the next few rows and choose the one containing
   * the greatest number of non-boolean labels.
   */
  let rankRow = -1

  if (groupRow >= 0) {
    let bestScore = 0

    for (
      let candidate =
        groupRow + 1;
      candidate <
        Math.min(
          rows.length,
          groupRow + 6,
        );
      candidate++
    ) {
      let score = 0

      for (
        let column = 0;
        column < width;
        column++
      ) {
        if (
          !groupsByColumn.has(
            column,
          )
        ) {
          continue
        }

        const value =
          cell(
            rows[candidate],
            column,
          )

        const lower =
          value.toLowerCase()

        if (
          value &&
          lower !== "true" &&
          lower !== "false"
        ) {
          score++
        }
      }

      if (score > bestScore) {
        bestScore = score
        rankRow = candidate
      }
    }
  }

  /*
   * If the group row wasn't found, inspect the first few rows
   * for likely rank headers and use their labels to construct
   * the columns.
   */
  if (rankRow === -1) {
    for (
      let candidate = 0;
      candidate <
        Math.min(
          rows.length,
          10,
        );
      candidate++
    ) {
      let score = 0

      for (
        let column = 0;
        column < width;
        column++
      ) {
        const value =
          cell(
            rows[candidate],
            column,
          )

        if (
          inferGroupFromRank(
            value,
          )
        ) {
          score++
        }
      }

      if (score >= 2) {
        rankRow = candidate
        break
      }
    }
  }

  if (rankRow === -1) {
    throw new Error(
      `Could not identify the rank header row in "${SHEET_NAME}".`,
    )
  }

  /*
   * Build ranks.
   */
  const ranks: Rank[] = []

  let currentFallbackGroup:
    | string
    | null = null

  for (
    let column = 0;
    column < width;
    column++
  ) {
    const rankLabel =
      cell(
        rows[rankRow],
        column,
      )

    if (!rankLabel) {
      continue
    }

    const lower =
      rankLabel.toLowerCase()

    /*
     * Don't turn TRUE/FALSE into rank names.
     */
    if (
      lower === "true" ||
      lower === "false"
    ) {
      continue
    }

    let groupId =
      groupsByColumn.get(
        column,
      ) ?? null

    /*
     * If the merged group header wasn't returned,
     * infer it from the actual rank name.
     */
    if (!groupId) {
      groupId =
        inferGroupFromRank(
          rankLabel,
        )
    }

    if (!groupId) {
      continue
    }

    currentFallbackGroup =
      groupId

    ranks.push({
      id: `${groupId}-${column}`,
      label: rankLabel,
      groupId,
      sourceColumn: column,
    })
  }

  /*
   * If only the first merged column carried the group name,
   * fill the group across any rank columns that didn't receive
   * a group.
   */
  if (
    ranks.length === 0 &&
    groupRow >= 0
  ) {
    throw new Error(
      `The "${SHEET_NAME}" tab was read, but no rank columns were found.`,
    )
  }

  /*
   * Remove duplicate columns.
   */
  const uniqueRanks =
    ranks.filter(
      (rank, index, array) =>
        array.findIndex(
          (other) =>
            other.sourceColumn ===
            rank.sourceColumn,
        ) === index,
    )

  /*
   * Build group list in the correct order.
   */
  const groups: Group[] =
    KNOWN_GROUPS
      .filter(
        (id) =>
          uniqueRanks.some(
            (rank) =>
              rank.groupId ===
              id,
          ),
      )
      .map((id) => ({
        id,
        label: id,
      }))

  /*
   * Find the first data row.
   */
  const firstDataRow =
    rankRow + 1

  const entries: MatrixEntry[] =
    []

  let currentSection = ""

  for (
    let rowIndex =
      firstDataRow;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row =
      rows[rowIndex]

    const columnA =
      cell(row, 0)

    const columnB =
      cell(row, 1)

    /*
     * Remove all unwanted footer/document information.
     */
    if (
      ignoredDocumentText(
        columnA,
      ) ||
      ignoredDocumentText(
        columnB,
      )
    ) {
      continue
    }

    const sectionValue =
      upper(columnA)

    if (
      sectionValue ===
      "PRIMARY RESPONSIBILITY"
    ) {
      currentSection =
        "PRIMARY RESPONSIBILITY"
    } else if (
      sectionValue === "AUTHORITY"
    ) {
      currentSection =
        "AUTHORITY"
    }

    /*
     * Some sheets put the responsibility directly in Column A
     * and the permissions immediately after it. Support that too.
     */
    let name = columnB
    let nameColumn = 1

    if (!name) {
      name = columnA
      nameColumn = 0
    }

    if (!name) {
      continue
    }

    if (
      upper(name) ===
        "PRIMARY RESPONSIBILITY" ||
      upper(name) === "AUTHORITY"
    ) {
      continue
    }

    if (!currentSection) {
      continue
    }

    if (
      ignoredDocumentText(
        name,
      )
    ) {
      continue
    }

    const permissions:
      Record<
        string,
        boolean
      > = {}

    for (const rank of uniqueRanks) {
      /*
       * If the responsibility is in Column A,
       * permissions still start from the original rank columns.
       *
       * If the responsibility is in Column B,
       * the rank columns remain unchanged.
       */
      void nameColumn

      permissions[
        rank.id
      ] = permission(
        cell(
          row,
          rank.sourceColumn,
        ),
      )
    }

    entries.push({
      id: `${rowIndex}-${name}`,
      section:
        currentSection,
      name,
      permissions,
    })
  }

  if (!entries.length) {
    throw new Error(
      `The "${SHEET_NAME}" tab was found, but no responsibility/authority entries could be read.`,
    )
  }

  return {
    groups,
    ranks: uniqueRanks,
    entries,
  }
}

function groupStyle(
  group: string,
) {
  switch (group) {
    case "OFFICERS":
      return {
        header:
          "bg-blue-500/[0.08] text-blue-300",
        cell:
          "bg-blue-500/[0.015]",
      }

    case "SUPERVISORS":
      return {
        header:
          "bg-violet-500/[0.08] text-violet-300",
        cell:
          "bg-violet-500/[0.015]",
      }

    case "LOW COMMAND":
      return {
        header:
          "bg-amber-500/[0.08] text-amber-300",
        cell:
          "bg-amber-500/[0.015]",
      }

    case "TRIAL HIGH COMMAND":
      return {
        header:
          "bg-red-500/[0.08] text-red-300",
        cell:
          "bg-red-500/[0.015]",
      }

    default:
      return {
        header:
          "bg-muted/20 text-muted-foreground",
        cell:
          "bg-transparent",
      }
  }
}

export default function AuthorityMatrix() {
  const [data, setData] =
    useState<MatrixData | null>(
      null,
    )

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

  const load =
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
              "The Google Sheet URL is invalid.",
            )
          }

          const sheetId =
            match[1]

          /*
           * No GID.
           * No API key.
           * The tab is selected by its name.
           */
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

          const parsed =
            parseGviz(raw)

          setData(parsed)
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load the Authority Matrix.",
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [],
    )

  useEffect(() => {
    void load()

    const interval =
      window.setInterval(
        () => {
          void load()
        },
        AUTO_REFRESH_MS,
      )

    return () =>
      window.clearInterval(
        interval,
      )
  }, [load])

  const sections =
    useMemo(() => {
      if (!data) {
        return []
      }

      return Array.from(
        new Set(
          data.entries.map(
            (entry) =>
              entry.section,
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

  const visibleRanks =
    useMemo(() => {
      if (!data) {
        return []
      }

      return data.ranks.filter(
        (rank) =>
          !hiddenGroups.includes(
            rank.groupId,
          ),
      )
    }, [data, hiddenGroups])

  const filtered =
    useMemo(() => {
      if (!data) {
        return []
      }

      const query =
        search
          .trim()
          .toLowerCase()

      return data.entries.filter(
        (entry) => {
          if (
            hiddenSections.includes(
              entry.section,
            )
          ) {
            return false
          }

          if (!query) {
            return true
          }

          return (
            entry.name
              .toLowerCase()
              .includes(query) ||
            entry.section
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

  const bySection =
    useMemo(() => {
      const map =
        new Map<
          string,
          MatrixEntry[]
        >()

      for (const entry of filtered) {
        const list =
          map.get(
            entry.section,
          ) ?? []

        list.push(entry)

        map.set(
          entry.section,
          list,
        )
      }

      return map
    }, [filtered])

  const orderedSections =
    useMemo(() => {
      const preferred = [
        "PRIMARY RESPONSIBILITY",
        "AUTHORITY",
      ]

      const existing =
        Array.from(
          bySection.keys(),
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
    }, [bySection])

  const toggleSection = (
    value: string,
  ) => {
    setHiddenSections(
      (current) =>
        current.includes(value)
          ? current.filter(
              (item) =>
                item !== value,
            )
          : [
              ...current,
              value,
            ],
    )
  }

  const toggleGroup = (
    value: string,
  ) => {
    setHiddenGroups(
      (current) =>
        current.includes(value)
          ? current.filter(
              (item) =>
                item !== value,
            )
          : [
              ...current,
              value,
            ],
    )
  }

  const clearFilters = () => {
    setSearch("")
    setHiddenSections([])
    setHiddenGroups([])
  }

  const hasFilters =
    Boolean(search.trim()) ||
    hiddenSections.length > 0 ||
    hiddenGroups.length > 0

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading Authority Matrix...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.025] p-6">
        <p className="text-sm font-semibold text-red-300">
          Unable to load Authority Matrix
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          {error}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() =>
            void load(true)
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
      {/* FILTER BAR */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search responsibilities..."
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* SECTION */}
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
                <Filter className="mr-2 h-3.5 w-3.5" />
                Section
                <ChevronDown className="ml-2 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-64"
            >
              <DropdownMenuLabel>
                Section
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {sections.map(
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

          {/* RANK */}
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
                <Filter className="mr-2 h-3.5 w-3.5" />
                Rank
                <ChevronDown className="ml-2 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56"
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
              void load(true)
            }
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        {hasFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-muted-foreground">
              Filters:
            </span>

            {search.trim() && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
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
                  className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
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
                  className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
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
              className="ml-1 text-[11px] font-medium text-blue-400 hover:text-blue-300"
            >
              Clear filters
            </button>
          </div>
        )}

        {error && (
          <div className="mt-2 text-[11px] text-amber-400">
            Refresh failed. Showing the last successfully
            loaded version.
          </div>
        )}
      </div>

      {/* MATRIX */}
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[30%]" />

            {visibleRanks.map(
              (rank) => (
                <col
                  key={rank.id}
                  style={{
                    width: `${
                      70 /
                      Math.max(
                        visibleRanks.length,
                        1,
                      )
                    }%`,
                  }}
                />
              ),
            )}
          </colgroup>

          <thead>
            <tr>
              <th
                rowSpan={2}
                className="border-b border-r border-border bg-background px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Responsibility / Authority
              </th>

              {visibleGroups.map(
                (group) => {
                  const ranks =
                    visibleRanks.filter(
                      (rank) =>
                        rank.groupId ===
                        group.id,
                    )

                  if (!ranks.length) {
                    return null
                  }

                  const styles =
                    groupStyle(
                      group.id,
                    )

                  return (
                    <th
                      key={group.id}
                      colSpan={
                        ranks.length
                      }
                      className={`border-b border-r border-border px-1 py-2 text-center text-[9px] font-bold uppercase tracking-wider ${styles.header}`}
                    >
                      {group.label}
                    </th>
                  )
                },
              )}
            </tr>

            <tr>
              {visibleRanks.map(
                (rank) => {
                  const styles =
                    groupStyle(
                      rank.groupId,
                    )

                  return (
                    <th
                      key={rank.id}
                      title={rank.label}
                      className={`border-b border-r border-border px-1 py-2 text-center text-[9px] font-semibold ${styles.header}`}
                    >
                      <span className="block truncate">
                        {rank.label}
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
                const entries =
                  bySection.get(
                    section,
                  ) ?? []

                if (!entries.length) {
                  return null
                }

                return (
                  <Fragment
                    key={section}
                  >
                    <tr>
                      <td
                        colSpan={
                          1 +
                          visibleRanks.length
                        }
                        className={`border-b border-border px-3 py-2 ${
                          section ===
                          "AUTHORITY"
                            ? "border-t-2 border-t-blue-500/30 bg-blue-500/[0.025]"
                            : "bg-muted/[0.015]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {section ===
                            "AUTHORITY" && (
                            <div className="h-px flex-1 bg-border" />
                          )}

                          <span
                            className={`text-[9px] font-bold uppercase tracking-[0.18em] ${
                              section ===
                              "AUTHORITY"
                                ? "text-blue-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {section}
                          </span>

                          {section ===
                            "AUTHORITY" && (
                            <div className="h-px flex-1 bg-border" />
                          )}
                        </div>
                      </td>
                    </tr>

                    {entries.map(
                      (entry) => (
                        <tr
                          key={
                            entry.id
                          }
                          className="transition hover:bg-white/[0.02]"
                        >
                          <td className="border-b border-r border-border bg-background px-3 py-2">
                            <span
                              title={
                                entry.name
                              }
                              className="block truncate text-[12px] font-medium text-foreground"
                            >
                              {
                                entry.name
                              }
                            </span>
                          </td>

                          {visibleRanks.map(
                            (rank) => {
                              const styles =
                                groupStyle(
                                  rank.groupId,
                                )

                              const allowed =
                                entry
                                  .permissions[
                                  rank.id
                                ]

                              return (
                                <td
                                  key={
                                    rank.id
                                  }
                                  className={`border-b border-r border-border px-1 py-1.5 text-center ${styles.cell}`}
                                >
                                  {allowed ? (
                                    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-500/15">
                                      <Check className="h-3 w-3 text-blue-400" />
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/20">
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

        {!filtered.length && (
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

      <div className="border-t border-border px-4 py-2">
        <span className="text-[10px] text-muted-foreground">
          {filtered.length}{" "}
          {filtered.length ===
          1
            ? "entry"
            : "entries"}
        </span>
      </div>
    </div>
  )
}
