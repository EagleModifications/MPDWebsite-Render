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

type Sheet = {
  key: string
  name: string
  gid: string
  headers: string[]
  rows: string[][]
  rawRows: string[][]
  rowCount: number
  columnCount: number
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

type DepartmentRow = {
  section: string
  callsign: string
  badgeNumber: string
  name: string
  rank: string
  jobDescription: string
  timeInDept: string
  timeInRank: string
  status: string
  discordId: string
  hoursThisMonth: string
}

type EmployeeRow = {
  section: string
  badgeNumber: string
  name: string
  discordId: string
  departmentStatus: string
  rank: string
  timezone: string
  joinDeptDate: string
  promoDate: string
  strike1: string
  strike2: string
  callsign: string
  timeInDept: string
  terminated: string
  loa: string
  resigned: string
  thisMonthHours: string
  lastMonthHours: string
}

type VehicleRow = {
  rank: string
  vehicleName: string
  spawncode: string
  requiredExtras: string
  livery: string
  windowTint: string
  turbo: string
  slicktopOptional: string
  unmarkedAllowed: string
}

type UniformRow = {
  rank: string
  className: string
  sharedOutfitCode: string
}

type ColumnDefinition = readonly [string, readonly string[]]

const pages: Page[] = [
  { id: "home", label: "Home", icon: FileSpreadsheet },
  { id: "department-roster", label: "Department Roster", icon: Shield },
  { id: "employee-database", label: "Employee Database", icon: Users },
  { id: "vehicle-roster", label: "Vehicle Roster", icon: Car },
  { id: "uniform-roster", label: "Uniform Roster", icon: Shirt },
]

const DEPARTMENT_COLUMNS: ColumnDefinition[] = [
  ["Callsign", ["Callsign"]],
  ["Badge Number", ["Badge Number", "Badge"]],
  ["Name", ["Name"]],
  ["Rank", ["Rank"]],
  ["Job Description", ["Job Description", "Job"]],
  ["Time in Dept", ["Time in Dept", "Time in Department"]],
  ["Time in Rank", ["Time in Rank"]],
  ["Status", ["Status", "Department Status"]],
  ["Discord ID", ["Discord ID", "Discord"]],
  ["Hours This Month", ["Hours This Month", "This Month's Hours", "This Month Hours"]],
]

const EMPLOYEE_COLUMNS: ColumnDefinition[] = [
  ["Badge Number", ["Badge Number", "Badge"]],
  ["Name", ["Name", "Names"]],
  ["Discord ID", ["Discord ID", "Discord"]],
  ["Department Status", ["Department Status", "Dept Status", "Status"]],
  ["Rank", ["Rank"]],
  ["Timezone", ["Timezone", "Time Zone"]],
  ["Join Dept Date", ["Join Dept Date", "Join Department Date"]],
  ["Promo Date", ["Promo Date", "Promotion Date"]],
  ["Strike 1", ["Strike 1"]],
  ["Strike 2", ["Strike 2"]],
  ["Callsign", ["Callsign", "Callsigns"]],
  ["Time in Dept", ["Time in Dept", "Time in Department"]],
  ["Terminated", ["Terminated"]],
  ["LOA", ["LOA", "Leave of Absence"]],
  ["Resigned", ["Resigned"]],
  ["This Month's Hours", ["This Month's Hours", "This Month Hours", "This Month's Dept. Hours"]],
  ["Last Month's Hours", ["Last Month's Hours", "Last Month Hours", "Last Month's Dept. Hours"]],
]

const VEHICLE_COLUMNS: ColumnDefinition[] = [
  ["Vehicle Name", ["Vehicle Name", "Vehicle"]],
  ["Spawncode", ["Spawncode", "Spawn Code"]],
  ["Required Extras", ["Required Extras", "Extras"]],
  ["Livery", ["Livery"]],
  ["Window Tint", ["Window Tint", "Window Ting"]],
  ["Turbo", ["Turbo"]],
  ["Slicktop Optional", ["Slicktop Optional", "Slicktop"]],
  ["Unmarked Allowed", ["Unmarked Allowed", "Unmarked"]],
]

const UNIFORM_COLUMNS: ColumnDefinition[] = [
  ["Class", ["Class"]],
  ["Shared Outfit Code", ["Shared Outfit Code", "Outfit Code", "Shared Code"]],
]

const HOME_CARDS = [
  { title: "This Month's Dept. Hours", icon: RefreshCw, kind: "hours" },
  { title: "Documents", icon: FileText, kind: "documents" },
  { title: "Statistics", icon: Award, kind: "statistics" },
  { title: "Chief Of Police", icon: Shield, kind: "leadership" },
  { title: "Deputy Chief Of Police", icon: Shield, kind: "leadership" },
  { title: "Assistant Chief Of Police", icon: Shield, kind: "leadership" },
  { title: "Chief Of Staff", icon: Shield, kind: "leadership" },
  { title: "FTD & Subdivisions", icon: Users, kind: "subdivisions" },
  { title: "Metro PD Founders", icon: Shield, kind: "founders" },
] as const

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim()
}

