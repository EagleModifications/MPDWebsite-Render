import {
  Car,
  FileText,
  Home,
  ShieldCheck,
  Shirt,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type TabId =
  | "mcd-hub"
  | "master-roster"
  | "mcd-vehicles"
  | "mcd-uniform"
  | "authority-matrix"

type Tab = {
  id: TabId
  label: string
  icon: typeof Home
  gid: string
}

/*
 * Published Google Sheets URL.
 *
 * This must be the published /pubhtml URL rather than
 * the normal Google Sheets document URL.
 */
const PUBLISHED_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBpebeH0aHV41aXS7amh1FR-OBx_1ytbsBcwoek8MT6dTtT0cXXbhcn1VjaVx8n2yLg4JYoOgPVOkY/pubhtml"

const tabs: Tab[] = [
  {
    id: "mcd-hub",
    label: "MCD | Hub",
    icon: Home,
    gid: "242649467",
  },
  {
    id: "master-roster",
    label: "Master Roster",
    icon: Users,
    gid: "1484490309",
  },
  {
    id: "mcd-vehicles",
    label: "MCD | Vehicle Roster",
    icon: Car,
    gid: "1470630129",
  },
  {
    id: "mcd-uniform",
    label: "MCD | Uniform Guidelines (Male)",
    icon: Shirt,
    gid: "909774973",
  },
  {
    id: "authority-matrix",
    label: "Authority Matrix",
    icon: ShieldCheck,
    gid: "1122608870",
  },
]

export default function MCD() {
  const [activeTab, setActiveTab] =
    useState<TabId>("mcd-hub")

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      gid: activeTabData.gid,
      single: "true",
      widget: "false",
      headers: "false",
      chrome: "false",
    })

    return `${PUBLISHED_SHEET_URL}?${params.toString()}`
  }, [activeTabData.gid])

  function changeTab(tab: TabId) {
    setActiveTab(tab)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {/* Header */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
              <FileText className="h-4 w-4 shrink-0" />

              <span>METRO POLICE DEPARTMENT</span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              MCD
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Access MCD personnel, vehicle, uniform,
              and authority information.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-5 overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-1 backdrop-blur">
            <div className="flex min-w-max items-center gap-1 lg:min-w-0">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active =
                  activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      changeTab(tab.id)
                    }
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

          {/* Google Sheet */}
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            {/* Sheet header */}
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                <ActiveIcon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold sm:text-base">
                  {activeTabData.label}
                </h2>

                <p className="text-xs text-muted-foreground">
                  Google Sheets
                </p>
              </div>
            </div>

            {/* Embedded sheet */}
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
