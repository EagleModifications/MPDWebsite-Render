import { useCallback, useEffect, useMemo, useState } from "react"
import { FileSpreadsheet, Filter, RefreshCw, Search, X } from "lucide-react"

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1WlES0v7NUSRccYvdd7EUHQgHvcdrBPJGUoKqNWbTDP8/edit?gid=0#gid=0"

const SECTION_NAMES = ["INFRACTION", "MODERATE", "SEVERE"] as const

type SectionName = (typeof SECTION_NAMES)[number]

type GvizCell = { v?: unknown; f?: unknown }
type GvizRow = { c?: Array<GvizCell | null> }
type GvizResponse = {
  table?: {
    cols?: Array<{ label?: string; id?: string }>
    rows?: GvizRow[]
  }
  status?: string
  errors?: Array<{ message?: string; detailed_message?: string }>
}

type PunishmentRow = {
  id: string
  section: SectionName | null
  values: string[]
}

type SheetData = {
  rows: PunishmentRow[]
}

const HEADERS = [
  "Category",
  "Offense / Example",
  "Offense #1",
  "Offense #2",
  "Offense #3",
  "Elevated Action",
] as const

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function key(value: unknown) {
  return clean(value).toUpperCase()
}

function rowValues(row: GvizRow | undefined) {
  return (row?.c ?? []).map((cell) => {
    if (!cell) return ""
    if (cell.f !== undefined && cell.f !== null) return clean(cell.f)
    if (cell.v !== undefined && cell.v !== null) return clean(cell.v)
    return ""
  })
}

function parseGviz(raw: string): GvizResponse {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("Google Sheets returned an invalid response.")
  }
  return JSON.parse(raw.slice(start, end + 1)) as GvizResponse
}

function getSheetId() {
  const match = SHEET_URL.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!match) throw new Error("The Punishment Guidelines Google Sheets URL is invalid.")
  return match[1]
}

function normalizeHeader(value: string) {
  return key(value)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
}

function findHeaderColumns(rows: string[][]) {
  const aliases = [
    ["CATEGORY"],
    ["OFFENSE / EXAMPLE", "OFFENSE/EXAMPLE", "OFFENSE EXAMPLE"],
    ["OFFENSE #1", "OFFENSE 1"],
    ["OFFENSE #2", "OFFENSE 2"],
    ["OFFENSE #3", "OFFENSE 3"],
    ["ELEVATED ACTION", "ELEVATED"],
  ]

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const row = rows[rowIndex].map(normalizeHeader)
    const indexes = aliases.map((variants) =>
      row.findIndex((cell) => variants.some((variant) => cell === variant)),
    )

    if (indexes.every((index) => index >= 0)) {
      return indexes
    }
  }

  // The current sheet layout places the six visible guideline columns in B:G.
  return [1, 2, 3, 4, 5, 6]
}

function sectionFromValue(value: string): SectionName | null {
  const normalized = key(value).replace(/[*:_-]/g, "").trim()
  if (normalized === "INFRACTION") return "INFRACTION"
  if (normalized === "MODERATE") return "MODERATE"
  if (normalized === "SEVERE") return "SEVERE"
  return null
}

function isFooterRow(values: string[]) {
  const joined = key(values.join(" "))
  return (
    joined.includes("THIS DOCUMENT SUPERCEDES") ||
    joined.includes("THIS DOCUMENT SUPERSEDES") ||
    joined.includes("LAST UPDATED")
  )
}