function display(value: unknown): string {
  const text = clean(value)
  return !text || text === "-" || text === "—" ? "—" : text
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function isTrue(value: string): boolean {
  return ["true", "yes", "y", "1", "on", "active"].includes(normalize(value))
}

function uniqueInOrder(values: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const text = clean(value)
    const key = normalize(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }

  return result
}

function rowValues(sheet: Sheet, rowIndex: number): string[] {
  const row = sheet.rawRows[rowIndex] ?? []
  return Array.from({ length: sheet.columnCount }, (_, index) => clean(row[index]))
}

function findHeader(sheet: Sheet, definitions: ColumnDefinition[], minimumMatches: number) {
  let best: { row: number; indexes: number[]; score: number } | null = null

  for (let rowIndex = 0; rowIndex < sheet.rawRows.length; rowIndex += 1) {
    const values = rowValues(sheet, rowIndex).map(normalize)
    const indexes = definitions.map(([, aliases]) => {
      for (const alias of aliases) {
        const index = values.indexOf(normalize(alias))
        if (index >= 0) return index
      }
      return -1
    })
    const score = indexes.filter((index) => index >= 0).length

    if (!best || score > best.score) {
      best = { row: rowIndex, indexes, score }
    }
  }

  if (!best || best.score < minimumMatches) return null
  return best
}

function getValue(row: string[], columns: ColumnDefinition[], label: string): string {
  const index = columns.findIndex(([column]) => column === label)
  return index >= 0 ? clean(row[index]) : ""
}

const DEPARTMENT_SECTION_ORDER = [
  "High Command",
  "Trial High Command",
  "Low Command",
  "Trial Low Command",
  "Supervisors",
  "Supervisor In Training",
  "Patrol Officers",
  "Cadets",
] as const

const DEPARTMENT_SECTION_ALIASES: Record<string, string> = {
  highcommand: "High Command",
  trialhighcommand: "Trial High Command",
  lowcommand: "Low Command",
  triallowcommand: "Trial Low Command",
  supervisors: "Supervisors",
  supervisor: "Supervisors",
  trialsupervisor: "Supervisor In Training",
  supervisorintraining: "Supervisor In Training",
  patrol: "Patrol Officers",
  patrolofficers: "Patrol Officers",
  cadet: "Cadets",
  cadets: "Cadets",
}

function sectionName(value: string): string {
  return DEPARTMENT_SECTION_ALIASES[normalize(value)] ?? ""
}

function sectionFromRow(row: string[]): string {
  for (const value of row) {
    const section = sectionName(value)
    if (section) return section
  }
  return ""
}

function isRepeatedDepartmentHeader(row: string[]): boolean {
  const normalized = row.map(normalize).filter(Boolean)
  if (!normalized.length) return false

  const headerWords = DEPARTMENT_COLUMNS.flatMap(([, aliases]) =>
    aliases.map(normalize),
  )

  const matches = normalized.filter((value) => headerWords.includes(value)).length
  return matches >= 4
}

function getSectionColumn(sheet: Sheet): number {
  const headers = sheet.headers.map(normalize)
  for (const alias of ["Section", "Division", "Department", "Command"]) {
    const index = headers.indexOf(normalize(alias))
    if (index >= 0) return index
  }
  return -1
}

function findHomeCellValue(sheet: Sheet, label: string): string {
  const position = findCell(sheet, label)
  if (!position) return ""

  const row = rowValues(sheet, position.row)
  for (let column = position.column + 1; column < Math.min(sheet.columnCount, position.column + 4); column += 1) {
    const value = clean(row[column])
    if (value) return value
  }

  return ""
}

function homeSubdivisionRows(
  sheet: Sheet,
  title: string,
  rows: Array<[string, string]>,
): Array<[string, string]> {
  const titlePosition = findCell(sheet, title)
  if (!titlePosition) {
    return rows.map(([label]) => [label, ""])
  }

  const startRow = titlePosition.row + 1
  const startColumn = titlePosition.column
  const endRow = Math.min(sheet.rawRows.length - 1, startRow + 12)
  const wanted = new Map(rows.map(([label]) => [normalize(label), label]))
  const found = new Map<string, string>()

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = rowValues(sheet, rowIndex)
    const cells = row.slice(startColumn, Math.min(sheet.columnCount, startColumn + 4))

    for (let i = 0; i < cells.length; i += 1) {
      const label = clean(cells[i])
      if (!label) continue

      const wantedLabel = wanted.get(normalize(label))
      if (!wantedLabel) continue

      let value = ""
      for (let j = i + 1; j < cells.length; j += 1) {
        if (clean(cells[j])) {
          value = clean(cells[j])
          break
        }
      }
      found.set(normalize(wantedLabel), value)
    }
  }

  return rows.map(([label]) => [label, found.get(normalize(label)) ?? findHomeCellValue(sheet, label)])
}

