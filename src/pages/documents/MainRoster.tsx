import {
  AlertCircle,
  Car,
  Database,
  Home,
  Loader2,
  Search,
  Shirt,
  Shield,
  Users,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type TabId =
  | "home"
  | "department"
  | "employees"
  | "vehicles"
  | "uniforms"

type Tab = {
  id: TabId
  label: string
  icon: typeof Home
  gid: string
  searchable?: boolean
}

type SheetData = {
  headers: string[]
  rows: string[][]
}

const PUBLISHED_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDo_yVusgQRYUpyDhfNnkBrJXPaNXAbSYvfndxC14IcKjVp9-8wDnOCb8_AGCsgRYLNeXyWzgimNuL/pub"

const tabs: Tab[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    gid: "1932029060",
  },
  {
    id: "department",
    label: "Department Roster",
    icon: Users,
    gid: "1093680513",
    searchable: true,
  },
  {
    id: "employees",
    label: "Employee Database",
    icon: Database,
    gid: "1598052317",
    searchable: true,
  },
  {
    id: "vehicles",
    label: "Vehicle Roster",
    icon: Car,
    gid: "1772848021",
  },
  {
    id: "uniforms",
    label: "Uniform Roster",
    icon: Shirt,
    gid: "1693514661",
  },
]

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []

  let row: string[] = []
  let cell = ""
  let insideQuotes = false

  for (let i = 0; i < csv.length; i += 1) {
    const character = csv[i]
    const nextCharacter = csv[i + 1]

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        cell += '"'
        i += 1
      } else {
        insideQuotes = !insideQuotes
      }

      continue
    }

    if (character === "," && !insideQuotes) {
      row.push(cell)
      cell = ""
      continue
    }

    if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        i += 1
      }

      row.push(cell)
      cell = ""

      if (
        row.some(
          (value) => value.trim().length > 0,
        )
      ) {
        rows.push(row)
      }

      row = []
      continue
    }

    cell += character
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)

    if (
      row.some(
        (value) => value.trim().length > 0,
      )
    ) {
      rows.push(row)
    }
  }

  return rows
}