function parseSheet(response: GvizResponse): SheetData {
  const rawRows = response.table?.rows ?? []

  if (!rawRows.length) {
    throw new Error("The Punishment Guidelines sheet returned no data.")
  }

  const rows = rawRows.map(rowValues)
  const columns = findHeaderColumns(rows)

  let headerRowIndex = -1

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const visible = columns.map((column) => normalizeHeader(rows[rowIndex][column] ?? ""))

    const matchesHeader =
      visible[0] === "CATEGORY" &&
      visible[1] === "OFFENSE / EXAMPLE" &&
      visible[2] === "OFFENSE #1" &&
      visible[3] === "OFFENSE #2" &&
      visible[4] === "OFFENSE #3" &&
      visible[5] === "ELEVATED ACTION"

    if (matchesHeader) {
      headerRowIndex = rowIndex
      break
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      "Could not find the six-column Punishment Guidelines header row.",
    )
  }

  const parsed: PunishmentRow[] = []
  let currentSection: SectionName | null = null

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    if (isFooterRow(row)) continue

    const sectionCandidate = row
      .map(sectionFromValue)
      .find((value): value is SectionName => value !== null)

    if (sectionCandidate) {
      currentSection = sectionCandidate

      const visible = columns.map((column) => clean(row[column]))
      const meaningful = visible.filter(Boolean)

      if (meaningful.length <= 1) {
        parsed.push({
          id: `punishment-section-${rowIndex}`,
          section: sectionCandidate,
          values: [sectionCandidate, "", "", "", "", ""],
        })
        continue
      }
    }

    // Nothing before the first section belongs in the visible table.
    if (!currentSection) continue

    const values = columns.map((column) => clean(row[column]))

    if (!values.some(Boolean)) continue

    if (
      normalizeHeader(values[0]) === "CATEGORY" &&
      normalizeHeader(values[1]) === "OFFENSE / EXAMPLE"
    ) {
      continue
    }

    parsed.push({
      id: `punishment-${rowIndex}`,
      section: currentSection,
      values,
    })
  }

  if (!parsed.length) {
    throw new Error(
      "The Punishment Guidelines sheet contained no guideline rows after the table header.",
    )
  }

  return { rows: parsed }
}

function sectionLabel(section: SectionName) {
  switch (section) {
    case "INFRACTION":
      return "INFRACTION"
    case "MODERATE":
      return "MODERATE"
    case "SEVERE":
      return "SEVERE"
  }
}

export default function PunishmentGuidelines() {
  const [data, setData] = useState<SheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const url =
        `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq` +
        `?headers=0&tqx=out:json&cacheBust=${Date.now()}`

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Google Sheets returned HTTP ${response.status}.`)
      }

      const raw = await response.text()

      if (/<!doctype html|<html/i.test(raw)) {
        throw new Error(
          "Google Sheets returned a webpage instead of sheet data. Make sure the spreadsheet is publicly viewable.",
        )
      }

      const parsed = parseGviz(raw)

      if (parsed.errors?.length) {
        throw new Error(
          parsed.errors[0]?.detailed_message ??
            parsed.errors[0]?.message ??
            "Google Sheets returned an error.",
        )
      }

      setData(parseSheet(parsed))
    } catch (caught) {
      setData(null)
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
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    if (!data) return []
    const query = key(search)

    return data.rows.filter((row) => {
      if (!query) return true
      return key(row.values.join(" ")).includes(query)
    })
  }, [data, search])

  const clearSearch = () => setSearch("")

  return (
    <div className="w-full min-w-0">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
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
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh
            </button>
          </div>

          {!loading && !error && data && (
            <div className="mt-4 flex gap-2.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search punishment guidelines..."
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading Punishment Guidelines...
          </div>
        )}

        {!loading && error && (
          <div className="p-5">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <h3 className="text-sm font-semibold text-red-400">
                Unable to load Punishment Guidelines
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void load(true)}
                className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[23%]" />
                <col className="w-[15.75%]" />
                <col className="w-[15.75%]" />
                <col className="w-[15.75%]" />
                <col className="w-[15.75%]" />
              </colgroup>

              <thead>
                <tr className="border-y border-border/70 bg-muted/10">
                  {HEADERS.map((header) => (
                    <th
                      key={header}
                      className="border-r border-border/50 px-3 py-3 text-left text-[9px] font-bold uppercase tracking-wide text-blue-400 last:border-r-0 sm:px-4 sm:text-[10px]"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  if (row.section && row.values.slice(1).every((value) => !value)) {
                    return (
                      <tr key={row.id}>
                        <td
                          colSpan={HEADERS.length}
                          className="border-b border-blue-500/20 bg-blue-500/[0.035] px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-blue-400"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Filter className="h-3 w-3 text-blue-400" />
                            {sectionLabel(row.section)}
                          </span>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 align-top hover:bg-blue-500/[0.025]"
                    >
                      {HEADERS.map((header, index) => (
                        <td
                          key={header}
                          className="border-r border-border/40 px-3 py-2.5 text-[10px] leading-4 text-foreground last:border-r-0 sm:px-4 sm:text-[11px]"
                        >
                          {row.values[index] || ""}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredRows.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Search className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try changing your search.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