function homeSubdivisionTable(sheet: Sheet): Array<{
  title: string
  rows: Array<[string, string]>
}> {
  const sections = [
    {
      title: "Field Training Division",
      rows: [["Director", ""], ["Co-Director", ""]] as Array<[string, string]>,
    },
    {
      title: "Traffic & Rescue Unit",
      rows: [["TRU-01", ""], ["TRU-02", ""], ["TRU-03", ""]] as Array<[string, string]>,
    },
    {
      title: "Gang Investigations Unit",
      rows: [["GIU-01", ""], ["GIU-02", ""], ["GIU-03", ""], ["GIU-04", ""], ["GIU-05", ""]] as Array<[string, string]>,
    },
    {
      title: "SWAT",
      rows: [["SWAT-01", ""], ["SWAT-02", ""], ["SWAT-03", ""], ["SWAT-04", ""], ["SWAT-05", ""]] as Array<[string, string]>,
    },
  ]

  return sections.map((section) => ({
    title: section.title,
    rows: homeSubdivisionRows(sheet, section.title, section.rows),
  }))
}

function parseDepartment(sheet: Sheet): DepartmentRow[] {
  const header = findHeader(sheet, DEPARTMENT_COLUMNS, 6)
  if (!header) return []

  const sectionColumn = getSectionColumn(sheet)
  const result: DepartmentRow[] = []
  let currentSection = ""

  for (let rowIndex = header.row + 1; rowIndex < sheet.rawRows.length; rowIndex += 1) {
    const source = rowValues(sheet, rowIndex)
    if (!source.some(Boolean)) continue

    // The Google Sheet repeats the column headings between command sections.
    // Never allow "Callsign" (or another column heading) to become a section.
    if (isRepeatedDepartmentHeader(source)) continue

    const explicitSection = sectionColumn >= 0 ? sectionName(clean(source[sectionColumn])) : ""
    const rowSection = sectionFromRow(source)

    if (explicitSection || rowSection) {
      currentSection = explicitSection || rowSection
      continue
    }

    const selected = header.indexes.map((index) =>
      index >= 0 ? clean(source[index]) : "",
    )

    if (!selected.some(Boolean)) continue

    // A repeated header can sometimes arrive as a single populated cell.
    if (normalize(selected[0]) === "callsign") continue

    const row: DepartmentRow = {
      section: currentSection,
      callsign: getValue(selected, DEPARTMENT_COLUMNS, "Callsign"),
      badgeNumber: getValue(selected, DEPARTMENT_COLUMNS, "Badge Number"),
      name: getValue(selected, DEPARTMENT_COLUMNS, "Name"),
      rank: getValue(selected, DEPARTMENT_COLUMNS, "Rank"),
      jobDescription: getValue(selected, DEPARTMENT_COLUMNS, "Job Description"),
      timeInDept: getValue(selected, DEPARTMENT_COLUMNS, "Time in Dept"),
      timeInRank: getValue(selected, DEPARTMENT_COLUMNS, "Time in Rank"),
      status: getValue(selected, DEPARTMENT_COLUMNS, "Status"),
      discordId: getValue(selected, DEPARTMENT_COLUMNS, "Discord ID"),
      hoursThisMonth: getValue(selected, DEPARTMENT_COLUMNS, "Hours This Month"),
    }

    if (row.callsign || row.badgeNumber || row.name || row.discordId) {
      result.push(row)
    }
  }

  return result
}

