import { Check } from "lucide-react"

type RankColumn = {
  id: string
  label: string
  group: "officers" | "supervisors" | "low-command" | "trial-high-command"
}

type AuthorityRow = {
  section: "PRIMARY RESPONSIBILITY" | "AUTHORITY"
  name: string
  permissions: Record<string, boolean>
}

const rankColumns: RankColumn[] = [
  { id: "officer", label: "Officer", group: "officers" },
  { id: "officer2", label: "Officer 2", group: "officers" },
  { id: "officer3", label: "Officer 3", group: "officers" },
  { id: "lcpl", label: "LCPL", group: "supervisors" },
  { id: "cpl", label: "CPL", group: "supervisors" },
  { id: "sgt", label: "SGT", group: "supervisors" },
  { id: "ssgt", label: "SSGT", group: "supervisors" },
  { id: "msgt", label: "MSGT", group: "supervisors" },
  { id: "2lt", label: "2LT", group: "low-command" },
  { id: "1lt", label: "1LT", group: "low-command" },
  { id: "cpt", label: "CPT", group: "low-command" },
  { id: "maj", label: "MAJ", group: "low-command" },
  { id: "ltcol", label: "Lieutenant Colonel", group: "trial-high-command" },
]

const allRanks = Object.fromEntries(rankColumns.map(({ id }) => [id, true]))
const noRanks = Object.fromEntries(rankColumns.map(({ id }) => [id, false]))
const from = (...ids: string[]) =>
  Object.fromEntries(rankColumns.map(({ id }) => [id, ids.includes(id)]))

const rows: AuthorityRow[] = [
  { section: "PRIMARY RESPONSIBILITY", name: "Patrol", permissions: allRanks },
  { section: "PRIMARY RESPONSIBILITY", name: "Assist Trainings**", permissions: from("officer3", "lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Assist Ridealongs**", permissions: from("officer3", "lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Conduct Training**", permissions: from("lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Conduct Ridealongs**", permissions: from("officer3", "lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Patrol Supervision", permissions: from("lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Supervise Training", permissions: from("cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Department Support Ticket (In Metro)", permissions: from("cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Review Applications**", permissions: from("lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "HC Requests", permissions: from("2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Internal Affairs", permissions: from("msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "LC Oversight", permissions: from("msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "PRIMARY RESPONSIBILITY", name: "Executive Authority", permissions: from("maj", "ltcol") },
  { section: "AUTHORITY", name: "Remove Cadet from Training", permissions: from("lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Send Officer Off Duty", permissions: from("lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Report Issues to Low Command", permissions: from("sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Send LCPL or CPL Off Duty", permissions: from("sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Recruitment", permissions: from("officer3", "lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Place Subordinate on Foot Patrol", permissions: from("lcpl", "cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Award FTO/FTA Badges", permissions: from("2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Send SGT off duty", permissions: from("msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "Hiring", permissions: from("2lt", "1lt", "cpt", "maj", "ltcol") },
  { section: "AUTHORITY", name: "1st Strike*", permissions: from("cpl", "sgt", "ssgt", "msgt", "2lt", "1lt", "cpt", "maj", "ltcol") },
]

const groupLabels = {
  officers: "OFFICERS",
  supervisors: "SUPERVISORS",
  "low-command": "LOW COMMAND",
  "trial-high-command": "TRIAL HIGH COMMAND",
} as const

const groupClasses = {
  officers: "bg-[#1769a8] text-white",
  supervisors: "bg-[#bd6500] text-white",
  "low-command": "bg-[#387a20] text-white",
  "trial-high-command": "bg-[#2b6e7d] text-white",
} as const

const cellClasses = {
  officers: "bg-[#a9c9e5]",
  supervisors: "bg-[#f5c895]",
  "low-command": "bg-[#9bc783]",
  "trial-high-command": "bg-[#b7d4dc]",
} as const

const sectionRows = rows.reduce<Record<string, number>>((acc, row) => {
  acc[row.section] = (acc[row.section] ?? 0) + 1
  return acc
}, {})

export default function AuthorityMatrix() {
  let previousSection: AuthorityRow["section"] | null = null

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1500px] border-collapse text-sm">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 z-30 min-w-[230px] border border-slate-300 bg-white px-4 py-3 text-left font-bold text-slate-900">
              RESPONSIBILITY / AUTHORITY
            </th>
            {(["officers", "supervisors", "low-command", "trial-high-command"] as const).map((group) => (
              <th key={group} colSpan={rankColumns.filter((column) => column.group === group).length} className={`border border-slate-300 px-3 py-3 text-center text-xs font-extrabold tracking-wide ${groupClasses[group]}`}>
                {groupLabels[group]}
              </th>
            ))}
          </tr>
          <tr>
            {rankColumns.map((column) => (
              <th key={column.id} className={`min-w-[105px] border border-slate-300 px-2 py-3 text-center text-xs font-bold text-slate-900 ${cellClasses[column.group]}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isFirstInSection = previousSection !== row.section
            previousSection = row.section

            return (
              <tr key={`${row.section}-${row.name}`}>
                {isFirstInSection && (
                  <th rowSpan={sectionRows[row.section]} className="sticky left-0 z-20 min-w-[230px] border border-slate-300 bg-slate-100 px-4 py-3 text-left align-top text-xs font-extrabold tracking-wide text-slate-800">
                    {row.section}
                  </th>
                )}
                <td className="border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900">
                  {row.name}
                </td>
                {rankColumns.map((column) => {
                  const allowed = row.permissions[column.id] ?? false
                  return (
                    <td key={column.id} className={`border border-slate-300 p-2 text-center ${cellClasses[column.group]}`}>
                      <span aria-label={allowed ? "Allowed" : "Not allowed"} className={`mx-auto flex h-6 w-6 items-center justify-center border ${allowed ? "border-black bg-black text-white" : "border-slate-500 bg-white/70"}`}>
                        {allowed && <Check className="h-4 w-4 stroke-[3]" />}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
