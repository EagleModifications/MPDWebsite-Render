import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react"
import {
  Search,
  Shield,
  Users,
  Car,
  Shirt,
  Home,
  Database,
  Loader2,
  AlertCircle,
} from "lucide-react"

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
  icon: ComponentType<{ className?: string }>
  gid: string
  searchable?: boolean
}

/*
 * Published Google Sheets URL.
 *
 * This must be the published-to-web URL, not the normal
 * Google Sheets editing URL.
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
    searchable: true,
  },
  {
    id: "uniforms",
    label: "Uniform Roster",
    icon: Shirt,
    gid: "1693514661",
    searchable: true,
  },
]

type SheetData = {
  headers: string[]
  rows: string[][]
}

/* -------------------------------------------------------------------------- */
/* CSV parser                                                                 */
/* -------------------------------------------------------------------------- */

function parseCSV(csv: string): string[][] {
  const rows: string[][] = []

  let row: string[] = []
  let cell = ""
  let insideQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    const nextCharacter = csv[index + 1]

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        cell += '"'
        index += 1
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
        index += 1
      }

      row.push(cell)
      cell = ""

      if (
        row.length > 1 ||
        row.some((value) => value.trim() !== "")
      ) {
        rows.push(row)
      }

      row = []

      continue
    }

    cell += character
  }

  if (
    cell.length > 0 ||
    row.length > 0
  ) {
    row.push(cell)

    if (
      row.length > 1 ||
      row.some((value) => value.trim() !== "")
    ) {
      rows.push(row)
    }
  }

  return rows
}

/* -------------------------------------------------------------------------- */
/* Google Sheet URLs                                                          */
/* -------------------------------------------------------------------------- */

function getSheetCSVUrl(gid: string) {
  const publishedBase = PUBLISHED_SHEET_URL.replace(
    /\/pubhtml.*$/,
    "/pub",
  )

  const params = new URLSearchParams({
    gid,
    single: "true",
    output: "csv",
  })

  return `${publishedBase}?${params.toString()}`
}

function getSheetEmbedUrl(gid: string) {
  const params = new URLSearchParams({
    gid,
    single: "true",
    widget: "false",
    headers: "false",
    chrome: "false",
  })

  return `${PUBLISHED_SHEET_URL}?${params.toString()}`
}

/* -------------------------------------------------------------------------- */
/* Sheet loader                                                               */
/* -------------------------------------------------------------------------- */

function useGoogleSheet(gid: string, enabled: boolean) {
  const [data, setData] =
    useState<SheetData | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    let active = true

    async function loadSheet() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          getSheetCSVUrl(gid),
          {
            method: "GET",
            cache: "no-store",
          },
        )

        if (!response.ok) {
          throw new Error(
            `Google Sheets returned ${response.status}.`,
          )
        }

        const csv = await response.text()

        const parsed = parseCSV(csv)

        if (!parsed.length) {
          throw new Error(
            "The Google Sheet did not contain any data.",
          )
        }

        const headers = parsed[0].map(
          (header, index) =>
            header.trim() ||
            `Column ${index + 1}`,
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

            return normalized
              .slice(0, headers.length)
              .map((value) =>
                value.trim(),
              )
          })
          .filter((row) =>
            row.some(
              (value) =>
                value.trim() !== "",
            ),
          )

        if (active) {
          setData({
            headers,
            rows,
          })
        }
      } catch (loadError) {
        console.error(
          "Failed to load Google Sheet:",
          loadError,
        )

        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Google Sheet.",
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSheet()

    return () => {
      active = false
    }
  }, [gid, enabled])

  return {
    data,
    loading,
    error,
  }
}

/* -------------------------------------------------------------------------- */
/* Sheet table                                                                */
/* -------------------------------------------------------------------------- */

