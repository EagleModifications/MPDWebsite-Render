import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  Award,
  Car,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
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

type SheetKey =
  | "home"
  | "department-roster"
  | "employee-database"
  | "vehicle-roster"
  | "uniform-roster"

type Cell = {
  value: string
}

type Merge = {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

type Sheet = {
  key: string
  name: string
  gid: string
  headers: string[]
  rows: string[][]
  rawRows: string[][]
  rowCount: number
  columnCount: number
  sheetRowCount?: number
  sheetColumnCount?: number
  merges?: Merge[]
  cells?: Cell[][]
}

type ApiResponse = {
  success: boolean
  sheet?: Sheet
  error?: string
}

type Page = {
  id: SheetKey
  label: string
  icon: LucideIcon
}

const pages: Page[] = [
  { id: "home", label: "Home", icon: FileSpreadsheet },
  { id: "department-roster", label: "Department Roster", icon: Shield },
  { id: "employee-database", label: "Employee Database", icon: Users },
  { id: "vehicle-roster", label: "Vehicle Roster", icon: Car },
  { id: "uniform-roster", label: "Uniform Roster", icon: Shirt },
]

const DEPARTMENT_COLUMNS = [
  ["Callsign", "Callsign"],
  ["Badge Number", "Badge Number"],
  ["Name", "Name"],
  ["Rank", "Rank"],
  ["Job Description", "Job Description"],
  ["Time in Dept", "Time in Dept"],
  ["Time in Rank", "Time in Rank"],
  ["Status", "Status"],
  ["Discord ID", "Discord ID"],
  ["Hours This Month", "Hours This Month"],
] as const

const EMPLOYEE_COLUMNS = [
  ["Badge Number", ["Badge Number"]],
  ["Name", ["Name", "Names"]],
  ["Discord ID", ["Discord ID"]],
  ["Department Status", ["Department Status", "Status"]],
  ["Rank", ["Rank"]],
  ["Timezone", ["Timezone"]],
  ["Join Dept Date", ["Join Dept Date", "Join Dept Date Format"]],
  ["Promo Date", ["Promo Date", "Promo Date Format"]],
  ["Strike 1", ["Strike 1"]],
  ["Strike 2", ["Strike 2"]],
  ["Callsign", ["Callsign", "Callsigns"]],
  ["Time in Dept", ["Time in Dept"]],
  ["Terminated", ["Terminated"]],
  ["LOA", ["LOA"]],
  ["Resigned", ["Resigned"]],
  ["This Month's Hours", ["This Month's Hours", "This Month Hours", "This Month's Dept. Hours"]],
  ["Last Month's Hours", ["Last Month's Hours", "Last Month Hours"]],
] as const

const VEHICLE_COLUMNS = [
  ["Vehicle Name", ["Vehicle Name"]],
  ["Spawncode", ["Spawncode"]],
  ["Required Extras", ["Required Extras"]],
  ["Livery", ["Livery"]],
  ["Window Tint", ["Window Tint", "Window Ting"]],
  ["Turbo", ["Turbo"]],
  ["Slicktop Optional", ["Slicktop Optional"]],
  ["Unmarked Allowed", ["Unmarked Allowed"]],
] as const

const UNIFORM_COLUMNS = [
  ["Class", ["Class"]],
  ["Shared Outfit Code", ["Shared Outfit Code"]],
] as const

function clean(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function display(value: unknown): string {
  const valueText = clean(value)
  return valueText && valueText !== "-" && valueText !== "—" ? valueText : "—"
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function truthy(value: unknown): boolean {
  return ["true", "yes", "y", "1", "on", "active"].includes(normalize(value))
}

function uniqueInSheetOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const text = clean(value)
    const key = normalize(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }

  return result
}

function StatusBadge({ value }: { value: string }) {
  const normalized = normalize(value)
  const positive = ["active", "current", "approved", "compliant", "yes", "true"].includes(normalized)
  const negative = ["inactive", "terminated", "resigned", "suspended", "no", "false"].includes(normalized)
  const leave = ["loa", "leave", "leaveofabsence"].includes(normalized)

  if (!positive && !negative && !leave) return <span>{display(value)}</span>

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold",
        positive
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : leave
            ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
            : "border-red-500/20 bg-red-500/10 text-red-400",
      ].join(" ")}
    >
      {positive ? <CheckCircle2 className="h-3 w-3" /> : null}
      {display(value)}
    </span>
  )
}

