import type { ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import DashboardSidebar from "@/components/dashboard/Sidebar"
import DashboardNavbar from "@/components/dashboard/Navbar"
import DashboardFooter from "@/components/dashboard/Footer"

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar />

        <SidebarInset className="min-w-0 min-h-svh flex flex-col">
          <DashboardNavbar />

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col gap-4 p-4">
              {children}
            </div>
          </main>

          <DashboardFooter />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
