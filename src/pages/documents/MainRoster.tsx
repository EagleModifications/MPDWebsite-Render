import {
  Shield,
  Users,
  Car,
  Shirt,
  Home,
  Database,
} from "lucide-react"
import { useMemo, useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type TabId =
  | "home"
  | "department"
  | "employees"
  | "vehicles"
  | "uniforms"

type Tab = {
  id: TabId
  label: string
  icon: typeof Home
  gid: string
}

/*
 * IMPORTANT:
 *
 * This is the PUBLISHED Google Sheets URL.
 *
 * Do NOT use the normal spreadsheet ID here.
 */
const PUBLISHED_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDo_yVusgQRYUpyDhfNnkBrJXPaNXAbSYvfndxC14IcKjVp9-8wDnOCb8_AGCsgRYLNeXyWzgimNuL/pubhtml"

const tabs: Tab[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    gid: "1932029060",
  },
  {
    id: "department",
    label: "Department Roster",
    icon: Users,
    gid: "1093680513",
  },
  {
    id: "employees",
    label: "Employee Database",
    icon: Database,
    gid: "1598052317",
  },
  {
    id: "vehicles",
    label: "Vehicle Roster",
    icon: Car,
    gid: "1772848021",
  },
  {
    id: "uniforms",
    label: "Uniform Roster",
    icon: Shirt,
    gid: "1693514661",
  },
]

export default function MainRoster() {
  const [activeTab, setActiveTab] =
    useState<TabId>("home")

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

  const ActiveIcon = activeTabData.icon

  /*
   * Google Sheets published embed.
   *
   * gid     = selected worksheet
   * single  = only show selected worksheet
   * widget  = disable widget mode
   * headers = hide Google row/column headers
   * chrome  = hide Google Sheets chrome
   */
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

          {/* ============================================================ */}
          {/* PAGE HEADER                                                   */}
          {/* ============================================================ */}

          <div className="mb-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>

              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500">
                  <Shield className="h-3.5 w-3.5" />

                  METRO POLICE DEPARTMENT
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Main Roster
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  View department personnel,
                  employee, vehicle and uniform
                  roster information.
                </p>
              </div>
            </div>

            {/* ========================================================== */}
            {/* TABS                                                         */}
            {/* ========================================================== */}

            <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-full items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1.5 shadow-sm backdrop-blur sm:min-w-0">
                {tabs.map((tab) => {
                  const active =
                    activeTab === tab.id

                  const Icon = tab.icon

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        changeTab(tab.id)
                      }
                      className={[
                        "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                        active
                          ? "bg-blue-500/10 text-blue-500 shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />

                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* GOOGLE SHEETS CARD                                            */}
          {/* ============================================================ */}

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">

            {/* ---------------------------------------------------------- */}
            {/* CARD HEADER                                                  */}
            {/* ---------------------------------------------------------- */}

            <div className="border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <ActiveIcon className="h-4 w-4 text-blue-500" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-medium">
                    {activeTabData.label}
                  </h2>

                  <p className="truncate text-xs text-muted-foreground">
                    Google Sheets
                  </p>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* GOOGLE SHEET                                                 */}
            {/* ---------------------------------------------------------- */}

            <div className="w-full overflow-x-auto bg-background">
              <iframe
                key={`${activeTabData.id}-${activeTabData.gid}`}
                src={embedUrl}
                title={`${activeTabData.label} Google Sheet`}
                className="block h-[850px] w-full min-w-0 border-0 bg-background"
                frameBorder="0"
                loading="lazy"
              />
            </div>
          </section>
        </div>

        <Footer />
      </main>
    </div>
  )
}
