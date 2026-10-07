import { Database } from "lucide-react"
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

const SOURCE_HEADERS = [
  "Message User",
  "Badge Number",
  "Names",
  "Discord ID",
  "Department Status",
  "Rank",
  "Timezone",
  "Join Dept Date",
  "Promo Date",
  "Strike 1",
  "Strike 2",
  "Callsigns",
  "Time in Dept",
  "Terminated",
  "LOA",
  "Resigned",
  "This months hours",
  "Last months hours",
]

const COLUMNS: RosterColumn[] = [
  { key: "messageUser", label: "Message User", width: "8%", kind: "message" },
  { key: "badgeNumber", label: "Badge Number", width: "7%" },
  { key: "discordId", label: "Discord ID", width: "12%", kind: "discord" },
  { key: "departmentStatus", label: "Department Status", width: "9%" },
  { key: "rank", label: "Rank", width: "8%" },
  { key: "timezone", label: "Timezone", width: "7%" },
  { key: "joinDeptDate", label: "Join Dept Date", width: "8%" },
  { key: "promoDate", label: "Promo Date", width: "8%" },
  { key: "strike1", label: "Strike 1", width: "5%", kind: "checkbox" },
  { key: "strike2", label: "Strike 2", width: "5%", kind: "checkbox" },
  { key: "callsigns", label: "Callsigns", width: "8%" },
  { key: "timeInDept", label: "Time in Dept", width: "8%" },
  { key: "terminated", label: "Terminated", width: "5%", kind: "checkbox" },
  { key: "loa", label: "LOA", width: "5%", kind: "checkbox" },
  { key: "resigned", label: "Resigned", width: "5%", kind: "checkbox" },
  { key: "thisMonthHours", label: "This months hours", width: "8%" },
  { key: "lastMonthHours", label: "Last months hours", width: "8%" },
]

function parse(rows: string[][]): RosterRecord[] {
  const headerRow = findHeaderRow(rows, SOURCE_HEADERS)
  const output: RosterRecord[] = []

  for (
    let index = headerRow + 1;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? []

    const values = {
      messageUser: "Message User",
      badgeNumber: getRowValue(row, 1),
      discordId: getRowValue(row, 3).replace(
        /[<@!>]/g,
        "",
      ),
      departmentStatus: getRowValue(row, 4),
      rank: getRowValue(row, 5),
      timezone: getRowValue(row, 6),
      joinDeptDate: getRowValue(row, 7),
      promoDate: getRowValue(row, 8),
      strike1: getRowValue(row, 9),
      strike2: getRowValue(row, 10),
      callsigns: getRowValue(row, 11),
      timeInDept: getRowValue(row, 12),
      terminated: getRowValue(row, 13),
      loa: getRowValue(row, 14),
      resigned: getRowValue(row, 15),
      thisMonthHours: getRowValue(row, 16),
      lastMonthHours: getRowValue(row, 17),
    }

    const name = getRowValue(row, 2)

    if (
      !name &&
      !values.badgeNumber &&
      !values.discordId
    ) {
      continue
    }

    output.push({
      id: makeId("employee", index, values),
      values,
      copyName: name,
    })
  }

  return output
}

export default function EmployeeDatabase() {
  const parser = useMemo(() => parse, [])

  return (
    <RosterPanel
      title="Employee Database"
      subtitle="Department employee records and status information"
      icon={Database}
      gid={GIDS.employees}
      columns={COLUMNS}
      parse={parser}
      selectable
    />
  )
}
