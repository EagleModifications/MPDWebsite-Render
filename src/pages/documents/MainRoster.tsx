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

type Color = {
  red?: number
  green?: number
  blue?: number
  alpha?: number
}

type Border = {
  style?: string
  color?: Color
}

type CellStyle = {
  backgroundColor?: Color
  textColor?: Color
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  horizontalAlignment?: string
  verticalAlignment?: string
  wrapStrategy?: string
  padding?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  borders?: {
    top?: Border
    right?: Border
    bottom?: Border
    left?: Border
  }
}

type Cell = {
  value: string
  formula?: string
  hyperlink?: string
  styleId: number
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
  sheetRowCount: number
  sheetColumnCount: number
  hideGridlines: boolean
  frozenRowCount: number
  frozenColumnCount: number
  rowHeights: number[]
  columnWidths: number[]
  hiddenRows: number[]
  hiddenColumns: number[]
  merges: Merge[]
  styles: CellStyle[]
  cells: Cell[][]
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
  ["Callsign", "callsign"],
  ["Badge Number", "badgenumber"],
  ["Name", "name"],
  ["Rank", "rank"],
  ["Job Description", "jobdescription"],
  ["Time in Dept", "timeindept"],
  ["Time in Rank", "timeinrank"],
  ["Status", "status"],
  ["Discord ID", "discordid"],
  ["Hours This Month", "hoursthismonth"],
] as const

const EMPLOYEE_COLUMNS = [
  ["Badge Number", "badgenumber"],
  ["Name", "name", "names"],
  ["Discord ID", "discordid"],
  ["Department Status", "departmentstatus", "status"],
  ["Rank", "rank"],
  ["Timezone", "timezone"],
  ["Join Dept Date", "joindeptdate", "joindeptdateformat"],
  ["Promo Date", "promodate", "promodateformat"],
  ["Strike 1", "strike1"],
  ["Strike 2", "strike2"],
  ["Callsign", "callsign", "callsigns"],
  ["Time in Dept", "timeindept"],
  ["Terminated", "terminated"],
  ["LOA", "loa"],
  ["Resigned", "resigned"],
  ["This Month's Hours", "thismonthshours", "thismonthhours"],
  ["Last Month's Hours", "lastmonthshours", "lastmonthhours"],
] as const

const VEHICLE_COLUMNS = [
  ["Vehicle Name", "vehiclename"],
  ["Spawncode", "spawncode"],
  ["Required Extras", "requiredextras"],
  ["Livery", "livery"],
  ["Window Tint", "windowtint", "windowting"],
  ["Turbo", "turbo"],
  ["Slicktop Optional", "slicktopoptional"],
  ["Unmarked Allowed", "unmarkedallowed"],
] as const

const UNIFORM_COLUMNS = [
  ["Class", "class"],
  ["Shared Outfit Code", "sharedoutfitcode"],
] as const

function clean(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim()
}

function normalize(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function displayValue(sheet: Sheet, row: number, column: number) {
  const direct = clean(sheet.cells[row]?.[column]?.value)
  if (direct) return direct

  const merge = sheet.merges.find(
    (item) =>
      row >= item.startRow &&
      row < item.endRow &&
      column >= item.startColumn &&
      column < item.endColumn,
  )

  if (merge) {
    return clean(sheet.cells[merge.startRow]?.[merge.startColumn]?.value)
  }

  return ""
}

function rowValues(sheet: Sheet, row: number) {
  return Array.from({ length: sheet.columnCount }, (_, column) =>
    displayValue(sheet, row, column),
  )
}

function findHeaderRow(
  sheet: Sheet,
  required: string[],
): { row: number; indexes: Record<string, number> } | null {
  for (let row = 0; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row).map(normalize)
    const indexes: Record<string, number> = {}

    for (const wanted of required) {
      const index = values.findIndex((value) => value === wanted)
      if (index >= 0) indexes[wanted] = index
    }

    if (required.every((wanted) => indexes[wanted] !== undefined)) {
      return { row, indexes }
    }
  }

  return null
}

