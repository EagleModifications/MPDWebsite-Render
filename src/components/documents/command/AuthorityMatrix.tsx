import {
  Check,
  ChevronDown,
  Filter,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type RankGroup =
  | "officers"
  | "supervisors"
  | "low-command"
  | "trial-high-command"

type Section = "PRIMARY RESPONSIBILITY" | "AUTHORITY"

type RankColumn = {
  id: string
  label: string
  group: RankGroup
}

type AuthorityRow = {
  section: Section
  name: string
  permissions: Record<string, boolean>
}

const rankColumns: RankColumn[] = [
  {
    id: "officer",
    label: "Officer",
    group: "officers",
  },
  {
    id: "officer2",
    label: "Officer 2",
    group: "officers",
  },
  {
    id: "officer3",
    label: "Officer 3",
    group: "officers",
  },
  {
    id: "lcpl",
    label: "LCPL",
    group: "supervisors",
  },
  {
    id: "cpl",
    label: "CPL",
    group: "supervisors",
  },
  {
    id: "sgt",
    label: "SGT",
    group: "supervisors",
  },
  {
    id: "ssgt",
    label: "SSGT",
    group: "supervisors",
  },
  {
    id: "msgt",
    label: "MSGT",
    group: "supervisors",
  },
  {
    id: "2lt",
    label: "2LT",
    group: "low-command",
  },
  {
    id: "1lt",
    label: "1LT",
    group: "low-command",
  },
  {
    id: "cpt",
    label: "CPT",
    group: "low-command",
  },
  {
    id: "maj",
    label: "MAJ",
    group: "low-command",
  },
  {
    id: "ltcol",
    label: "Lieutenant Colonel",
    group: "trial-high-command",
  },
]

const groupLabels: Record<RankGroup, string> = {
  officers: "OFFICERS",
  supervisors: "SUPERVISORS",
  "low-command": "LOW COMMAND",
  "trial-high-command": "TRIAL HIGH COMMAND",
}

const groupColors: Record<RankGroup, string> = {
  officers: "bg-[#1769a8] text-white",
  supervisors: "bg-[#bd6500] text-white",
  "low-command": "bg-[#387a20] text-white",
  "trial-high-command": "bg-[#2b6e7d] text-white",
}

const groupCellColors: Record<RankGroup, string> = {
  officers: "bg-[#a9c9e5]",
  supervisors: "bg-[#f5c895]",
  "low-command": "bg-[#9bc783]",
  "trial-high-command": "bg-[#b7d4dc]",
}

const rows: AuthorityRow[] = [
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Patrol",
    permissions: {
      officer: true,
      officer2: true,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Assist Trainings",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Assist Ridealongs",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Conduct Training",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Conduct Ridealongs",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Patrol Supervision",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Supervise Training",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Department Support Ticket (In Metro)",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Review Applications",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "HC Requests",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Internal Affairs",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "LC Oversight",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Executive Authority",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": false,
      "1lt": false,
      cpt: false,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Remove Cadet from Training",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Send Officer Off Duty",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Report Issues to Low Command",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Send LCPL or CPL Off Duty",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Recruitment",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Place Subordinate on Foot Patrol",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Award FTO/FTA Badges",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Send SGT off duty",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "Hiring",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
  {
    section: "AUTHORITY",
    name: "1st Strike",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
]

const groupOrder: RankGroup[] = [
  "officers",
  "supervisors",
  "low-command",
  "trial-high-command",
]

const allGroups = [...groupOrder]

export default function AuthorityMatrix() {
  const [search, setSearch] = useState("")

  const [sectionFilters, setSectionFilters] =
    useState<Section[]>([
      "PRIMARY RESPONSIBILITY",
      "AUTHORITY",
    ])

  const [groupFilters, setGroupFilters] =
    useState<RankGroup[]>(allGroups)

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query)

      const matchesSection =
        sectionFilters.includes(row.section)

      return matchesSearch && matchesSection
    })
  }, [search, sectionFilters])

  const visibleColumns = useMemo(
    () =>
      rankColumns.filter((column) =>
        groupFilters.includes(column.group),
      ),
    [groupFilters],
  )

  const filtersAreDefault =
    sectionFilters.length === 2 &&
    groupFilters.length === allGroups.length

  const hasActiveFilters =
    search.trim().length > 0 ||
    !filtersAreDefault

  const toggleSection = (section: Section) => {
    setSectionFilters((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    )
  }

  const toggleGroup = (group: RankGroup) => {
    setGroupFilters((current) =>
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group],
    )
  }

  const clearFilters = () => {
    setSearch("")
    setSectionFilters([])
    setGroupFilters([])
  }

  const resetFilters = () => {
    setSearch("")
    setSectionFilters([
      "PRIMARY RESPONSIBILITY",
      "AUTHORITY",
    ])
    setGroupFilters(allGroups)
  }

  const visibleSections = (
    [
      "PRIMARY RESPONSIBILITY",
      "AUTHORITY",
    ] as Section[]
  ).filter((section) =>
    filteredRows.some(
      (row) => row.section === section,
    ),
  )

  return (
    <div className="w-full min-w-0">
      {/* Filters */}

      <div className="border-b bg-card/95 px-4 py-4 backdrop-blur sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {/* Search */}

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search responsibility or authority..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Clear Search */}

          {search.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearch("")}
              className="h-7 shrink-0 gap-1.5 px-2 text-sm font-medium hover:bg-transparent hover:text-blue-400"
            >
              <X className="h-4 w-4" />
              Clear Search
            </Button>
          )}

          {/* Filters */}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 xl:min-w-[150px]"
              >
                <Filter className="h-4 w-4 text-blue-400" />

                <span>Filters</span>

                {hasActiveFilters && (
                  <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                    {sectionFilters.length +
                      groupFilters.length}
                  </span>
                )}

                <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-64"
            >
              <DropdownMenuLabel>
                Sections
              </DropdownMenuLabel>

              <DropdownMenuCheckboxItem
                checked={sectionFilters.includes(
                  "PRIMARY RESPONSIBILITY",
                )}
                onCheckedChange={() =>
                  toggleSection(
                    "PRIMARY RESPONSIBILITY",
                  )
                }
              >
                Primary Responsibility
              </DropdownMenuCheckboxItem>

              <DropdownMenuCheckboxItem
                checked={sectionFilters.includes(
                  "AUTHORITY",
                )}
                onCheckedChange={() =>
                  toggleSection("AUTHORITY")
                }
              >
                Authority
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              <DropdownMenuLabel>
                Rank Groups
              </DropdownMenuLabel>

              {groupOrder.map((group) => (
                <DropdownMenuCheckboxItem
                  key={group}
                  checked={groupFilters.includes(group)}
                  onCheckedChange={() =>
                    toggleGroup(group)
                  }
                >
                  {groupLabels[group]}
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator />

              <div className="flex items-center justify-between px-2 py-1">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-blue-400"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-blue-400"
                >
                  Reset
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Filters */}

        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Active filters:
            </div>

            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
              >
                Search: {search}
                <X className="h-3 w-3" />
              </button>
            )}

            {sectionFilters.length === 1 && (
              <button
                type="button"
                onClick={() =>
                  toggleSection(
                    sectionFilters[0],
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
              >
                {sectionFilters[0] ===
                "PRIMARY RESPONSIBILITY"
                  ? "Primary Responsibility"
                  : "Authority"}
                <X className="h-3 w-3" />
              </button>
            )}

            {groupFilters.length < allGroups.length &&
              groupFilters.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                >
                  {groupLabels[group]}
                  <X className="h-3 w-3" />
                </button>
              ))}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-7 items-center justify-center gap-1.5 border-0 bg-transparent px-2 text-sm font-medium text-foreground shadow-none hover:bg-transparent hover:text-blue-400"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </Button>

              <Button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-7 items-center justify-center gap-1.5 border-0 bg-transparent px-2 text-sm font-medium text-foreground shadow-none hover:bg-transparent hover:text-blue-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Matrix */}

      <div className="w-full overflow-x-auto">
        {filteredRows.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 px-6 text-center">
            <Search className="h-8 w-8 text-muted-foreground" />

            <p className="font-medium">
              No authority matrix entries found
            </p>

            <p className="text-sm text-muted-foreground">
              Try changing or clearing your search or filters.
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="mt-2"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <table className="w-full min-w-[1500px] border-collapse text-xs">
            <thead>
              {/* Group headers */}

              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-40 w-[210px] min-w-[210px] border border-border bg-card px-4 py-3 text-left font-bold text-foreground"
                >
                  RESPONSIBILITY /
                  <br />
                  AUTHORITY
                </th>

                {groupOrder.map((group) => {
                  const columns = visibleColumns.filter(
                    (column) =>
                      column.group === group,
                  )

                  if (!columns.length) {
                    return null
                  }

                  return (
                    <th
                      key={group}
                      colSpan={columns.length}
                      className={`border border-border px-3 py-3 text-center text-[11px] font-extrabold tracking-wide ${groupColors[group]}`}
                    >
                      {groupLabels[group]}
                    </th>
                  )
                })}
              </tr>

              {/* Rank headers */}

              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.id}
                    className={`min-w-[105px] border border-border px-2 py-3 text-center text-[11px] font-bold text-slate-900 ${groupCellColors[column.group]}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleSections.map((section) => {
                const sectionRows = filteredRows.filter(
                  (row) => row.section === section,
                )

                return (
                  <tbody
                    key={section}
                    className="contents"
                  >
                    {/* Section separator */}

                    {section === "AUTHORITY" && (
                      <tr>
                        <td
                          colSpan={
                            visibleColumns.length + 1
                          }
                          className="border-x border-b border-border bg-background p-0"
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="h-px flex-1 bg-border" />

                            <span className="text-[11px] font-bold tracking-wider text-muted-foreground">
                              AUTHORITY
                            </span>

                            <div className="h-px flex-1 bg-border" />
                          </div>
                        </td>
                      </tr>
                    )}

                    {sectionRows.map((row, rowIndex) => (
                      <tr
                        key={`${section}-${row.name}`}
                        className="group"
                      >
                        {rowIndex === 0 && (
                          <th
                            rowSpan={sectionRows.length}
                            className="sticky left-0 z-30 w-[210px] min-w-[210px] border border-border bg-muted/30 px-4 py-3 text-left align-top text-[10px] font-extrabold tracking-wide text-muted-foreground"
                          >
                            {section}
                          </th>
                        )}

                        <td className="w-[175px] min-w-[175px] border border-border bg-card px-3 py-3 font-medium text-foreground">
                          {row.name}
                        </td>

                        {visibleColumns.map((column) => {
                          const allowed =
                            row.permissions[column.id] ??
                            false

                          return (
                            <td
                              key={column.id}
                              className={`border border-border p-2 text-center ${groupCellColors[column.group]}`}
                            >
                              <span
                                aria-label={
                                  allowed
                                    ? "Allowed"
                                    : "Not allowed"
                                }
                                className={[
                                  "mx-auto flex h-6 w-6 items-center justify-center border",
                                  allowed
                                    ? "border-black bg-black text-white"
                                    : "border-slate-500 bg-white/70",
                                ].join(" ")}
                              >
                                {allowed && (
                                  <Check className="h-4 w-4 stroke-[3]" />
                                )}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
