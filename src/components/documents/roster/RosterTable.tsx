import {
  Check,
  ChevronDown,
  Square,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  CopyMenu,
} from "@/components/roster/RosterControls"
import {
  displayRank,
  isChecked,
  isRankSection,
  sectionLabel,
  type RosterColumn,
  type RosterRecord,
} from "@/components/roster/rosterShared"

type RosterTableProps = {
  columns: RosterColumn[]
  rows: RosterRecord[]
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  emptyText?: string
  preserveSections?: boolean
  nameKey?: string
}

function getSearchableValue(
  row: RosterRecord,
  columns: RosterColumn[],
) {
  return columns
    .map((column) => row.values[column.key] ?? "")
    .join(" ")
    .toLowerCase()
}

function valueForCopy(
  row: RosterRecord,
  key: string,
) {
  return row.values[key] ?? ""
}

function CopySelectedMenu({
  rows,
  selectedIds,
}: {
  rows: RosterRecord[]
  selectedIds: string[]
}) {
  const [open, setOpen] = useState(false)

  const selectedRows = useMemo(
    () =>
      rows.filter((row) =>
        selectedIds.includes(row.id),
      ),
    [rows, selectedIds],
  )

  const copy = async (
    label: string,
    getValue: (row: RosterRecord) => string,
  ) => {
    const values = selectedRows
      .map(getValue)
      .filter(Boolean)

    if (!values.length) return

    await navigator.clipboard.writeText(
      values.join("\n"),
    )
    setOpen(false)
    toast.success(`${label} copied`)
  }

  const options = [
    {
      label: "Discord IDs",
      getValue: (row: RosterRecord) =>
        valueForCopy(row, "discordId"),
    },
    {
      label: "Discord Mentions",
      getValue: (row: RosterRecord) => {
        const id = valueForCopy(row, "discordId")
        return id ? `<@${id}>` : ""
      },
    },
    {
      label: "Names",
      getValue: (row: RosterRecord) =>
        row.copyName ||
        valueForCopy(row, "name"),
    },
    {
      label: "Callsigns",
      getValue: (row: RosterRecord) =>
        valueForCopy(row, "callsign"),
    },
    {
      label: "Badge Numbers",
      getValue: (row: RosterRecord) =>
        valueForCopy(row, "badgeNumber"),
    },
    {
      label: "Ranks",
      getValue: (row: RosterRecord) =>
        valueForCopy(row, "rank"),
    },
    {
      label: "Full Details",
      getValue: (row: RosterRecord) =>
        [
          row.copyName ||
            valueForCopy(row, "name"),
          valueForCopy(row, "rank"),
          valueForCopy(row, "callsign"),
          valueForCopy(row, "badgeNumber"),
          valueForCopy(row, "discordId"),
        ]
          .filter(Boolean)
          .join(" | "),
    },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background/70 px-2.5 text-xs font-medium hover:border-blue-500/40"
      >
        <span>Copy Selected ({selectedIds.length})</span>
        <ChevronDown className="h-3.5 w-3.5 text-blue-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+5px)] z-50 min-w-[190px] rounded-xl border border-border bg-card p-1.5 shadow-xl">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() =>
                void copy(
                  option.label,
                  option.getValue,
                )
              }
              className="flex w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-muted"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RosterTable({
  columns,
  rows,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  emptyText = "No roster records found.",
  preserveSections = false,
  nameKey = "name",
}: RosterTableProps) {
  const [search, setSearch] = useState("")

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return rows

    return rows.filter((row) =>
      getSearchableValue(row, columns).includes(query),
    )
  }, [columns, rows, search])

  const selectableRows = filteredRows.filter(
    (row) =>
      !(
        preserveSections &&
        isRankSection(
          row.values[nameKey] ?? "",
        )
      ),
  )

  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) =>
      selectedIds.includes(row.id),
    )

  const toggleAll = () => {
    if (!onSelectionChange) return

    if (allSelected) {
      onSelectionChange(
        selectedIds.filter(
          (id) =>
            !selectableRows.some(
              (row) => row.id === id,
            ),
        ),
      )
      return
    }

    onSelectionChange(
      Array.from(
        new Set([
          ...selectedIds,
          ...selectableRows.map(
            (row) => row.id,
          ),
        ]),
      ),
    )
  }

  const toggle = (id: string) => {
    if (!onSelectionChange) return

    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(
            (item) => item !== id,
          )
        : [...selectedIds, id],
    )
  }

  const columnWidth = selectable
    ? `${Math.max(5, 95 / (columns.length + 1))}%`
    : `${Math.max(6, 100 / columns.length)}%`

  const renderCell = (
    row: RosterRecord,
    column: RosterColumn,
  ) => {
    const value = row.values[column.key] ?? ""

    if (column.kind === "checkbox") {
      const checked = isChecked(value)
      return (
        <span
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-md border",
            checked
              ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
              : "border-border/70 bg-muted/30 text-muted-foreground",
          ].join(" ")}
        >
          {checked ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </span>
      )
    }

    if (column.kind === "discord") {
      const id = value.replace(/[<@!>]/g, "").trim()

      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <a
            href={
              id
                ? `https://discord.com/users/${id}`
                : "#"
            }
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!id) event.preventDefault()
            }}
            className="min-w-0 truncate text-blue-400 hover:underline"
          >
            {id || "—"}
          </a>

          <CopyMenu
            items={[
              {
                label: "Discord ID",
                value: id,
              },
              {
                label: "Discord Mention",
                value: id
                  ? `<@${id}>`
                  : "",
              },
            ]}
          />
        </div>
      )
    }

    if (column.kind === "message") {
      const id =
        row.values.discordId
          ?.replace(/[<@!>]/g, "")
          .trim() ?? ""

      return id ? (
        <a
          href={`https://discord.com/users/${id}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline"
        >
          Message User
        </a>
      ) : (
        <span className="text-muted-foreground">
          Message User
        </span>
      )
    }

    if (column.key === "rank") {
      return displayRank(value) || "—"
    }

    return value || "—"
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search roster..."
            className="h-9 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-blue-500/50"
          />
        </div>

        {selectable && selectedIds.length > 0 && (
          <CopySelectedMenu
            rows={rows}
            selectedIds={selectedIds}
          />
        )}
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center px-6 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="max-h-[calc(100vh-300px)] overflow-auto">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              {selectable && (
                <col style={{ width: "42px" }} />
              )}
              {columns.map((column) => (
                <col
                  key={column.key}
                  style={{
                    width: column.width ?? columnWidth,
                  }}
                />
              ))}
            </colgroup>

            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border/70">
                {selectable && (
                  <th className="h-11 px-2 text-center">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md"
                      title={
                        allSelected
                          ? "Deselect all"
                          : "Select all"
                      }
                    >
                      {allSelected ? (
                        <Check className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Square className="h-4 w-4 text-blue-500" />
                      )}
                    </button>
                  </th>
                )}

                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="h-11 px-2 text-left font-semibold text-blue-400"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const possibleSection =
                  preserveSections
                    ? sectionLabel(
                        row.values[nameKey] ?? "",
                      )
                    : ""

                const section =
                  preserveSections &&
                  isRankSection(possibleSection)

                if (section) {
                  return (
                    <tr key={row.id}>
                      <td
                        colSpan={
                          columns.length +
                          (selectable ? 1 : 0)
                        }
                        className="border-b border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-blue-400"
                      >
                        {possibleSection}
                      </td>
                    </tr>
                  )
                }

                const selected =
                  selectedIds.includes(row.id)

                return (
                  <tr
                    key={row.id}
                    className={[
                      "border-b border-border/50 transition-colors",
                      selected
                        ? "bg-blue-500/10"
                        : "hover:bg-muted/30",
                    ].join(" ")}
                  >
                    {selectable && (
                      <td className="px-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            toggle(row.id)
                          }
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md"
                          title={
                            selected
                              ? "Deselect"
                              : "Select"
                          }
                        >
                          {selected ? (
                            <Check className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Square className="h-4 w-4 text-blue-500" />
                          )}
                        </button>
                      </td>
                    )}

                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="h-12 overflow-visible px-2 align-middle"
                      >
                        <div className="min-w-0 truncate">
                          {renderCell(row, column)}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
