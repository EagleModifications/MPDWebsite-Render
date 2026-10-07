import { Shirt } from "lucide-react"
import { useMemo } from "react"

import RosterPanel from "@/components/roster/RosterPanel"
import {
  findHeaderRow,
  getRowValue,
  GIDS,
  makeId,
  type RosterColumn,
  type RosterRecord,
} from "@/components/roster/rosterShared"

const HEADERS = [
  "Rank",
  "Class",
  "Shared Outfit Code",
]

const COLUMNS: RosterColumn[] = [
  { key: "rank", label: "Rank", width: "30%" },
  { key: "class", label: "Class", width: "35%" },
  { key: "outfitCode", label: "Shared Outfit Code", width: "35%" },
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
      class: getRowValue(row, 1),
      outfitCode: getRowValue(row, 2),
    }

    if (
      !values.rank &&
      !values.class &&
      !values.outfitCode
    ) {
      continue
    }

    output.push({
      id: makeId("uniform", index, values),
      values,
    })
  }

  return output
}

export default function UniformRoster() {
  const parser = useMemo(() => parse, [])

  return (
    <RosterPanel
      title="Uniform Roster"
      subtitle="Department uniform classes and shared outfit codes"
      icon={Shirt}
      gid={GIDS.uniforms}
      columns={COLUMNS}
      parse={parser}
    />
  )
}
