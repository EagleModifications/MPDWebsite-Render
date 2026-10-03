import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

import {
  Car,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Shirt,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SheetKey =
  | "home"
  | "department-roster"
  | "employee-database"
  | "vehicle-roster"
  | "uniform-roster"

type MainRosterColor = {
  red?: number
  green?: number
  blue?: number
  alpha?: number
}

type MainRosterBorder = {
  style?: string
  color?: MainRosterColor
}

type MainRosterCellStyle = {
  backgroundColor?: MainRosterColor
  textColor?: MainRosterColor
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  horizontalAlignment?: string
  verticalAlignment?: string
  wrapStrategy?: string
  textDirection?: string
  padding?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  borders?: {
    top?: MainRosterBorder
    right?: MainRosterBorder
    bottom?: MainRosterBorder
    left?: MainRosterBorder
  }
  numberFormat?: {
    type?: string
    pattern?: string
  }
  textRotation?: {
    angle?: number
    vertical?: boolean
  }
}

type MainRosterCell = {
  value: string
  formula?: string
  hyperlink?: string
  styleId: number
}

type MainRosterMerge = {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

type MainRosterSheet = {
  key: string
  name: string
  gid: string
  headers: string[]
  rows: string[][]
  rawRows: string[][]
  rowCount: number
  columnCount: number
  sheetRowCount: number
  sheetColumnCount: number
  hideGridlines: boolean
  frozenRowCount: number
  frozenColumnCount: number
  rowHeights: number[]
  columnWidths: number[]
  hiddenRows: number[]
  hiddenColumns: number[]
  merges: MainRosterMerge[]
  styles: MainRosterCellStyle[]
  cells: MainRosterCell[][]
}

type MainRosterResponse = {
  success: boolean
  sheet?: MainRosterSheet
  error?: string
}

type MainRosterPage = {
  id: SheetKey
  label: string
  icon: LucideIcon
}

const pages: MainRosterPage[] = [
  { id: "home", label: "Home", icon: FileSpreadsheet },
  { id: "department-roster", label: "Department Roster", icon: Shield },
  { id: "employee-database", label: "Employee Database", icon: Users },
  { id: "vehicle-roster", label: "Vehicle Roster", icon: Car },
  { id: "uniform-roster", label: "Uniform Roster", icon: Shirt },
]

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function colorToCss(value?: MainRosterColor): string | undefined {
  if (!value) return undefined

  const red = Math.round((value.red ?? 0) * 255)
  const green = Math.round((value.green ?? 0) * 255)
  const blue = Math.round((value.blue ?? 0) * 255)
  const alpha = value.alpha ?? 1

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function borderToCss(value?: MainRosterBorder): string | undefined {
  if (!value || !value.style || value.style === "NONE") return undefined

  const styleMap: Record<string, string> = {
    SOLID: "solid",
    SOLID_MEDIUM: "solid",
    SOLID_THICK: "solid",
    DASHED: "dashed",
    DOTTED: "dotted",
    DOUBLE: "double",
  }

  const cssStyle = styleMap[value.style] ?? "solid"
  const width =
    value.style === "SOLID_THICK"
      ? 3
      : value.style === "SOLID_MEDIUM"
        ? 2
        : 1

  return `${width}px ${cssStyle} ${colorToCss(value.color) ?? "rgba(128,128,128,.35)"}`
}

function cellStyleToCss(
  style: MainRosterCellStyle | undefined,
): CSSProperties {
  if (!style) return {}

  const css: CSSProperties = {}

  const background = colorToCss(style.backgroundColor)
  const textColor = colorToCss(style.textColor)

  if (background) css.backgroundColor = background
  if (textColor) css.color = textColor
  if (style.fontFamily) css.fontFamily = style.fontFamily
  if (typeof style.fontSize === "number") css.fontSize = `${style.fontSize}px`
  if (style.bold) css.fontWeight = 700
  if (style.italic) css.fontStyle = "italic"
  if (style.underline) css.textDecoration = "underline"
  if (style.strikethrough) css.textDecoration = "line-through"

  if (style.horizontalAlignment) {
    const alignment: Record<string, CSSProperties["textAlign"]> = {
      LEFT: "left",
      CENTER: "center",
      RIGHT: "right",
    }
    css.textAlign = alignment[style.horizontalAlignment] ?? "center"
  }

  if (style.verticalAlignment) {
    const alignment: Record<string, CSSProperties["verticalAlign"]> = {
      TOP: "top",
      MIDDLE: "middle",
      BOTTOM: "bottom",
    }
    css.verticalAlign = alignment[style.verticalAlignment] ?? "middle"
  }

  if (style.wrapStrategy === "WRAP") css.whiteSpace = "pre-wrap"
  if (style.wrapStrategy === "CLIP") {
    css.whiteSpace = "nowrap"
    css.overflow = "hidden"
  }
  if (style.wrapStrategy === "OVERFLOW_CELL") css.whiteSpace = "nowrap"

  if (style.textDirection === "RIGHT_TO_LEFT") css.direction = "rtl"

  if (style.padding) {
    css.paddingTop = style.padding.top
    css.paddingRight = style.padding.right
    css.paddingBottom = style.padding.bottom
    css.paddingLeft = style.padding.left
  }

  if (style.borders) {
    const top = borderToCss(style.borders.top)
    const right = borderToCss(style.borders.right)
    const bottom = borderToCss(style.borders.bottom)
    const left = borderToCss(style.borders.left)
    if (top) css.borderTop = top
    if (right) css.borderRight = right
    if (bottom) css.borderBottom = bottom
    if (left) css.borderLeft = left
  }

  if (style.textRotation?.vertical) {
    css.writingMode = "vertical-rl"
    css.transform = "rotate(180deg)"
  } else if (typeof style.textRotation?.angle === "number") {
    css.transform = `rotate(${style.textRotation.angle}deg)`
  }

  return css
}

function findFilterHeaderRow(sheet: MainRosterSheet): number {
  const rows = sheet.rawRows

  const matches = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader)
    const hasRank = normalized.includes("rank")
    const hasStatus =
      normalized.includes("status") ||
      normalized.includes("departmentstatus") ||
      normalized.includes("employmentstatus")
    return hasRank && (hasStatus || normalized.includes("callsign"))
  })

  if (matches !== -1) return matches

  return rows.findIndex((row) =>
    row.some((value) => normalizeHeader(value) === "rank"),
  )
}

