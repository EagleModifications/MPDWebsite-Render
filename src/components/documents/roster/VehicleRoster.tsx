import { Car } from "lucide-react"
import { useMemo } from "react"

import RosterPanel from "@/components/documents/roster/RosterPanel"
import {
  findHeaderRow,
  getRowValue,
  GIDS,
  makeId,
  type RosterColumn,
  type RosterRecord,
} from "@/components/documents/roster/rosterShared"

const HEADERS = [
  "Rank",
  "Vehicle Name",
  "Spawncode",
  "Required Extras",
  "Livery",
  "Window Tint",
  "Turbo",
  "Slicktop Optional",
  "Unmarked Allowed",
]

const COLUMNS: RosterColumn[] = [
  { key: "rank", label: "Rank", width: "11%" },
  { key: "vehicleName", label: "Vehicle Name", width: "14%" },
  { key: "spawncode", label: "Spawncode", width: "13%" },
  { key: "requiredExtras", label: "Required Extras", width: "15%" },
  { key: "livery", label: "Livery", width: "12%" },
  { key: "windowTint", label: "Window Tint", width: "10%" },
  { key: "turbo", label: "Turbo", width: "7%", kind: "checkbox" },
  { key: "slicktop", label: "Slicktop Optional", width: "9%", kind: "checkbox" },
  { key: "unmarked", label: "Unmarked Allowed", width: "9%", kind: "checkbox" },
]

function parse(rows: string[][]): RosterRecord[] {
  const headerRow = findHeaderRow(rows, HEADERS)
  const output: RosterRecord[] = []

  for (
    let index = headerRow + 1;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? []

    const values = {
      rank: getRowValue(row, 0),
      vehicleName: getRowValue(row, 1),
      spawncode: getRowValue(row, 2),
      requiredExtras: getRowValue(row, 3),
      livery: getRowValue(row, 4),
      windowTint: getRowValue(row, 5),
      turbo: getRowValue(row, 6),
      slicktop: getRowValue(row, 7),
      unmarked: getRowValue(row, 8),
    }

    if (
      !values.rank &&
      !values.vehicleName &&
      !values.spawncode
    ) {
      continue
    }

    output.push({
      id: makeId("vehicle", index, values),
      values,
    })
  }

  return output
}

export default function VehicleRoster() {
  const parser = useMemo(() => parse, [])

  return (
    <RosterPanel
      title="Vehicle Roster"
      subtitle="Department vehicle permissions and configurations"
      icon={Car}
      gid={GIDS.vehicles}
      columns={COLUMNS}
      parse={parser}
    />
  )
}
