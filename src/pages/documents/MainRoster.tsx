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
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
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

type MainRosterSheet = {
  key: SheetKey
  name: string
  gid: string
  headers: string[]
  rows: string[][]
  rawRows?: string[][]
  rowCount: number
  columnCount: number
}

type MainRosterResponse = {
  success: boolean
  sheet?: MainRosterSheet
  error?: string
}

type MainRosterPage = {
  id: SheetKey
  label: string
  icon: LucideIcon
}

const pages: MainRosterPage[] = [
  { id: "home", label: "Home", icon: FileSpreadsheet },
  { id: "department-roster", label: "Department Roster", icon: Shield },
  { id: "employee-database", label: "Employee Database", icon: Users },
  { id: "vehicle-roster", label: "Vehicle Roster", icon: Car },
  { id: "uniform-roster", label: "Uniform Roster", icon: Shirt },
]

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  const result = String(value).trim()

  if (
    !result ||
    result === "-" ||
    result === "—" ||
    result.toLowerCase() === "null" ||
    result.toLowerCase() === "undefined"
  ) {
    return ""
  }

  return result
}

function displayValue(value: unknown): string {
  return cleanValue(value) || "—"
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function findColumn(headers: string[], names: string[]): number {
  const normalized = headers.map(normalizeHeader)

  for (const name of names) {
    const index = normalized.indexOf(normalizeHeader(name))
    if (index !== -1) return index
  }

  return -1
}

function getCell(
  row: string[],
  headers: string[],
  names: string[],
): string {
  const index = findColumn(headers, names)
  return index === -1 ? "" : cleanValue(row[index])
}

function isImageUrl(value: string): boolean {
  const lower = value.toLowerCase()

  return (
    /^https?:\/\//.test(value) &&
    (
      /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(lower) ||
      lower.includes("googleusercontent.com") ||
      lower.includes("discordapp.com") ||
      lower.includes("discord.com") ||
      lower.includes("imgur.com")
    )
  )
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function statusClasses(status: string): string {
  const normalized = status.trim().toLowerCase()

  if (
    normalized === "active" ||
    normalized === "approved" ||
    normalized === "current" ||
    normalized === "compliant"
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

function StatusBadge({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase()

  const Icon =
    normalized === "active" ||
    normalized === "approved" ||
    normalized === "current" ||
    normalized === "compliant"
      ? CheckCircle2
      : normalized === "terminated" ||
          normalized === "resigned" ||
          normalized === "inactive" ||
          normalized === "suspended"
        ? XCircle
        : null

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        statusClasses(value),
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {displayValue(value)}
    </span>
  )
}

function BooleanBadge({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase()
  const yes = ["yes", "true", "1", "y"].includes(normalized)
  const no = ["no", "false", "0", "n"].includes(normalized)

  if (!yes && !no) {
    return <>{displayValue(value)}</>
  }

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        yes
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-muted/50 text-muted-foreground",
      ].join(" ")}
    >
      {yes ? "Yes" : "No"}
    </span>
  )
}

function isStatusHeader(header: string): boolean {
  return [
    "status",
    "department status",
    "employment status",
    "state",
  ].includes(header.trim().toLowerCase())
}

function isBooleanHeader(header: string): boolean {
  const normalized = header.trim().toLowerCase()

  return (
    normalized.includes("allowed") ||
    normalized.includes("optional") ||
    normalized.includes("turbo") ||
    normalized.includes("terminated") ||
    normalized.includes("resigned") ||
    normalized.includes("loa")
  )
}

function isImageHeader(header: string): boolean {
  const normalized = header.trim().toLowerCase()

  return (
    normalized.includes("image") ||
    normalized.includes("photo") ||
    normalized.includes("picture") ||
    normalized.includes("avatar") ||
    normalized.includes("logo") ||
    normalized.includes("icon")
  )
}

function ImageCell({ value }: { value: string }) {
  const [failed, setFailed] = useState(false)

  if (!isImageUrl(value) || failed) {
    return <>{displayValue(value)}</>
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center"
      title="Open image"
    >
      <img
        src={value}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-10 w-14 rounded-md border border-border object-cover"
      />
    </a>
  )
}

function CellValue({
  header,
  value,
}: {
  header: string
  value: string
}) {
  if (isImageHeader(header) && isImageUrl(value)) {
    return <ImageCell value={value} />
  }

  if (isStatusHeader(header) && value) {
    return <StatusBadge value={value} />
  }

  if (isBooleanHeader(header) && value) {
    return <BooleanBadge value={value} />
  }

  if (isLikelyUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-[260px] items-center gap-1.5 truncate text-blue-500 hover:underline"
      >
        {value}
      </a>
    )
  }

  return (
    <span className="whitespace-pre-wrap break-words">
      {displayValue(value)}
    </span>
  )
}

function TableShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        {children}
      </table>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center">
      <FileSpreadsheet className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="p-12 text-center">
      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-500" />
      <p className="mt-3 text-sm text-muted-foreground">
        Loading Google Sheet...
      </p>
    </div>
  )
}

