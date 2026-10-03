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
  ClipboardList,
  FileSpreadsheet,
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

const pages: {
  id: MainRosterPage
  label: string
  icon: LucideIcon
}[] = [
  { id: "home", label: "MPD Home", icon: FileSpreadsheet },
  { id: "department", label: "Department Roster", icon: Shield },
  { id: "employees", label: "Employee Data", icon: Users },
  { id: "vehicles", label: "Vehicle Roster", icon: Car },
  { id: "uniforms", label: "Uniform Roster", icon: Shirt },
]

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—"

  const text = String(value).trim()

  if (
    !text ||
    text === "-" ||
    text === "—" ||
    text.toLowerCase() === "null" ||
    text.toLowerCase() === "undefined"
  ) {
    return "—"
  }

  return text
}

function formatUpdatedAt(value: string | Date | undefined): string {
  if (!value) return "Unknown"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Unknown"

  return date.toLocaleString()
}

function statusClasses(status: string): string {
  const value = status.trim().toLowerCase()

  if (
    value === "active" ||
    value === "compliant" ||
    value === "approved" ||
    value === "current"
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
  }

  if (
    value === "terminated" ||
    value === "resigned" ||
    value === "inactive" ||
    value === "suspended"
  ) {
    return "border-red-500/20 bg-red-500/10 text-red-400"
  }

  if (value === "loa" || value === "leave") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-400"
  }

  return "border-border bg-muted/50 text-muted-foreground"
}

function StatusBadge({ status }: { status: string }) {
  const value = status.trim().toLowerCase()

  const Icon =
    value === "active" ||
    value === "compliant" ||
    value === "approved" ||
    value === "current"
      ? CheckCircle2
      : value === "terminated" ||
          value === "resigned" ||
          value === "inactive" ||
          value === "suspended"
        ? XCircle
        : null

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        statusClasses(status),
      ].join(" ")}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {displayValue(status)}
    </span>
  )
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        value
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-muted/50 text-muted-foreground",
      ].join(" ")}
    >
      {value ? "Yes" : "No"}
    </span>
  )
}