function BooleanBadge({ value }: { value: string }) {
  if (!clean(value)) return <span>—</span>

  return (
    <span
      className={truthy(value)
        ? "inline-flex rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-400"
        : "inline-flex rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground"}
    >
      {truthy(value) ? "Yes" : "No"}
    </span>
  )
}

function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-xs">{children}</table>
    </div>
  )
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-muted/30">
      <tr>{children}</tr>
    </thead>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  )
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td className={`whitespace-nowrap border-b border-border px-3 py-3 align-middle ${className}`}>
      {children}
    </td>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center p-10 text-center">
      <ClipboardList className="h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center">
      <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
      <p className="mt-3 text-sm text-muted-foreground">Loading roster data...</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center">
      <XCircle className="h-7 w-7 text-red-500" />
      <p className="mt-3 text-sm font-semibold">Failed to load Main Roster</p>
      <p className="mt-1 max-w-xl text-xs text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-[165px]">
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        <option value="">All {label}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

function rowValues(sheet: Sheet, row: number): string[] {
  const width = Math.max(sheet.columnCount, sheet.headers.length, sheet.cells?.[row]?.length ?? 0)
  return Array.from({ length: width }, (_, column) => {
    const direct = clean(sheet.cells?.[row]?.[column]?.value)
    if (direct) return direct

    const merge = (sheet.merges ?? []).find(
      (item) =>
        row >= item.startRow &&
        row < item.endRow &&
        column >= item.startColumn &&
        column < item.endColumn,
    )

    if (merge) return clean(sheet.cells?.[merge.startRow]?.[merge.startColumn]?.value)
    return clean(sheet.rows[row]?.[column])
  })
}

function findHeaderRow(sheet: Sheet, required: string[]): { row: number; indexes: Record<string, number> } | null {
  const wanted = required.map(normalize)

  for (let row = 0; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row).map(normalize)
    const indexes: Record<string, number> = {}

    for (const item of wanted) {
      const index = values.indexOf(item)
      if (index !== -1) indexes[item] = index
    }

    if (wanted.every((item) => indexes[item] !== undefined)) {
      return { row, indexes }
    }
  }

  return null
}

function extractTable(
  sheet: Sheet,
  definitions: readonly (readonly [string, readonly string[]])[],
  required: string[],
) {
  const header = findHeaderRow(sheet, required)

  if (!header) {
    return { headers: definitions.map((item) => item[0]), rows: [] as string[][] }
  }

  const indexes = definitions.map((definition) => {
    for (const alias of definition[1]) {
      const index = header.indexes[normalize(alias)]
      if (index !== undefined) return index
    }
    return -1
  })

  const rows: string[][] = []

  for (let row = header.row + 1; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    const selected = indexes.map((index) => index >= 0 ? clean(values[index]) : "")
    if (!selected.some(Boolean)) continue

    const normalized = selected.map(normalize)
    if (normalized.includes("callsign") || normalized.includes("badgenumber") || normalized.includes("sharedoutfitcode")) continue

    rows.push(selected)
  }

  return { headers: definitions.map((item) => item[0]), rows }
}

