import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1WlES0v7NUSRccYvdd7EUHQgHvcdrBPJGUoKqNWbTDP8/edit"

const SHEET_NAME = "Sheet1"

const HEADERS = [
  "Category",
  "Offense / Example",
  "Offense #1",
  "Offense #2",
  "Offense #3",
  "Elevated Action",
] as const

type Header = (typeof HEADERS)[number]
type Section = "INFRACTION" | "MODERATE" | "SEVERE"

type Row = {
  id: string
  section: Section
  values: Record<Header, string>
}

type GvizCell = { v?: unknown; f?: unknown }
type GvizRow = { c?: Array<GvizCell | null> }
type GvizResponse = {
  table?: { rows?: GvizRow[] }
  status?: string
  errors?: Array<{ message?: string; detailed_message?: string }>
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
  if (start < 0 || end < start) {
    throw new Error("Google Sheets returned an invalid response.")
  }
  return JSON.parse(raw.slice(start, end + 1)) as GvizResponse
}

function getSheetId(): string {
  const match = SHEET_URL.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!match) throw new Error("The Punishment Guidelines Google Sheets URL is invalid.")
  return match[1]
}

function isSection(value: string): value is Section {
  return ["INFRACTION", "MODERATE", "SEVERE"].includes(key(value))
}

function findHeaderRow(rows: GvizRow[]): number {
  let bestIndex = -1
  let bestScore = 0

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex += 1) {
    const row = rows[rowIndex]
    const values = row?.c ?? []
    let score = 0

    for (let column = 0; column < values.length; column += 1) {
      const value = key(cellValue(row, column))
      if (HEADERS.some((header) => key(header) === value)) score += 1
    }

    if (score > bestScore) {
      bestScore = score
      bestIndex = rowIndex
    }
  }

  if (bestScore < 4) {
    throw new Error("Could not find the Punishment Guidelines column headings.")
  }

  return bestIndex
}

function parseSheet(response: GvizResponse): Row[] {
  const rows = response.table?.rows ?? []
  if (!rows.length) {
    throw new Error("The Punishment Guidelines sheet returned no data.")
  }

  const headerRowIndex = findHeaderRow(rows)
  const headerColumns = new Map<Header, number>()

  for (
    let column = 0;
    column < (rows[headerRowIndex]?.c?.length ?? 0);
    column += 1
  ) {
    const value = key(cellValue(rows[headerRowIndex], column))
    const header = HEADERS.find((item) => key(item) === value)
    if (header) headerColumns.set(header, column)
  }

  const rowsOut: Row[] = []
  let currentSection: Section | null = null

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]
    if (!row) continue

    const allValues = (row.c ?? []).map((cell) =>
      clean(cell?.f ?? cell?.v ?? ""),
    )
    const allText = key(allValues.join(" "))

    if (
      !allText ||
      allText.includes("THIS DOCUMENT SUPERCEDES") ||
      allText.includes("THIS DOCUMENT SUPERSEDES") ||
      allText.includes("LAST UPDATED")
    ) {
      continue
    }

    // Some versions of the sheet put the section name in Category
    // on the first data row; others use a standalone separator row.
    const sectionCandidate = allValues.find((value) => isSection(value))
    const nonEmptyValues = allValues.filter(Boolean)

    if (sectionCandidate) {
      currentSection = sectionCandidate as Section

      // A section-only row is a visual separator and is not data.
      if (nonEmptyValues.length === 1) {
        continue
      }
    }

    if (!currentSection) continue

    const values = {} as Record<Header, string>
    for (const header of HEADERS) {
      const column = headerColumns.get(header)
      values[header] =
        column === undefined ? "" : clean(cellValue(row, column))
    }

    const hasData = HEADERS.some(
      (header) => header !== "Category" && values[header],
    )
    if (!hasData) continue

    // Category is represented by the section separator.
    values.Category = ""

    rowsOut.push({
      id: `${currentSection}-${rowIndex}-${values["Offense / Example"] || rowIndex}`,
      section: currentSection,
      values,
    })
  }

  if (!rowsOut.length) {
    throw new Error(
      "The Punishment Guidelines loaded, but no guideline rows were found.",
    )
  }

  return rowsOut
}

export default function PunishmentGuidelines() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const loadGuidelines = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const url =
        `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq` +
        `?sheet=${encodeURIComponent(SHEET_NAME)}` +
        `&headers=0&tqx=out:json&cacheBust=${Date.now()}`

      const response = await fetch(url, { method: "GET", cache: "no-store" })
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

      setRows(parseSheet(responseData))
    } catch (caught) {
      setRows([])
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Punishment Guidelines.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadGuidelines()
  }, [loadGuidelines])

  const filteredRows = useMemo(() => {
    const query = key(search)
    if (!query) return rows

    return rows.filter((row) =>
      HEADERS.some((header) => key(row.values[header]).includes(query)),
    )
  }, [rows, search])

  const groupedRows = useMemo(() => {
    const groups: Array<{ section: Section; rows: Row[] }> = []

    for (const row of filteredRows) {
      const existing = groups.find((group) => group.section === row.section)
      if (existing) existing.rows.push(row)
      else groups.push({ section: row.section, rows: [row] })
    }

    return groups
  }, [filteredRows])

  const rowsForSection = (section: Section) =>
    groupedRows.find((group) => group.section === section)?.rows ?? []


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
                <h2 className="text-base font-semibold">Punishment Guidelines</h2>
                <p className="text-xs text-muted-foreground">
                  Command punishment guidelines.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadGuidelines(true)}
              disabled={refreshing}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 text-blue-400 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search punishment guidelines..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
        </div>

        {loading && (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
              Loading Punishment Guidelines...
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
                    Unable to load Punishment Guidelines
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadGuidelines(true)}
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

        {!loading && !error && (
          <div className="max-h-[72vh] overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[23%]" />
                <col className="w-[15.75%]" />
                <col className="w-[15.75%]" />
                <col className="w-[15.75%]" />
                <col className="w-[15.75%]" />
              </colgroup>

              <thead className="sticky top-0 z-30">
                <tr className="border-b border-border/70 bg-card">
                  {HEADERS.map((header) => (
                    <th
                      key={header}
                      className="border-r border-border/50 bg-card px-2 py-2.5 text-left text-[8px] font-bold uppercase tracking-[0.06em] text-blue-400 last:border-r-0 sm:px-4 sm:text-[9px]"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groupedRows.flatMap((group) => [
                  <tr key={`section-${group.section}`}>
                    <td
                      colSpan={HEADERS.length}
                      className="border-b border-t border-blue-500/20 bg-muted/20 px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:px-4 sm:text-[10px]"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-blue-400" />
                        {group.section}
                      </span>
                    </td>
                  </tr>,
                  ...group.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 hover:bg-muted/10"
                    >
                      {HEADERS.map((header) => (
                        <td
                          key={`${row.id}-${header}`}
                          className="border-r border-border/50 px-3 py-2.5 align-top text-[10px] leading-4 text-foreground last:border-r-0 sm:px-4 sm:text-[11px]"
                        >
                          {row.values[header]}
                        </td>
                      ))}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>

            {!filteredRows.length && (
              <div className="border-t border-border/70 px-4 py-10 text-center">
                <Search className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try changing your search.
                </p>
              </div>
            )}

            <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {filteredRows.length}
              </span>{" "}
              guideline rows
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