function findColumn(
  sheet: Sheet,
  aliases: readonly string[],
  startRow = 0,
) {
  const wanted = aliases.map(normalize)

  for (let row = startRow; row < Math.min(sheet.rowCount, startRow + 20); row += 1) {
    const values = rowValues(sheet, row).map(normalize)
    for (const alias of wanted) {
      const index = values.findIndex((value) => value === alias)
      if (index >= 0) return { row, column: index }
    }
  }

  return null
}

function firstNonEmpty(values: string[]) {
  return values.find(Boolean) ?? ""
}

function boolValue(value: string) {
  const v = normalize(value)
  if (["true", "yes", "active"].includes(v)) return true
  if (["false", "no", "inactive"].includes(v)) return false
  return null
}

function StatusBadge({ value }: { value: string }) {
  const normalized = normalize(value)
  const positive = ["active", "yes", "true"].includes(normalized)
  const negative = ["terminated", "resigned", "loa", "false", "no"].includes(
    normalized,
  )

  if (!positive && !negative) return <span>{value || "—"}</span>

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        positive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-400",
      ].join(" ")}
    >
      {positive ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {value}
    </span>
  )
}

function TableShell({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: string[][]
  empty?: string
}) {
  if (!rows.length) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        {empty ?? "No records found."}
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`${rowIndex}-${row.join("|")}`}
              className="border-b transition-colors last:border-0 hover:bg-muted/20"
            >
              {headers.map((_, columnIndex) => {
                const value = row[columnIndex] ?? ""
                const bool = boolValue(value)

                return (
                  <td
                    key={`${rowIndex}-${columnIndex}`}
                    className="whitespace-nowrap px-3 py-2.5"
                  >
                    {bool !== null ? (
                      <StatusBadge value={value} />
                    ) : (
                      value || "—"
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function extractTable(
  sheet: Sheet,
  definitions: readonly (readonly [string, ...string[]])[],
  options?: { required?: string[] },
) {
  const required = options?.required ?? definitions.map((item) => item[1])
  const header = findHeaderRow(sheet, required)

  if (!header) {
    return {
      headers: definitions.map((item) => item[0]),
      rows: [] as string[][],
      headerRow: -1,
    }
  }

  const indexes = definitions.map((definition) => {
    const aliases = definition.slice(1).map(normalize)
    return aliases
      .map((alias) => header.indexes[alias])
      .find((index) => index !== undefined) ?? -1
  })

  const rows: string[][] = []

  for (let row = header.row + 1; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    const selected = indexes.map((index) => (index >= 0 ? values[index] ?? "" : ""))

    if (!selected.some(Boolean)) continue

    // Ignore repeated section headers and explanatory rows.
    const normalized = selected.map(normalize)
    if (
      normalized.includes("callsign") ||
      normalized.includes("badgenumber") ||
      normalized.includes("name") ||
      normalized.includes("rank")
    ) {
      continue
    }

    const hasPersonData = selected.some(Boolean)
    if (hasPersonData) rows.push(selected)
  }

  return {
    headers: definitions.map((item) => item[0]),
    rows,
    headerRow: header.row,
  }
}

function extractRankSections(
  sheet: Sheet,
  definitions: readonly (readonly [string, ...string[]])[],
) {
  const headerCandidates = definitions.map((item) => item[1])
  const firstHeader = findHeaderRow(sheet, headerCandidates)

  if (!firstHeader) return []

  const sections: { rank: string; rows: string[][] }[] = []
  let currentRank = ""

  for (let row = firstHeader.row + 1; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    const normalized = values.map(normalize)

    const headerLike = definitions.every((definition) =>
      definition.slice(1).some((alias) => normalized.includes(normalize(alias))),
    )

    if (headerLike) continue

    const rankColumn = 0
    const explicitRank = clean(values[rankColumn])

    if (explicitRank) currentRank = explicitRank

    const selected = definitions.slice(1).map((definition) => {
      const aliases = definition.map(normalize).slice(1)
      const index = values.findIndex((value) => aliases.includes(normalize(value)))
      return index >= 0 ? values[index] : ""
    })

    // The first definition is Rank and is supplied separately.
    const actualRow = values.some(Boolean) ? selected : []

    if (!actualRow.some(Boolean) || !currentRank) continue

    const existing = sections.find((section) => section.rank === currentRank)
    if (existing) {
      existing.rows.push(actualRow)
    } else {
      sections.push({ rank: currentRank, rows: [actualRow] })
    }
  }

  return sections
}

function extractVehicleSections(sheet: Sheet) {
  const header = findHeaderRow(sheet, [
    "rank",
    "vehiclename",
    "spawncode",
    "requiredextras",
    "livery",
    "windowtint",
    "turbo",
    "slicktopoptional",
    "unmarkedallowed",
  ])

  if (!header) return []

  const headerValues = rowValues(sheet, header.row).map(normalize)
  const columnFor = (aliases: string[]) =>
    aliases
      .map(normalize)
      .map((alias) => headerValues.indexOf(alias))
      .find((index) => index >= 0) ?? -1

  const rankColumn = columnFor(["rank"])
  const columns = {
    vehicle: columnFor(["vehiclename"]),
    spawn: columnFor(["spawncode"]),
    extras: columnFor(["requiredextras"]),
    livery: columnFor(["livery"]),
    tint: columnFor(["windowtint", "windowting"]),
    turbo: columnFor(["turbo"]),
    slicktop: columnFor(["slicktopoptional"]),
    unmarked: columnFor(["unmarkedallowed"]),
  }

  const sections: { rank: string; rows: string[][] }[] = []
  let currentRank = ""

  for (let row = header.row + 1; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    const normalized = values.map(normalize)

    const repeatedHeader = [
      "rank",
      "vehiclename",
      "spawncode",
    ].every((value) => normalized.includes(value))

    if (repeatedHeader) continue

    const explicitRank = rankColumn >= 0 ? clean(values[rankColumn]) : ""
    if (explicitRank) currentRank = explicitRank

    const output = [
      columns.vehicle,
      columns.spawn,
      columns.extras,
      columns.livery,
      columns.tint,
      columns.turbo,
      columns.slicktop,
      columns.unmarked,
    ].map((index) => (index >= 0 ? clean(values[index]) : ""))

    if (!output.some(Boolean) || !currentRank) continue

    // Skip the explanatory/example block at the top of the sheet.
    if (normalize(output[0]) === "example") continue

    const existing = sections.find((section) => section.rank === currentRank)
    if (existing) {
      existing.rows.push(output)
    } else {
      sections.push({
        rank: currentRank,
        rows: [output],
      })
    }
  }

  return sections
}

function extractUniformSections(sheet: Sheet) {
  const header = findHeaderRow(sheet, ["rank", "class", "sharedoutfitcode"])
  if (!header) return []

  const sections: { rank: string; rows: string[][] }[] = []
  let currentRank = ""

  for (let row = header.row + 1; row < sheet.rowCount; row += 1) {
    const values = rowValues(sheet, row)
    const normalized = values.map(normalize)

    const repeatedHeader = ["rank", "class", "sharedoutfitcode"].every((value) =>
      normalized.includes(value),
    )
    if (repeatedHeader) continue

    const rank = clean(values[header.indexes.rank])
    if (rank) currentRank = rank

    const classValue = clean(values[header.indexes.class])
    const outfit = clean(values[header.indexes.sharedoutfitcode])

    if (!classValue && !outfit) continue
    if (!currentRank) continue

    const existing = sections.find((section) => section.rank === currentRank)
    if (existing) existing.rows.push([classValue, outfit])
    else sections.push({ rank: currentRank, rows: [[classValue, outfit]] })
  }

  return sections
}

function findCell(sheet: Sheet, text: string) {
  const wanted = normalize(text)

  for (let row = 0; row < sheet.rowCount; row += 1) {
    for (let column = 0; column < sheet.columnCount; column += 1) {
      if (normalize(displayValue(sheet, row, column)) === wanted) {
        return { row, column }
      }
    }
  }

  return null
}

function nearbyValues(
  sheet: Sheet,
  startRow: number,
  startColumn: number,
  rowRadius = 3,
  columnRadius = 8,
) {
  const result: string[] = []
  const seen = new Set<string>()

  for (
    let row = Math.max(0, startRow - 1);
    row <= Math.min(sheet.rowCount - 1, startRow + rowRadius);
    row += 1
  ) {
    for (
      let column = Math.max(0, startColumn - columnRadius);
      column <= Math.min(sheet.columnCount - 1, startColumn + columnRadius);
      column += 1
    ) {
      const value = clean(displayValue(sheet, row, column))
      if (!value || seen.has(value)) continue
      seen.add(value)
      result.push(value)
    }
  }

  return result
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
    <section
      className={`overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background">
          <Icon className="h-4 w-4 text-blue-500" />
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function HomeView({ sheet }: { sheet: Sheet }) {
  const hoursPosition = findCell(sheet, "This Month's Dept. Hours")
  const documentsPosition = findCell(sheet, "Documents")
  const statisticsPosition = findCell(sheet, "Statistics")
  const ftdPosition = findCell(sheet, "FTD & Subdivisions")
  const foundersPosition = findCell(sheet, "Metro PD Founders")

  const hours = hoursPosition
    ? firstNonEmpty(
        nearbyValues(
          sheet,
          hoursPosition.row + 1,
          hoursPosition.column,
          4,
          3,
        ).filter(
          (value) =>
            normalize(value) !== normalize("This Month's Dept. Hours"),
        ),
      )
    : ""

  const documents = documentsPosition
    ? nearbyValues(
        sheet,
        documentsPosition.row,
        documentsPosition.column,
        7,
        8,
      ).filter(
        (value) =>
          normalize(value) !== normalize("Documents") &&
          value.length > 3,
      )
    : []

  const statistics = statisticsPosition
    ? nearbyValues(
        sheet,
        statisticsPosition.row + 1,
        statisticsPosition.column,
        10,
        6,
      ).filter((value) => /\d/.test(value))
    : []

  const founderValues = foundersPosition
    ? nearbyValues(
        sheet,
        foundersPosition.row + 1,
        foundersPosition.column,
        10,
        8,
      ).filter(
        (value) =>
          normalize(value) !== normalize("Metro PD Founders") &&
          value.length > 2,
      )
    : []

  const leadershipTitles = [
    "Chief of Police",
    "Deputy Chief of Police",
    "Assistant Chief of Police",
    "Chief of Staff",
    "Colonel",
  ]

  const leadership = leadershipTitles.map((title) => {
    const position = findCell(sheet, title)
    const values = position
      ? nearbyValues(sheet, position.row, position.column, 3, 6).filter(
          (value) => normalize(value) !== normalize(title),
        )
      : []

    return { title, values }
  })

  const subdivisionValues = ftdPosition
    ? nearbyValues(
        sheet,
        ftdPosition.row + 1,
        ftdPosition.column,
        30,
        8,
      ).filter((value) => normalize(value) !== normalize("FTD & Subdivisions"))
    : []

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4">
        <HomeCard title="This Month's Dept. Hours" icon={RefreshCw}>
          <div className="text-3xl font-bold tracking-tight">
            {hours || "—"}
          </div>
        </HomeCard>

        <HomeCard title="Documents" icon={FileText}>
          <div className="space-y-2">
            {documents.length ? (
              documents
                .filter((value, index) => documents.indexOf(value) === index)
                .slice(0, 8)
                .map((document) => (
                  <div
                    key={document}
                    className="rounded-lg border bg-muted/10 px-3 py-2 text-sm"
                  >
                    {document}
                  </div>
                ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No documents found.
              </div>
            )}
          </div>
        </HomeCard>

        <HomeCard title="Statistics" icon={Award}>
          <div className="space-y-2">
            {statistics.length ? (
              statistics
                .filter((value, index) => statistics.indexOf(value) === index)
                .map((stat) => (
                  <div
                    key={stat}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{stat}</span>
                  </div>
                ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No statistics found.
              </div>
            )}
          </div>
        </HomeCard>
      </div>

      <div className="space-y-4">
        {leadership.map(({ title, values }) => (
          <HomeCard key={title} title={title} icon={Shield}>
            {values.length ? (
              <div className="space-y-2">
                {values.slice(0, 5).map((value, index) => (
                  <div
                    key={`${title}-${index}-${value}`}
                    className={
                      index === 0
                        ? "text-sm font-semibold"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {value}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No data found.
              </div>
            )}
          </HomeCard>
        ))}
      </div>

      <div className="space-y-4">
        <HomeCard title="FTD & Subdivisions" icon={Users}>
          <div className="space-y-1">
            {subdivisionValues.length ? (
              subdivisionValues
                .filter(
                  (value, index) => subdivisionValues.indexOf(value) === index,
                )
                .slice(0, 40)
                .map((value, index) => (
                  <div
                    key={`${index}-${value}`}
                    className="rounded-md border px-3 py-1.5 text-xs"
                  >
                    {value}
                  </div>
                ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No subdivision data found.
              </div>
            )}
          </div>
        </HomeCard>

        <HomeCard title="Metro PD Founders" icon={Shield}>
          <div className="space-y-2">
            {founderValues.length ? (
              founderValues
                .filter((value, index) => founderValues.indexOf(value) === index)
                .slice(0, 12)
                .map((founder) => (
                  <div
                    key={founder}
                    className="rounded-lg border bg-muted/10 px-3 py-2 text-sm"
                  >
                    {founder}
                  </div>
                ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No founder data found.
              </div>
            )}
          </div>
        </HomeCard>
      </div>
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
  if (!options.length) return null

  return (
    <div className="relative">
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 appearance-none rounded-md border bg-background pl-8 pr-8 text-xs outline-none transition focus:ring-2 focus:ring-ring"
      >
        <option value="">All {label}</option>
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

function StandardTableView({
  sheet,
  type,
  search,
  setSearch,
  status,
  setStatus,
  rank,
  setRank,
}: {
  sheet: Sheet
  type: "department" | "employee"
  search: string
  setSearch: (value: string) => void
  status: string
  setStatus: (value: string) => void
  rank: string
  setRank: (value: string) => void
}) {
  const isDepartment = type === "department"

  const definitions = isDepartment ? DEPARTMENT_COLUMNS : EMPLOYEE_COLUMNS
  const required = isDepartment
    ? ["callsign", "badgenumber", "name", "rank", "status"]
    : ["badgenumber", "name", "rank"]

  const extracted = useMemo(
    () => extractTable(sheet, definitions, { required }),
    [sheet, definitions, required],
  )

  const rankColumn = definitions.findIndex(
    (definition) => definition[1] === "rank",
  )
  const statusColumn = isDepartment
    ? definitions.findIndex((definition) => definition[1] === "status")
    : definitions.findIndex((definition) =>
        definition.slice(1).includes("departmentstatus"),
      )

  const rankOptions = useMemo(
    () =>
      Array.from(
        new Set(
          extracted.rows
            .map((row) => clean(row[rankColumn]))
            .filter(Boolean),
        ),
      ),
    [extracted.rows, rankColumn],
  )

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          extracted.rows
            .map((row) => clean(row[statusColumn]))
            .filter(Boolean),
        ),
      ),
    [extracted.rows, statusColumn],
  )

  const filteredRows = useMemo(() => {
    const query = normalize(search)

    return extracted.rows.filter((row) => {
      const matchesSearch =
        !query || row.some((value) => normalize(value).includes(query))
      const matchesRank = !rank || row[rankColumn] === rank
      const matchesStatus =
        !isDepartment || !status || row[statusColumn] === status

      return matchesSearch && matchesRank && matchesStatus
    })
  }, [
    extracted.rows,
    isDepartment,
    rank,
    rankColumn,
    search,
    status,
    statusColumn,
  ])

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/10 p-3">
        <div className="relative min-w-[240px] flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${isDepartment ? "department roster" : "employee database"}...`}
            className="h-9 pl-9 text-xs"
          />
        </div>

        {isDepartment ? (
          <FilterSelect
            label="Status"
            value={status}
            options={statusOptions}
            onChange={setStatus}
          />
        ) : null}

        <FilterSelect
          label="Ranks"
          value={rank}
          options={rankOptions}
          onChange={setRank}
        />

        <div className="ml-auto text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredRows.length}</span>{" "}
          of {extracted.rows.length}
        </div>
      </div>

      <TableShell
        headers={extracted.headers}
        rows={filteredRows}
        empty="No matching records found."
      />
    </div>
  )
}

function VehicleView({ sheet }: { sheet: Sheet }) {
  const sections = useMemo(() => extractVehicleSections(sheet), [sheet])

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section
          key={section.rank}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3">
            <Shield className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold">{section.rank}</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {section.rows.length} vehicles
            </span>
          </div>
          <TableShell
            headers={[
              "Vehicle Name",
              "Spawncode",
              "Required Extras",
              "Livery",
              "Window Tint",
              "Turbo",
              "Slicktop Optional",
              "Unmarked Allowed",
            ]}
            rows={section.rows}
          />
        </section>
      ))}

      {!sections.length ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No vehicle roster data found.
        </div>
      ) : null}
    </div>
  )
}

