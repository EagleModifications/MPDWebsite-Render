import { Users } from "lucide-react"
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
  "Callsign",
  "Badge Number",
  "Name",
  "Insignia",
  "Rank",
  "Job Description",
  "Time in Dept",
  "Time in Rank",
  "Status",
  "Strike 1",
  "Strike 2",
  "Discord ID",
  "Hours this month",
]

const COLUMNS: RosterColumn[] = [
  { key: "callsign", label: "Callsign", width: "7%" },
  { key: "badgeNumber", label: "Badge Number", width: "8%" },
  { key: "name", label: "Name", width: "10%" },
  { key: "rank", label: "Rank", width: "9%" },
  { key: "jobDescription", label: "Job Description", width: "12%" },
  { key: "timeInDept", label: "Time in Dept", width: "8%" },
  { key: "timeInRank", label: "Time in Rank", width: "8%" },
  { key: "status", label: "Status", width: "8%" },
  { key: "strike1", label: "Strike 1", width: "5%", kind: "checkbox" },
  { key: "strike2", label: "Strike 2", width: "5%", kind: "checkbox" },
  { key: "discordId", label: "Discord ID", width: "14%", kind: "discord" },
  { key: "hours", label: "Hours this month", width: "8%" },
]

function parse(rows: string[][]): RosterRecord[] {
  const headerRow = findHeaderRow(rows, SOURCE_HEADERS)
  const output: RosterRecord[] = []

  const indices = {
    callsign: SOURCE_HEADERS.indexOf("Callsign"),
    badgeNumber: SOURCE_HEADERS.indexOf("Badge Number"),
    name: SOURCE_HEADERS.indexOf("Name"),
    rank: SOURCE_HEADERS.indexOf("Rank"),
    jobDescription: SOURCE_HEADERS.indexOf("Job Description"),
    timeInDept: SOURCE_HEADERS.indexOf("Time in Dept"),
    timeInRank: SOURCE_HEADERS.indexOf("Time in Rank"),
    status: SOURCE_HEADERS.indexOf("Status"),
    strike1: SOURCE_HEADERS.indexOf("Strike 1"),
    strike2: SOURCE_HEADERS.indexOf("Strike 2"),
    discordId: SOURCE_HEADERS.indexOf("Discord ID"),
    hours: SOURCE_HEADERS.indexOf("Hours this month"),
  }

  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const first = getRowValue(row, 0)

    if (!first) continue

    const section = first
      .replace(/\*+/g, "")
      .trim()

    if (
      [
        "High Command",
        "Trial High Command",
        "Low Command",
        "Supervisors",
        "Officers",
        "Trial Supervisors",
        "Trial Low Command",
      ].some(
        (label) =>
          label.toLowerCase() ===
          section.toLowerCase(),
      )
    ) {
      output.push({
        id: makeId("department-section", index, {
          section,
        }),
        values: {
          name: section,
        },
      })
      continue
    }

    const values = {
      callsign: getRowValue(row, indices.callsign),
      badgeNumber: getRowValue(row, indices.badgeNumber),
      name: getRowValue(row, indices.name),
      rank: getRowValue(row, indices.rank),
      jobDescription: getRowValue(
        row,
        indices.jobDescription,
      ),
      timeInDept: getRowValue(
        row,
        indices.timeInDept,
      ),
      timeInRank: getRowValue(
        row,
        indices.timeInRank,
      ),
      status: getRowValue(row, indices.status),
      strike1: getRowValue(row, indices.strike1),
      strike2: getRowValue(row, indices.strike2),
      discordId: getRowValue(
        row,
        indices.discordId,
      ).replace(/[<@!>]/g, ""),
      hours: getRowValue(row, indices.hours),
    }

    if (
      !values.name &&
      !values.callsign &&
      !values.badgeNumber
    ) {
      continue
    }

    output.push({
      id: makeId("department", index, values),
      values,
      copyName: values.name,
    })
  }

  return output
}

export default function DepartmentRoster() {
  const parser = useMemo(() => parse, [])

  return (
    <RosterPanel
      title="Department Roster"
      subtitle="Department personnel and current roster status"
      icon={Users}
      gid={GIDS.department}
      columns={COLUMNS}
      parse={parser}
      selectable
      preserveSections
      nameKey="name"
    />
  )
}
