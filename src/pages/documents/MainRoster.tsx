import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  Car,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
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

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

type MainRosterPage =
  | "home"
  | "department"
  | "employees"
  | "vehicles"
  | "uniforms"

type MainRosterDepartmentMember = {
  section: string
  callsign: string
  badgeNumber: string
  name: string
  insignia: string
  rank: string
  jobDescription: string
  timeInDept: string
  timeInRank: string
  status: string
  strike1: boolean
  strike2: boolean
  discordId: string
  hoursThisMonth: string
}

type MainRosterEmployee = {
  sendMessage: string
  badgeNumber: string
  name: string
  discordId: string
  departmentStatus: string
  rank: string
  timezone: string
  joinDeptDate: string
  promoDate: string
  strike1: boolean
  strike2: boolean
  callsign: string
  timeInDept: string
  terminated: boolean
  loa: boolean
  resigned: boolean
  thisMonthHours: string
  lastMonthHours: string
}

type MainRosterVehicle = {
  rank: string
  vehicleName: string
  spawncode: string
  requiredExtras: string
  livery: string
  windowTint: string
  turbo: boolean
  slicktopOptional: boolean
  unmarkedAllowed: boolean
}

type MainRosterUniform = {
  rank: string
  className: string
  sharedOutfitCode: string
}

type MainRosterHome = {
  headers: string[]
  rows: string[][]
}

type MainRosterData = {
  type: "main"
  home: MainRosterHome
  department: MainRosterDepartmentMember[]
  employees: MainRosterEmployee[]
  vehicles: MainRosterVehicle[]
  uniforms: MainRosterUniform[]
  updatedAt: string | Date
}

type MainRosterResponse = {
  success: boolean
  roster?: MainRosterData
  error?: string
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  const valueString = String(value).trim()

  if (
    !valueString ||
    valueString === "-" ||
    valueString === "—" ||
    valueString.toLowerCase() === "null" ||
    valueString.toLowerCase() === "undefined"
  ) {
    return ""
  }

  return valueString
}

function displayValue(value: unknown): string {
  return cleanValue(value) || "—"
}

function normalize(value: unknown): string {
  return cleanValue(value).toLowerCase()
}

function formatUpdatedAt(value: string | Date | undefined): string {
  if (!value) {
    return "Unknown"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }

  return date.toLocaleString()
}

function statusClasses(status: string): string {
  const normalized = normalize(status)

  if (
    normalized === "active" ||
    normalized === "compliant" ||
    normalized === "approved" ||
    normalized === "current"
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
  }

  if (
    normalized === "terminated" ||
    normalized === "resigned" ||
    normalized === "inactive" ||
    normalized === "suspended"
  ) {
    return "border-red-500/20 bg-red-500/10 text-red-400"
  }

  if (normalized === "loa" || normalized === "leave") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-400"
  }

  return "border-border bg-muted/50 text-muted-foreground"
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalize(status)

  const Icon =
    normalized === "active" ||
    normalized === "compliant" ||
    normalized === "approved" ||
    normalized === "current"
      ? CheckCircle2
      : normalized === "terminated" ||
          normalized === "resigned" ||
          normalized === "inactive" ||
          normalized === "suspended"
        ? XCircle
        : null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {displayValue(status)}
    </span>
  )
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        value
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-muted/50 text-muted-foreground"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  )
}

const pages: {
  id: MainRosterPage
  label: string
  icon: LucideIcon
}[] = [
  { id: "home", label: "MPD Home", icon: FileSpreadsheet },
  { id: "department", label: "Department", icon: Shield },
  { id: "employees", label: "Employees", icon: Users },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "uniforms", label: "Uniforms", icon: Shirt },
]

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