function extractRankedRows(
  sheet: Sheet,
  columns: readonly (readonly [string, readonly string[]])[],
) {
  const required = ["rank", ...columns.map((column) => normalize(column[1][0]))]
  const header = findHeaderRow(sheet, required)
  if (!header) return [] as { rank: string; rows: string[][] }[]

  const rankIndex = header.indexes.rank
  const columnIndexes = columns.map((column) => {
    for (const alias of column[1]) {
      const index = header.indexes[normalize(alias)]
      if (index !== undefined) return index
    }
    return -1
  })

  const sections: { rank: string; rows: string[][] }[] = []
  let currentRank = ""

  for (let row = header.row + 1; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    const normalized = values.map(normalize)
    if (["rank", ...columns.map((column) => normalize(column[0]))].every((item) => normalized.includes(item))) continue

    const explicitRank = clean(values[rankIndex])
    if (explicitRank) currentRank = explicitRank

    const selected = columnIndexes.map((index) => index >= 0 ? clean(values[index]) : "")
    if (!currentRank || !selected.some(Boolean)) continue

    let section = sections.find((item) => normalize(item.rank) === normalize(currentRank))
    if (!section) {
      section = { rank: currentRank, rows: [] }
      sections.push(section)
    }
    section.rows.push(selected)
  }

  return sections
}

function findCell(sheet: Sheet, text: string) {
  const wanted = normalize(text)

  for (let row = 0; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    for (let column = 0; column < values.length; column += 1) {
      if (normalize(values[column]) === wanted) return { row, column }
    }
  }

  return null
}

function nearbyValues(sheet: Sheet, row: number, column: number, rowRadius: number, columnRadius: number): string[] {
  const values: string[] = []
  const seen = new Set<string>()

  for (let currentRow = Math.max(0, row - 1); currentRow <= Math.min(sheet.rowCount - 1, row + rowRadius); currentRow += 1) {
    const rowData = rowValues(sheet, currentRow)
    for (let currentColumn = Math.max(0, column - columnRadius); currentColumn <= Math.min(rowData.length - 1, column + columnRadius); currentColumn += 1) {
      const value = clean(rowData[currentColumn])
      if (!value || seen.has(value)) continue
      seen.add(value)
      values.push(value)
    }
  }

  return values
}

