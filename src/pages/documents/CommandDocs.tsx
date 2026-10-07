import { FileSpreadsheet, FileText, Presentation } from "lucide-react"
import { useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import AuthorityMatrix from "@/components/documents/command/AuthorityMatrix"
import PunishmentGuidelines from "@/components/documents/command/PunishmentGuidelines"
import ScreeningDocument from "@/components/documents/command/ScreeningDocument"

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
  },
  {
    id: "command-supervisorscreening",
    label: "Supervisor Screening",
    icon: Presentation,
    url: "https://docs.google.com/presentation/d/1MZACGzmyCFbdNuouku_dYuqenNl7i-z1kiFtuG_FF58/edit",
  },
  {
    id: "command-commandscreening",
    label: "Command Screening",
    icon: Presentation,
    url: "https://docs.google.com/presentation/d/1Dtg8Ecu6y7abp8TgWtvU6cn4CdqGAos5-7hE13ZB6mg/edit",
  },
]

export default function CommandDocuments() {
  const [activeTab, setActiveTab] = useState<TabId>("command-authority-matrix")

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

          {activeTab === "command-authority-matrix" && <AuthorityMatrix />}
          {activeTab === "command-punishmentguidelines" && <PunishmentGuidelines />}
          {activeTab === "command-supervisorscreening" && (
            <ScreeningDocument
              title="Supervisor Screening"
              url={tabs.find((tab) => tab.id === "command-supervisorscreening")?.url ?? ""}
            />
          )}
          {activeTab === "command-commandscreening" && (
            <ScreeningDocument
              title="Command Screening"
              url={tabs.find((tab) => tab.id === "command-commandscreening")?.url ?? ""}
            />
          )}
        </div>

        <Footer />
      </main>
    </div>
  )
}
