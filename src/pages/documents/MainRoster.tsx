import {
  Search,
  Shield,
  Users,
  Car,
  Shirt,
  Home,
  Database,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useState,
} from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

import { Button } from "@/components/ui/button"

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

/*
 * Published Google Sheets URL.
 *
 * This must be the published spreadsheet URL,
 * not the normal spreadsheet URL.
 */
const PUBLISHED_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDo_yVusgQRYUpyDhfNnkBrJXPaNXAbSYvfndxC14IcKjVp9-8wDnOCb8_AGCsgRYLNeXyWzgimNuL/pubhtml"

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

type SheetRow = string[]

/*
 * Google Sheets published CSV endpoint.
 *
 * This allows the searchable tabs to be loaded directly
 * into React instead of being trapped inside an iframe.
 */
function getCsvUrl(gid: string) {
  return `${PUBLISHED_SHEET_URL.replace(
    "/pubhtml",
    "/pub",
  )}?gid=${encodeURIComponent(
    gid,
  )}&single=true&output=csv`
}

/*
 * Small CSV parser.
 *
 * Handles:
 * - quoted values
 * - commas inside quoted values
 * - escaped quotes
 * - new lines inside quoted values
 */
function parseCsv(csv: string): SheetRow[] {
  const rows: SheetRow[] = []

  let row: string[] = []
  let value = ""
  let insideQuotes = false

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]
    const next = csv[i + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        value += '"'
        i += 1
      } else {
        insideQuotes = !insideQuotes
      }

      continue
    }

    if (char === "," && !insideQuotes) {
      row.push(value)
      value = ""
      continue
    }

    if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i += 1
      }

      row.push(value)
      value = ""

      if (
        row.some(
          (cell) => cell.trim().length > 0,
        )
      ) {
        rows.push(row)
      }

      row = []
      continue
    }

    value += char
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value)

    if (
      row.some(
        (cell) => cell.trim().length > 0,
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

  const [search, setSearch] =
    useState("")

  const [sheetRows, setSheetRows] =
    useState<SheetRow[]>([])

  const [isLoadingSheet, setIsLoadingSheet] =
    useState(false)

  const [sheetError, setSheetError] =
    useState<string | null>(null)

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  /*
   * Load CSV data only for searchable tabs.
   */
  useEffect(() => {
    if (!activeTabData.searchable) {
      setSheetRows([])
      setSheetError(null)
      setIsLoadingSheet(false)
      return
    }

    const controller =
      new AbortController()

    async function loadSheet() {
      try {
        setIsLoadingSheet(true)
        setSheetError(null)
        setSheetRows([])

        const response = await fetch(
          getCsvUrl(activeTabData.gid),
          {
            signal: controller.signal,
            cache: "no-store",
          },
        )

        if (!response.ok) {
          throw new Error(
            `Google Sheets returned ${response.status}`,
          )
        }

        const csv =
          await response.text()

        const rows = parseCsv(csv)

        if (!rows.length) {
          throw new Error(
            "The Google Sheet returned no data.",
          )
        }

        setSheetRows(rows)
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return
        }

        console.error(
          "Failed to load Google Sheet:",
          error,
        )

        setSheetError(
          "Unable to load the roster data.",
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSheet(false)
        }
      }
    }

    loadSheet()

    return () => {
      controller.abort()
    }
  }, [
    activeTabData.gid,
    activeTabData.searchable,
  ])

  /*
   * Search every column in every row.
   *
   * This means a search for:
   * - callsign
   * - badge number
   * - name
   * - rank
   * - department
   * - status
   * etc.
   *
   * will find the matching row.
   */
  const filteredRows = useMemo(() => {
    if (!activeTabData.searchable) {
      return []
    }

    const query = search
      .trim()
      .toLowerCase()

    if (!query) {
      return sheetRows
    }

    return sheetRows.filter((row) =>
      row.some((cell) =>
        cell
          .toLowerCase()
          .includes(query),
      ),
    )
  }, [
    activeTabData.searchable,
    search,
    sheetRows,
  ])

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      gid: activeTabData.gid,
      single: "true",
      widget: "false",
      headers: "false",
      chrome: "false",
    })

    return `${PUBLISHED_SHEET_URL}?${params.toString()}`
  }, [activeTabData.gid])

  function changeTab(tab: TabId) {
    setActiveTab(tab)
    setSearch("")
  }

  const headers =
    sheetRows.length > 0
      ? sheetRows[0]
      : []

  const dataRows =
    filteredRows.length > 0
      ? filteredRows.slice(1)
      : []

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-7">

          {/* PAGE HEADER */}

          <div className="mb-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>

              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500">
                  <Shield className="h-3.5 w-3.5" />
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
            </div>

            {/* TABS */}

            <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-full items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1.5 shadow-sm backdrop-blur sm:min-w-0">
                {tabs.map((tab) => {
                  const active =
                    activeTab === tab.id

                  const Icon = tab.icon

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        changeTab(tab.id)
                      }
                      className={[
                        "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                        active
                          ? "bg-blue-500/10 text-blue-500 shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />

                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* CONTENT CARD */}

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">

            {/* CARD HEADER */}

            <div className="border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <ActiveIcon className="h-4 w-4 text-blue-500" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-medium">
                    {activeTabData.label}
                  </h2>

                  <p className="truncate text-xs text-muted-foreground">
                    {activeTabData.searchable
                      ? "Live roster data"
                      : "Google Sheets"}
                  </p>
                </div>
              </div>
            </div>

            {/* SEARCH */}

            {activeTabData.searchable && (
              <div className="border-b border-border/70 bg-card p-3 sm:p-4">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder={
                      activeTabData.id ===
                      "employees"
                        ? "Search employees..."
                        : "Search roster..."
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {!isLoadingSheet &&
                  !sheetError &&
                  sheetRows.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {search.trim()
                        ? `${dataRows.length} result${
                            dataRows.length === 1
                              ? ""
                              : "s"
                          } found`
                        : `${dataRows.length} entries`}
                    </div>
                  )}
              </div>
            )}

            {/* SEARCHABLE SHEET */}

            {activeTabData.searchable ? (
              <div className="w-full bg-background">

                {isLoadingSheet && (
                  <div className="flex h-[500px] items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-blue-500" />

                      <p className="text-sm text-muted-foreground">
                        Loading roster...
                      </p>
                    </div>
                  </div>
                )}

                {!isLoadingSheet &&
                  sheetError && (
                    <div className="flex h-[500px] items-center justify-center px-6">
                      <div className="text-center">
                        <Shield className="mx-auto mb-3 h-8 w-8 text-destructive" />

                        <h3 className="font-semibold">
                          Unable to load roster
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {sheetError}
                        </p>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() =>
                            window.location.reload()
                          }
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  )}

                {!isLoadingSheet &&
                  !sheetError &&
                  sheetRows.length > 0 && (
                    <div className="max-h-[800px] w-full overflow-auto">
                      <table className="w-full min-w-max border-collapse text-sm">
                        <thead className="sticky top-0 z-10 bg-muted">
                          <tr>
                            {headers.map(
                              (
                                header,
                                index,
                              ) => (
                                <th
                                  key={`${header}-${index}`}
                                  className="whitespace-nowrap border-b border-r border-border px-4 py-3 text-left text-xs font-semibold text-foreground last:border-r-0"
                                >
                                  {header ||
                                    `Column ${
                                      index +
                                      1
                                    }`}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {dataRows.map(
                            (
                              row,
                              rowIndex,
                            ) => (
                              <tr
                                key={`row-${rowIndex}`}
                                className="transition-colors hover:bg-muted/40"
                              >
                                {headers.map(
                                  (
                                    _,
                                    columnIndex,
                                  ) => (
                                    <td
                                      key={`${rowIndex}-${columnIndex}`}
                                      className="whitespace-nowrap border-b border-r border-border px-4 py-3 text-muted-foreground last:border-r-0"
                                    >
                                      {row[
                                        columnIndex
                                      ] ?? ""}
                                    </td>
                                  ),
                                )}
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>

                      {dataRows.length ===
                        0 && (
                        <div className="flex h-40 items-center justify-center">
                          <div className="text-center">
                            <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />

                            <p className="text-sm font-medium">
                              No results found
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Try a different
                              search term.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ) : (
              /* NON-SEARCHABLE SHEETS */

              <div className="w-full overflow-hidden bg-background">
                <iframe
                  key={`${activeTabData.id}-${activeTabData.gid}`}
                  src={embedUrl}
                  title={`${activeTabData.label} Google Sheet`}
                  className="block h-[800px] w-full border-0 bg-background"
                  frameBorder="0"
                  loading="lazy"
                />
              </div>
            )}
          </section>
        </div>

        <Footer />
      </main>
    </div>
  )
}
