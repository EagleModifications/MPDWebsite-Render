import {
  FileSpreadsheet,
  FileText,
  Presentation,
  Check,
} from "lucide-react"
import { useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type TabId =
  | "command-authority-matrix"
  | "command-punishmentguidelines"
  | "command-supervisorscreening"
  | "command-commandscreening"

type Tab = {
  id: TabId
  label: string
  icon: typeof FileText
  url?: string
}

const tabs: Tab[] = [
  {
    id: "command-authority-matrix",
    label: "Authority Matrix",
    icon: FileSpreadsheet,
  },
  {
    id: "command-punishmentguidelines",
    label: "Punishment Guidelines",
    icon: FileSpreadsheet,
    url: "https://docs.google.com/spreadsheets/d/1WlES0v7NUSRccYvdd7EUHQgHvcdrBPJGUoKqNWbTDP8/preview",
  },
  {
    id: "command-supervisorscreening",
    label: "Supervisor Screening",
    icon: Presentation,
    url: "https://docs.google.com/presentation/d/1MZACGzmyCFbdNuouku_dYuqenNl7i-z1kiFtuG_FF58/preview",
  },
  {
    id: "command-commandscreening",
    label: "Command Screening",
    icon: Presentation,
    url: "https://docs.google.com/presentation/d/1Dtg8Ecu6y7abp8TgWtvU6cn4CdqGAos5-7hE13ZB6mg/preview",
  },
]

type RankColumn = {
  id: string
  label: string
  group: string
}

const rankColumns: RankColumn[] = [
  {
    id: "officer",
    label: "Officer",
    group: "officers",
  },
  {
    id: "officer2",
    label: "Officer 2",
    group: "officers",
  },
  {
    id: "officer3",
    label: "Officer 3",
    group: "officers",
  },

  {
    id: "lcpl",
    label: "LCPL",
    group: "supervisors",
  },
  {
    id: "cpl",
    label: "CPL",
    group: "supervisors",
  },
  {
    id: "sgt",
    label: "SGT",
    group: "supervisors",
  },
  {
    id: "ssgt",
    label: "SSGT",
    group: "supervisors",
  },
  {
    id: "msgt",
    label: "MSGT",
    group: "supervisors",
  },

  {
    id: "2lt",
    label: "2LT",
    group: "low-command",
  },
  {
    id: "1lt",
    label: "1LT",
    group: "low-command",
  },
  {
    id: "cpt",
    label: "CPT",
    group: "low-command",
  },
  {
    id: "maj",
    label: "MAJ",
    group: "low-command",
  },

  {
    id: "ltcol",
    label: "Lieutenant Colonel",
    group: "trial-high-command",
  },
]

type AuthorityRow = {
  section: "PRIMARY RESPONSIBILITY" | "AUTHORITY"
  name: string
  permissions: Record<string, boolean>
}

const authorityRows: AuthorityRow[] = [
  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Patrol",
    permissions: {
      officer: true,
      officer2: true,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Assist Trainings**",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Assist Ridealongs**",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Conduct Training**",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Conduct Ridealongs**",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Patrol Supervision",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Supervise Training",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Department Support Ticket (In Metro)",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Review Applications**",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "HC Requests",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Internal Affairs",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "LC Oversight",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "PRIMARY RESPONSIBILITY",
    name: "Executive Authority",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": false,
      "1lt": false,
      cpt: false,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Remove Cadet from Training",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Send Officer Off Duty",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Report Issues to Low Command",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Send LCPL or CPL Off Duty",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Recruitment",
    permissions: {
      officer: false,
      officer2: false,
      officer3: true,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Place Subordinate on Foot Patrol",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: true,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Award FTO/FTA Badges",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Send SGT off duty",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "Hiring",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: false,
      sgt: false,
      ssgt: false,
      msgt: false,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },

  {
    section: "AUTHORITY",
    name: "1st Strike*",
    permissions: {
      officer: false,
      officer2: false,
      officer3: false,
      lcpl: false,
      cpl: true,
      sgt: true,
      ssgt: true,
      msgt: true,
      "2lt": true,
      "1lt": true,
      cpt: true,
      maj: true,
      ltcol: true,
    },
  },
]

function getGroupLabel(group: string) {
  switch (group) {
    case "officers":
      return "OFFICERS"
    case "supervisors":
      return "SUPERVISORS"
    case "low-command":
      return "LOW COMMAND"
    case "trial-high-command":
      return "TRIAL HIGH COMMAND"
    default:
      return group
  }
}

function getGroupClass(group: string) {
  switch (group) {
    case "officers":
      return "bg-[#1769a8] text-white"
    case "supervisors":
      return "bg-[#bd6500] text-white"
    case "low-command":
      return "bg-[#387a20] text-white"
    case "trial-high-command":
      return "bg-[#2b6e7d] text-white"
    default:
      return "bg-muted text-foreground"
  }
}

function getCellClass(group: string) {
  switch (group) {
    case "officers":
      return "bg-[#a9c9e5]"
    case "supervisors":
      return "bg-[#f5c895]"
    case "low-command":
      return "bg-[#9bc783]"
    case "trial-high-command":
      return "bg-[#b7d4dc]"
    default:
      return "bg-background"
  }
}

function AuthorityMatrix() {
  const sectionCounts = authorityRows.reduce(
    (counts, row) => {
      counts[row.section] = (counts[row.section] ?? 0) + 1
      return counts
    },
    {} as Record<string, number>,
  )

  const sectionSeen: Record<string, boolean> = {}

  return (
    <div className="w-full overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] border-collapse text-xs">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-30 min-w-[125px] border border-black/20 bg-[#05054a]"
              />

              <th
                rowSpan={2}
                className="sticky left-[125px] z-30 min-w-[225px] border border-black/20 bg-white px-2 text-left font-medium text-black"
              />

              {[
                "officers",
                "supervisors",
                "low-command",
                "trial-high-command",
              ].map((group) => {
                const count = rankColumns.filter(
                  (column) => column.group === group,
                ).length

                return (
                  <th
                    key={group}
                    colSpan={count}
                    className={`border border-black/20 px-2 py-1.5 text-center font-bold ${getGroupClass(group)}`}
                  >
                    {getGroupLabel(group)}
                  </th>
                )
              })}
            </tr>

            <tr>
              {rankColumns.map((column) => (
                <th
                  key={column.id}
                  className={`min-w-[76px] border border-black/20 px-1 py-2 text-center font-semibold ${getGroupClass(column.group)}`}
                >
                  <span className="block whitespace-nowrap">
                    {column.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {authorityRows.map((row, rowIndex) => {
              const showSection = !sectionSeen[row.section]

              if (showSection) {
                sectionSeen[row.section] = true
              }

              return (
                <tr key={`${row.section}-${row.name}-${rowIndex}`}>
                  {showSection ? (
                    <td
                      rowSpan={sectionCounts[row.section]}
                      className="sticky left-0 z-20 min-w-[125px] border border-black/20 bg-[#05054a] px-2 py-3 text-center align-middle text-[11px] font-bold uppercase leading-tight text-white"
                    >
                      <div className="[writing-mode:horizontal-tb]">
                        {row.section}
                      </div>
                    </td>
                  ) : null}

                  <td className="sticky left-[125px] z-10 min-w-[225px] border border-black/20 bg-white px-2 py-1.5 text-left font-medium text-black">
                    {row.name}
                  </td>

                  {rankColumns.map((column) => {
                    const enabled =
                      row.permissions[column.id] === true

                    return (
                      <td
                        key={column.id}
                        className={`border border-black/20 text-center ${getCellClass(column.group)}`}
                      >
                        {enabled ? (
                          <div className="flex items-center justify-center">
                            <div className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-black text-white">
                              <Check
                                className="h-3 w-3"
                                strokeWidth={3}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mx-auto h-4 w-4 rounded-[2px] border-2 border-black/70 bg-transparent" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GoogleDocument({
  url,
  title,
}: {
  url: string
  title: string
}) {
  return (
    <div className="w-full overflow-hidden bg-background">
      <iframe
        key={url}
        src={url}
        title={title}
        className="block h-[800px] w-full border-0"
        loading="lazy"
        allowFullScreen
      />
    </div>
  )
}

export default function CommandDocuments() {
  const [activeTab, setActiveTab] = useState<TabId>(
    "command-authority-matrix",
  )

  const activeTabData =
    tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  const ActiveIcon = activeTabData.icon

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
              <FileText className="h-4 w-4 shrink-0" />
              <span>METRO POLICE DEPARTMENT</span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Command Documents
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Access command authority, guidelines, and screening materials.
            </p>
          </div>

          <div className="mb-5 overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-1 backdrop-blur">
            <div className="flex min-w-max items-center gap-1 lg:min-w-0">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                      "lg:flex-1",
                      active
                        ? "bg-blue-500/10 text-blue-500"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                <ActiveIcon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold sm:text-base">
                  {activeTabData.label}
                </h2>

                <p className="text-xs text-muted-foreground">
                  {activeTab === "command-authority-matrix"
                    ? "Authority Matrix"
                    : activeTabData.url?.includes("presentation")
                      ? "Google Slides"
                      : "Google Sheets"}
                </p>
              </div>
            </div>

            {activeTab === "command-authority-matrix" ? (
              <AuthorityMatrix />
            ) : activeTabData.url ? (
              <GoogleDocument
                url={activeTabData.url}
                title={activeTabData.label}
              />
            ) : null}
          </section>
        </div>

        <Footer />
      </main>
    </div>
  )
}
