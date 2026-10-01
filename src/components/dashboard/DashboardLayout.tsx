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

        <SidebarInset className="flex min-h-screen min-w-0 flex-col">
          <DashboardNavbar />

          <main className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </main>

          <DashboardFooter />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