function ErrorState({
  message,
  retry,
}: {
  message: string
  retry: () => void
}) {
  return (
    <div className="p-10 text-center">
      <XCircle className="mx-auto h-7 w-7 text-red-500" />
      <p className="mt-3 text-sm font-semibold">
        Failed to load Main Roster
      </p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">
        {message}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={retry}
        className="mt-4"
      >
        Try Again
      </Button>
    </div>
  )
}

function GenericSheetTable({
  sheet,
}: {
  sheet: MainRosterSheet
}) {
  if (!sheet.headers.length || !sheet.rows.length) {
    return (
      <EmptyState
        message={`The ${sheet.name} sheet does not currently contain any data.`}
      />
    )
  }

  return (
    <TableShell>
      <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
        <tr className="border-b border-border">
          {sheet.headers.map((header, index) => (
            <th
              key={`${header}-${index}`}
              className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {displayValue(header)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {sheet.rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
            {sheet.headers.map((header, columnIndex) => (
              <td
                key={`${rowIndex}-${columnIndex}`}
                className="max-w-[360px] whitespace-normal px-4 py-3 text-center align-middle"
              >
                <CellValue
                  header={header}
                  value={cleanValue(row[columnIndex])}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

export default function MainRoster() {
  const [page, setPage] = useState<SheetKey>("home")
  const [sheet, setSheet] = useState<MainRosterSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rankFilter, setRankFilter] = useState("")

  const pageInfo =
    pages.find((item) => item.id === page) ?? pages[0]

  const loadSheet = useCallback(
    async (
      selectedPage: SheetKey,
      showLoading = true,
    ) => {
      if (showLoading) setLoading(true)

      setError(null)

      try {
        const response = await fetch(
          `/api/main-roster/${selectedPage}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        )

        const data =
          (await response.json().catch(() => null)) as
            | MainRosterResponse
            | null

        if (!response.ok || !data?.success || !data.sheet) {
          throw new Error(
            data?.error ||
              `Failed to load ${pageInfo.label} (${response.status}).`,
          )
        }

        setSheet(data.sheet)
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
    setStatusFilter("")
    setRankFilter("")
    void loadSheet(page)
  }, [page, loadSheet])

  const refresh = useCallback(async () => {
    if (refreshing) return

    setRefreshing(true)
    setError(null)

    try {
      await loadSheet(page, false)

      toast.success("Main Roster refreshed", {
        description: `Latest ${pageInfo.label} data loaded from Google Sheets.`,
      })
    } catch {
      // loadSheet handles the displayed error state.
    } finally {
      setRefreshing(false)
    }
  }, [loadSheet, page, pageInfo.label, refreshing])

  const statusColumn = useMemo(() => {
    if (page !== "department-roster" || !sheet) return -1

    return findColumn(sheet.headers, [
      "Status",
      "Department Status",
      "Employment Status",
    ])
  }, [page, sheet])

  const rankColumn = useMemo(() => {
    if (
      !sheet ||
      (page !== "department-roster" &&
        page !== "employee-database")
    ) {
      return -1
    }

    return findColumn(sheet.headers, ["Rank"])
  }, [page, sheet])

  const statusOptions = useMemo(() => {
    if (!sheet || statusColumn === -1) return []

    const values: string[] = []
    const seen = new Set<string>()

    for (const row of sheet.rows) {
      const value = cleanValue(row[statusColumn])
      if (value && !seen.has(value)) {
        seen.add(value)
        values.push(value)
      }
    }

    return values
  }, [sheet, statusColumn])

  const rankOptions = useMemo(() => {
    if (!sheet || rankColumn === -1) return []

    const values: string[] = []
    const seen = new Set<string>()

    for (const row of sheet.rows) {
      const value = cleanValue(row[rankColumn])
      if (value && !seen.has(value)) {
        seen.add(value)
        values.push(value)
      }
    }

    return values
  }, [sheet, rankColumn])

  const filteredRows = useMemo(() => {
    if (!sheet) return []

    const query = search.trim().toLowerCase()

    return sheet.rows.filter((row) => {
      if (
        statusFilter &&
        statusColumn !== -1 &&
        cleanValue(row[statusColumn]) !== statusFilter
      ) {
        return false
      }

      if (
        rankFilter &&
        rankColumn !== -1 &&
        cleanValue(row[rankColumn]) !== rankFilter
      ) {
        return false
      }

      if (!query) return true

      return row.some((value) =>
        cleanValue(value).toLowerCase().includes(query),
      )
    })
  }, [
    rankColumn,
    rankFilter,
    search,
    sheet,
    statusColumn,
    statusFilter,
  ])

  const hasFilters =
    Boolean(search || statusFilter || rankFilter)

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("")
    setRankFilter("")
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
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
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            className="gap-2 self-start lg:self-auto"
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                refreshing ? "animate-spin" : "",
              ].join(" ")}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex w-full gap-2 overflow-x-auto pb-1">
          {pages.map((item) => {
            const Icon = item.icon
            const active = item.id === page

            return (
              <Button
                key={item.id}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(item.id)}
                className="shrink-0 gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </div>

        {/* Main card */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <pageInfo.icon className="h-4 w-4 text-blue-500" />
              </div>

              <div>
                <h2 className="text-base font-semibold">
                  {pageInfo.label}
                </h2>

                <p className="text-xs text-muted-foreground">
                  {sheet
                    ? `${sheet.rowCount.toLocaleString()} rows`
                    : "Loading..."}
                </p>
              </div>
            </div>

            {page !== "home" && (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                {/* Search only on Department + Employee Database */}
                {(page === "department-roster" ||
                  page === "employee-database") && (
                  <div className="relative w-full lg:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder={`Search ${pageInfo.label.toLowerCase()}...`}
                      className="pl-9"
                    />
                  </div>
                )}

                {/* Department Status filter */}
                {page === "department-roster" &&
                  statusOptions.length > 0 && (
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring lg:w-44"
                    >
                      <option value="">All Status</option>
                      {statusOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}

                {/* Rank filter */}
                {(page === "department-roster" ||
                  page === "employee-database") &&
                  rankOptions.length > 0 && (
                    <select
                      value={rankFilter}
                      onChange={(event) =>
                        setRankFilter(event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring lg:w-52"
                    >
                      <option value="">All Ranks</option>
                      {rankOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}

                {hasFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Filter summary */}
          {page !== "home" && sheet && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-5 py-3">
              {(page === "department-roster" ||
                page === "employee-database") && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {filteredRows.length.toLocaleString()}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {sheet.rows.length.toLocaleString()}
                  </span>
                </span>
              )}

              {page !== "department-roster" &&
                page !== "employee-database" && (
                  <span className="text-xs text-muted-foreground">
                    {sheet.rows.length.toLocaleString()} rows
                  </span>
                )}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState
              message={error}
              retry={() => void loadSheet(page)}
            />
          ) : !sheet ? (
            <EmptyState message="No sheet data was returned." />
          ) : sheet.headers.length === 0 ||
            sheet.rows.length === 0 ? (
            <EmptyState
              message={`The ${sheet.name} sheet does not currently contain any data.`}
            />
          ) : (
            <TableShell>
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <tr className="border-b border-border">
                  {sheet.headers.map((header, index) => (
                    <th
                      key={`${header}-${index}`}
                      className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {displayValue(header)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    {sheet.headers.map((header, columnIndex) => (
                      <td
                        key={`${rowIndex}-${columnIndex}`}
                        className="max-w-[360px] whitespace-normal px-4 py-3 text-center align-middle"
                      >
                        <CellValue
                          header={header}
                          value={cleanValue(row[columnIndex])}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={Math.max(sheet.headers.length, 1)}
                      className="px-6 py-12 text-center text-sm text-muted-foreground"
                    >
                      No records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </TableShell>
          )}
        </section>

        {sheet && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Source: {sheet.name}
            </span>
            <span>
              {sheet.columnCount} columns · {sheet.rowCount} rows
            </span>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