function HomeCard({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-500" />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function HomeView({ sheet }: { sheet: Sheet }) {
  const leadershipTitles = [
    "Chief of Police",
    "Deputy Chief of Police",
    "Assistant Chief of Police",
    "Chief of Staff",
    "Colonel",
  ]

  const hoursPosition = findCell(sheet, "This Month's Dept. Hours")
  const documentsPosition = findCell(sheet, "Documents")
  const statisticsPosition = findCell(sheet, "Statistics")
  const ftdPosition = findCell(sheet, "FTD & Subdivisions")
  const foundersPosition = findCell(sheet, "Metro PD Founders")

  const hours = hoursPosition
    ? nearbyValues(sheet, hoursPosition.row + 1, hoursPosition.column, 4, 4).find((value) => normalize(value) !== normalize("This Month's Dept. Hours")) ?? ""
    : ""

  const documents = documentsPosition
    ? nearbyValues(sheet, documentsPosition.row, documentsPosition.column, 8, 8).filter((value) => normalize(value) !== normalize("Documents"))
    : []

  const statistics = statisticsPosition
    ? nearbyValues(sheet, statisticsPosition.row + 1, statisticsPosition.column, 12, 8).filter((value) => normalize(value) !== normalize("Statistics"))
    : []

  const leadership = leadershipTitles.map((title) => {
    const position = findCell(sheet, title)
    const values = position
      ? nearbyValues(sheet, position.row, position.column, 4, 6).filter((value) => normalize(value) !== normalize(title))
      : []
    return { title, values }
  })

  const subdivisions = ftdPosition
    ? nearbyValues(sheet, ftdPosition.row + 1, ftdPosition.column, 30, 8).filter((value) => normalize(value) !== normalize("FTD & Subdivisions"))
    : []

  const founders = foundersPosition
    ? nearbyValues(sheet, foundersPosition.row + 1, foundersPosition.column, 12, 8).filter((value) => normalize(value) !== normalize("Metro PD Founders"))
    : []

  const unique = (items: string[]) => items.filter((value, index) => items.indexOf(value) === index)

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4">
        <HomeCard title="This Month's Dept. Hours" icon={RefreshCw}>
          <div className="text-3xl font-bold tracking-tight">{display(hours)}</div>
          <p className="mt-1 text-xs text-muted-foreground">Current department activity hours.</p>
        </HomeCard>

        <HomeCard title="Documents" icon={FileText}>
          <div className="space-y-2">
            {unique(documents).slice(0, 10).map((value) => (
              <div key={value} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm">
                {value}
              </div>
            ))}
            {!documents.length ? <p className="text-sm text-muted-foreground">No documents found.</p> : null}
          </div>
        </HomeCard>

        <HomeCard title="Statistics" icon={Award}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {unique(statistics).filter((value) => /\d/.test(value)).slice(0, 12).map((value) => (
              <div key={value} className="rounded-lg border border-border px-3 py-2 text-sm font-medium">
                {value}
              </div>
            ))}
            {!statistics.some((value) => /\d/.test(value)) ? <p className="text-sm text-muted-foreground">No statistics found.</p> : null}
          </div>
        </HomeCard>
      </div>

      <div className="space-y-4">
        {leadership.map(({ title, values }) => (
          <HomeCard key={title} title={title} icon={Shield}>
            {values.length ? (
              <div className="space-y-2">
                {unique(values).slice(0, 6).map((value, index) => (
                  <div key={`${title}-${value}`} className={index === 0 ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
                    {value}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data found.</p>
            )}
          </HomeCard>
        ))}
      </div>

      <div className="space-y-4">
        <HomeCard title="FTD & Subdivisions" icon={Users}>
          <div className="space-y-1.5">
            {unique(subdivisions).slice(0, 40).map((value) => (
              <div key={value} className="rounded-md border border-border px-3 py-2 text-xs">
                {value}
              </div>
            ))}
            {!subdivisions.length ? <p className="text-sm text-muted-foreground">No subdivision data found.</p> : null}
          </div>
        </HomeCard>

        <HomeCard title="Metro PD Founders" icon={Shield}>
          <div className="space-y-2">
            {unique(founders).slice(0, 20).map((value) => (
              <div key={value} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm">
                {value}
              </div>
            ))}
            {!founders.length ? <p className="text-sm text-muted-foreground">No founder data found.</p> : null}
          </div>
        </HomeCard>
      </div>
    </div>
  )
}

function DepartmentTable({ rows }: { rows: string[][] }) {
  if (!rows.length) return <EmptyState message="No Department Roster records match your filters." />

  return (
    <TableShell>
      <TableHead>
        {DEPARTMENT_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}
      </TableHead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${rowIndex}-${row.join("|")}`} className="transition-colors hover:bg-muted/20">
            {row.map((value, index) => (
              <Td key={`${rowIndex}-${index}`} className={index === 0 || index === 2 ? "font-medium" : ""}>
                {index === 7 ? <StatusBadge value={value} /> : index === 8 ? <span className="font-mono text-[11px]">{display(value)}</span> : display(value)}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function EmployeeTable({ rows }: { rows: string[][] }) {
  if (!rows.length) return <EmptyState message="No Employee Database records match your filters." />

  return (
    <TableShell>
      <TableHead>
        {EMPLOYEE_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}
      </TableHead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${rowIndex}-${row.join("|")}`} className="transition-colors hover:bg-muted/20">
            {row.map((value, index) => (
              <Td key={`${rowIndex}-${index}`} className={index === 0 || index === 1 || index === 10 ? "font-medium" : ""}>
                {index >= 8 && index <= 9 ? <BooleanBadge value={value} /> : index >= 12 && index <= 14 ? <BooleanBadge value={value} /> : index === 2 ? <span className="font-mono text-[11px]">{display(value)}</span> : index === 3 ? <StatusBadge value={value} /> : display(value)}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function VehicleView({ sheet }: { sheet: Sheet }) {
  const sections = useMemo(() => extractRankedRows(sheet, VEHICLE_COLUMNS), [sheet])

  if (!sections.length) return <EmptyState message="No Vehicle Roster data found." />

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.rank} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
            <Car className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">{section.rank}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{section.rows.length} vehicles</span>
          </div>
          <TableShell>
            <TableHead>{VEHICLE_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}</TableHead>
            <tbody>
              {section.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row.join("|")}`} className="hover:bg-muted/20">
                  {row.map((value, index) => (
                    <Td key={`${rowIndex}-${index}`} className={index === 1 ? "font-mono text-[11px]" : ""}>
                      {index >= 5 ? <BooleanBadge value={value} /> : display(value)}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableShell>
        </section>
      ))}
    </div>
  )
}

function UniformView({ sheet }: { sheet: Sheet }) {
  const sections = useMemo(() => {
    const header = findHeaderRow(sheet, ["rank", "class", "sharedoutfitcode"])
    if (!header) return [] as { rank: string; rows: string[][] }[]

    const sections: { rank: string; rows: string[][] }[] = []
    let currentRank = ""
    const rankIndex = header.indexes.rank
    const classIndex = header.indexes.class
    const outfitIndex = header.indexes.sharedoutfitcode

    for (let row = header.row + 1; row < sheet.rowCount; row += 1) {
      const values = rowValues(sheet, row)
      const normalized = values.map(normalize)
      if (["rank", "class", "sharedoutfitcode"].every((value) => normalized.includes(value))) continue

      const explicitRank = clean(values[rankIndex])
      if (explicitRank) currentRank = explicitRank

      const classValue = clean(values[classIndex])
      const outfit = clean(values[outfitIndex])
      if (!currentRank || (!classValue && !outfit)) continue

      let section = sections.find((item) => normalize(item.rank) === normalize(currentRank))
      if (!section) {
        section = { rank: currentRank, rows: [] }
        sections.push(section)
      }
      section.rows.push([classValue, outfit])
    }

    return sections
  }, [sheet])

  if (!sections.length) return <EmptyState message="No Uniform Roster data found." />

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.rank} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
            <Shirt className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">{section.rank}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{section.rows.length} uniforms</span>
          </div>
          <TableShell>
            <TableHead>
              <Th>Rank</Th>
              {UNIFORM_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}
            </TableHead>
            <tbody>
              {section.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row.join("|")}`} className="hover:bg-muted/20">
                  <Td className="font-medium">{display(section.rank)}</Td>
                  <Td>{display(row[0])}</Td>
                  <Td className="font-mono text-[11px]">{display(row[1])}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </section>
      ))}
    </div>
  )
}

export default function MainRoster() {
  const [page, setPage] = useState<SheetKey>("home")
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rankFilter, setRankFilter] = useState("")

  const pageInfo = pages.find((item) => item.id === page) ?? pages[0]
  const PageIcon = pageInfo.icon

  const loadSheet = useCallback(
    async (selectedPage: SheetKey, forceRefresh = false) => {
      setLoading(true)
      setError("")

      try {
        const query = forceRefresh ? "?refresh=1" : ""
        const response = await fetch(`/api/main-roster/${selectedPage}${query}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        })

        const data = (await response.json().catch(() => null)) as ApiResponse | null
        if (!response.ok || !data?.success || !data.sheet) {
          throw new Error(data?.error || `Failed to load ${pageInfo.label}.`)
        }

        setSheet(data.sheet)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : `Failed to load ${pageInfo.label}.`
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [pageInfo.label],
  )

  useEffect(() => {
    setSearch("")
    setStatusFilter("")
    setRankFilter("")
    void loadSheet(page, false)
  }, [loadSheet, page])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadSheet(page, false)
    }, 30 * 60 * 1000)

    return () => window.clearInterval(interval)
  }, [loadSheet, page])

  const refresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadSheet(page, true)
      toast.success("Main Roster refreshed", {
        description: `${pageInfo.label} was refreshed from the roster data source.`,
      })
    } finally {
      setRefreshing(false)
    }
  }, [loadSheet, page, pageInfo.label, refreshing])

  const departmentTable = useMemo(() => {
    if (!sheet || page !== "department-roster") return { rows: [], allRows: [] as string[][] }
    const extracted = extractTable(
      sheet,
      DEPARTMENT_COLUMNS.map(([label, alias]) => [label, [alias]] as const),
      ["Callsign", "Badge Number", "Name", "Rank", "Status"],
    )

    const query = normalize(search)
    const rankIndex = 3
    const statusIndex = 7

    const rows = extracted.rows.filter((row) => {
      const matchesSearch = !query || row.some((value) => normalize(value).includes(query))
      const matchesStatus = !statusFilter || normalize(row[statusIndex]) === normalize(statusFilter)
      const matchesRank = !rankFilter || normalize(row[rankIndex]) === normalize(rankFilter)
      return matchesSearch && matchesStatus && matchesRank
    })

    return { rows, allRows: extracted.rows }
  }, [page, rankFilter, search, sheet, statusFilter])

  const employeeTable = useMemo(() => {
    if (!sheet || page !== "employee-database") return { rows: [], allRows: [] as string[][] }
    const extracted = extractTable(sheet, EMPLOYEE_COLUMNS, ["Badge Number", "Name", "Rank"])
    const query = normalize(search)
    const rankIndex = 4

    const rows = extracted.rows.filter((row) => {
      const matchesSearch = !query || row.some((value) => normalize(value).includes(query))
      const matchesRank = !rankFilter || normalize(row[rankIndex]) === normalize(rankFilter)
      return matchesSearch && matchesRank
    })

    return { rows, allRows: extracted.rows }
  }, [page, rankFilter, search, sheet])

  const statusOptions = useMemo(() => {
    if (!sheet || page !== "department-roster") return []
    return uniqueInSheetOrder(departmentTable.allRows.map((row) => row[7] ?? ""))
  }, [departmentTable.allRows, page, sheet])

  const rankOptions = useMemo(() => {
    if (!sheet || page === "home" || page === "vehicle-roster" || page === "uniform-roster") return []
    const source = page === "department-roster" ? departmentTable.allRows : employeeTable.allRows
    const rankIndex = page === "department-roster" ? 3 : 4
    return uniqueInSheetOrder(source.map((row) => row[rankIndex] ?? ""))
  }, [departmentTable.allRows, employeeTable.allRows, page, sheet])

  const count = page === "department-roster"
    ? departmentTable.rows.length
    : page === "employee-database"
      ? employeeTable.rows.length
      : sheet?.rowCount ?? 0

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-6 overflow-x-hidden">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">Main Roster</h1>
              <p className="mt-1 text-sm text-muted-foreground">Metro Police Department master roster and operational data.</p>
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing || loading} className="w-fit gap-2">
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </header>

        <nav className="flex w-full gap-2 overflow-x-auto pb-1">
          {pages.map((item) => {
            const Icon = item.icon
            const active = item.id === page
            return (
              <Button key={item.id} type="button" variant={active ? "default" : "outline"} size="sm" onClick={() => setPage(item.id)} className="shrink-0 gap-2">
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </nav>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <PageIcon className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{pageInfo.label}</h2>
                <p className="text-xs text-muted-foreground">{count.toLocaleString()} {count === 1 ? "record" : "records"}</p>
              </div>
            </div>

            {(page === "department-roster" || page === "employee-database") ? (
              <div className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row">
                <div className="relative w-full xl:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${pageInfo.label.toLowerCase()}...`} className="pl-9" />
                </div>
                {page === "department-roster" ? (
                  <>
                    <FilterSelect label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
                    <FilterSelect label="Ranks" value={rankFilter} options={rankOptions} onChange={setRankFilter} />
                  </>
                ) : (
                  <FilterSelect label="Ranks" value={rankFilter} options={rankOptions} onChange={setRankFilter} />
                )}
              </div>
            ) : null}
          </div>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void loadSheet(page, false)} />
          ) : !sheet ? (
            <EmptyState message="No roster data is available." />
          ) : page === "home" ? (
            <div className="p-5"><HomeView sheet={sheet} /></div>
          ) : page === "department-roster" ? (
            <DepartmentTable rows={departmentTable.rows} />
          ) : page === "employee-database" ? (
            <EmployeeTable rows={employeeTable.rows} />
          ) : page === "vehicle-roster" ? (
            <div className="p-5"><VehicleView sheet={sheet} /></div>
          ) : (
            <div className="p-5"><UniformView sheet={sheet} /></div>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}