function findColumnInRow(row: string[], aliases: string[]): number {
  const normalized = row.map(normalizeHeader)
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias))
    if (index !== -1) return index
  }
  return -1
}

function buildMergeMap(merges: MainRosterMerge[]) {
  const map = new Map<
    string,
    { anchor: boolean; rowSpan: number; colSpan: number }
  >()

  for (const merge of merges) {
    const rowSpan = Math.max(1, merge.endRow - merge.startRow)
    const colSpan = Math.max(1, merge.endColumn - merge.startColumn)

    for (let row = merge.startRow; row < merge.endRow; row += 1) {
      for (
        let column = merge.startColumn;
        column < merge.endColumn;
        column += 1
      ) {
        map.set(`${row}:${column}`, {
          anchor: row === merge.startRow && column === merge.startColumn,
          rowSpan,
          colSpan,
        })
      }
    }
  }

  return map
}

function CellContent({
  cell,
}: {
  cell: MainRosterCell
}) {
  const value = cell.value

  if (!value) return null

  if (cell.hyperlink) {
    return (
      <a
        href={cell.hyperlink}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-current/40 underline-offset-2 hover:opacity-80"
      >
        {value}
      </a>
    )
  }

  return <>{value}</>
}

function GoogleSheetGrid({
  sheet,
  visibleRows,
}: {
  sheet: MainRosterSheet
  visibleRows: Set<number> | null
}) {
  const mergeMap = useMemo(() => buildMergeMap(sheet.merges), [sheet.merges])

  const hiddenRows = useMemo(
    () => new Set(sheet.hiddenRows),
    [sheet.hiddenRows],
  )
  const hiddenColumns = useMemo(
    () => new Set(sheet.hiddenColumns),
    [sheet.hiddenColumns],
  )

  const tableStyle: CSSProperties = {
    borderCollapse: "collapse",
    tableLayout: "fixed",
    width: Math.max(
      1,
      sheet.columnWidths.reduce((total, width, index) => {
        if (hiddenColumns.has(index)) return total
        return total + (width || 100)
      }, 0),
    ),
  }

  return (
    <div className="max-h-[calc(100vh-250px)] w-full overflow-auto bg-background">
      <table style={tableStyle}>
        <colgroup>
          {sheet.columnWidths.map((width, columnIndex) => (
            <col
              key={columnIndex}
              style={{
                width: width || 100,
                display: hiddenColumns.has(columnIndex) ? "none" : undefined,
              }}
            />
          ))}
        </colgroup>

        <tbody>
          {sheet.cells.map((row, rowIndex) => {
            if (hiddenRows.has(rowIndex)) return null
            if (visibleRows && !visibleRows.has(rowIndex)) return null

            const rowStyle: CSSProperties = {
              height: sheet.rowHeights[rowIndex] || 21,
              display: visibleRows && !visibleRows.has(rowIndex) ? "none" : undefined,
            }

            return (
              <tr key={rowIndex} style={rowStyle}>
                {row.map((cell, columnIndex) => {
                  if (hiddenColumns.has(columnIndex)) return null

                  const merge = mergeMap.get(`${rowIndex}:${columnIndex}`)
                  if (merge && !merge.anchor) return null

                  const style = sheet.styles[cell.styleId] ?? sheet.styles[0]
                  const css = cellStyleToCss(style)

                  if (!sheet.hideGridlines) {
                    css.borderTop ??= "1px solid rgba(128,128,128,.18)"
                    css.borderRight ??= "1px solid rgba(128,128,128,.18)"
                    css.borderBottom ??= "1px solid rgba(128,128,128,.18)"
                    css.borderLeft ??= "1px solid rgba(128,128,128,.18)"
                  }

                  return (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      rowSpan={merge?.rowSpan}
                      colSpan={merge?.colSpan}
                      style={css}
                    >
                      <div className="min-h-[1em] w-full">
                        <CellContent cell={cell} />
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center">
      <FileSpreadsheet className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="p-12 text-center">
      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-500" />
      <p className="mt-3 text-sm text-muted-foreground">Loading Google Sheet...</p>
    </div>
  )
}

function ErrorState({
  message,
  retry,
}: {
  message: string
  retry: () => void
}) {
  return (
    <div className="p-10 text-center">
      <XCircle className="mx-auto h-7 w-7 text-red-500" />
      <p className="mt-3 text-sm font-semibold">Failed to load Main Roster</p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={retry} className="mt-4">
        Try Again
      </Button>
    </div>
  )
}

export default function MainRoster() {
  const [page, setPage] = useState<SheetKey>("home")
  const [sheet, setSheet] = useState<MainRosterSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rankFilter, setRankFilter] = useState("")

  const pageInfo = pages.find((item) => item.id === page) ?? pages[0]

  const loadSheet = useCallback(
    async (selectedPage: SheetKey, showLoading = true) => {
      if (showLoading) setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/main-roster/${selectedPage}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        })

        const data = (await response.json().catch(() => null)) as MainRosterResponse | null

        if (!response.ok || !data?.success || !data.sheet) {
          throw new Error(
            data?.error || `Failed to load ${pageInfo.label} (${response.status}).`,
          )
        }

        setSheet(data.sheet)
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : `Failed to load ${pageInfo.label}.`
        setSheet(null)
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [pageInfo.label],
  )

  useEffect(() => {
    setSearch("")
    setStatusFilter("")
    setRankFilter("")
    void loadSheet(page)
  }, [page, loadSheet])

  const refresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)

    try {
      await loadSheet(page, false)
      toast.success("Main Roster refreshed", {
        description: `Latest ${pageInfo.label} data loaded from Google Sheets.`,
      })
    } finally {
      setRefreshing(false)
    }
  }, [loadSheet, page, pageInfo.label, refreshing])

  const filterHeaderRow = useMemo(
    () => (sheet ? findFilterHeaderRow(sheet) : -1),
    [sheet],
  )

  const filterHeader = useMemo(
    () => (filterHeaderRow >= 0 && sheet ? sheet.rawRows[filterHeaderRow] ?? [] : []),
    [filterHeaderRow, sheet],
  )

  const statusColumn = useMemo(() => {
    if (page !== "department-roster") return -1
    return findColumnInRow(filterHeader, [
      "Status",
      "Department Status",
      "Employment Status",
    ])
  }, [filterHeader, page])

  const rankColumn = useMemo(() => {
    if (page !== "department-roster" && page !== "employee-database") return -1
    return findColumnInRow(filterHeader, ["Rank"])
  }, [filterHeader, page])

  const statusOptions = useMemo(() => {
    if (!sheet || statusColumn === -1) return []

    const values: string[] = []
    const seen = new Set<string>()

    for (let rowIndex = filterHeaderRow + 1; rowIndex < sheet.rawRows.length; rowIndex += 1) {
      const value = cleanValue(sheet.rawRows[rowIndex]?.[statusColumn])
      if (value && !seen.has(value)) {
        seen.add(value)
        values.push(value)
      }
    }

    return values
  }, [filterHeaderRow, sheet, statusColumn])

  const rankOptions = useMemo(() => {
    if (!sheet || rankColumn === -1) return []

    const values: string[] = []
    const seen = new Set<string>()

    for (let rowIndex = filterHeaderRow + 1; rowIndex < sheet.rawRows.length; rowIndex += 1) {
      const value = cleanValue(sheet.rawRows[rowIndex]?.[rankColumn])
      if (value && !seen.has(value)) {
        seen.add(value)
        values.push(value)
      }
    }

    return values
  }, [filterHeaderRow, sheet, rankColumn])

  const visibleRows = useMemo(() => {
    if (!sheet || page === "home" || (!search.trim() && !statusFilter && !rankFilter)) {
      return null
    }

    const query = search.trim().toLowerCase()
    const result = new Set<number>()

    for (let rowIndex = 0; rowIndex < sheet.rawRows.length; rowIndex += 1) {
      if (rowIndex === filterHeaderRow) {
        result.add(rowIndex)
        continue
      }

      const row = sheet.rawRows[rowIndex] ?? []

      if (
        statusFilter &&
        statusColumn !== -1 &&
        cleanValue(row[statusColumn]) !== statusFilter
      ) {
        continue
      }

      if (
        rankFilter &&
        rankColumn !== -1 &&
        cleanValue(row[rankColumn]) !== rankFilter
      ) {
        continue
      }

      if (query && !row.some((value) => cleanValue(value).toLowerCase().includes(query))) {
        continue
      }

      result.add(rowIndex)
    }

    return result
  }, [filterHeaderRow, page, rankColumn, rankFilter, search, sheet, statusColumn, statusFilter])

  const filteredCount = visibleRows
    ? Array.from(visibleRows).filter((rowIndex) => rowIndex !== filterHeaderRow).length
    : sheet?.rawRows.length ?? 0

  const hasFilters = Boolean(search || statusFilter || rankFilter)

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("")
    setRankFilter("")
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">Main Roster</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Metro Police Department master roster and operational data.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            className="gap-2 self-start lg:self-auto"
          >
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="flex w-full gap-2 overflow-x-auto pb-1">
          {pages.map((item) => {
            const Icon = item.icon
            const active = item.id === page

            return (
              <Button
                key={item.id}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(item.id)}
                className="shrink-0 gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <pageInfo.icon className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{pageInfo.label}</h2>
                <p className="text-xs text-muted-foreground">
                  {sheet ? `${sheet.rowCount.toLocaleString()} rows` : "Loading..."}
                </p>
              </div>
            </div>

            {(page === "department-roster" || page === "employee-database") && (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative w-full lg:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${pageInfo.label.toLowerCase()}...`}
                    className="pl-9"
                  />
                </div>

                {page === "department-roster" && statusOptions.length > 0 && (
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring lg:w-44"
                  >
                    <option value="">All Status</option>
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                )}

                {rankOptions.length > 0 && (
                  <select
                    value={rankFilter}
                    onChange={(event) => setRankFilter(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring lg:w-52"
                  >
                    <option value="">All Ranks</option>
                    {rankOptions.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                )}

                {hasFilters && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          {sheet && page !== "home" && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-5 py-3">
              {(page === "department-roster" || page === "employee-database") ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  {hasFilters ? (
                    <>Showing <span className="font-semibold text-foreground">{filteredCount.toLocaleString()}</span></>
                  ) : (
                    <>Showing all <span className="font-semibold text-foreground">{sheet.rowCount.toLocaleString()}</span></>
                  )}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {sheet.rowCount.toLocaleString()} rows
                </span>
              )}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} retry={() => void loadSheet(page)} />
          ) : !sheet ? (
            <EmptyState message="No sheet data was returned." />
          ) : sheet.cells.length === 0 ? (
            <EmptyState message={`The ${sheet.name} sheet does not currently contain any data.`} />
          ) : (
            <GoogleSheetGrid sheet={sheet} visibleRows={visibleRows} />
          )}
        </section>

        {sheet && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Source: {sheet.name}</span>
            <span>{sheet.columnCount} columns · {sheet.rowCount} rows</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
