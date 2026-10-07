import {
  BarChart3,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  cleanValue,
  fetchSheet,
  type SheetRow,
} from "@/components/roster/rosterShared"

const HOME_GID = "1932029060"

function cell(rows: SheetRow[], row: number, column: number) {
  return cleanValue(rows[row]?.[column])
}

function firstValue(...values: string[]) {
  return values.find((value) => cleanValue(value)) ?? ""
}

function valueFromRows(
  rows: SheetRow[],
  start: number,
  end: number,
  column: number,
) {
  for (let row = start; row <= end; row += 1) {
    const value = cell(rows, row, column)
    if (value) return value
  }

  return ""
}

function HomeCard({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string
  icon: typeof FileText
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function LeadershipCard({
  rank,
  callsign,
  name,
  role,
}: {
  rank: string
  callsign: string
  name: string
  role: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="mb-2 flex items-end justify-between gap-3">
        <h3 className="text-sm font-bold">{rank}</h3>
        {role && (
          <span className="text-right text-[10px] font-semibold text-muted-foreground">
            {role}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[90px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border/60 bg-muted/40 text-xs">
        <div className="flex items-center justify-center border-r border-border/60 px-2 py-2 font-semibold text-blue-400">
          {callsign || "—"}
        </div>
        <div className="flex items-center px-3 py-2 font-medium">
          {name || "Vacant"}
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  href,
}: {
  label?: string
  value: string
  href?: string
}) {
  const content = (
    <div className="flex min-h-10 items-center justify-center border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-muted/60">
      {value || "—"}
    </div>
  )

  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <div>
      {label ? (
        <div className="mb-1 text-[10px] font-semibold text-muted-foreground">
          {label}
        </div>
      ) : null}
      {content}
    </div>
  )
}

export default function HomeRoster() {
  const [rows, setRows] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHome = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const data = await fetchSheet(HOME_GID)

      // Google Sheet rows 1–8 are the decorative sheet header.
      // The website starts from row 9 only.
      setRows(data.slice(8))
    } catch (caught) {
      setRows([])
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the Main Roster home page.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadHome()
  }, [loadHome])

  const leadership = useMemo(() => {
    // These ranges mirror the five leadership blocks visible below row 8.
    const blocks = [
      {
        rank: "Chief of Police",
        start: 2,
        roleColumn: 12,
      },
      {
        rank: "Deputy Chief of Police",
        start: 9,
        roleColumn: 12,
      },
      {
        rank: "Assistant Chief of Police",
        start: 16,
        roleColumn: 12,
      },
      {
        rank: "Chief of Staff",
        start: 23,
        roleColumn: 12,
      },
      {
        rank: "Colonel",
        start: 30,
        roleColumn: 12,
      },
    ]

    return blocks.map((block) => ({
      rank: block.rank,
      callsign: firstValue(
        cell(rows, block.start + 1, 8),
        cell(rows, block.start + 1, 7),
        cell(rows, block.start + 1, 6),
      ),
      name: firstValue(
        cell(rows, block.start + 1, 9),
        cell(rows, block.start + 1, 10),
      ),
      role: cell(rows, block.start, block.roleColumn),
    }))
  }, [rows])

  const documents = useMemo(
    () =>
      [
        cell(rows, 8, 1),
        cell(rows, 10, 1),
        cell(rows, 12, 1),
        cell(rows, 14, 1),
      ].filter(Boolean),
    [rows],
  )

  const statistics = useMemo(
    () =>
      [
        valueFromRows(rows, 25, 35, 1),
        valueFromRows(rows, 26, 36, 1),
        valueFromRows(rows, 27, 37, 1),
        valueFromRows(rows, 28, 38, 1),
        valueFromRows(rows, 29, 39, 1),
        valueFromRows(rows, 30, 40, 1),
      ].filter(Boolean),
    [rows],
  )

  const departmentHours = firstValue(
    cell(rows, 2, 1),
    cell(rows, 3, 1),
    cell(rows, 2, 2),
  )

  const subdivisions = useMemo(() => {
    const result: Array<{
      label: string
      rows: Array<[string, string]>
    }> = []

    let current: { label: string; rows: Array<[string, string]> } | null = null

    for (let index = 4; index < Math.min(rows.length, 35); index += 1) {
      const left = cell(rows, index, 14)
      const right = cell(rows, index, 15)

      if (!left && !right) continue

      const isDivision =
        left &&
        !/^\d|SWAT-\d|TRU-\d|GIU-\d|MCD-\d|TEU-\d|SAR-\d/i.test(left)

      if (isDivision) {
        current = { label: left, rows: [] }
        result.push(current)
        continue
      }

      if (!current) {
        current = { label: "FTD & Subdivisions", rows: [] }
        result.push(current)
      }

      if (left || right) current.rows.push([left, right])
    }

    return result
  }, [rows])

  if (loading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading roster...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[600px] flex-col items-center justify-center gap-4 px-6 text-center">
        <BarChart3 className="h-9 w-9 text-red-400" />
        <div>
          <p className="font-semibold">Unable to load Main Roster</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadHome(true)}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Master Roster</p>
          <p className="text-xs text-muted-foreground">
            Department overview
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadHome(true)}
          disabled={refreshing}
          className="gap-2 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(420px,1.5fr)_minmax(260px,0.95fr)]">
        <div className="space-y-4">
          <HomeCard title="This Month's Dept. Hours" icon={BarChart3}>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-4 text-center text-sm font-bold">
              {departmentHours || "—"}
            </div>
          </HomeCard>

          <HomeCard title="Documents" icon={FileText}>
            <div className="space-y-2">
              {documents.map((document, index) => (
                <InfoRow
                  key={`${document}-${index}`}
                  value={document}
                  href={document.startsWith("http") ? document : undefined}
                />
              ))}
            </div>
          </HomeCard>

          <HomeCard title="Statistics" icon={Users}>
            <div className="space-y-1">
              {statistics.map((statistic, index) => (
                <div
                  key={`${statistic}-${index}`}
                  className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs font-medium"
                >
                  {statistic}
                </div>
              ))}
            </div>
          </HomeCard>
        </div>

        <div className="space-y-3">
          {leadership.map((leader) => (
            <LeadershipCard key={leader.rank} {...leader} />
          ))}

          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-5 text-center">
            <div className="mb-3 text-lg font-semibold italic text-blue-400">
              Metro PD Founders
            </div>
            <div className="mx-auto mb-4 h-px max-w-sm bg-blue-500/60" />
            <div className="space-y-2 text-[11px] font-semibold text-muted-foreground">
              {[
                "ANDREW ZWARYCH",
                "JOE WEST",
                "JACK DANIELS",
                "VOLT JOINS (NOVALDIO 1000)",
                "JAY LINS",
              ].map((founder) => (
                <div key={founder}>{founder}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <HomeCard title="FTD & Subdivisions" icon={Users}>
            <div className="space-y-3">
              {subdivisions.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  No subdivision data found.
                </div>
              ) : (
                subdivisions.map((division) => (
                  <div key={division.label}>
                    <div className="rounded-t-md border border-border/60 bg-muted/60 px-3 py-2 text-center text-[11px] font-bold">
                      {division.label}
                    </div>
                    <div className="overflow-hidden rounded-b-md border border-t-0 border-border/60">
                      {division.rows.map(([identifier, name], index) => (
                        <div
                          key={`${identifier}-${name}-${index}`}
                          className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-border/60 last:border-b-0"
                        >
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-blue-400">
                            {identifier}
                          </div>
                          <div className="border-l border-border/60 px-2 py-1.5 text-[10px]">
                            {name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </HomeCard>

          <HomeCard title="Officer Statistics" icon={BarChart3}>
            <div className="flex min-h-[210px] items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="relative h-36 w-36 rounded-full bg-[conic-gradient(from_0deg,_#f97316_0_43%,_#14b8a6_43%_66%,_#22c55e_66%_81%,_#60a5fa_81%_94%,_#facc15_94%_100%)] shadow-inner">
                <div className="absolute inset-[34%] rounded-full bg-card" />
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Distribution from the Master Roster
            </p>
          </HomeCard>
        </div>
      </div>
    </div>
  )
}