export default function MainRoster() {
  const [page, setPage] = useState<MainRosterPage>("home")
  const [roster, setRoster] = useState<MainRosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const loadRoster = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)

    setError(null)

    try {
      const response = await fetch("/api/main-roster", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
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
          data?.error || "Main Roster data was not returned by the server.",
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
    if (refreshing) return

    setRefreshing(true)
    setError(null)

    try {
      toast.info("Synchronizing Main Roster", {
        description: "Fetching the latest data from Google Sheets.",
      })

      const response = await fetch("/api/import/google/main-roster", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error ||
            `Roster synchronization failed (${response.status}).`,
        )
      }

      await loadRoster(false)

      toast.success("Main Roster refreshed", {
        description: "The latest Google Sheets data has been loaded.",
      })
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh the Main Roster."

      setError(message)

      toast.error("Refresh failed", {
        description: message,
      })
    } finally {
      setRefreshing(false)
    }
  }, [loadRoster, refreshing])

  const query = search.trim().toLowerCase()

  const department = useMemo(() => {
    const rows = roster?.department ?? []
    if (!query) return rows

    return rows.filter((member) =>
      [
        member.section,
        member.callsign,
        member.badgeNumber,
        member.name,
        member.insignia,
        member.rank,
        member.jobDescription,
        member.status,
        member.discordId,
        member.hoursThisMonth,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
  }, [roster, query])

  const employees = useMemo(() => {
    const rows = roster?.employees ?? []
    if (!query) return rows

    return rows.filter((employee) =>
      [
        employee.sendMessage,
        employee.badgeNumber,
        employee.name,
        employee.discordId,
        employee.departmentStatus,
        employee.rank,
        employee.timezone,
        employee.joinDeptDate,
        employee.promoDate,
        employee.callsign,
        employee.timeInDept,
        employee.thisMonthHours,
        employee.lastMonthHours,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
  }, [roster, query])

  const vehicles = useMemo(() => {
    const rows = roster?.vehicles ?? []
    if (!query) return rows

    return rows.filter((vehicle) =>
      [
        vehicle.rank,
        vehicle.vehicleName,
        vehicle.spawncode,
        vehicle.requiredExtras,
        vehicle.livery,
        vehicle.windowTint,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
  }, [roster, query])

  const uniforms = useMemo(() => {
    const rows = roster?.uniforms ?? []
    if (!query) return rows

    return rows.filter((uniform) =>
      [
        uniform.rank,
        uniform.className,
        uniform.sharedOutfitCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
  }, [roster, query])

  const pageInfo = pages.find((item) => item.id === page) ?? pages[0]
  const PageIcon = pageInfo.icon

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                Main Roster
              </h1>
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
            className="w-fit gap-2"
          >
            <RefreshCw
              className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </header>

        <nav className="flex w-full gap-2 overflow-x-auto pb-1">
          {pages.map((item) => {
            const Icon = item.icon
            const active = item.id === page

            return (
              <Button
                key={item.id}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPage(item.id)
                  setSearch("")
                }}
                className="shrink-0 gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </nav>

        {roster && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Department" value={roster.department.length} icon={Shield} />
            <StatCard label="Employees" value={roster.employees.length} icon={Users} />
            <StatCard label="Vehicles" value={roster.vehicles.length} icon={Car} />
            <StatCard label="Uniforms" value={roster.uniforms.length} icon={Shirt} />
            <StatCard label="Home Rows" value={roster.home.rows.length} icon={FileSpreadsheet} />
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <PageIcon className="h-4 w-4 text-blue-500" />
              </div>

              <div>
                <h2 className="text-base font-semibold">{pageInfo.label}</h2>
                <p className="text-xs text-muted-foreground">
                  Last synchronized: {formatUpdatedAt(roster?.updatedAt)}
                </p>
              </div>
            </div>

            {page !== "home" && (
              <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${pageInfo.label.toLowerCase()}...`}
                  className="pl-9"
                />
              </div>
            )}
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
            <VehicleTable vehicles={vehicles} />
          ) : (
            <UniformTable uniforms={uniforms} />
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}

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
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
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
    <div className="p-12 text-center">
      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-500" />
      <p className="mt-3 text-sm text-muted-foreground">
        Loading Main Roster...
      </p>
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
    <div className="p-10 text-center">
      <XCircle className="mx-auto h-6 w-6 text-red-500" />
      <p className="mt-3 text-sm font-semibold">Failed to load Main Roster</p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">
        {message}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-4"
      >
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
    <td
      className={[
        "whitespace-nowrap px-4 py-3 text-center align-middle",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  )
}

function HomeTable({ home }: { home: MainRosterHome }) {
  if (!home.headers.length || !home.rows.length) {
    return (
      <EmptyState message="The MPD | Home sheet does not currently contain any data." />
    )
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
          <tr
            key={rowIndex}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
            {home.headers.map((_, columnIndex) => (
              <Td key={`${rowIndex}-${columnIndex}`}>
                {displayValue(row[columnIndex])}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function DepartmentTable({
  members,
}: {
  members: MainRosterDepartmentMember[]
}) {
  if (!members.length) {
    return <EmptyState message="No Department Roster members match your search." />
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
          <tr
            key={`${member.badgeNumber || member.discordId || member.name}-${index}`}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
            <Td>{displayValue(member.section)}</Td>
            <Td className="font-semibold">{displayValue(member.callsign)}</Td>
            <Td>{displayValue(member.badgeNumber)}</Td>
            <Td className="font-medium">{displayValue(member.name)}</Td>
            <Td>{displayValue(member.insignia)}</Td>
            <Td>{displayValue(member.rank)}</Td>
            <Td className="max-w-sm whitespace-normal">
              {displayValue(member.jobDescription)}
            </Td>
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

function EmployeeTable({
  employees,
}: {
  employees: MainRosterEmployee[]
}) {
  if (!employees.length) {
    return <EmptyState message="No Employee Database records match your search." />
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
          <tr
            key={`${employee.badgeNumber || employee.discordId || employee.name}-${index}`}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
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

function VehicleTable({
  vehicles,
}: {
  vehicles: MainRosterVehicle[]
}) {
  if (!vehicles.length) {
    return <EmptyState message="No Vehicle Roster records match your search." />
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
          <tr
            key={`${vehicle.spawncode || vehicle.vehicleName}-${index}`}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
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

function UniformTable({
  uniforms,
}: {
  uniforms: MainRosterUniform[]
}) {
  if (!uniforms.length) {
    return <EmptyState message="No Uniform Roster records match your search." />
  }

  return (
    <TableShell>
      <TableHead>
        <Th>Rank</Th>
        <Th>Class</Th>
        <Th>Server Outfit Code</Th>
      </TableHead>

      <tbody>
        {uniforms.map((uniform, index) => (
          <tr
            key={`${uniform.sharedOutfitCode || uniform.className}-${index}`}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
            <Td className="font-medium">{displayValue(uniform.rank)}</Td>
            <Td>{displayValue(uniform.className)}</Td>
            <Td className="font-mono text-xs">
              {displayValue(uniform.sharedOutfitCode)}
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}
