import {
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import RosterTable from "@/components/documents/roster/RosterTable"
import {
  fetchSheet,
  type RosterColumn,
  type RosterRecord,
} from "@/components/documents/roster/rosterShared"

type RosterPanelProps = {
  title: string
  subtitle: string
  icon: typeof RefreshCw
  gid: string
  columns: RosterColumn[]
  parse: (rows: string[][]) => RosterRecord[]
  selectable?: boolean
  preserveSections?: boolean
  nameKey?: string
}

export default function RosterPanel({
  title,
  subtitle,
  icon: Icon,
  gid,
  columns,
  parse,
  selectable = false,
  preserveSections = false,
  nameKey = "name",
}: RosterPanelProps) {
  const [rows, setRows] = useState<RosterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const load = useCallback(
    async (manual = false) => {
      try {
        if (manual) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError(null)

        const source = await fetchSheet(gid)
        const parsed = parse(source)

        setRows(parsed)
        setSelectedIds([])
      } catch (caught) {
        setRows([])
        setError(
          caught instanceof Error
            ? caught.message
            : `Unable to load ${title}.`,
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [gid, parse, title],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold sm:text-base">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-border/70 bg-background/70 px-3 text-sm font-medium transition-colors hover:border-blue-500/40 disabled:cursor-default disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw
            className={[
              "h-4 w-4 text-blue-500",
              refreshing ? "animate-spin" : "",
            ].join(" ")}
          />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            Loading {title.toLowerCase()}...
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center">
          <AlertCircle className="h-7 w-7 text-red-400" />
          <p className="font-medium">
            Unable to load {title}
          </p>
          <p className="max-w-xl text-sm text-red-400/90">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm hover:border-blue-500/40"
          >
            <RefreshCw className="h-4 w-4 text-blue-500" />
            Try Again
          </button>
        </div>
      ) : (
        <RosterTable
          columns={columns}
          rows={rows}
          selectable={selectable}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          preserveSections={preserveSections}
          nameKey={nameKey}
        />
      )}
    </section>
  )
}