export default function MainRoster() {
  const [page, setPage] = useState<MainRosterPage>("home")
  const [roster, setRoster] = useState<MainRosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [rankFilter, setRankFilter] = useState("all")

  const loadRoster = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/main-roster", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })

      const data = (await response.json().catch(() => null)) as
        | MainRosterResponse
        | null

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Failed to load Main Roster (${response.status}).`,
        )
      }

      if (!data?.success || !data.roster) {
        throw new Error(
          data?.error ||
            "Main Roster data was not returned by the server.",
        )
      }

      setRoster(data.roster)
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load Main Roster."

      setRoster(null)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  const refreshRoster = useCallback(async () => {
    if (refreshing) {
      return
    }

    setRefreshing(true)
    setError(null)

    try {
      const response = await fetch("/api/import/google/main-roster", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Roster synchronization failed (${response.status}).`,
        )
      }

      await loadRoster()

      toast.success("Master Roster refreshed", {
        description: "The latest Google Sheets data has been loaded.",
      })
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh the Master Roster."

      setError(message)

      toast.error("Refresh failed", {
        description: message,
      })
    } finally {
      setRefreshing(false)
    }
  }, [loadRoster, refreshing])

  const departmentStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          (roster?.department ?? [])
            .map((member) => cleanValue(member.status))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [roster],
  )

  const departmentRanks = useMemo(
    () =>
      Array.from(
        new Set(
          (roster?.department ?? [])
            .map((member) => cleanValue(member.rank))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [roster],
  )

  const employeeStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          (roster?.employees ?? [])
            .map((employee) => cleanValue(employee.departmentStatus))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [roster],
  )

  const employeeRanks = useMemo(
    () =>
      Array.from(
        new Set(
          (roster?.employees ?? [])
            .map((employee) => cleanValue(employee.rank))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [roster],
  )

  const department = useMemo(() => {
    const query = search.trim().toLowerCase()

    return (roster?.department ?? []).filter((member) => {
      const matchesSearch =
        !query ||
        [
          member.section,
          member.callsign,
          member.badgeNumber,
          member.name,
          member.rank,
          member.jobDescription,
          member.status,
          member.discordId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)

      const matchesStatus =
        statusFilter === "all" ||
        normalize(member.status) === normalize(statusFilter)

      const matchesRank =
        rankFilter === "all" ||
        normalize(member.rank) === normalize(rankFilter)

      return matchesSearch && matchesStatus && matchesRank
    })
  }, [roster, search, statusFilter, rankFilter])

  const employees = useMemo(() => {
    const query = search.trim().toLowerCase()

    return (roster?.employees ?? []).filter((employee) => {
      const matchesSearch =
        !query ||
        [
          employee.badgeNumber,
          employee.name,
          employee.discordId,
          employee.departmentStatus,
          employee.rank,
          employee.timezone,
          employee.callsign,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)

      const matchesStatus =
        statusFilter === "all" ||
        normalize(employee.departmentStatus) === normalize(statusFilter)

      const matchesRank =
        rankFilter === "all" ||
        normalize(employee.rank) === normalize(rankFilter)

      return matchesSearch && matchesStatus && matchesRank
    })
  }, [roster, search, statusFilter, rankFilter])

  const pageInfo = pages.find((item) => item.id === page) ?? pages[0]
  const PageIcon = pageInfo.icon
  const isFilterable = page === "department" || page === "employees"

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("all")
    setRankFilter("all")
  }

  const filteredCount =
    page === "department"
      ? department.length
      : page === "employees"
        ? employees.length
        : page === "vehicles"
          ? roster?.vehicles.length ?? 0
          : page === "uniforms"
            ? roster?.uniforms.length ?? 0
            : roster?.home.rows.length ?? 0

  const totalCount =
    page === "department"
      ? roster?.department.length ?? 0
      : page === "employees"
        ? roster?.employees.length ?? 0
        : page === "vehicles"
          ? roster?.vehicles.length ?? 0
          : page === "uniforms"
            ? roster?.uniforms.length ?? 0
            : roster?.home.rows.length ?? 0

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-500" />
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
            onClick={() => void refreshRoster()}
            disabled={refreshing || loading}
            className="gap-2 self-start lg:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((item) => {
            const Icon = item.icon
            const active = item.id === page

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPage(item.id)
                  clearFilters()
                }}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Stats */}
        {roster && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Department" value={roster.department.length} icon={Shield} />
            <StatCard label="Employees" value={roster.employees.length} icon={Users} />
            <StatCard label="Vehicles" value={roster.vehicles.length} icon={Car} />
            <StatCard label="Uniforms" value={roster.uniforms.length} icon={Shirt} />
            <StatCard label="Home Rows" value={roster.home.rows.length} icon={FileSpreadsheet} />
          </div>
        )}

        {/* Search + filters only where useful */}
        {isFilterable && !loading && !error && roster && (
          <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex flex-col gap-2 xl:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, callsign, badge, rank or Discord ID..."
                  className="h-9 pl-9"
                />
              </div>

              <FilterSelect
                icon={Filter}
                value={statusFilter}
                onChange={setStatusFilter}
                label="Status"
                options={
                  page === "department" ? departmentStatuses : employeeStatuses
                }
              />

              <FilterSelect
                icon={Shield}
                value={rankFilter}
                onChange={setRankFilter}
                label="Rank"
                options={page === "department" ? departmentRanks : employeeRanks}
              />

              {(search || statusFilter !== "all" || rankFilter !== "all") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Main table/card */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <PageIcon className="h-4 w-4 text-blue-500" />
              </div>

              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{pageInfo.label}</h2>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Loading roster..."
                    : `${filteredCount.toLocaleString()} of ${totalCount.toLocaleString()} records • Last synchronized: ${formatUpdatedAt(roster?.updatedAt)}`}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void loadRoster()} />
          ) : !roster ? (
            <EmptyState message="The Main Roster has not been synchronized yet." />
          ) : page === "home" ? (
            <HomeTable home={roster.home} />
          ) : page === "department" ? (
            <DepartmentTable members={department} />
          ) : page === "employees" ? (
            <EmployeeTable employees={employees} />
          ) : page === "vehicles" ? (
            <VehicleTable vehicles={roster.vehicles} />
          ) : (
            <UniformTable uniforms={roster.uniforms} />
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}