function SheetTable({
  data,
  search,
}: {
  data: SheetData
  search: string
}) {
  const filteredRows = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase()

    if (!query) {
      return data.rows
    }

    return data.rows.filter((row) =>
      row.some((value) =>
        value
          .toLocaleLowerCase()
          .includes(query),
      ),
    )
  }, [data.rows, search])

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* Result count */}
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:px-4">
        <span>
          {filteredRows.length.toLocaleString()}{" "}
          {filteredRows.length === 1
            ? "result"
            : "results"}
        </span>

        {search.trim() && (
          <span className="truncate">
            Searching for{" "}
            <span className="font-medium text-foreground">
              "{search.trim()}"
            </span>
          </span>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50" />

          <p className="mt-3 text-sm font-medium">
            No results found
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40">
                {data.headers.map(
                  (header, index) => (
                    <th
                      key={`${header}-${index}`}
                      className="break-words border-r border-border/60 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0 sm:px-3 sm:text-xs"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map(
                (row, rowIndex) => (
                  <tr
                    key={`row-${rowIndex}`}
                    className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/20"
                  >
                    {data.headers.map(
                      (_, columnIndex) => (
                        <td
                          key={`${rowIndex}-${columnIndex}`}
                          className="break-words border-r border-border/40 px-2 py-2.5 text-center align-middle text-xs last:border-r-0 sm:px-3 sm:text-sm"
                        >
                          {row[columnIndex] || (
                            <span className="text-muted-foreground/30">
                              —
                            </span>
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Loading state                                                               */
/* -------------------------------------------------------------------------- */

function SheetLoading() {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center rounded-xl border border-border/60 bg-card">
      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />

      <p className="mt-3 text-sm font-medium">
        Loading roster...
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        Loading data from Google Sheets.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Error state                                                                 */
/* -------------------------------------------------------------------------- */

function SheetError({
  message,
}: {
  message: string
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        Unable to load roster
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        {message}
      </p>

      <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
        Make sure the Google Sheet is published
        to the web and accessible publicly.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function MainRoster() {
  const [activeTab, setActiveTab] =
    useState<TabId>("home")

  const [search, setSearch] =
    useState("")

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  const {
    data,
    loading,
    error,
  } = useGoogleSheet(
    activeTabData.gid,
    activeTab !== "home",
  )

  function changeTab(tab: TabId) {
    setActiveTab(tab)
    setSearch("")
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {/* ---------------------------------------------------------------- */}
          {/* PAGE HEADER                                                       */}
          {/* ---------------------------------------------------------------- */}

          <div className="mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Main Roster
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  View department personnel,
                  employee, vehicle and uniform
                  roster information.
                </p>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* TABS                                                             */}
          {/* ---------------------------------------------------------------- */}

          <div className="mb-5 w-full overflow-hidden rounded-xl border border-border/60 bg-card/70 p-1">
            <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
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
                      "flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                      active
                        ? "bg-blue-500/10 text-blue-500 shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
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

          {/* ---------------------------------------------------------------- */}
          {/* CONTENT CARD                                                     */}
          {/* ---------------------------------------------------------------- */}

          <section className="w-full overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur">
            {/* Header */}
            <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border/60 bg-card/95 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <ActiveIcon className="h-4 w-4 text-blue-500" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-medium">
                    {activeTabData.label}
                  </h2>

                  <p className="truncate text-xs text-muted-foreground">
                    Google Sheets
                  </p>
                </div>
              </div>

              {activeTabData.searchable &&
                data && (
                  <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {data.rows.length.toLocaleString()}{" "}
                    records
                  </div>
                )}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* SEARCH                                                          */}
            {/* -------------------------------------------------------------- */}

            {activeTabData.searchable && (
              <div className="border-b border-border/60 bg-card p-3 sm:p-4">
                <div className="relative w-full">
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
                      activeTabData.id ===
                      "employees"
                        ? "Search employees..."
                        : activeTabData.id ===
                            "department"
                          ? "Search department roster..."
                          : activeTabData.id ===
                              "vehicles"
                            ? "Search vehicles..."
                            : "Search uniforms..."
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* HOME                                                            */}
            {/* -------------------------------------------------------------- */}

            {activeTab === "home" && (
              <div className="w-full overflow-hidden bg-background">
                <iframe
                  key={`home-${activeTabData.gid}`}
                  src={getSheetEmbedUrl(
                    activeTabData.gid,
                  )}
                  title="Metro Police Department Master Roster"
                  className="block h-[calc(100vh-180px)] min-h-[700px] w-full border-0 bg-background"
                  frameBorder="0"
                  loading="lazy"
                />
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* LOADING                                                         */}
            {/* -------------------------------------------------------------- */}

            {activeTab !== "home" &&
              loading && (
                <div className="p-4 sm:p-5">
                  <SheetLoading />
                </div>
              )}

            {/* -------------------------------------------------------------- */}
            {/* ERROR                                                           */}
            {/* -------------------------------------------------------------- */}

            {activeTab !== "home" &&
              !loading &&
              error && (
                <div className="p-4 sm:p-5">
                  <SheetError message={error} />
                </div>
              )}

            {/* -------------------------------------------------------------- */}
            {/* TABLE                                                           */}
            {/* -------------------------------------------------------------- */}

            {activeTab !== "home" &&
              !loading &&
              !error &&
              data && (
                <div className="p-3 sm:p-4">
                  <SheetTable
                    data={data}
                    search={search}
                  />
                </div>
              )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
