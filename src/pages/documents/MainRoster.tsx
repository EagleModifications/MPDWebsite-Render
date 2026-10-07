import {
  Car,
  Database,
  FileText,
  Shirt,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import DepartmentRoster from "@/components/roster/DepartmentRoster"
import EmployeeDatabase from "@/components/roster/EmployeeDatabase"
import UniformRoster from "@/components/roster/UniformRoster"
import VehicleRoster from "@/components/roster/VehicleRoster"

type TabId =
  | "department"
  | "employees"
  | "vehicles"
  | "uniforms"

type Tab = {
  id: TabId
  label: string
  icon: typeof Users
}

const tabs: Tab[] = [
  {
    id: "department",
    label: "Department Roster",
    icon: Users,
  },
  {
    id: "employees",
    label: "Employee Database",
    icon: Database,
  },
  {
    id: "vehicles",
    label: "Vehicle Roster",
    icon: Car,
  },
  {
    id: "uniforms",
    label: "Uniform Roster",
    icon: Shirt,
  },
]

export default function MainRoster() {
  const [activeTab, setActiveTab] =
    useState<TabId>("department")

  const activeTabData = useMemo(
    () =>
      tabs.find(
        (tab) => tab.id === activeTab,
      ) ?? tabs[0],
    [activeTab],
  )

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
              Main Roster
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Access department personnel, employee,
              vehicle and uniform roster information.
            </p>
          </div>

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
                      setActiveTab(tab.id)
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
                  Metro Police Department roster
                </p>
              </div>
            </div>

            <div className="w-full overflow-hidden bg-background">
              {activeTab === "department" && (
                <DepartmentRoster />
              )}

              {activeTab === "employees" && (
                <EmployeeDatabase />
              )}

              {activeTab === "vehicles" && (
                <VehicleRoster />
              )}

              {activeTab === "uniforms" && (
                <UniformRoster />
              )}
            </div>
          </section>
        </div>

        <Footer />
      </main>
    </div>
  )
}