function parseEmployees(sheet: Sheet): EmployeeRow[] {
  const header = findHeader(sheet, EMPLOYEE_COLUMNS, 10)
  if (!header) return []

  const result: EmployeeRow[] = []
  let currentSection = ""

  for (let rowIndex = header.row + 1; rowIndex < sheet.rawRows.length; rowIndex += 1) {
    const source = rowValues(sheet, rowIndex)
    if (!source.some(Boolean)) continue

    if (isRepeatedDepartmentHeader(source)) continue

    const sectionRow = sectionFromRow(source)
    if (sectionRow) {
      currentSection = sectionRow
      continue
    }

    const selected = header.indexes.map((index) =>
      index >= 0 ? clean(source[index]) : "",
    )

    if (!selected.some(Boolean)) continue

    if (normalize(selected[0]) === "badgenumber" || normalize(selected[1]) === "name") continue

    const normalized = selected.map(normalize)
    const headerWords = EMPLOYEE_COLUMNS.map(([label]) => normalize(label))
    if (headerWords.filter((word) => normalized.includes(word)).length >= 6) {
      continue
    }

    const row: EmployeeRow = {
      section: currentSection,
      badgeNumber: getValue(selected, EMPLOYEE_COLUMNS, "Badge Number"),
      name: getValue(selected, EMPLOYEE_COLUMNS, "Name"),
      discordId: getValue(selected, EMPLOYEE_COLUMNS, "Discord ID"),
      departmentStatus: getValue(selected, EMPLOYEE_COLUMNS, "Department Status"),
      rank: getValue(selected, EMPLOYEE_COLUMNS, "Rank"),
      timezone: getValue(selected, EMPLOYEE_COLUMNS, "Timezone"),
      joinDeptDate: getValue(selected, EMPLOYEE_COLUMNS, "Join Dept Date"),
      promoDate: getValue(selected, EMPLOYEE_COLUMNS, "Promo Date"),
      strike1: getValue(selected, EMPLOYEE_COLUMNS, "Strike 1"),
      strike2: getValue(selected, EMPLOYEE_COLUMNS, "Strike 2"),
      callsign: getValue(selected, EMPLOYEE_COLUMNS, "Callsign"),
      timeInDept: getValue(selected, EMPLOYEE_COLUMNS, "Time in Dept"),
      terminated: getValue(selected, EMPLOYEE_COLUMNS, "Terminated"),
      loa: getValue(selected, EMPLOYEE_COLUMNS, "LOA"),
      resigned: getValue(selected, EMPLOYEE_COLUMNS, "Resigned"),
      thisMonthHours: getValue(selected, EMPLOYEE_COLUMNS, "This Month's Hours"),
      lastMonthHours: getValue(selected, EMPLOYEE_COLUMNS, "Last Month's Hours"),
    }

    if (row.badgeNumber || row.name || row.discordId) {
      result.push(row)
    }
  }

  return result
}

function parseRankedRows(sheet: Sheet, definitions: ColumnDefinition[]): string[][] {
  const rankDefinition: ColumnDefinition = ["Rank", ["Rank"]]
  const allDefinitions = [rankDefinition, ...definitions]
  const header = findHeader(sheet, allDefinitions, Math.max(2, Math.ceil(allDefinitions.length * 0.55)))
  if (!header) return []

  const result: string[][] = []
  let currentRank = ""

  for (let rowIndex = header.row + 1; rowIndex < sheet.rawRows.length; rowIndex += 1) {
    const source = rowValues(sheet, rowIndex)
    const rank = header.indexes[0] >= 0 ? clean(source[header.indexes[0]]) : ""
    if (rank) currentRank = rank

    const selected = header.indexes.slice(1).map((index) => (index >= 0 ? clean(source[index]) : ""))
    if (!currentRank || !selected.some(Boolean)) continue

    const normalized = selected.map(normalize)
    if (normalized.includes("vehiclename") || normalized.includes("classname") || normalized.includes("sharedoutfitcode")) continue

    result.push([currentRank, ...selected])
  }

  return result
}

function findCell(sheet: Sheet, label: string): { row: number; column: number } | null {
  const wanted = normalize(label)

  for (let row = 0; row < sheet.rawRows.length; row += 1) {
    const values = rowValues(sheet, row)
    for (let column = 0; column < values.length; column += 1) {
      if (normalize(values[column]) === wanted) return { row, column }
    }
  }

  return null
}

function nearby(
  sheet: Sheet,
  position: { row: number; column: number },
  rowRadius: number,
  columnRadius: number,
  excludedTitles: string[] = [],
): string[] {
  const values: string[] = []
  const seen = new Set<string>()
  const excluded = new Set(excludedTitles.map(normalize))

  const startRow = Math.max(0, position.row + 1)
  const endRow = Math.min(sheet.rawRows.length - 1, position.row + rowRadius)
  const startColumn = Math.max(0, position.column - columnRadius)
  const endColumn = Math.min(sheet.columnCount - 1, position.column + columnRadius)

  for (let row = startRow; row <= endRow; row += 1) {
    const rowData = rowValues(sheet, row)

    for (let column = startColumn; column <= endColumn; column += 1) {
      const value = clean(rowData[column])
      const key = normalize(value)

      if (!value || seen.has(key) || excluded.has(key)) continue

      seen.add(key)
      values.push(value)
    }
  }

  return values
}

function homeValues(
  sheet: Sheet,
  title: string,
  rowRadius: number,
  columnRadius = 2,
): string[] {
  const position = findCell(sheet, title)
  if (!position) return []

  return nearby(
    sheet,
    position,
    rowRadius,
    columnRadius,
    HOME_CARDS.map((card) => card.title),
  )
}

function HomeCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border bg-muted/20 px-4 py-3">
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
  const hours = homeValues(sheet, "This Month's Dept. Hours", 4, 1)
  const documents = uniqueInOrder(homeValues(sheet, "Documents", 10, 2))
  const statistics = uniqueInOrder(homeValues(sheet, "Statistics", 12, 2))
  const subdivisionSections = homeSubdivisionTable(sheet)
  const founders = uniqueInOrder(homeValues(sheet, "Metro PD Founders", 15, 2))

  const leadership = HOME_CARDS.filter((card) => card.kind === "leadership").map((card) => ({
    ...card,
    values: uniqueInOrder(homeValues(sheet, card.title, 5, 2)),
  }))

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-3">
      <div className="space-y-4">
        <HomeCard title="This Month's Dept. Hours" icon={RefreshCw}>
          <p className="text-3xl font-bold tracking-tight">{display(hours[0])}</p>
          <p className="mt-1 text-xs text-muted-foreground">Current department hours from the MPD Home sheet.</p>
        </HomeCard>

        <HomeCard title="Documents" icon={FileText}>
          <div className="space-y-2">
            {documents.length ? documents.slice(0, 12).map((value) => (
              <div key={value} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm">{value}</div>
            )) : <p className="text-sm text-muted-foreground">No document data found.</p>}
          </div>
        </HomeCard>

        <HomeCard title="Statistics" icon={Award}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {statistics.length ? statistics.slice(0, 16).map((value) => (
              <div key={value} className="rounded-lg border border-border px-3 py-2 text-sm font-medium">{value}</div>
            )) : <p className="text-sm text-muted-foreground">No statistics found.</p>}
          </div>
        </HomeCard>
      </div>

      <div className="space-y-4">
        {leadership.map(({ title, icon, values }) => (
          <HomeCard key={title} title={title} icon={icon}>
            {values.length ? (
              <div className="space-y-2">
                {values.slice(0, 8).map((value, index) => (
                  <div key={`${title}-${value}`} className={index === 0 ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{value}</div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No data found.</p>}
          </HomeCard>
        ))}
      </div>

      <div className="space-y-4">
        <HomeCard title="1N-05" icon={Shield}>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-center text-sm font-semibold">
            Vacant
          </div>
        </HomeCard>

        <HomeCard title="FTD & Subdivisions" icon={Users}>
          <div className="overflow-hidden rounded-md border border-blue-950/70 bg-muted/10">
            {subdivisionSections.map((section) => (
              <div key={section.title}>
                <div className="border-b border-blue-950/70 bg-muted/70 px-3 py-2 text-center text-xs font-bold">
                  {section.title}
                </div>
                {section.rows.map(([label, value]) => (
                  <div key={`${section.title}-${label}`} className="grid grid-cols-[88px_minmax(0,1fr)] border-b border-blue-950/70 last:border-b-0">
                    <div className="border-r border-blue-950/70 px-2 py-1.5 text-center text-xs font-medium">{label}</div>
                    <div className="px-2 py-1.5 text-center text-xs">{display(value)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </HomeCard>

        <HomeCard title="Metro PD Founders" icon={Shield}>
          <div className="space-y-2">
            {founders.length ? founders.slice(0, 20).map((value) => (
              <div key={value} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm">{value}</div>
            )) : <p className="text-sm text-muted-foreground">No founder data found.</p>}
          </div>
        </HomeCard>
      </div>
    </div>
  )
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto"><table className="w-full min-w-max border-collapse text-xs">{children}</table></div>
}

function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border bg-muted/30"><tr>{children}</tr></thead>
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap border-b border-border px-3 py-3 text-center align-middle ${className}`}>{children}</td>
}

function StatusBadge({ value }: { value: string }) {
  const normalized = normalize(value)
  const positive = ["active", "current", "approved", "compliant"].includes(normalized)
  const negative = ["inactive", "terminated", "resigned", "suspended"].includes(normalized)
  const leave = ["loa", "leave", "leaveofabsence"].includes(normalized)

  if (!positive && !negative && !leave) return <span>{display(value)}</span>

  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${positive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : leave ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>{display(value)}</span>
}

function BooleanBadge({ value }: { value: string }) {
  if (!clean(value)) return <span>—</span>
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${isTrue(value) ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-border bg-muted/40 text-muted-foreground"}`}>{isTrue(value) ? "Yes" : "No"}</span>
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center"><ClipboardList className="h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{message}</p></div>
}

function LoadingState() {
  return <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center"><RefreshCw className="h-6 w-6 animate-spin text-blue-500" /><p className="mt-3 text-sm text-muted-foreground">Loading roster data...</p></div>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center"><XCircle className="h-7 w-7 text-red-500" /><p className="mt-3 text-sm font-semibold">Failed to load Main Roster</p><p className="mt-1 max-w-xl text-xs text-muted-foreground">{message}</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try Again</Button></div>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div className="relative min-w-[165px]"><Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"><option value="">All {label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /></div>
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
        <Shield className="h-4 w-4 text-blue-500" />
      </div>
      <h3 className="text-sm font-semibold">{display(title)}</h3>
    </div>
  )
}

function DepartmentTable({ groups }: { groups: Array<[string, DepartmentRow[]]> }) {
  const visibleGroups = groups.filter(([, rows]) => rows.length)

  if (!visibleGroups.length) {
    return <EmptyState message="No Department Roster records match your filters." />
  }

  return (
    <div className="space-y-4 p-4">
      {visibleGroups.map(([section, rows]) => (
        <section key={section} className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionHeader title={section || "Department Roster"} />
          <TableShell>
            <TableHead>
              {DEPARTMENT_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}
            </TableHead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.badgeNumber || row.discordId || row.name}-${index}`}
                  className="transition-colors hover:bg-muted/20"
                >
                  <Td className="font-semibold">{display(row.callsign)}</Td>
                  <Td>{display(row.badgeNumber)}</Td>
                  <Td className="font-medium">{display(row.name)}</Td>
                  <Td>{display(row.rank)}</Td>
                  <Td className="max-w-sm whitespace-normal text-left">{display(row.jobDescription)}</Td>
                  <Td>{display(row.timeInDept)}</Td>
                  <Td>{display(row.timeInRank)}</Td>
                  <Td><StatusBadge value={row.status} /></Td>
                  <Td className="font-mono text-[10px]">{display(row.discordId)}</Td>
                  <Td>{display(row.hoursThisMonth)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </section>
      ))}
    </div>
  )
}

function EmployeeTable({ groups }: { groups: Array<[string, EmployeeRow[]]> }) {
  const visibleGroups = groups.filter(([, rows]) => rows.length)

  if (!visibleGroups.length) {
    return <EmptyState message="No Employee Database records match your filters." />
  }

  return (
    <div className="space-y-4 p-4">
      {visibleGroups.map(([section, rows]) => (
        <section key={section} className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionHeader title={section || "Employee Database"} />
          <TableShell>
            <TableHead>
              {EMPLOYEE_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}
            </TableHead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.badgeNumber || row.discordId || row.name}-${index}`}
                  className="transition-colors hover:bg-muted/20"
                >
                  <Td className="font-semibold">{display(row.badgeNumber)}</Td>
                  <Td className="font-medium">{display(row.name)}</Td>
                  <Td className="font-mono text-[10px]">{display(row.discordId)}</Td>
                  <Td><StatusBadge value={row.departmentStatus} /></Td>
                  <Td>{display(row.rank)}</Td>
                  <Td>{display(row.timezone)}</Td>
                  <Td>{display(row.joinDeptDate)}</Td>
                  <Td>{display(row.promoDate)}</Td>
                  <Td><BooleanBadge value={row.strike1} /></Td>
                  <Td><BooleanBadge value={row.strike2} /></Td>
                  <Td className="font-semibold">{display(row.callsign)}</Td>
                  <Td>{display(row.timeInDept)}</Td>
                  <Td><BooleanBadge value={row.terminated} /></Td>
                  <Td><BooleanBadge value={row.loa} /></Td>
                  <Td><BooleanBadge value={row.resigned} /></Td>
                  <Td>{display(row.thisMonthHours)}</Td>
                  <Td>{display(row.lastMonthHours)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </section>
      ))}
    </div>
  )
}

function RankSection({ rank, children }: { rank: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center gap-2.5 border-b border-border bg-muted/20 px-4 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10"><Shield className="h-4 w-4 text-blue-500" /></div><h3 className="text-sm font-semibold">{display(rank)}</h3></div>{children}</section>
}

function VehicleSections({ rows }: { rows: VehicleRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, VehicleRow[]>()
    for (const row of rows) { const rank = row.rank || "Unassigned"; const list = map.get(rank) ?? []; list.push(row); map.set(rank, list) }
    return Array.from(map.entries())
  }, [rows])

  if (!rows.length) return <EmptyState message="No Vehicle Roster records were found." />

  return <div className="space-y-4 p-4">{groups.map(([rank, vehicles]) => <RankSection key={rank} rank={rank}><TableShell><TableHead>{VEHICLE_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}</TableHead><tbody>{vehicles.map((vehicle, index) => <tr key={`${vehicle.spawncode || vehicle.vehicleName}-${index}`} className="transition-colors hover:bg-muted/20"><Td className="font-medium">{display(vehicle.vehicleName)}</Td><Td className="font-mono text-[10px]">{display(vehicle.spawncode)}</Td><Td>{display(vehicle.requiredExtras)}</Td><Td>{display(vehicle.livery)}</Td><Td>{display(vehicle.windowTint)}</Td><Td><BooleanBadge value={vehicle.turbo} /></Td><Td><BooleanBadge value={vehicle.slicktopOptional} /></Td><Td><BooleanBadge value={vehicle.unmarkedAllowed} /></Td></tr>)}</tbody></TableShell></RankSection>)}</div>
}

function UniformSections({ rows }: { rows: UniformRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, UniformRow[]>()
    for (const row of rows) { const rank = row.rank || "Unassigned"; const list = map.get(rank) ?? []; list.push(row); map.set(rank, list) }
    return Array.from(map.entries())
  }, [rows])

  if (!rows.length) return <EmptyState message="No Uniform Roster records were found." />

  return <div className="space-y-4 p-4">{groups.map(([rank, uniforms]) => <RankSection key={rank} rank={rank}><TableShell><TableHead><Th>Rank</Th>{UNIFORM_COLUMNS.map(([label]) => <Th key={label}>{label}</Th>)}</TableHead><tbody>{uniforms.map((uniform, index) => <tr key={`${uniform.sharedOutfitCode || uniform.className}-${index}`} className="transition-colors hover:bg-muted/20"><Td className="font-medium">{display(uniform.rank)}</Td><Td>{display(uniform.className)}</Td><Td className="font-mono text-[10px]">{display(uniform.sharedOutfitCode)}</Td></tr>)}</tbody></TableShell></RankSection>)}</div>
}

function countCards(department: DepartmentRow[], employees: EmployeeRow[], vehicles: VehicleRow[], uniforms: UniformRow[]) {
  return [
    { label: "Department", value: department.length, icon: Shield },
    { label: "Employees", value: employees.length, icon: Users },
    { label: "Vehicles", value: vehicles.length, icon: Car },
    { label: "Uniforms", value: uniforms.length, icon: Shirt },
  ]
}

function StatCards({ cards }: { cards: ReturnType<typeof countCards> }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-blue-500" /></div><p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p></div>)}</div>
}

export default function MainRoster() {
  const [page, setPage] = useState<SheetKey>("home")
  const [sheets, setSheets] = useState<Partial<Record<SheetKey, Sheet>>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rankFilter, setRankFilter] = useState("")

  const pageInfo = pages.find((item) => item.id === page) ?? pages[0]
  const PageIcon = pageInfo.icon
  const sheet = sheets[page]

  const loadSheet = useCallback(async (selectedPage: SheetKey, showLoading = true, forceRefresh = false) => {
    if (showLoading) setLoading(true)
    setError(null)

    try {
      const query = forceRefresh ? "?refresh=1" : ""
      const response = await fetch(`/api/main-roster/${selectedPage}${query}`, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
      const data = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !data?.success || !data.sheet) {
        throw new Error(data?.error || `Failed to load ${pageInfo.label} (${response.status}).`)
      }

      setSheets((current) => ({ ...current, [selectedPage]: data.sheet as Sheet }))
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : `Failed to load ${pageInfo.label}.`
      setError(message)
      if (showLoading) toast.error("Failed to load Main Roster", { description: message })
    } finally {
      setLoading(false)
    }
  }, [pageInfo.label])

  useEffect(() => {
    setSearch("")
    setStatusFilter("")
    setRankFilter("")
    void loadSheet(page, true, false)
  }, [page, loadSheet])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadSheet(page, false, false)
    }, 30 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [page, loadSheet])

  const refresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadSheet(page, false, true)
      toast.success("Main Roster refreshed", { description: `Latest ${pageInfo.label} data loaded from Google Sheets.` })
    } finally {
      setRefreshing(false)
    }
  }, [loadSheet, page, pageInfo.label, refreshing])

  const departmentRows = useMemo(() => parseDepartment(sheets["department-roster"] ?? ({ rawRows: [], columnCount: 0 } as Sheet)), [sheets])
  const employeeRows = useMemo(() => parseEmployees(sheets["employee-database"] ?? ({ rawRows: [], columnCount: 0 } as Sheet)), [sheets])
  const vehicleRows = useMemo(() => parseRankedRows(sheets["vehicle-roster"] ?? ({ rawRows: [], columnCount: 0 } as Sheet), VEHICLE_COLUMNS).map((row) => ({ rank: row[0], vehicleName: row[1], spawncode: row[2], requiredExtras: row[3], livery: row[4], windowTint: row[5], turbo: row[6], slicktopOptional: row[7], unmarkedAllowed: row[8] })), [sheets])
  const uniformRows = useMemo(() => parseRankedRows(sheets["uniform-roster"] ?? ({ rawRows: [], columnCount: 0 } as Sheet), UNIFORM_COLUMNS).map((row) => ({ rank: row[0], className: row[1], sharedOutfitCode: row[2] })), [sheets])

  const statusOptions = useMemo(
    () => uniqueInOrder(departmentRows.map((row) => row.status)),
    [departmentRows],
  )

  const departmentRankOptions = useMemo(
    () => uniqueInOrder(departmentRows.map((row) => row.rank)),
    [departmentRows],
  )

  const employeeRankOptions = useMemo(
    () => uniqueInOrder(employeeRows.map((row) => row.rank)),
    [employeeRows],
  )

  const filteredDepartmentRows = useMemo(() => {
    const query = normalize(search)

    return departmentRows.filter((row) => {
      const matchesSearch =
        !query ||
        [
          row.callsign,
          row.badgeNumber,
          row.name,
          row.rank,
          row.jobDescription,
          row.status,
          row.discordId,
          row.hoursThisMonth,
        ].some((value) => normalize(value).includes(query))

      const matchesStatus =
        !statusFilter || normalize(row.status) === normalize(statusFilter)

      const matchesRank =
        !rankFilter || normalize(row.rank) === normalize(rankFilter)

      return matchesSearch && matchesStatus && matchesRank
    })
  }, [departmentRows, search, statusFilter, rankFilter])

  const filteredEmployeeRows = useMemo(() => {
    const query = normalize(search)

    return employeeRows.filter((row) => {
      const matchesSearch =
        !query ||
        [
          row.badgeNumber,
          row.name,
          row.discordId,
          row.departmentStatus,
          row.rank,
          row.timezone,
          row.joinDeptDate,
          row.promoDate,
          row.callsign,
          row.timeInDept,
          row.thisMonthHours,
          row.lastMonthHours,
        ].some((value) => normalize(value).includes(query))

      const matchesRank =
        !rankFilter || normalize(row.rank) === normalize(rankFilter)

      return matchesSearch && matchesRank
    })
  }, [employeeRows, search, rankFilter])

  const departmentGroups = useMemo(() => {
    const groups = new Map<string, DepartmentRow[]>()

    for (const section of DEPARTMENT_SECTION_ORDER) {
      groups.set(section, [])
    }

    for (const row of filteredDepartmentRows) {
      const section = sectionName(row.section) || row.section
      if (!groups.has(section)) continue
      groups.get(section)!.push(row)
    }

    return Array.from(groups.entries()).filter(([, rows]) => rows.length)
  }, [filteredDepartmentRows])

  const employeeGroups = useMemo(() => {
    const groups = new Map<string, EmployeeRow[]>()

    for (const section of DEPARTMENT_SECTION_ORDER) {
      groups.set(section, [])
    }

    for (const row of filteredEmployeeRows) {
      const section = sectionName(row.section) || row.section
      if (!groups.has(section)) continue
      groups.get(section)!.push(row)
    }

    return Array.from(groups.entries()).filter(([, rows]) => rows.length)
  }, [filteredEmployeeRows])

  const counts = countCards(departmentRows, employeeRows, vehicleRows, uniformRows)

  return (
    <DashboardLayout>
      <div className="flex min-h-full min-w-0 flex-col gap-4 overflow-x-hidden p-3 sm:gap-6 sm:p-6">
        <div className="flex shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10"><ClipboardList className="h-5 w-5 text-blue-500" /></div>
            <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Main Roster</h1><p className="text-sm text-muted-foreground">Metro Police Department master roster and operational data.</p></div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing || loading} className="w-fit gap-2"><RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{refreshing ? "Refreshing..." : "Refresh"}</Button>
        </div>

        <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="inline-flex min-w-full items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 sm:min-w-0">{pages.map((item) => { const active = item.id === page; const Icon = item.icon; return <button key={item.id} type="button" onClick={() => { setPage(item.id); setSearch(""); setStatusFilter(""); setRankFilter("") }} className={active ? "shrink-0 rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 shadow-sm sm:px-4 sm:text-sm" : "shrink-0 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-4 sm:text-sm"}><Icon className="mr-1.5 inline h-3.5 w-3.5" />{item.label}</button> })}</div></div>

        {page !== "home" && <StatCards cards={counts} />}

        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10"><PageIcon className="h-4 w-4 text-blue-500" /></div><div><h2 className="text-base font-semibold">{pageInfo.label}</h2><p className="text-xs text-muted-foreground">Data is read directly from the configured Google Sheet.</p></div></div>
            {(page === "department-roster" || page === "employee-database") && <div className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row"><div className="relative w-full xl:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${pageInfo.label.toLowerCase()}...`} className="pl-9" /></div>{page === "department-roster" ? <><FilterSelect label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} /><FilterSelect label="Rank" value={rankFilter} options={departmentRankOptions} onChange={setRankFilter} /></> : <FilterSelect label="Rank" value={rankFilter} options={employeeRankOptions} onChange={setRankFilter} />}</div>}
          </div>

          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void loadSheet(page, true, false)} /> : !sheet ? <EmptyState message="No roster data is available." /> : page === "home" ? <HomeView sheet={sheet} /> : page === "department-roster" ? <DepartmentTable groups={departmentGroups} /> : page === "employee-database" ? <EmployeeTable groups={employeeGroups} /> : page === "vehicle-roster" ? <VehicleSections rows={vehicleRows} /> : <UniformSections rows={uniformRows} />}
        </section>
      </div>
    </DashboardLayout>
  )
}
