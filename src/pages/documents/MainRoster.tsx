import {
  ChevronDown,
  ClipboardList,
  Filter,
  Search,
  Shield,
  UserRound,
  Users,
  Car,
  Shirt,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type MainRosterPage =
  | "department"
  | "employees"
  | "vehicles"
  | "uniforms"

type MainRosterMember = {
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  division: string
  discordId: string
  timeInDept: string
  timeInRank: string
  status: string
}

type Vehicle = {
  vehicle: string
  model: string
  plate: string
  callsign: string
  division: string
  assignedTo: string
  status: string
}

type Uniform = {
  name: string
  rank: string
  division: string
  uniform: string
  status: string
}

type GenericRecord = Record<string, unknown>

const pages: {
  id: MainRosterPage
  label: string
  icon: typeof Shield
}[] = [
  {
    id: "department",
    label: "Department Roster",
    icon: Shield,
  },
  {
    id: "employees",
    label: "Employee Database",
    icon: Users,
  },
  {
    id: "vehicles",
    label: "Vehicle Roster",
    icon: Car,
  },
  {
    id: "uniforms",
    label: "Uniform Roster",
    icon: Shirt,
  },
]

const cleanValue = (value: unknown): string => {
  if (
    value === null ||
    value === undefined
  ) {
    return ""
  }

  const cleaned = String(value).trim()

  if (
    !cleaned ||
    cleaned === "-" ||
    cleaned === "—" ||
    cleaned === "#N/A" ||
    cleaned.toLowerCase() === "n/a" ||
    cleaned.toLowerCase() === "null" ||
    cleaned.toLowerCase() === "undefined"
  ) {
    return ""
  }

  return cleaned
}

const normalizeValue = (value: unknown): string =>
  cleanValue(value)
    .replace(/\s+/g, " ")
    .toLowerCase()

const getStatusClasses = (status: string) => {
  const normalized = normalizeValue(status)

  if (
    normalized === "active" ||
    normalized === "available" ||
    normalized === "assigned" ||
    normalized === "issued"
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
  }

  if (
    normalized === "inactive" ||
    normalized === "unavailable" ||
    normalized === "retired" ||
    normalized === "returned"
  ) {
    return "border-red-500/20 bg-red-500/10 text-red-400"
  }

  return "border-blue-500/20 bg-blue-500/10 text-blue-400"
}

const getPageTitle = (
  page: MainRosterPage,
) => {
  switch (page) {
    case "department":
      return "Department Roster"

    case "employees":
      return "Employee Database"

    case "vehicles":
      return "Vehicle Roster"

    case "uniforms":
      return "Uniform Roster"
  }
}

const getPageDescription = (
  page: MainRosterPage,
) => {
  switch (page) {
    case "department":
      return "View the current Metro Police Department roster."

    case "employees":
      return "View employee information and department records."

    case "vehicles":
      return "View Metro Police Department vehicles and assignments."

    case "uniforms":
      return "View uniform assignments and department uniform records."
  }
}

const getPageIcon = (
  page: MainRosterPage,
) => {
  switch (page) {
    case "department":
      return Shield

    case "employees":
      return Users

    case "vehicles":
      return Car

    case "uniforms":
      return Shirt
  }
}

const compareText = (
  a: string,
  b: string,
) =>
  cleanValue(a).localeCompare(
    cleanValue(b),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  )

export default function MainRoster() {
  const [page, setPage] =
    useState<MainRosterPage>("department")

  const [members, setMembers] =
    useState<MainRosterMember[]>([])

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([])

  const [uniforms, setUniforms] =
    useState<Uniform[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState("")

  const [divisionFilters, setDivisionFilters] =
    useState<string[]>([])

  const [rankFilters, setRankFilters] =
    useState<string[]>([])

  const [statusFilters, setStatusFilters] =
    useState<string[]>([])

  const loadPage = useCallback(
    async (
      selectedPage: MainRosterPage,
      showLoading = true,
    ) => {
      try {
        if (showLoading) {
          setLoading(true)
        }

        setError(null)

        let endpoint = ""

        switch (selectedPage) {
          case "department":
            endpoint = "/api/main-roster/department"
            break

          case "employees":
            endpoint = "/api/main-roster/employees"
            break

          case "vehicles":
            endpoint = "/api/main-roster/vehicles"
            break

          case "uniforms":
            endpoint = "/api/main-roster/uniforms"
            break
        }

        const response = await fetch(
          endpoint,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Failed to load ${getPageTitle(
              selectedPage,
            )} (${response.status})`,
          )
        }

        const data =
          await response.json()

        if (!data?.success) {
          throw new Error(
            data?.error ||
              `Failed to load ${getPageTitle(
                selectedPage,
              )}.`,
          )
        }

        if (
          selectedPage ===
          "department"
        ) {
          const nextMembers: MainRosterMember[] =
            Array.isArray(data.members)
              ? data.members
                  .map(
                    (
                      member: GenericRecord,
                    ) => ({
                      callsign:
                        cleanValue(
                          member.callsign,
                        ),
                      badgeNumber:
                        cleanValue(
                          member.badgeNumber,
                        ),
                      name:
                        cleanValue(
                          member.name,
                        ),
                      rank:
                        cleanValue(
                          member.rank,
                        ),
                      division:
                        cleanValue(
                          member.division,
                        ),
                      discordId:
                        cleanValue(
                          member.discordId,
                        ),
                      timeInDept:
                        cleanValue(
                          member.timeInDept,
                        ),
                      timeInRank:
                        cleanValue(
                          member.timeInRank,
                        ),
                      status:
                        cleanValue(
                          member.status,
                        ) || "Active",
                    }),
                  )
                  .filter(
                    (
                      member,
                    ) =>
                      member.name ||
                      member.callsign ||
                      member.badgeNumber,
                  )
              : []

          setMembers(nextMembers)
        }

        if (
          selectedPage ===
          "employees"
        ) {
          const nextMembers: MainRosterMember[] =
            Array.isArray(data.members)
              ? data.members
                  .map(
                    (
                      member: GenericRecord,
                    ) => ({
                      callsign:
                        cleanValue(
                          member.callsign,
                        ),
                      badgeNumber:
                        cleanValue(
                          member.badgeNumber,
                        ),
                      name:
                        cleanValue(
                          member.name,
                        ),
                      rank:
                        cleanValue(
                          member.rank,
                        ),
                      division:
                        cleanValue(
                          member.division,
                        ),
                      discordId:
                        cleanValue(
                          member.discordId,
                        ),
                      timeInDept:
                        cleanValue(
                          member.timeInDept,
                        ),
                      timeInRank:
                        cleanValue(
                          member.timeInRank,
                        ),
                      status:
                        cleanValue(
                          member.status,
                        ) || "Active",
                    }),
                  )
                  .filter(
                    (
                      member,
                    ) =>
                      member.name ||
                      member.callsign ||
                      member.badgeNumber,
                  )
              : []

          setMembers(nextMembers)
        }

        if (
          selectedPage ===
          "vehicles"
        ) {
          const nextVehicles: Vehicle[] =
            Array.isArray(data.vehicles)
              ? data.vehicles.map(
                  (
                    vehicle: GenericRecord,
                  ) => ({
                    vehicle:
                      cleanValue(
                        vehicle.vehicle,
                      ),
                    model:
                      cleanValue(
                        vehicle.model,
                      ),
                    plate:
                      cleanValue(
                        vehicle.plate,
                      ),
                    callsign:
                      cleanValue(
                        vehicle.callsign,
                      ),
                    division:
                      cleanValue(
                        vehicle.division,
                      ),
                    assignedTo:
                      cleanValue(
                        vehicle.assignedTo,
                      ),
                    status:
                      cleanValue(
                        vehicle.status,
                      ) || "Available",
                  }),
                )
              : []

          setVehicles(nextVehicles)
        }

        if (
          selectedPage ===
          "uniforms"
        ) {
          const nextUniforms: Uniform[] =
            Array.isArray(data.uniforms)
              ? data.uniforms.map(
                  (
                    uniform: GenericRecord,
                  ) => ({
                    name:
                      cleanValue(
                        uniform.name,
                      ),
                    rank:
                      cleanValue(
                        uniform.rank,
                      ),
                    division:
                      cleanValue(
                        uniform.division,
                      ),
                    uniform:
                      cleanValue(
                        uniform.uniform,
                      ),
                    status:
                      cleanValue(
                        uniform.status,
                      ) || "Issued",
                  }),
                )
              : []

          setUniforms(nextUniforms)
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to load ${getPageTitle(
                selectedPage,
              )}.`

        setError(message)

        toast.error(
          "Failed to load roster",
          {
            description: message,
          },
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    setSearch("")
    setDivisionFilters([])
    setRankFilters([])
    setStatusFilters([])

    void loadPage(page)
  }, [page, loadPage])

  /*
   * Automatically refresh the currently
   * selected page every 30 minutes.
   *
   * The actual Google Sheets sync happens
   * server-side, so there is deliberately
   * NO refresh button on this page.
   */
  useEffect(() => {
    const interval = window.setInterval(
      () => {
        void loadPage(
          page,
          false,
        )
      },
      30 * 60 * 1000,
    )

    return () => {
      window.clearInterval(
        interval,
      )
    }
  }, [page, loadPage])

  const currentDataCount =
    page === "department" ||
    page === "employees"
      ? members.length
      : page === "vehicles"
        ? vehicles.length
        : uniforms.length

  const divisionOptions = useMemo(() => {
    if (
      page !== "department" &&
      page !== "employees"
    ) {
      return []
    }

    const values = new Set<string>()

    for (const member of members) {
      if (member.division) {
        values.add(member.division)
      }
    }

    return Array.from(values).sort(
      compareText,
    )
  }, [members, page])

  const rankOptions = useMemo(() => {
    if (
      page !== "department" &&
      page !== "employees"
    ) {
      return []
    }

    const values = new Set<string>()

    for (const member of members) {
      if (member.rank) {
        values.add(member.rank)
      }
    }

    return Array.from(values).sort(
      compareText,
    )
  }, [members, page])

  const statusOptions = useMemo(() => {
    if (
      page !== "department" &&
      page !== "employees"
    ) {
      return []
    }

    const values = new Set<string>()

    for (const member of members) {
      if (member.status) {
        values.add(member.status)
      }
    }

    return Array.from(values).sort(
      compareText,
    )
  }, [members, page])

  const filteredMembers = useMemo(() => {
    if (
      page !== "department" &&
      page !== "employees"
    ) {
      return []
    }

    const query =
      search.trim().toLowerCase()

    return [...members]
      .sort((a, b) =>
        compareText(
          a.callsign,
          b.callsign,
        ),
      )
      .filter((member) => {
        const matchesSearch =
          !query ||
          [
            member.callsign,
            member.badgeNumber,
            member.name,
            member.rank,
            member.division,
            member.discordId,
            member.timeInDept,
            member.timeInRank,
          ].some((value) =>
            cleanValue(value)
              .toLowerCase()
              .includes(query),
          )

        const matchesDivision =
          divisionFilters.length ===
            0 ||
          divisionFilters.some(
            (division) =>
              normalizeValue(
                division,
              ) ===
              normalizeValue(
                member.division,
              ),
          )

        const matchesRank =
          rankFilters.length === 0 ||
          rankFilters.some(
            (rank) =>
              normalizeValue(
                rank,
              ) ===
              normalizeValue(
                member.rank,
              ),
          )

        const matchesStatus =
          statusFilters.length === 0 ||
          statusFilters.some(
            (status) =>
              normalizeValue(
                status,
              ) ===
              normalizeValue(
                member.status,
              ),
          )

        return (
          matchesSearch &&
          matchesDivision &&
          matchesRank &&
          matchesStatus
        )
      })
  }, [
    members,
    page,
    search,
    divisionFilters,
    rankFilters,
    statusFilters,
  ])

  const filteredVehicles = useMemo(
    () =>
      [...vehicles]
        .sort((a, b) =>
          compareText(
            a.callsign,
            b.callsign,
          ),
        ),
    [vehicles],
  )

  const filteredUniforms = useMemo(
    () =>
      [...uniforms].sort((a, b) =>
        compareText(
          a.name,
          b.name,
        ),
      ),
    [uniforms],
  )

  const hasFilters =
    Boolean(search.trim()) ||
    divisionFilters.length > 0 ||
    rankFilters.length > 0 ||
    statusFilters.length > 0

  const clearFilters = () => {
    setSearch("")
    setDivisionFilters([])
    setRankFilters([])
    setStatusFilters([])
  }

  const toggleFilter = (
    value: string,
    setter: React.Dispatch<
      React.SetStateAction<string[]>
    >,
  ) => {
    setter((current) =>
      current.some(
        (item) =>
          normalizeValue(item) ===
          normalizeValue(value),
      )
        ? current.filter(
            (item) =>
              normalizeValue(item) !==
              normalizeValue(value),
          )
        : [...current, value],
    )
  }

  const copyDiscord = async (
    discordId: string,
    name: string,
  ) => {
    if (!discordId) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        discordId,
      )

      toast.success(
        "Discord ID copied",
        {
          description: `${name}'s Discord ID has been copied to your clipboard.`,
        },
      )
    } catch {
      toast.error(
        "Copy failed",
        {
          description:
            "Your browser could not access the clipboard.",
        },
      )
    }
  }

  const PageIcon = getPageIcon(page)

  return (
    <DashboardLayout>
      <div className="flex min-h-full min-w-0 flex-col gap-4 overflow-x-hidden p-3 sm:gap-6 sm:p-6">
        {/* HEADER */}

        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <PageIcon className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {getPageTitle(page)}
              </h1>

              <p className="text-sm text-muted-foreground">
                {getPageDescription(page)}
              </p>
            </div>
          </div>

          {/* MAIN ROSTER TABS */}

          <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-full items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 sm:min-w-0">
              {pages.map((item) => {
                const active =
                  page === item.id

                const Icon =
                  item.icon

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (
                        page === item.id
                      ) {
                        return
                      }

                      setPage(item.id)
                    }}
                    className={
                      active
                        ? "flex shrink-0 items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 shadow-sm transition-colors sm:px-4 sm:text-sm"
                        : "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-4 sm:text-sm"
                    }
                  >
                    <Icon className="h-4 w-4" />

                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* STATS */}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total
              </p>

              <Users className="h-4 w-4 text-blue-500" />
            </div>

            <p className="mt-2 text-2xl font-semibold">
              {currentDataCount}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page
              </p>

              <PageIcon className="h-4 w-4 text-blue-500" />
            </div>

            <p className="mt-2 truncate text-lg font-semibold">
              {getPageTitle(page)}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Data Source
              </p>

              <ClipboardList className="h-4 w-4 text-blue-500" />
            </div>

            <p className="mt-2 text-sm font-semibold">
              Google Sheets
            </p>
          </div>

          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sync
              </p>

              <Shield className="h-4 w-4 text-blue-500" />
            </div>

            <p className="mt-2 text-sm font-semibold">
              Automatic
            </p>
          </div>
        </div>

        {/* SEARCH + FILTERS
            ONLY ROSTER / EMPLOYEE DATABASE */}

        {(page === "department" ||
          page === "employees") && (
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
              {/* SEARCH */}

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
                  placeholder="Search name, callsign, badge, rank, division or Discord ID..."
                  className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* DIVISION */}

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
                      Division
                    </span>

                    {divisionFilters.length >
                      0 && (
                      <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                        {
                          divisionFilters.length
                        }
                      </span>
                    )}

                    <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="max-h-80 w-64 overflow-y-auto"
                >
                  {divisionOptions.length ===
                  0 ? (
                    <DropdownMenuItem disabled>
                      No divisions available
                    </DropdownMenuItem>
                  ) : (
                    divisionOptions.map(
                      (division) => {
                        const checked =
                          divisionFilters.some(
                            (item) =>
                              normalizeValue(
                                item,
                              ) ===
                              normalizeValue(
                                division,
                              ),
                          )

                        return (
                          <DropdownMenuItem
                            key={division}
                            onSelect={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              toggleFilter(
                                division,
                                setDivisionFilters,
                              )
                            }
                            className="gap-2"
                          >
                            <Checkbox
                              checked={
                                checked
                              }
                              tabIndex={-1}
                              className="pointer-events-none"
                            />

                            <Shield className="h-4 w-4 text-blue-400" />

                            <span className="truncate">
                              {division}
                            </span>
                          </DropdownMenuItem>
                        )
                      },
                    )
                  )}

                  {divisionFilters.length >
                    0 && (
                    <>
                      <div className="my-1 h-px bg-border" />

                      <DropdownMenuItem
                        onClick={() =>
                          setDivisionFilters(
                            [],
                          )
                        }
                        className="gap-2 text-muted-foreground"
                      >
                        <X className="h-4 w-4" />

                        Clear Divisions
                      </DropdownMenuItem>
                    </>
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
                    className="gap-2 xl:min-w-[170px]"
                  >
                    <Shield className="h-4 w-4 text-blue-400" />

                    <span>Rank</span>

                    {rankFilters.length >
                      0 && (
                      <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                        {
                          rankFilters.length
                        }
                      </span>
                    )}

                    <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="max-h-80 w-64 overflow-y-auto"
                >
                  {rankOptions.length ===
                  0 ? (
                    <DropdownMenuItem disabled>
                      No ranks available
                    </DropdownMenuItem>
                  ) : (
                    rankOptions.map(
                      (rank) => {
                        const checked =
                          rankFilters.some(
                            (item) =>
                              normalizeValue(
                                item,
                              ) ===
                              normalizeValue(
                                rank,
                              ),
                          )

                        return (
                          <DropdownMenuItem
                            key={rank}
                            onSelect={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              toggleFilter(
                                rank,
                                setRankFilters,
                              )
                            }
                            className="gap-2"
                          >
                            <Checkbox
                              checked={
                                checked
                              }
                              tabIndex={-1}
                              className="pointer-events-none"
                            />

                            <Shield className="h-4 w-4 text-blue-400" />

                            <span className="truncate">
                              {rank}
                            </span>
                          </DropdownMenuItem>
                        )
                      },
                    )
                  )}

                  {rankFilters.length >
                    0 && (
                    <>
                      <div className="my-1 h-px bg-border" />

                      <DropdownMenuItem
                        onClick={() =>
                          setRankFilters([])
                        }
                        className="gap-2 text-muted-foreground"
                      >
                        <X className="h-4 w-4" />

                        Clear Ranks
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* STATUS */}

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

                    <span>Status</span>

                    {statusFilters.length >
                      0 && (
                      <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                        {
                          statusFilters.length
                        }
                      </span>
                    )}

                    <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="max-h-80 w-64 overflow-y-auto"
                >
                  {statusOptions.length ===
                  0 ? (
                    <DropdownMenuItem disabled>
                      No statuses available
                    </DropdownMenuItem>
                  ) : (
                    statusOptions.map(
                      (status) => {
                        const checked =
                          statusFilters.some(
                            (item) =>
                              normalizeValue(
                                item,
                              ) ===
                              normalizeValue(
                                status,
                              ),
                          )

                        return (
                          <DropdownMenuItem
                            key={status}
                            onSelect={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              toggleFilter(
                                status,
                                setStatusFilters,
                              )
                            }
                            className="gap-2"
                          >
                            <Checkbox
                              checked={
                                checked
                              }
                              tabIndex={-1}
                              className="pointer-events-none"
                            />

                            <span className="truncate">
                              {status}
                            </span>
                          </DropdownMenuItem>
                        )
                      },
                    )
                  )}

                  {statusFilters.length >
                    0 && (
                    <>
                      <div className="my-1 h-px bg-border" />

                      <DropdownMenuItem
                        onClick={() =>
                          setStatusFilters(
                            [],
                          )
                        }
                        className="gap-2 text-muted-foreground"
                      >
                        <X className="h-4 w-4" />

                        Clear Statuses
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={
                    clearFilters
                  }
                  className="gap-2"
                >
                  <X className="h-4 w-4" />

                  Clear
                </Button>
              )}
            </div>

            {/* ACTIVE FILTERS */}

            {(divisionFilters.length >
              0 ||
              rankFilters.length > 0 ||
              statusFilters.length >
                0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />

                  Active filters:
                </div>

                {divisionFilters.map(
                  (value) => (
                    <button
                      key={`division-${value}`}
                      type="button"
                      onClick={() =>
                        toggleFilter(
                          value,
                          setDivisionFilters,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      {value}

                      <X className="h-3 w-3" />
                    </button>
                  ),
                )}

                {rankFilters.map(
                  (value) => (
                    <button
                      key={`rank-${value}`}
                      type="button"
                      onClick={() =>
                        toggleFilter(
                          value,
                          setRankFilters,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      {value}

                      <X className="h-3 w-3" />
                    </button>
                  ),
                )}

                {statusFilters.map(
                  (value) => (
                    <button
                      key={`status-${value}`}
                      type="button"
                      onClick={() =>
                        toggleFilter(
                          value,
                          setStatusFilters,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      {value}

                      <X className="h-3 w-3" />
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* CONTENT */}

        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="min-w-0">
              <h2 className="font-medium">
                {getPageTitle(page)}
              </h2>

              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {page === "department" ||
                page === "employees"
                  ? filteredMembers.length
                  : currentDataCount}{" "}
                records
              </p>
            </div>

            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />

              Automatic sync
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />

                Loading...
              </div>
            </div>
          ) : page ===
            "department" ||
            page === "employees" ? (
            filteredMembers.length ===
            0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 px-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />

                <p className="font-medium">
                  No employees found
                </p>

                <p className="text-sm text-muted-foreground">
                  {hasFilters
                    ? "Try changing or clearing your filters."
                    : "There are no employee records available."}
                </p>

                {hasFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={
                      clearFilters
                    }
                    className="mt-2"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* DESKTOP EMPLOYEE TABLE */}

                <div className="hidden w-full overflow-x-auto md:block">
                  <table className="w-full min-w-[1050px] table-fixed text-xs">
                    <colgroup>
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[15%]" />
                      <col className="w-[14%]" />
                      <col className="w-[11%]" />
                      <col className="w-[14%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>

                    <thead>
                      <tr className="border-b bg-muted/30 text-center">
                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Callsign
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Badge
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Name
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Rank
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Division
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Discord ID
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Time in Dept
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Time in Rank
                        </th>

                        <th className="px-3 py-3 font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredMembers.map(
                        (member) => (
                          <tr
                            key={
                              member.discordId ||
                              `${member.badgeNumber}-${member.callsign}-${member.name}`
                            }
                            className="border-b last:border-0 transition-colors hover:bg-muted/20"
                          >
                            <td className="px-3 py-3 text-center font-medium">
                              {
                                member.callsign
                              }
                            </td>

                            <td className="px-3 py-3 text-center text-muted-foreground">
                              {
                                member.badgeNumber
                              }
                            </td>

                            <td className="px-3 py-3 text-center">
                              {
                                member.name
                              }
                            </td>

                            <td className="px-3 py-3 text-center text-muted-foreground">
                              {
                                member.rank
                              }
                            </td>

                            <td className="px-3 py-3 text-center text-muted-foreground">
                              {
                                member.division ||
                                "—"
                              }
                            </td>

                            <td className="px-3 py-3 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                >
                                  <button
                                    type="button"
                                    className="mx-auto block max-w-full truncate rounded-md px-2 py-1 font-mono text-[10px] text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                                  >
                                    {
                                      member.discordId
                                    }
                                  </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void copyDiscord(
                                        member.discordId,
                                        member.name,
                                      )
                                    }
                                    className="gap-2"
                                  >
                                    <ClipboardList className="h-4 w-4" />

                                    Copy User ID
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>

                            <td className="px-3 py-3 text-center text-muted-foreground">
                              {
                                member.timeInDept ||
                                "—"
                              }
                            </td>

                            <td className="px-3 py-3 text-center text-muted-foreground">
                              {
                                member.timeInRank ||
                                "—"
                              }
                            </td>

                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                                  member.status,
                                )}`}
                              >
                                {
                                  member.status
                                }
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE EMPLOYEE CARDS */}

                <div className="divide-y md:hidden">
                  {filteredMembers.map(
                    (member) => (
                      <div
                        key={
                          member.discordId ||
                          `${member.badgeNumber}-${member.callsign}-${member.name}`
                        }
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {
                                member.callsign
                              }
                            </p>

                            <p className="truncate text-sm text-muted-foreground">
                              {
                                member.name
                              }
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                              member.status,
                            )}`}
                          >
                            {
                              member.status
                            }
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-muted-foreground">
                              Badge
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                member.badgeNumber
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Rank
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                member.rank
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Division
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                member.division ||
                                "—"
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Time in Dept
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                member.timeInDept ||
                                "—"
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Time in Rank
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                member.timeInRank ||
                                "—"
                              }
                            </p>
                          </div>

                          <div className="min-w-0">
                            <p className="text-muted-foreground">
                              Discord
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                void copyDiscord(
                                  member.discordId,
                                  member.name,
                                )
                              }
                              className="mt-1 block max-w-full truncate font-mono text-[10px] text-blue-400"
                            >
                              {
                                member.discordId ||
                                "—"
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )
          ) : page === "vehicles" ? (
            filteredVehicles.length ===
            0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
                <Car className="h-8 w-8 text-muted-foreground" />

                <p className="font-medium">
                  No vehicles found
                </p>

                <p className="text-sm text-muted-foreground">
                  There are no vehicle records available.
                </p>
              </div>
            ) : (
              <>
                {/* VEHICLES DESKTOP */}

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30 text-center">
                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Vehicle
                        </th>

                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Model
                        </th>

                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Plate
                        </th>

                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Callsign
                        </th>

                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Division
                        </th>

                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Assigned To
                        </th>

                        <th className="px-4 py-3 font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredVehicles.map(
                        (
                          vehicle,
                          index,
                        ) => (
                          <tr
                            key={`${vehicle.plate}-${vehicle.callsign}-${index}`}
                            className="border-b text-center last:border-0 hover:bg-muted/20"
                          >
                            <td className="px-4 py-3 font-medium">
                              {
                                vehicle.vehicle ||
                                "—"
                              }
                            </td>

                            <td className="px-4 py-3 text-muted-foreground">
                              {
                                vehicle.model ||
                                "—"
                              }
                            </td>

                            <td className="px-4 py-3 font-mono">
                              {
                                vehicle.plate ||
                                "—"
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                vehicle.callsign ||
                                "—"
                              }
                            </td>

                            <td className="px-4 py-3 text-muted-foreground">
                              {
                                vehicle.division ||
                                "—"
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                vehicle.assignedTo ||
                                "—"
                              }
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                                  vehicle.status,
                                )}`}
                              >
                                {
                                  vehicle.status
                                }
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                {/* VEHICLES MOBILE */}

                <div className="divide-y md:hidden">
                  {filteredVehicles.map(
                    (
                      vehicle,
                      index,
                    ) => (
                      <div
                        key={`${vehicle.plate}-${vehicle.callsign}-${index}`}
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {
                                vehicle.vehicle ||
                                "Vehicle"
                              }
                            </p>

                            <p className="text-sm text-muted-foreground">
                              {
                                vehicle.model ||
                                "—"
                              }
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                              vehicle.status,
                            )}`}
                          >
                            {
                              vehicle.status
                            }
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-muted-foreground">
                              Plate
                            </p>

                            <p className="mt-1 font-mono font-medium">
                              {
                                vehicle.plate ||
                                "—"
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Callsign
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                vehicle.callsign ||
                                "—"
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Division
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                vehicle.division ||
                                "—"
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">
                              Assigned To
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                vehicle.assignedTo ||
                                "—"
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )
          ) : filteredUniforms.length ===
            0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
              <Shirt className="h-8 w-8 text-muted-foreground" />

              <p className="font-medium">
                No uniforms found
              </p>

              <p className="text-sm text-muted-foreground">
                There are no uniform records available.
              </p>
            </div>
          ) : (
            <>
              {/* UNIFORMS DESKTOP */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[750px] text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-center">
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Name
                      </th>

                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Rank
                      </th>

                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Division
                      </th>

                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Uniform
                      </th>

                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUniforms.map(
                      (
                        uniform,
                        index,
                      ) => (
                        <tr
                          key={`${uniform.name}-${uniform.uniform}-${index}`}
                          className="border-b text-center last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-3 font-medium">
                            {
                              uniform.name ||
                              "—"
                            }
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {
                              uniform.rank ||
                              "—"
                            }
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {
                              uniform.division ||
                              "—"
                            }
                          </td>

                          <td className="px-4 py-3">
                            {
                              uniform.uniform ||
                              "—"
                            }
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                                uniform.status,
                              )}`}
                            >
                              {
                                uniform.status
                              }
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* UNIFORMS MOBILE */}

              <div className="divide-y md:hidden">
                {filteredUniforms.map(
                  (
                    uniform,
                    index,
                  ) => (
                    <div
                      key={`${uniform.name}-${uniform.uniform}-${index}`}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {
                              uniform.name ||
                              "Employee"
                            }
                          </p>

                          <p className="text-sm text-muted-foreground">
                            {
                              uniform.rank ||
                              "—"
                            }
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusClasses(
                            uniform.status,
                          )}`}
                        >
                          {
                            uniform.status
                          }
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-muted-foreground">
                            Division
                          </p>

                          <p className="mt-1 font-medium">
                            {
                              uniform.division ||
                              "—"
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">
                            Uniform
                          </p>

                          <p className="mt-1 font-medium">
                            {
                              uniform.uniform ||
                              "—"
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
