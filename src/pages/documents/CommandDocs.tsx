import {
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react"
import { useMemo, useState } from "react"

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
  url: string
}

const tabs: Tab[] = [
  {
    id: "command-authority-matrix",
    label: "Authority Matrix",
    icon: FileSpreadsheet,
    url: "https://docs.google.com/spreadsheets/d/18Io5OdkKsZ9aVDh8I5nsAPjBUISGGM77461K06ziALU/preview",
  },
  {
    id: "command-punishmentguidelines",
    label: "Command Punishment Guidelines",
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

function getEmbedUrl(url: string) {
  if (url.includes("docs.google.com/document/")) {
    const match = url.match(/\/document\/d\/([^/]+)/)

    if (!match) {
      return url
    }

    return `https://docs.google.com/document/d/${match[1]}/preview`
  }

  if (url.includes("docs.google.com/presentation/")) {
    const match = url.match(/\/presentation\/d\/([^/]+)/)

    if (!match) {
      return url
    }

    return `https://docs.google.com/presentation/d/${match[1]}/preview`
  }

  if (url.includes("docs.google.com/spreadsheets/")) {
    const match = url.match(/\/spreadsheets\/d\/([^/]+)/)

    if (!match) {
      return url
    }

    return `https://docs.google.com/spreadsheets/d/${match[1]}/preview`
  }

  return url
}

function getDocumentType(url: string) {
  if (url.includes("presentation")) {
    return "Google Slides"
  }

  if (url.includes("spreadsheets")) {
    return "Google Sheets"
  }

  if (url.includes("document")) {
    return "Google Docs"
  }

  return "Document"
}

export default function CommandDocuments() {
  const [activeTab, setActiveTab] =
    useState<TabId>("command-authority-matrix")

  const activeTabData = useMemo(
    () =>
      tabs.find((tab) => tab.id === activeTab) ??
      tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  const embedUrl = useMemo(
    () => getEmbedUrl(activeTabData.url),
    [activeTabData.url],
  )

  const documentType = getDocumentType(
    activeTabData.url,
  )

  const changeTab = (tabId: TabId) => {
    setActiveTab(tabId)
  }

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
                    onClick={() => changeTab(tab.id)}
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
                  {documentType}
                </p>
              </div>
            </div>

            <div className="w-full overflow-hidden bg-background">
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={activeTabData.label}
                className="block h-[800px] w-full border-0"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </section>
        </div>

        <Footer />
      </main>
    </div>
  )
}