export default function MainRoster() {
  const [activeTab, setActiveTab] =
    useState<TabId>("home")

  const [search, setSearch] = useState("")

  const [sheetData, setSheetData] =
    useState<SheetData>({
      headers: [],
      rows: [],
    })

  const [loading, setLoading] = useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  useEffect(() => {
    let cancelled = false

    async function loadSheet() {
      setLoading(true)
      setError(null)
      setSearch("")

      try {
        const url = new URL(
          PUBLISHED_SHEET_URL,
        )

        url.searchParams.set(
          "gid",
          activeTabData.gid,
        )

        url.searchParams.set(
          "single",
          "true",
        )

        url.searchParams.set(
          "output",
          "csv",
        )

        const response = await fetch(
          url.toString(),
        )

        if (!response.ok) {
          throw new Error(
            `Google Sheets returned ${response.status}.`,
          )
        }

        const csv = await response.text()

        if (cancelled) {
          return
        }

        const parsed = parseCsv(csv)

        if (parsed.length === 0) {
          setSheetData({
            headers: [],
            rows: [],
          })

          return
        }

        const headers = parsed[0].map(
          (header) => header.trim(),
        )

        const rows = parsed
          .slice(1)
          .map((row) => {
            const normalized = [...row]

            while (
              normalized.length <
              headers.length
            ) {
              normalized.push("")
            }

            return normalized.slice(
              0,
              headers.length,
            )
          })

        setSheetData({
          headers,
          rows,
        })
      } catch (err) {
        console.error(
          "Failed to load Google Sheet:",
          err,
        )

        if (cancelled) {
          return
        }

        setSheetData({
          headers: [],
          rows: [],
        })

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the Google Sheet.",
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSheet()

    return () => {
      cancelled = true
    }
  }, [activeTabData.gid])

  const filteredRows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase()

    if (!query) {
      return sheetData.rows
    }

    return sheetData.rows.filter((row) =>
      row.some((cell) =>
        String(cell ?? "")
          .toLowerCase()
          .includes(query),
      ),
    )
  }, [search, sheetData.rows])

  function changeTab(tab: TabId) {
    setActiveTab(tab)
    setSearch("")
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="pt-20">
        <div className="mx-auto w-full max-w-[1800px] px-3 py-6 sm:px-6 lg:px-8 lg:py-8">

          {/* Header */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
              <Shield className="h-4 w-4" />
              METRO POLICE DEPARTMENT
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Main Roster
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              View department personnel,
              employee, vehicle and uniform
              roster information.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-4 w-full overflow-hidden rounded-xl border border-border/70 bg-card/70 p-1 shadow-sm">
            <div className="flex w-full flex-wrap gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active =
                  activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      changeTab(tab.id)
                    }
                    className={[
                      "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm",
                      active
                        ? "bg-blue-500/10 text-blue-500"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" />

                    <span className="truncate">
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Roster */}
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">

            {/* Section header */}
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <ActiveIcon className="h-4 w-4 text-blue-500" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    {activeTabData.label}
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Metro Police Department
                  </p>
                </div>
              </div>

              {/* Search */}
              {activeTabData.searchable && (
                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder={
                      activeTab ===
                      "employees"
                        ? "Search employees..."
                        : "Search roster..."
                    }
                    className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
            </div>

            {/* Search count */}
            {activeTabData.searchable &&
              search.trim() && (
                <div className="border-b border-border/70 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {filteredRows.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {sheetData.rows.length}
                  </span>{" "}
                  records
                </div>
              )}

            {/* Loading */}
            {loading && (
              <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />

                <p className="mt-4 text-sm font-medium">
                  Loading roster...
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Loading the latest published
                  roster data.
                </p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>

                <p className="mt-4 text-sm font-semibold">
                  Unable to load roster
                </p>

                <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                  {error}
                </p>
              </div>
            )}

            {/* Empty */}
            {!loading &&
              !error &&
              sheetData.headers.length === 0 && (
                <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
                  <Database className="h-8 w-8 text-muted-foreground" />

                  <p className="mt-4 text-sm font-medium">
                    No roster data found
                  </p>
                </div>
              )}

            {/* Table */}
            {!loading &&
              !error &&
              sheetData.headers.length > 0 && (
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed border-collapse text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        {sheetData.headers.map(
                          (header, index) => (
                            <th
                              key={`${header}-${index}`}
                              className="border-b border-r border-border/70 px-1.5 py-2 text-center align-middle font-semibold last:border-r-0 sm:px-2.5 sm:py-2.5"
                            >
                              <span className="block break-words">
                                {header ||
                                  `Column ${
                                    index + 1
                                  }`}
                              </span>
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRows.map(
                        (row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="transition-colors hover:bg-muted/30"
                          >
                            {sheetData.headers.map(
                              (_, columnIndex) => (
                                <td
                                  key={`${rowIndex}-${columnIndex}`}
                                  className="border-b border-r border-border/50 px-1.5 py-2 text-center align-middle last:border-r-0 sm:px-2.5"
                                >
                                  <span className="block break-words">
                                    {row[
                                      columnIndex
                                    ] ?? ""}
                                  </span>
                                </td>
                              ),
                            )}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>

                  {/* No search results */}
                  {filteredRows.length === 0 && (
                    <div className="px-6 py-12 text-center">
                      <Search className="mx-auto h-7 w-7 text-muted-foreground" />

                      <p className="mt-3 text-sm font-medium">
                        No results found
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Try a different search.
                      </p>
                    </div>
                  )}
                </div>
              )}
          </section>

          {/* Footer info */}
          {!loading &&
            !error &&
            sheetData.headers.length > 0 && (
              <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>
                  {filteredRows.length}{" "}
                  {filteredRows.length === 1
                    ? "record"
                    : "records"}
                </span>

                <span>
                  Data sourced from the Metro
                  Police Department roster.
                </span>
              </div>
            )}
        </div>

        <Footer />
      </main>
    </div>
  )
}