/* ─────────────────────────────────────────────
   Controls
───────────────────────────────────────────── */

function FilterSelect({
  icon: Icon,
  value,
  onChange,
  label,
  options,
}: {
  icon: LucideIcon
  value: string
  onChange: (value: string) => void
  label: string
  options: string[]
}) {
  return (
    <div className="relative shrink-0">
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-blue-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-[145px] appearance-none rounded-md border border-input bg-background px-8 pr-8 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
        aria-label={label}
      >
        <option value="all">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Small components
───────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: LucideIcon
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-500" />
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="p-10 text-center">
      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-500" />
      <p className="mt-3 text-sm text-muted-foreground">Loading Main Roster...</p>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="p-8 text-center">
      <XCircle className="mx-auto h-6 w-6 text-red-500" />
      <p className="mt-3 text-sm font-medium">Failed to load Main Roster</p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
        Try Again
      </Button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-10 text-center">
      <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max text-sm">{children}</table>
    </div>
  )
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
      <tr className="border-b border-border">{children}</tr>
    </thead>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  )
}

function Td({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 text-center align-middle ${className}`}>
      {children}
    </td>
  )
}

function HomeTable({ home }: { home: MainRosterHome }) {
  if (home.headers.length === 0 || home.rows.length === 0) {
    return <EmptyState message="The MPD | Home sheet does not currently contain any tabular data." />
  }

  return (
    <TableShell>
      <TableHead>
        {home.headers.map((header, index) => (
          <Th key={`${header}-${index}`}>{displayValue(header)}</Th>
        ))}
      </TableHead>
      <tbody>
        {home.rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-border last:border-0 hover:bg-muted/30">
            {home.headers.map((_, columnIndex) => (
              <Td key={`${rowIndex}-${columnIndex}`}>{displayValue(row[columnIndex])}</Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function DepartmentTable({ members }: { members: MainRosterDepartmentMember[] }) {
  if (members.length === 0) {
    return <EmptyState message="No Department Roster members match the current search or filters." />
  }

  return (
    <TableShell>
      <TableHead>
        <Th>Section</Th>
        <Th>Callsign</Th>
        <Th>Badge</Th>
        <Th>Name</Th>
        <Th>Insignia</Th>
        <Th>Rank</Th>
        <Th>Job Description</Th>
        <Th>Time In Dept</Th>
        <Th>Time In Rank</Th>
        <Th>Status</Th>
        <Th>Strikes</Th>
        <Th>Discord ID</Th>
        <Th>This Month</Th>
      </TableHead>
      <tbody>
        {members.map((member, index) => (
          <tr key={`${member.badgeNumber}-${index}`} className="border-b border-border last:border-0 hover:bg-muted/30">
            <Td>{displayValue(member.section)}</Td>
            <Td className="font-semibold">{displayValue(member.callsign)}</Td>
            <Td>{displayValue(member.badgeNumber)}</Td>
            <Td className="font-medium">{displayValue(member.name)}</Td>
            <Td>{displayValue(member.insignia)}</Td>
            <Td>{displayValue(member.rank)}</Td>
            <Td className="max-w-xs whitespace-normal">{displayValue(member.jobDescription)}</Td>
            <Td>{displayValue(member.timeInDept)}</Td>
            <Td>{displayValue(member.timeInRank)}</Td>
            <Td><StatusBadge status={member.status} /></Td>
            <Td>
              <div className="flex justify-center gap-1">
                <BooleanBadge value={member.strike1} />
                <BooleanBadge value={member.strike2} />
              </div>
            </Td>
            <Td>{displayValue(member.discordId)}</Td>
            <Td>{displayValue(member.hoursThisMonth)}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function EmployeeTable({ employees }: { employees: MainRosterEmployee[] }) {
  if (employees.length === 0) {
    return <EmptyState message="No Employee Database records match the current search or filters." />
  }

  return (
    <TableShell>
      <TableHead>
        <Th>Message</Th>
        <Th>Badge</Th>
        <Th>Name</Th>
        <Th>Discord ID</Th>
        <Th>Department Status</Th>
        <Th>Rank</Th>
        <Th>Timezone</Th>
        <Th>Join Dept</Th>
        <Th>Promo Date</Th>
        <Th>Strikes</Th>
        <Th>Callsign</Th>
        <Th>Time In Dept</Th>
        <Th>Terminated</Th>
        <Th>LOA</Th>
        <Th>Resigned</Th>
        <Th>This Month</Th>
        <Th>Last Month</Th>
      </TableHead>
      <tbody>
        {employees.map((employee, index) => (
          <tr key={`${employee.badgeNumber}-${index}`} className="border-b border-border last:border-0 hover:bg-muted/30">
            <Td>{displayValue(employee.sendMessage)}</Td>
            <Td className="font-semibold">{displayValue(employee.badgeNumber)}</Td>
            <Td className="font-medium">{displayValue(employee.name)}</Td>
            <Td>{displayValue(employee.discordId)}</Td>
            <Td><StatusBadge status={employee.departmentStatus} /></Td>
            <Td>{displayValue(employee.rank)}</Td>
            <Td>{displayValue(employee.timezone)}</Td>
            <Td>{displayValue(employee.joinDeptDate)}</Td>
            <Td>{displayValue(employee.promoDate)}</Td>
            <Td>
              <div className="flex justify-center gap-1">
                <BooleanBadge value={employee.strike1} />
                <BooleanBadge value={employee.strike2} />
              </div>
            </Td>
            <Td>{displayValue(employee.callsign)}</Td>
            <Td>{displayValue(employee.timeInDept)}</Td>
            <Td><BooleanBadge value={employee.terminated} /></Td>
            <Td><BooleanBadge value={employee.loa} /></Td>
            <Td><BooleanBadge value={employee.resigned} /></Td>
            <Td>{displayValue(employee.thisMonthHours)}</Td>
            <Td>{displayValue(employee.lastMonthHours)}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function VehicleTable({ vehicles }: { vehicles: MainRosterVehicle[] }) {
  if (vehicles.length === 0) {
    return <EmptyState message="No Vehicle Roster records were found." />
  }

  return (
    <TableShell>
      <TableHead>
        <Th>Rank</Th>
        <Th>Vehicle Name</Th>
        <Th>Spawncode</Th>
        <Th>Required Extras</Th>
        <Th>Livery</Th>
        <Th>Window Tint</Th>
        <Th>Turbo</Th>
        <Th>Slicktop Optional</Th>
        <Th>Unmarked Allowed</Th>
      </TableHead>
      <tbody>
        {vehicles.map((vehicle, index) => (
          <tr key={`${vehicle.spawncode}-${index}`} className="border-b border-border last:border-0 hover:bg-muted/30">
            <Td>{displayValue(vehicle.rank)}</Td>
            <Td className="font-medium">{displayValue(vehicle.vehicleName)}</Td>
            <Td className="font-mono text-xs">{displayValue(vehicle.spawncode)}</Td>
            <Td>{displayValue(vehicle.requiredExtras)}</Td>
            <Td>{displayValue(vehicle.livery)}</Td>
            <Td>{displayValue(vehicle.windowTint)}</Td>
            <Td><BooleanBadge value={vehicle.turbo} /></Td>
            <Td><BooleanBadge value={vehicle.slicktopOptional} /></Td>
            <Td><BooleanBadge value={vehicle.unmarkedAllowed} /></Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function UniformTable({ uniforms }: { uniforms: MainRosterUniform[] }) {
  if (uniforms.length === 0) {
    return <EmptyState message="No Uniform Roster records were found." />
  }

  return (
    <TableShell>
      <TableHead>
        <Th>Rank</Th>
        <Th>Class</Th>
        <Th>Shared Outfit Code</Th>
      </TableHead>
      <tbody>
        {uniforms.map((uniform, index) => (
          <tr key={`${uniform.sharedOutfitCode}-${index}`} className="border-b border-border last:border-0 hover:bg-muted/30">
            <Td className="font-medium">{displayValue(uniform.rank)}</Td>
            <Td>{displayValue(uniform.className)}</Td>
            <Td className="font-mono text-xs">{displayValue(uniform.sharedOutfitCode)}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}
