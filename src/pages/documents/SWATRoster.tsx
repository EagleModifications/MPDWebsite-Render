import {
  Activity,
  Car,
  FileText,
  Home,
  Shirt,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type TabId =
  | "swat-home"
  | "swat-roster"
  | "swat-vehicles"
  | "swat-uniforms"
  | "mtf7-roster"
  | "swat-activity"

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
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDo_yVusgQRYUpyDhfNnkBrJXPaNXAbSYvfndxC14IcKjVp9-8wDnOCb8_AGCsgRYLNeXyWzgimNuL/pubhtml"

const tabs: Tab[] = [
  {
    id: "swat-home",
    label: "SWAT | Home",
    icon: Home,
    gid: "1932029060",
  },
  {
    id: "swat-roster",
    label: "SWAT | Master Roster",
    icon: Users,
    gid: "1093680513",
  },
  {
    id: "swat-vehicles",
    label: "SWAT | Vehicle Guidelines",
    icon: Car,
    gid: "1772848021",
  },
  {
    id: "swat-uniforms",
    label: "SWAT | Uniform Guidelines",
    icon: Shirt,
    gid: "1693514661",
  },
  {
    id: "mtf7-roster",
    label: "MTF-7 | Master Roster",
    icon: Users,
    gid: "1598052317",
  },
  {
    id: "swat-activity",
    label: "SWAT | Activity & Promotion Guidelines",
    icon: Activity,
    gid: "1693514661",
  },
]

export default function MainRoster() {
  const [activeTab, setActiveTab] =
    useState<TabId>("swat-home")

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
              SWAT
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Access SWAT and MTF-7 rosters, vehicle guidelines,
              uniform guidelines, and activity requirements.
            </p>
          </div>

          {/* Tabs */}
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
