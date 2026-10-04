import {
  Search,
  Shield,
  Users,
  Car,
  Shirt,
  Home,
  Database,
  ChevronDown,
  Filter,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  filters?: boolean
}

/*
 * IMPORTANT:
 *
 * This is the PUBLISHED Google Sheets URL.
 *
 * Do NOT use the normal spreadsheet ID here.
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
    filters: true,
  },
  {
    id: "employees",
    label: "Employee Database",
    icon: Database,
    gid: "1598052317",
    searchable: true,
    filters: true,
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

/*
 * These are currently UI filters.
 *
 * The Google Sheet itself is inside a cross-origin iframe,
 * so React cannot directly filter its rows.
 *
 * If you want these to actually filter the roster data,
 * the Department Roster and Employee Database need to be
 * loaded through your Google Sheets API/server endpoint
 * instead of an iframe.
 */
const filterOptions = [
  {
    id: "active",
    label: "Active",
  },
  {
    id: "inactive",
    label: "Inactive",
  },
]

export default function MainRoster() {
  const [activeTab, setActiveTab] =
    useState<TabId>("home")

  const [search, setSearch] =
    useState("")

  const [filters, setFilters] =
    useState<string[]>([])

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  /*
   * Google published-sheet embed.
   *
   * gid       = selected worksheet
   * single    = only selected worksheet
   * widget    = false removes Google sheet tabs
   * headers   = false removes Google row/column headers
   * chrome    = false removes Google title/footer UI
   */
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

  const hasFilters =
    Boolean(search.trim()) ||
    filters.length > 0

  const toggleFilter = (
    filter: string,
  ) => {
    setFilters((current) =>
      current.includes(filter)
        ? current.filter(
            (item) => item !== filter,
          )
        : [...current, filter],
    )
  }

  const clearFilters = () => {
    setSearch("")
    setFilters([])
  }

  const changeTab = (tab: TabId) => {
    setActiveTab(tab)
    setSearch("")
    setFilters([])
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-full min-w-0 flex-col gap-4 overflow-x-hidden p-3 sm:gap-6 sm:p-6">

        {/* PAGE HEADER */}
        <div className="flex shrink-0 flex-col gap-4">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Main Roster
              </h1>

              <p className="text-sm text-muted-foreground">
                View department personnel, employee,
                vehicle and uniform roster information.
              </p>

            </div>
          </div>

          {/* TABS */}
          <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            <div className="inline-flex min-w-full items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 sm:min-w-0">

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
                    className={
                      active
                        ? "inline-flex shrink-0 items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 shadow-sm transition-colors sm:px-4 sm:text-sm"
                        : "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-4 sm:text-sm"
                    }
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
        <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">

          {/* CARD HEADER */}
          <div className="border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-5">

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
          </div>

          {/* SEARCH / FILTERS */}
          {(activeTabData.searchable ||
            activeTabData.filters) && (
            <div className="border-b border-border/60 bg-card p-3 sm:p-4">

              <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">

                {/* SEARCH */}
                {activeTabData.searchable && (
                  <div className="relative min-w-0 flex-1">

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
                      className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />

                  </div>
                )}

                {/* FILTER */}
                {activeTabData.filters && (
                  <DropdownMenu>

                    <DropdownMenuTrigger
                      asChild
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 xl:min-w-[170px]"
                      >

                        <Filter className="h-4 w-4 text-blue-400" />

                        <span>
                          Filters
                        </span>

                        {filters.length > 0 && (
                          <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                            {filters.length}
                          </span>
                        )}

                        <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />

                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      className="w-56"
                    >

                      <DropdownMenuItem
                        onSelect={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => {
                          const allSelected =
                            filters.length ===
                            filterOptions.length

                          if (allSelected) {
                            setFilters([])
                          } else {
                            setFilters(
                              filterOptions.map(
                                (filter) =>
                                  filter.id,
                              ),
                            )
                          }
                        }}
                        className="gap-2"
                      >

                        <Checkbox
                          checked={
                            filters.length ===
                            filterOptions.length
                          }
                          tabIndex={-1}
                          className="pointer-events-none"
                        />

                        <Filter className="h-4 w-4 text-blue-400" />

                        <span className="font-medium">
                          All Filters
                        </span>

                      </DropdownMenuItem>

                      <div className="my-1 h-px bg-border" />

                      {filterOptions.map(
                        (filter) => {
                          const checked =
                            filters.includes(
                              filter.id,
                            )

                          return (
                            <DropdownMenuItem
                              key={filter.id}
                              onSelect={(event) =>
                                event.preventDefault()
                              }
                              onClick={() =>
                                toggleFilter(
                                  filter.id,
                                )
                              }
                              className="gap-2"
                            >

                              <Checkbox
                                checked={checked}
                                tabIndex={-1}
                                className="pointer-events-none"
                              />

                              <span>
                                {filter.label}
                              </span>

                            </DropdownMenuItem>
                          )
                        },
                      )}

                      {filters.length > 0 && (
                        <>
                          <div className="my-1 h-px bg-border" />

                          <DropdownMenuItem
                            onClick={
                              clearFilters
                            }
                            className="gap-2 text-muted-foreground"
                          >

                            <X className="h-4 w-4" />

                            Clear Filters

                          </DropdownMenuItem>
                        </>
                      )}

                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* CLEAR */}
                {hasFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-2"
                  >

                    <X className="h-4 w-4" />

                    Clear

                  </Button>
                )}

              </div>

              {/* ACTIVE FILTERS */}
              {filters.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">

                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">

                    <Filter className="h-3.5 w-3.5" />

                    Active filters:

                  </div>

                  {filters.map(
                    (filter) => {
                      const label =
                        filterOptions.find(
                          (item) =>
                            item.id ===
                            filter,
                        )?.label ?? filter

                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() =>
                            toggleFilter(
                              filter,
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                        >

                          <Filter className="h-3 w-3" />

                          {label}

                          <X className="h-3 w-3" />

                        </button>
                      )
                    },
                  )}

                </div>
              )}

            </div>
          )}

          {/* GOOGLE SHEET */}
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

        </div>
      </div>
    </DashboardLayout>
  )
}