function UniformView({ sheet }: { sheet: Sheet }) {
  const sections = useMemo(() => extractUniformSections(sheet), [sheet])

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section
          key={section.rank}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3">
            <Shirt className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold">{section.rank}</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {section.rows.length} uniforms
            </span>
          </div>
          <TableShell
            headers={["Class", "Shared Outfit Code"]}
            rows={section.rows}
          />
        </section>
      ))}

      {!sections.length ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No uniform roster data found.
        </div>
      ) : null}
    </div>
  )
}

export default function MainRoster() {
  const [page, setPage] = useState<SheetKey>("home")
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [rank, setRank] = useState("")

  const pageInfo = pages.find((item) => item.id === page) ?? pages[0]

  const loadSheet = useCallback(
    async (selectedPage: SheetKey, showToast = false) => {
      setLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/main-roster/${selectedPage}`, {
          cache: "no-store",
          credentials: "include",
        })

        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.success || !data.sheet) {
          throw new Error(data.error || `Failed to load ${pageInfo.label}.`)
        }

        setSheet(data.sheet)

        if (showToast) toast.success(`${pageInfo.label} refreshed`)
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : `Failed to load ${pageInfo.label}.`

        setSheet(null)
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [pageInfo.label],
  )

  useEffect(() => {
    setSearch("")
    setStatus("")
    setRank("")
    void loadSheet(page)
  }, [loadSheet, page])

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card shadow-sm">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Main Roster</h1>
              <p className="text-sm text-muted-foreground">
                Metro Police Department master roster and operational data.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSheet(page, true)}
            disabled={loading}
          >
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {pages.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={page === id ? "default" : "outline"}
              size="sm"
              onClick={() => setPage(id)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background">
              <pageInfo.icon className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold">{pageInfo.label}</h2>
              <p className="text-xs text-muted-foreground">
                {sheet ? `${sheet.rowCount.toLocaleString()} rows` : "Loading..."}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 p-3 md:p-4">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading {pageInfo.label}...
              </div>
            ) : error ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <XCircle className="mb-3 h-9 w-9 text-red-500" />
                <h3 className="font-semibold">Failed to load Main Roster</h3>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => void loadSheet(page)}
                >
                  Try Again
                </Button>
              </div>
            ) : !sheet ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No sheet data available.
              </div>
            ) : page === "home" ? (
              <HomeView sheet={sheet} />
            ) : page === "department-roster" ? (
              <StandardTableView
                sheet={sheet}
                type="department"
                search={search}
                setSearch={setSearch}
                status={status}
                setStatus={setStatus}
                rank={rank}
                setRank={setRank}
              />
            ) : page === "employee-database" ? (
              <StandardTableView
                sheet={sheet}
                type="employee"
                search={search}
                setSearch={setSearch}
                status=""
                setStatus={() => undefined}
                rank={rank}
                setRank={setRank}
              />
            ) : page === "vehicle-roster" ? (
              <VehicleView sheet={sheet} />
            ) : (
              <UniformView sheet={sheet} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
